import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { SubmitMaintenanceBtn, KanbanActionBtn } from '@/components/MaintenanceClientActions'

// ==========================================
// SERVER ACTIONS (Aman & Terintegrasi Enum)
// ==========================================
async function updateStatusMaintenance(formData: FormData) {
  'use server'
  
  // 1. Proteksi Otoritas & Ambil ID Pencatat
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  const userIdStr = cookieStore.get('user_id')?.value

  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const idStr = formData.get('maintenanceId') as string
  const statusBaru = formData.get('statusBaru') as string
  const tanggungJawab = formData.get('tanggungJawab') as string || 'Pengelola'

  if (!idStr || !statusBaru) return
  const maintenanceId = parseInt(idStr, 10)

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.maintenance.findUnique({ where: { id: maintenanceId } })
      if (!existing) return

      // Update status dengan penegasan tipe Enum
      await tx.maintenance.update({
        where: { id: maintenanceId },
        data: { 
          status: statusBaru as 'PENDING' | 'DIPROSES' | 'SELESAI' | 'RESOLVED',
          tanggungJawab: statusBaru === 'RESOLVED' ? tanggungJawab : existing.tanggungJawab
        }
      })

      // OTOMATISASI FINANSIAL JIKA RESOLVED
      if (statusBaru === 'RESOLVED' && existing.estimasiBiaya && existing.estimasiBiaya > 0) {
        if (tanggungJawab === 'Pengelola') {
          await tx.pengeluaran.create({
            data: {
              kategori: 'Maintenance',
              jumlah: existing.estimasiBiaya,
              keterangan: `Perbaikan Kamar ID ${existing.kamarId} (Selesai): ${existing.deskripsi.substring(0, 50)}...`,
              dicatatOlehId: userIdStr ? parseInt(userIdStr) : null // Rekam jejak audit
            }
          })
        } else if (tanggungJawab === 'Tenant' && existing.kamarId) {
          // Cari kontrak dengan status Enum yang benar (AKTIF)
          const kontrakAktif = await tx.kontrak.findFirst({
            where: { kamarId: existing.kamarId, status: 'AKTIF' }
          })

          if (kontrakAktif) {
            const tglJatuhTempo = new Date()
            tglJatuhTempo.setDate(tglJatuhTempo.getDate() + 3)

            await tx.invoice.create({
              data: {
                kamarId: existing.kamarId,
                kontrakId: kontrakAktif.id,
                penghuniId: kontrakAktif.penghuniId, // Integrasi relasi mutakhir
                jumlah: existing.estimasiBiaya,
                jatuhTempo: tglJatuhTempo,
                status: 'BELUM_LUNAS' // Enum mutakhir
              }
            })
          }
        }
      }
    })

    revalidatePath('/maintenance')
    revalidatePath('/laporan-keuangan')
  } catch (error) {
    console.error("Gagal update status:", error)
  }
}

async function buatTiketMaintenanceAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const kamarIdStr = formData.get('kamarId') as string
  const deskripsi = formData.get('deskripsi') as string
  const kategori = formData.get('kategori') as string

  if (!kamarIdStr || !deskripsi) return

  await prisma.maintenance.create({
    data: {
      kamarId: parseInt(kamarIdStr, 10),
      deskripsi: deskripsi.trim(),
      kategori: kategori || 'Lainnya',
      status: 'PENDING', // Sesuai Enum Database
      tanggungJawab: 'Pengelola'
    }
  })

  revalidatePath('/maintenance')
  redirect('/maintenance')
}

async function simpanEstimasiBiayaAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const maintenanceId = parseInt(formData.get('maintenanceId') as string, 10)
  const nominal = parseFloat(formData.get('estimasiBiaya') as string)
  const tanggungJawab = formData.get('tanggungJawab') as string || 'Pengelola'

  if (!maintenanceId || isNaN(nominal)) return

  await prisma.maintenance.update({
    where: { id: maintenanceId },
    data: { estimasiBiaya: nominal, tanggungJawab } 
  })
  revalidatePath('/maintenance')
}

