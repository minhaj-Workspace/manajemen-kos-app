import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ==========================================
// SERVER ACTIONS
// ==========================================

// 1. Update Status Kanban & Integrasi Finansial Otomatis Saat Resolved
async function updateStatusMaintenance(formData: FormData) {
  'use server'
  const idStr = formData.get('maintenanceId') as string
  const statusBaru = formData.get('statusBaru') as string
  const tanggungJawab = formData.get('tanggungJawab') as string || 'Pengelola'

  if (!idStr || !statusBaru) return

  const maintenanceId = parseInt(idStr, 10)

  await prisma.$transaction(async (tx) => {
    // Ambil data maintenance dulu untuk cek biaya dan kamarId
    const existing = await tx.maintenance.findUnique({
      where: { id: maintenanceId }
    })

    if (!existing) return

    // Update status tiket
    await tx.maintenance.update({
      where: { id: maintenanceId },
      data: { 
        status: statusBaru,
        tanggungJawab: statusBaru === 'Resolved' ? tanggungJawab : existing.tanggungJawab
      }
    })

    // JIKA TIKET BERUBAH MENJADI "Resolved" DAN ADA ESTIMASI BIAYA
    // Jalankan aturan Enterprise: Potong Kas Pengelola ATAU Terbitkan Invoice ke Tenant
    if (statusBaru === 'Resolved' && existing.estimasiBiaya && existing.estimasiBiaya > 0) {
      if (tanggungJawab === 'Pengelola') {
        // Catat sebagai pengeluaran operasional maintenance kas kos
        await tx.pengeluaran.create({
          data: {
            kategori: 'Maintenance',
            jumlah: existing.estimasiBiaya,
            keterangan: `Perbaikan Kamar ID ${existing.kamarId} (Selesai): ${existing.deskripsi}`
          }
        })
      } else if (tanggungJawab === 'Tenant') {
        // Cari kontrak aktif di kamar tersebut lalu terbitkan tagihan ekstra
        const kontrakAktif = await tx.kontrak.findFirst({
          where: { kamarId: existing.kamarId, status: 'Aktif' }
        })

        if (kontrakAktif) {
          const tglJatuhTempo = new Date()
          tglJatuhTempo.setDate(tglJatuhTempo.getDate() + 3) // Jatuh tempo 3 hari

          await tx.invoice.create({
            data: {
              kamarId: existing.kamarId,
              kontrakId: kontrakAktif.id,
              jumlah: existing.estimasiBiaya,
              jatuhTempo: tglJatuhTempo,
              status: 'Belum Lunas'
            }
          })
        }
      }
    }
  })

  revalidatePath('/maintenance')
  revalidatePath('/laporan-keuangan')
  revalidatePath('/dashboard-operator')
}

// 2. Buat Tiket Maintenance Baru
async function buatTiketMaintenanceAction(formData: FormData) {
  'use server'
  const kamarIdStr = formData.get('kamarId') as string
  const deskripsi = formData.get('deskripsi') as string
  const kategori = formData.get('kategori') as string

  if (!kamarIdStr || !deskripsi) return

  await prisma.maintenance.create({
    data: {
      kamarId: parseInt(kamarIdStr, 10),
      deskripsi: deskripsi.trim(),
      kategori: kategori || 'Lainnya',
      status: 'Open',
      tanggungJawab: 'Pengelola'
    }
  })

  revalidatePath('/maintenance')
  revalidatePath('/dashboard-operator')
  redirect('/maintenance')
}

// 3. Simpan Estimasi Biaya & Kebijakan Tanggung Jawab
async function simpanEstimasiBiayaAction(formData: FormData) {
  'use server'
  const maintenanceId = parseInt(formData.get('maintenanceId') as string, 10)
  const nominal = parseFloat(formData.get('estimasiBiaya') as string)
  const tanggungJawab = formData.get('tanggungJawab') as string || 'Pengelola'

  if (!maintenanceId || isNaN(nominal)) return

  await prisma.maintenance.update({
    where: { id: maintenanceId },
    data: { 
      estimasiBiaya: nominal,
      tanggungJawab: tanggungJawab
    } 
  })

  revalidatePath('/maintenance')
}

