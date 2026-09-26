import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SubmitTagihanBtn, HapusTagihanForm } from '@/components/TagihanClientActions'

// ==========================================
// SERVER ACTIONS (Aman & Terintegrasi Enum)
// ==========================================
async function verifyAdminAccess() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (role !== 'operator' && role !== 'owner') throw new Error('Akses ditolak')
}

async function buatTagihanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()

  const kamarId = parseInt(formData.get('kamarId') as string, 10)
  const jumlahStr = formData.get('jumlah') as string
  const jatuhTempo = formData.get('jatuhTempo') as string

  if (!kamarId || !jumlahStr || !jatuhTempo) return

  const jumlah = parseInt(jumlahStr.replace(/\D/g, ''), 10)

  // Logika Presisi: Cari Penghuni Utama di kamar tersebut untuk dibebankan tagihan
  const penghuniTarget = await prisma.penghuni.findFirst({
    where: { kamarId: kamarId, isAkunUtama: true },
    orderBy: { tanggalMasuk: 'desc' }
  })

  // Fallback jika tidak ada akun utama, ambil penghuni manapun yang aktif di kamar itu
  const finalPenghuniId = penghuniTarget?.id || (await prisma.penghuni.findFirst({ where: { kamarId } }))?.id

  if (!finalPenghuniId) {
    console.error("Gagal: Kamar ini tidak memiliki penghuni aktif.")
    return
  }

  // Cari Kontrak Aktif untuk direlasikan
  const kontrakAktif = await prisma.kontrak.findFirst({
    where: { penghuniId: finalPenghuniId, status: 'AKTIF' }
  })

  await prisma.invoice.create({
    data: {
      kamarId: kamarId,
      penghuniId: finalPenghuniId,
      kontrakId: kontrakAktif?.id || null, // Relasi opsional tapi krusial jika ada
      jumlah: jumlah,
      jatuhTempo: new Date(jatuhTempo),
      status: 'BELUM_LUNAS', // Enum Mutakhir
    }
  })

  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

async function hapusTagihanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  
  const id = parseInt(formData.get('idTagihan') as string, 10)
  if (!id) return

  await prisma.invoice.delete({ where: { id } })
  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

// ==========================================
// KOMPONEN HALAMAN (Mobile-First & Tailwind)
// ==========================================
interface PageProps { searchParams: Promise<{ search?: string }> }