// ==========================================
// KOMPONEN HALAMAN (Mobile-First Kanban)
// ==========================================
interface PageProps { searchParams: Promise<{ detailId?: string; search?: string; action?: string }> }

export default async function MaintenancePage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') redirect('/')

  const resolvedSearchParams = await searchParams
  const detailId = resolvedSearchParams.detailId ? parseInt(resolvedSearchParams.detailId, 10) : null
  const keyword = resolvedSearchParams.search || ''
  const isCreatingNew = resolvedSearchParams.action === 'new'

  const daftarKamar = await prisma.kamar.findMany({ orderBy: { nomorKamar: 'asc' } })

  const daftarMaintenance = await prisma.maintenance.findMany({
    where: keyword ? {
      OR: [
        { deskripsi: { contains: keyword, mode: 'insensitive' } },
        { kategori: { contains: keyword, mode: 'insensitive' } },
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } }
      ]
    } : undefined,
    include: { kamar: true },
    orderBy: { createdAt: 'desc' }
  })

  // Pengelompokan berdasarkan Enum Skema yang sesungguhnya (4 Kolom)
  const tiketPending = daftarMaintenance.filter(m => m.status === 'PENDING')
  const tiketProses = daftarMaintenance.filter(m => m.status === 'DIPROSES')
  const tiketSelesai = daftarMaintenance.filter(m => m.status === 'SELESAI')
  const tiketResolved = daftarMaintenance.filter(m => m.status === 'RESOLVED')

  const selectedTicket = detailId ? daftarMaintenance.find(m => m.id === detailId) : null

  const getKategoriColor = (kat: string) => {
    switch (kat) {
      case 'Listrik': return 'bg-red-900/20 text-red-400 border-red-800/50'
      case 'Air & Pipa': return 'bg-sky-900/20 text-sky-400 border-sky-800/50'
      case 'Fasilitas (AC/Kasur)': return 'bg-yellow-900/20 text-yellow-500 border-yellow-800/50'
      default: return 'bg-slate-800/50 text-slate-400 border-slate-700/50'
    }
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6 relative">
      
      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-sky-400 font-bold">Enterprise Asset Control</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">Manajemen Tiket Fasilitas</h1>
          <p className="text-sm text-slate-400">
            {keyword ? `Hasil pencarian tiket: "${keyword}"` : 'Pantau perbaikan fasilitas, tetapkan beban biaya, dan kelola keluhan tenant.'}
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {keyword && (
            <Link href="/maintenance" className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              ✕ Reset
            </Link>
          )}
          <Link href="/maintenance?action=new" className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            + Tiket Baru
          </Link>
        </div>
      </div>

      {/* KANBAN BOARD 4 KOLOM (Responsive Scroll Mobile, Grid Desktop) */}
      <div className="flex overflow-x-auto snap-x snap-mandatory lg:grid lg:grid-cols-4 gap-4 pb-4 custom-scrollbar">
        
        {/* KOLOM 1: PENDING */}
        <div className="min-w-[85vw] md:min-w-[320px] lg:min-w-0 snap-center bg-slate-900 border border-slate-800 rounded-xl flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
              <span className="text-sm font-bold text-white">PENDING</span>
            </div>
            <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">{tiketPending.length}</span>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
            {tiketPending.map(item => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white font-bold">Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getKategoriColor(item.kategori)}`}>
                    {item.kategori}
                  </span>
                </div>
                <p className="text-sm text-slate-300 m-0 leading-relaxed">{item.deskripsi}</p>
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-800">
                  <Link href={`/maintenance?detailId=${item.id}`} className="text-[11px] text-sky-400 font-bold hover:text-sky-300">Detail ↗</Link>
                  <form action={updateStatusMaintenance} className="m-0">
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <input type="hidden" name="statusBaru" value="DIPROSES" />
                    <KanbanActionBtn text="Proses →" colorClass="bg-slate-800 text-white border-slate-700 hover:bg-slate-700" />
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 2: DIPROSES */}
        <div className="min-w-[85vw] md:min-w-[320px] lg:min-w-0 snap-center bg-slate-900 border border-slate-800 rounded-xl flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></span>
              <span className="text-sm font-bold text-white">DIPROSES</span>
            </div>
            <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">{tiketProses.length}</span>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
            {tiketProses.map(item => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white font-bold">Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <Link href={`/maintenance?detailId=${item.id}`} className="text-[10px] text-yellow-500 hover:text-yellow-400">Detail ↗</Link>
                </div>
                <div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getKategoriColor(item.kategori)}`}>{item.kategori}</span>
                </div>
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-800">
                  <form action={updateStatusMaintenance} className="m-0">
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <input type="hidden" name="statusBaru" value="PENDING" />
                    <KanbanActionBtn text="← Batal" colorClass="bg-transparent text-slate-500 border-transparent hover:text-slate-300" />
                  </form>
                  <form action={updateStatusMaintenance} className="m-0">
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <input type="hidden" name="statusBaru" value="SELESAI" />
                    <KanbanActionBtn text="Perbaikan Selesai ✓" colorClass="bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700" />
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 3: SELESAI (Menunggu Konfirmasi Biaya) */}
        <div className="min-w-[85vw] md:min-w-[320px] lg:min-w-0 snap-center bg-slate-900 border border-slate-800 rounded-xl flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span>
              <span className="text-sm font-bold text-white">SELESAI (Review)</span>
            </div>
            <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">{tiketSelesai.length}</span>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
            {tiketSelesai.map(item => (
              <div key={item.id} className="bg-sky-950/20 border border-sky-900/30 rounded-lg p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white font-bold">Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <Link href={`/maintenance?detailId=${item.id}`} className="text-[10px] text-sky-400 hover:text-sky-300">Cek Biaya ↗</Link>
                </div>
                <div className="text-[11px] text-sky-300 bg-sky-900/20 p-2 rounded border border-sky-800/30">
                  Estimasi: <strong className="text-white">{item.estimasiBiaya ? `Rp ${item.estimasiBiaya.toLocaleString('id-ID')}` : 'Belum diset'}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 mt-1">
                  <form action={updateStatusMaintenance} className="m-0 w-full">
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <input type="hidden" name="statusBaru" value="RESOLVED" />
                    <input type="hidden" name="tanggungJawab" value={item.tanggungJawab} />
                    <KanbanActionBtn text="Tutup Tiket (Resolved) ➔" colorClass="w-full bg-sky-600 text-white border-sky-500 hover:bg-sky-500" />
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 4: RESOLVED (Tutup & Terekam Finansial) */}
        <div className="min-w-[85vw] md:min-w-[320px] lg:min-w-0 snap-center bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center rounded-t-xl shrink-0 opacity-70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
              <span className="text-sm font-bold text-slate-300">RESOLVED</span>
            </div>
            <span className="bg-slate-800 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{tiketResolved.length}</span>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 opacity-70 hover:opacity-100 transition-opacity">
            {tiketResolved.map(item => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300 font-bold">Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <Link href={`/maintenance?detailId=${item.id}`} className="text-[10px] text-emerald-500">Detail ↗</Link>
                </div>
                <div className="text-[10px] text-slate-400">
                  Ditanggung: <strong className="text-slate-300">{item.tanggungJawab === 'Pengelola' ? 'Kas Kos' : 'Tenant'}</strong>
                </div>
                <p className="text-xs text-slate-500 m-0 truncate">{item.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM TAMBAH TIKET BARU (MODAL) */}
      {isCreatingNew && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
          <div className="w-full md:w-[500px] bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white m-0">➕ Buat Tiket Baru</h2>
              <Link href="/maintenance" className="bg-slate-800 text-red-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-700">✕</Link>
            </div>
            <form action={buatTiketMaintenanceAction} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Lokasi / Kamar</label>
                <select name="kamarId" required className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500">
                  <option value="">-- Pilih Kamar --</option>
                  {daftarKamar.map(k => <option key={k.id} value={k.id}>Kamar {k.nomorKamar} - {k.tipe}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Kategori Kerusakan</label>
                <select name="kategori" required className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500">
                  <option value="Lainnya">Lainnya</option>
                  <option value="Listrik">Listrik & Kelistrikan</option>
                  <option value="Air & Pipa">Air & Saluran Pipa</option>
                  <option value="Fasilitas (AC/Kasur)">Fasilitas (AC/Kasur/Lemari)</option>
                  <option value="Bangunan">Kerusakan Bangunan (Atap/Dinding)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Deskripsi Detail</label>
                <textarea name="deskripsi" required rows={4} placeholder="Jelaskan kerusakan..." className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500 resize-y"></textarea>
              </div>
              <div className="pt-2">
                <SubmitMaintenanceBtn text="Simpan & Terbitkan Tiket" />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL DETAIL SLIDE-OVER + KEBIJAKAN ENTERPRISE */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end">
          <div className="w-full md:w-[480px] bg-slate-900 border-l border-slate-800 h-full p-5 md:p-8 flex flex-col gap-6 overflow-y-auto shadow-2xl animate-fade-in-right">
            
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 shrink-0">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">TICKET ID</span>
                <h2 className="text-xl font-bold text-white m-0 mt-1">MNT-{selectedTicket.id.toString().padStart(4, '0')}</h2>
              </div>
              <Link href="/maintenance" className="bg-slate-800 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700">✕ Tutup</Link>
            </div>

            {/* SEKSI: ESTIMASI BIAYA & KEBIJAKAN */}
            <div className="bg-sky-950/20 border border-sky-900/40 rounded-xl p-5">
              <h4 className="text-xs text-sky-400 font-bold uppercase mb-4 flex items-center gap-2">💰 Kebijakan & Biaya</h4>
              
              <div className="mb-5">
                <p className="text-[11px] text-slate-400 m-0 mb-1">Tercatat & Tanggung Jawab:</p>
                <p className="text-xl font-bold text-emerald-400 m-0 flex flex-wrap items-center gap-2">
                  {selectedTicket.estimasiBiaya ? `Rp ${selectedTicket.estimasiBiaya.toLocaleString('id-ID')}` : 'Belum Ditentukan'} 
                  <span className="text-[11px] font-normal text-sky-400 bg-sky-900/30 px-2 py-0.5 rounded-full border border-sky-800">
                    {selectedTicket.tanggungJawab === 'Pengelola' ? 'Beban Kas Kos' : 'Tagihan Tenant'}
                  </span>
                </p>
              </div>

              <form action={simpanEstimasiBiayaAction} className="flex flex-col gap-4">
                <input type="hidden" name="maintenanceId" value={selectedTicket.id} />
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Nominal Biaya (Rp)</label>
                  <input type="number" name="estimasiBiaya" required defaultValue={selectedTicket.estimasiBiaya || ''} className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-sky-400 font-bold mb-1.5">Pembebanan Biaya:</label>
                  <select name="tanggungJawab" defaultValue={selectedTicket.tanggungJawab} className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-sky-500 appearance-none">
                    <option value="Pengelola">Ditanggung Pengelola (Potong Kas Kos)</option>
                    <option value="Tenant">Ditagihkan ke Tenant (Terbitkan Invoice)</option>
                  </select>
                </div>
                <SubmitMaintenanceBtn text="Simpan Kebijakan Biaya" />
              </form>
            </div>

            {/* SEKSI: DETAIL KELUHAN */}
            <div>
              <h4 className="text-[11px] text-slate-500 font-bold uppercase mb-3">Detail Keluhan</h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between text-sm border-b border-slate-800 pb-3">
                  <span className="text-slate-500">Lokasi:</span>
                  <span className="text-white font-bold">Kamar {selectedTicket.kamar?.nomorKamar || 'Umum'}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-sm pt-1">
                  <span className="text-slate-500">Deskripsi:</span>
                  <p className="text-slate-300 m-0 leading-relaxed">{selectedTicket.deskripsi}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </main>
  )
}