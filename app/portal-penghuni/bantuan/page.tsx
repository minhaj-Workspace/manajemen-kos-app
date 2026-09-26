import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'

// ==========================================
// SERVER ACTION (Dengan Dukungan Unggah File Fisik)
// ==========================================
async function ajukanTiketAction(formData: FormData) {
  'use server'
  const kamarId = formData.get('kamarId') as string
  const kategori = formData.get('kategori') as string
  const deskripsi = formData.get('deskripsi') as string
  const fotoFile = formData.get('fotoFile') as File | null

  if (!kamarId || !deskripsi) return

  let fotoUrlToSave = null

  // Proses pengunggahan berkas fisik foto kerusakan ke folder public/uploads/maintenance
  if (fotoFile && fotoFile.size > 0) {
    try {
      const bytes = await fotoFile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const originalName = fotoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `ticket_${Date.now()}_${originalName}`
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'maintenance')

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      const filePath = path.join(uploadDir, fileName)
      fs.writeFileSync(filePath, buffer)
      fotoUrlToSave = `/uploads/maintenance/${fileName}`
    } catch (error) {
      console.error('Gagal mengunggah foto kendala:', error)
    }
  }

  const deskripsiLengkap = kategori ? `[Kategori: ${kategori}] ${deskripsi}` : deskripsi

  await prisma.maintenance.create({
    data: { 
      kamarId: parseInt(kamarId, 10), 
      deskripsi: deskripsiLengkap, 
      status: 'PENDING', // Enum Mutakhir (Menyesuaikan Kanban Operator)
      tanggungJawab: 'Pengelola', 
      ...(fotoUrlToSave ? { fotoUrl: fotoUrlToSave } : {})
    }
  })

  revalidatePath('/portal-penghuni/bantuan')
  revalidatePath('/maintenance')
}

// ==========================================
// KOMPONEN UTAMA BANTUAN PENGHUNI
// ==========================================
export default async function BantuanPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  // Validasi role dengan Enum 'TENANT'
  if (!userId || userRole !== 'TENANT') redirect('/')

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: parseInt(userId, 10) },
    include: { kamar: true }
  })
  
  if (!penghuni) redirect('/')

  let daftarTiket: any[] = []
  if (penghuni.kamarId) {
    daftarTiket = await prisma.maintenance.findMany({
      where: { kamarId: penghuni.kamarId },
      orderBy: { createdAt: 'desc' }
    })
  }

  // Helper Warna Status (Mendukung status operasional Kanban)
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SELESAI':
      case 'RESOLVED':
        return { bg: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: 'rgba(74, 222, 128, 0.3)', label: '✅ Selesai Dikerjakan' }
      case 'IN_PROGRESS':
      case 'PROSES':
        return { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)', label: '🛠️ Sedang Ditangani Teknisi' }
      case 'DISEPAKATI':
      case 'TRIAGED':
        return { bg: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)', label: '🔍 Ditinjau Operator' }
      default:
        return { bg: 'rgba(250, 204, 21, 0.1)', color: '#facc15', border: 'rgba(250, 204, 21, 0.3)', label: '⏳ Menunggu Antrean (Pending)' }
    }
  }

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#eab308', fontWeight: 'bold' }}>HELP & MAINTENANCE PORTAL</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>Lapor Perbaikan & Layanan Kamar</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Ajukan tiket kendala fasilitas dan pantau estimasi penanganan oleh operator/teknisi secara live.</p>
        </div>
        {penghuni.kamar && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', color: '#38bdf8', fontWeight: 'bold' }}>
            Unit Aktif: Kamar {penghuni.kamar.nomorKamar}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* KOLOM KIRI: FORM PENGAJUAN DENGAN UNGGAH BERKAS FISIK */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#eab308' }}></div>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            📝 Form Pelaporan Kendala
          </h2>
          
          {penghuni.kamarId ? (
            <form action={ajukanTiketAction} method="POST" encType="multipart/form-data" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input type="hidden" name="kamarId" value={penghuni.kamarId} />

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Kategori Kerusakan / Fasilitas</label>
                <select 
                  name="kategori" 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="AC / Pendingin">❄️ AC / Pendingin Ruangan</option>
                  <option value="Plumbing / Pipa Air">🚿 Plumbing / Air & Wastafel</option>
                  <option value="Kelistrikan & Lampu">💡 Kelistrikan / Saklar / Lampu</option>
                  <option value="Mebel & Kunci Kamar">🔑 Kunci / Pintu / Lemari / Kasur</option>
                  <option value="Lainnya">⚠️ Kebersihan & Kendala Lainnya</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Detail Kendala Fasilitas</label>
                <textarea 
                  name="deskripsi" 
                  required 
                  rows={4} 
                  placeholder="Jelaskan kendala secara spesifik, misalnya: AC bocor meneteskan air ke lantai sejak semalam..." 
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                ></textarea>
              </div>

              {/* UNGGAH FOTO FISIK (MENGGANTIKAN URL TEKS) */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>Unggah Foto Kerusakan (Opsional)</label>
                <input 
                  type="file" 
                  name="fotoFile" 
                  accept=".jpg,.jpeg,.png"
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#cbd5e1', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Format foto: JPG, JPEG, atau PNG. Langsung pilih dari galeri HP atau komputer Anda.</span>
              </div>

              <button type="submit" style={{ backgroundColor: '#eab308', color: '#000', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-start', transition: '0.2s' }}>
                🚨 Kirim Laporan ke Operator
              </button>
            </form>
          ) : (
            <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
              ⚠️ Anda belum terikat pada kamar aktif untuk mengajukan pemeliharaan. Silakan hubungi pengelola kos.
            </div>
          )}
        </div>

        {/* KOLOM KANAN: RIWAYAT TIKET & PROGRESS LIVE */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            📋 Status Pengerjaan Teknisi ({daftarTiket.length})
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {daftarTiket.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0, padding: '12px 0' }}>Belum ada tiket pemeliharaan yang diajukan.</p>
            ) : (
              daftarTiket.map(t => {
                const badge = getStatusBadge(t.status)

                return (
                  <div key={t.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ color: '#eab308', fontSize: '12px', fontWeight: 'bold' }}>Tiket #{t.id}</span>
                      <span style={{ color: badge.color, fontSize: '11px', backgroundColor: badge.bg, border: `1px solid ${badge.border}`, padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        {badge.label}
                      </span>
                    </div>

                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '13px', lineHeight: '1.5' }}>{t.deskripsi}</p>

                    {/* TAMPILKAN FOTO JIKA ADA */}
                    {t.fotoUrl && (
                      <div>
                        <a href={t.fotoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📷 Lihat Foto Bukti Kerusakan
                        </a>
                      </div>
                    )}

                    {/* METRIK INTEGRASI OPERATOR */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #1e293b', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ color: '#94a3b8' }}>
                        Diajukan: {t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                      </span>
                      {t.estimasiBiaya ? (
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                          Biaya: Rp {t.estimasiBiaya.toLocaleString('id-ID')} ({t.tanggungJawab === 'Pengelola' ? 'Ditanggung Pengelola' : 'Ditagihkan ke Tenant'})
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Biaya: Menunggu Tinjauan</span>
                      )}
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}