export default async function TagihanPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') redirect('/')

  const resolvedSearchParams = await searchParams
  const keyword = resolvedSearchParams.search || ''

  // Ambil kamar dengan status Enum yang benar
  const kamarTerisi = await prisma.kamar.findMany({
    where: { status: 'TERISI' },
    include: { 
      penghuni: { where: { isAkunUtama: true }, take: 1 } 
    },
    orderBy: { nomorKamar: 'asc' }
  })

  // Pencarian global dengan Enum Mutakhir
  const daftarInvoice = await prisma.invoice.findMany({
    where: keyword ? {
      OR: [
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } },
        { penghuni: { nama: { contains: keyword, mode: 'insensitive' } } }
      ]
    } : undefined,
    include: { 
      kamar: true,
      penghuni: true
    },
    orderBy: { createdAt: 'desc' }
  })

  // Kalkulasi Metrik Finansial
  const totalLunas = daftarInvoice
    .filter(inv => inv.status === 'LUNAS')
    .reduce((acc, curr) => acc + curr.jumlah, 0)
    
  const totalMenunggu = daftarInvoice
    .filter(inv => inv.status === 'MENUNGGU_VERIFIKASI')
    .reduce((acc, curr) => acc + curr.jumlah, 0)

  const totalBelumBayar = daftarInvoice
    .filter(inv => inv.status === 'BELUM_LUNAS')
    .reduce((acc, curr) => acc + curr.jumlah, 0)

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      
      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-sky-400 font-bold">Billing & Financial</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">Tagihan & Invoice</h1>
          <p className="text-sm text-slate-400 m-0">
            {keyword ? `Hasil pencarian untuk: "${keyword}"` : 'Kelola siklus pembayaran, terbitkan tagihan otomatis, dan pantau tunggakan.'}
          </p>
        </div>
        {keyword && (
          <Link href="/tagihan" className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
            ✕ Reset Pencarian
          </Link>
        )}
      </div>

      {/* METRIK FINANSIAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">Pendapatan Masuk (Lunas)</p>
          <h2 className="text-2xl font-bold text-white m-0">Rp {totalLunas.toLocaleString('id-ID')}</h2>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">Menunggu Verifikasi</p>
          <h2 className="text-2xl font-bold text-white m-0">Rp {totalMenunggu.toLocaleString('id-ID')}</h2>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">Total Tunggakan</p>
          <h2 className="text-2xl font-bold text-white m-0">Rp {totalBelumBayar.toLocaleString('id-ID')}</h2>
        </div>
      </div>

      {/* GRID KONTEN UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
        
        {/* PANEL KIRI: FORM TERBITKAN TAGIHAN */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl sticky top-6">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
            <span className="text-sky-400">📄</span> Terbitkan Manual
          </h2>
          
          <form action={buatTagihanAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tujuan Penghuni</label>
              <select name="kamarId" required className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none appearance-none">
                <option value="">-- Pilih Kamar / Penghuni --</option>
                {kamarTerisi.map(kamar => {
                  const namaPenghuni = kamar.penghuni && kamar.penghuni.length > 0 ? kamar.penghuni[0].nama : 'Tanpa Nama'
                  return (
                    <option key={kamar.id} value={kamar.id}>
                      Kamar {kamar.nomorKamar} - {namaPenghuni}
                    </option>
                  )
                })}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nominal Tagihan (Rp)</label>
              <input type="number" name="jumlah" required placeholder="1500000" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Jatuh Tempo</label>
              <input type="date" name="jatuhTempo" required className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none [color-scheme:dark]" />
            </div>
            
            <SubmitTagihanBtn />
          </form>
        </div>

        {/* PANEL KANAN: DAFTAR INVOICE */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-white m-0">Daftar Invoice Aktif ({daftarInvoice.length})</h2>
          </div>

          <div className="flex flex-col gap-3">
            {daftarInvoice.length === 0 ? (
              <div className="text-center p-10 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-500 italic m-0">Belum ada riwayat tagihan atau yang cocok dengan pencarian.</p>
              </div>
            ) : (
              daftarInvoice.map((inv) => {
                const isLunas = inv.status === 'LUNAS'
                const isMenunggu = inv.status === 'MENUNGGU_VERIFIKASI'
                
                // Pesan WhatsApp Otomatis
                const rawWa = inv.penghuni?.nomorHp?.replace(/\D/g, '') || ''
                const nomorWa = rawWa.startsWith('0') ? `62${rawWa.substring(1)}` : rawWa
                const pesanWa = encodeURIComponent(`Halo Kak ${inv.penghuni?.nama || 'Penghuni'},\n\nMenginformasikan bahwa tagihan kamar Anda (INV-${inv.id.toString().padStart(4, '0')}) sebesar *Rp ${inv.jumlah.toLocaleString('id-ID')}* telah terbit dan jatuh tempo pada ${new Date(inv.jatuhTempo).toLocaleDateString('id-ID')}.\n\nSilakan cek portal penghuni untuk melakukan pembayaran. Terima kasih! 🙏`)
                const linkWa = `https://wa.me/${nomorWa}?text=${pesanWa}`

                return (
                  <div key={inv.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-slate-700 transition-colors shadow-sm">
                    
                    <div className="flex gap-4 items-start md:items-center">
                      <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-xl shrink-0 shadow-inner">
                        💳
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="m-0 text-sm font-bold text-white">INV-{inv.id.toString().padStart(4, '0')}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border ${
                            isLunas ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' :
                            isMenunggu ? 'bg-yellow-900/20 text-yellow-500 border-yellow-800/50' :
                            'bg-red-900/20 text-red-400 border-red-800/50'
                          }`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 m-0 leading-snug">
                          {inv.penghuni?.nama || 'Tanpa Nama'} (Kamar {inv.kamar?.nomorKamar || '-'})<br/>
                          Tempo: {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t border-slate-800 md:border-0 w-full md:w-auto">
                      <p className={`m-0 text-base font-bold ${isLunas ? 'text-emerald-400' : isMenunggu ? 'text-yellow-500' : 'text-red-400'}`}>
                        Rp {inv.jumlah.toLocaleString('id-ID')}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        {!isLunas && inv.penghuni?.nomorHp && (
                          <a href={linkWa} target="_blank" rel="noopener noreferrer" className="p-2 rounded bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 transition-colors" title="Kirim Tagihan via WA">
                            💬
                          </a>
                        )}
                        <div className="w-[1px] h-6 bg-slate-800 hidden md:block mx-1"></div>
                        <HapusTagihanForm idTagihan={inv.id} actionFn={hapusTagihanAction} />
                      </div>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </main>
  )
}