import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function PengumumanPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  // Proteksi Akses: Hanya Tenant
  if (!userId || userRole !== 'tenant') redirect('/')
  const idUser = parseInt(userId, 10)

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: idUser },
    include: { kamar: true }
  })

  if (!penghuni) redirect('/')

  // Ambil daftar pengumuman dari database (dengan fallback data jika tabel belum dimigrasi)
  let daftarPengumuman: any[] = []
  try {
    // @ts-ignore
    daftarPengumuman = await prisma.pengumuman.findMany({
      orderBy: { createdAt: 'desc' }
    })
  } catch (e) {
    // Fallback data pengumuman standar apabila tabel database belum diinisialisasi
    daftarPengumuman = [
      {
        id: 1,
        judul: '🧹 Jadwal Pembersihan Tandon & Area Bersama',
        kategori: 'Maintenance',
        prioritas: 'Penting',
        createdAt: new Date(),
        isi: 'Diberitahukan kepada seluruh penghuni kos bahwa pembersihan tandon air dan perawatan fasilitas bersama akan dilaksanakan pada hari Rabu pukul 09.00 WITA. Mohon pastikan pintu kamar terkunci dengan aman saat beraktivitas.'
      },
      {
        id: 2,
        judul: '💡 Informasi Batas Akhir Pengiriman Bukti Bayar Sewa',
        kategori: 'Keuangan',
        prioritas: 'Informasi',
        createdAt: new Date(Date.now() - 86400000 * 2),
        isi: 'Pengingat bagi seluruh penghuni agar melakukan pembayaran sewa bulanan dan mengunggah bukti transfer melalui menu Keuangan sebelum tanggal 5 setiap bulannya untuk menghindari penundaan verifikasi.'
      }
    ]
  }

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#eab308', fontWeight: 'bold' }}>SMART BROADCAST & ANNOUNCEMENT</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>📢 Papan Pengumuman Kos</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Informasi resmi, jadwal pemeliharaan, dan pengumuman penting dari pengelola untuk seluruh penghuni.</p>
        </div>
        {penghuni.kamar && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', color: '#eab308', fontWeight: 'bold' }}>
            Kamar {penghuni.kamar.nomorKamar}
          </div>
        )}
      </div>

      {/* DAFTAR KARTU PENGUMUMAN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '850px' }}>
        {daftarPengumuman.length === 0 ? (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Belum ada pengumuman aktif saat ini.
          </div>
        ) : (
          daftarPengumuman.map((item) => {
            const isPenting = item.prioritas?.toLowerCase() === 'penting'
            
            return (
              <div key={item.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: isPenting ? '#f87171' : '#eab308' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                      {item.kategori || 'Umum'}
                    </span>
                    {isPenting && (
                      <span style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                        ⚠️ Pengumuman Penting
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                    {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <h2 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 'bold' }}>
                  {item.judul}
                </h2>

                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                  {item.isi}
                </p>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}