// ==========================================
// KOMPONEN UTAMA: HALAMAN MAINTENANCE
// ==========================================
interface PageProps {
  searchParams: Promise<{ detailId?: string; search?: string; action?: string }>
}

export default async function MaintenancePage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const detailId = resolvedSearchParams.detailId ? parseInt(resolvedSearchParams.detailId, 10) : null
  const keyword = resolvedSearchParams.search || ''
  const isCreatingNew = resolvedSearchParams.action === 'new'

  const daftarKamar = await prisma.kamar.findMany({ orderBy: { nomorKamar: 'asc' } })

  const daftarMaintenance = await prisma.maintenance.findMany({
    where: keyword ? {
      OR: [
        { deskripsi: { contains: keyword, mode: 'insensitive' } },
        { status: { contains: keyword, mode: 'insensitive' } },
        { kategori: { contains: keyword, mode: 'insensitive' } },
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } }
      ]
    } : undefined,
    include: { kamar: true },
    orderBy: { createdAt: 'desc' }
  })

  const tiketOpen = daftarMaintenance.filter(m => m.status === 'Open' || m.status === 'Pending' || m.status === 'Menunggu')
  const tiketTriaged = daftarMaintenance.filter(m => m.status === 'Triaged')
  const tiketProgress = daftarMaintenance.filter(m => m.status === 'In Progress' || m.status === 'Proses' || m.status === 'Dalam Perbaikan')
  const tiketResolved = daftarMaintenance.filter(m => m.status === 'Resolved' || m.status === 'Selesai')
  const tiketCancelled = daftarMaintenance.filter(m => m.status === 'Cancelled' || m.status === 'Dibatalkan')

  const selectedTicket = detailId ? daftarMaintenance.find(m => m.id === detailId) : null

  const getKategoriColor = (kat: string) => {
    switch (kat) {
      case 'Listrik': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' }
      case 'Air & Pipa': return { bg: 'rgba(56, 189, 248, 0.1)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.2)' }
      case 'Fasilitas (AC/Kasur)': return { bg: 'rgba(250, 204, 21, 0.1)', text: '#facc15', border: 'rgba(250, 204, 21, 0.2)' }
      default: return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', fontFamily: 'sans-serif', padding: '24px 30px', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER HALAMAN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Enterprise Asset Control</span>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>Manajemen Tiket Pemeliharaan</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            {keyword ? `Hasil pencarian tiket: "${keyword}"` : 'Pantau perbaikan fasilitas, tentukan kebijakan biaya, dan kelola keluhan.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {keyword && <a href="/maintenance" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>✕ Reset Pencarian</a>}
          <a href="/maintenance?action=new" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }}>+ Tiket Baru</a>
        </div>
      </div>

      {/* KANBAN BOARD 5 KOLOM */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
        
        {/* OPEN */}
        <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#f87171', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Open</span>
            </div>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>{tiketOpen.length}</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {tiketOpen.map(item => (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 'bold' }}>Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>{new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <div><span style={{ backgroundColor: getKategoriColor(item.kategori).bg, color: getKategoriColor(item.kategori).text, border: `1px solid ${getKategoriColor(item.kategori).border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>● {item.kategori}</span></div>
                <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>{item.deskripsi}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <a href={`/maintenance?detailId=${item.id}`} style={{ fontSize: '11px', color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>Detail ↗</a>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}>
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <button type="submit" name="statusBaru" value="Triaged" style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Tinjau →</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TRIAGED */}
        <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#60a5fa', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Triaged</span>
            </div>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>{tiketTriaged.length}</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {tiketTriaged.map(item => (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 'bold' }}>Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <a href={`/maintenance?detailId=${item.id}`} style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none' }}>Detail ↗</a>
                </div>
                <div><span style={{ backgroundColor: getKategoriColor(item.kategori).bg, color: getKategoriColor(item.kategori).text, border: `1px solid ${getKategoriColor(item.kategori).border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>● {item.kategori}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}><input type="hidden" name="maintenanceId" value={item.id} /><button type="submit" name="statusBaru" value="Open" style={{ backgroundColor: 'transparent', color: '#64748b', border: 'none', fontSize: '10px', cursor: 'pointer' }}>← Open</button></form>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}><input type="hidden" name="maintenanceId" value={item.id} /><button type="submit" name="statusBaru" value="In Progress" style={{ backgroundColor: '#1e293b', color: '#facc15', border: '1px solid #334155', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Proses →</button></form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IN PROGRESS */}
        <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#facc15', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>In Progress</span>
            </div>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>{tiketProgress.length}</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {tiketProgress.map(item => (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 'bold' }}>Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <a href={`/maintenance?detailId=${item.id}`} style={{ fontSize: '10px', color: '#facc15', textDecoration: 'none' }}>Detail ↗</a>
                </div>
                <div><span style={{ backgroundColor: getKategoriColor(item.kategori).bg, color: getKategoriColor(item.kategori).text, border: `1px solid ${getKategoriColor(item.kategori).border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>● {item.kategori}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}><input type="hidden" name="maintenanceId" value={item.id} /><button type="submit" name="statusBaru" value="Triaged" style={{ backgroundColor: 'transparent', color: '#64748b', border: 'none', fontSize: '10px', cursor: 'pointer' }}>← Tinjau</button></form>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}>
                    <input type="hidden" name="maintenanceId" value={item.id} />
                    <input type="hidden" name="statusBaru" value="Resolved" />
                    <input type="hidden" name="tanggungJawab" value={item.tanggungJawab} />
                    <button type="submit" style={{ backgroundColor: '#1e293b', color: '#4ade80', border: '1px solid #334155', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Selesai ✓</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RESOLVED */}
        <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Resolved</span>
            </div>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>{tiketResolved.length}</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {tiketResolved.map(item => (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 'bold' }}>Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <a href={`/maintenance?detailId=${item.id}`} style={{ fontSize: '10px', color: '#4ade80', textDecoration: 'none' }}>Detail ↗</a>
                </div>
                <div style={{ fontSize: '11px', color: '#38bdf8' }}>Beban: {item.tanggungJawab === 'Pengelola' ? 'Kas Kos' : 'Tagihan Tenant'} ({item.estimasiBiaya ? `Rp ${item.estimasiBiaya.toLocaleString('id-ID')}` : 'Rp 0'})</div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deskripsi}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <form action={updateStatusMaintenance} style={{ margin: 0 }}><input type="hidden" name="maintenanceId" value={item.id} /><button type="submit" name="statusBaru" value="In Progress" style={{ backgroundColor: 'transparent', color: '#64748b', border: 'none', fontSize: '10px', cursor: 'pointer' }}>← Buka Kembali</button></form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CANCELLED */}
        <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#64748b', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Cancelled</span>
            </div>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>{tiketCancelled.length}</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {tiketCancelled.map(item => (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Kamar {item.kamar?.nomorKamar || 'Umum'}</span>
                  <a href={`/maintenance?detailId=${item.id}`} style={{ fontSize: '10px', color: '#94a3b8', textDecoration: 'none' }}>Detail ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM TAMBAH TIKET BARU */}
      {isCreatingNew && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '480px', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '14px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>➕ Buat Tiket Maintenance Baru</h2>
              <a href="/maintenance" style={{ backgroundColor: '#1e293b', color: '#f87171', border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>✕</a>
            </div>

            <form action={buatTiketMaintenanceAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Kamar / Lokasi</label>
                <select name="kamarId" required style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}>
                  <option value="">-- Pilih Kamar --</option>
                  {daftarKamar.map(k => <option key={k.id} value={k.id}>Kamar {k.nomorKamar} - {k.tipe}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Kategori Kerusakan</label>
                <select name="kategori" required style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}>
                  <option value="Lainnya">Lainnya</option>
                  <option value="Listrik">Listrik & Kelistrikan</option>
                  <option value="Air & Pipa">Air & Saluran Pipa</option>
                  <option value="Fasilitas (AC/Kasur)">Fasilitas (AC/Kasur/Lemari)</option>
                  <option value="Bangunan">Kerusakan Bangunan (Atap/Dinding)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Deskripsi Keluhan</label>
                <textarea name="deskripsi" required rows={4} placeholder="Contoh: Plafon kamar mandi runtuh..." style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical' }}></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <a href="/maintenance" style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Batal</a>
                <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan & Terbitkan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL DETAIL SLIDE-OVER + KEBIJAKAN ENTERPRISE */}
      {selectedTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '480px', backgroundColor: '#090d16', borderLeft: '1px solid #1e293b', height: '100%', padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box', overflowY: 'auto' }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>TICKET ID</span>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', margin: '4px 0 0 0' }}>MNT-{selectedTicket.id.toString().padStart(4, '0')}</h2>
              </div>
              <a href="/maintenance" style={{ backgroundColor: '#1e293b', color: '#f87171', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>✕ Tutup</a>
            </div>

            {/* SEKSI: ESTIMASI BIAYA & KEBIJAKAN ENTERPRISE (PENGELOLA VS TENANT) */}
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '10px', padding: '16px' }}>
              <h4 style={{ fontSize: '13px', color: '#38bdf8', margin: '0 0 12px 0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💰 Kebijakan & Biaya Perbaikan
              </h4>
              
              <div style={{ marginBottom: '14px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#94a3b8' }}>Biaya tercatat & Tanggung Jawab:</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>
                  {selectedTicket.estimasiBiaya ? `Rp ${selectedTicket.estimasiBiaya.toLocaleString('id-ID')}` : 'Belum Ditentukan'} 
                  <span style={{ fontSize: '12px', color: '#38bdf8', marginLeft: '8px' }}>({selectedTicket.tanggungJawab === 'Pengelola' ? 'Beban Kas Kos' : 'Tagihan Tenant'})</span>
                </p>
              </div>

              {/* Form Input Biaya + Pilihan Tanggung Jawab */}
              <form action={simpanEstimasiBiayaAction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="hidden" name="maintenanceId" value={selectedTicket.id} />
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Nominal Biaya (Rp)</label>
                  <input 
                    type="number" 
                    name="estimasiBiaya" 
                    placeholder="Masukkan nominal angka..." 
                    required
                    defaultValue={selectedTicket.estimasiBiaya || ''}
                    style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#38bdf8', marginBottom: '4px', fontWeight: 'bold' }}>Pembebanan Biaya:</label>
                  <select name="tanggungJawab" defaultValue={selectedTicket.tanggungJawab} style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="Pengelola">Ditanggung Pengelola (Potong Kas Kos)</option>
                    <option value="Tenant">Ditagihkan ke Tenant (Terbitkan Invoice)</option>
                  </select>
                </div>

                <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
                  Simpan Perubahan Biaya & Kebijakan
                </button>
              </form>
            </div>

            {/* SEKSI: DESKRIPSI KELUHAN */}
            <div>
              <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Detail Keluhan</h4>
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                  <span style={{ color: '#64748b' }}>Aset / Lokasi:</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>Kamar {selectedTicket.kamar?.nomorKamar || 'Umum'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Deskripsi Kerusakan:</span>
                  <p style={{ color: '#f8fafc', margin: 0, lineHeight: '1.5' }}>{selectedTicket.deskripsi}</p>
                </div>
              </div>
            </div>

            {/* SEKSI: AKSI STATUS KANBAN & PENYELESAIAN (RESOLVED OTOMATIS) */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px dashed #1e293b' }}>
              <h4 style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Opsi Navigasi Kanban</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {['Open', 'Triaged', 'In Progress', 'Resolved'].map(st => (
                  <form key={st} action={updateStatusMaintenance} style={{ margin: 0 }}>
                    <input type="hidden" name="maintenanceId" value={selectedTicket.id} />
                    <input type="hidden" name="statusBaru" value={st} />
                    <input type="hidden" name="tanggungJawab" value={selectedTicket.tanggungJawab} />
                    <button type="submit" style={{ width: '100%', backgroundColor: selectedTicket.status === st ? '#1e293b' : 'transparent', color: selectedTicket.status === st ? '#fff' : '#64748b', border: `1px solid ${selectedTicket.status === st ? '#38bdf8' : '#334155'}`, padding: '10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                      {selectedTicket.status === st ? `✓ ${st}` : `Pindah ke ${st}`}
                    </button>
                  </form>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}