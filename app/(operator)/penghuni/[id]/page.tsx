import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DetailPenghuniPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Validasi Akses: Izinkan Operator maupun Owner
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // 2. Ambil ID penghuni dari parameter URL yang di-await (standar Next.js 15)
  const resolvedParams = await params
  const penghuniId = parseInt(resolvedParams.id, 10)

  // 3. Ambil data lengkap penghuni beserta relasi kamar, kontrakList, dan user akunnya
  const penghuni = await prisma.penghuni.findUnique({
    where: { id: penghuniId },
    include: {
      kamar: {
        include: {
          kontrakList: {
            where: { penghuniId: penghuniId },
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      user: true
    }
  })

  if (!penghuni) {
    return (
      <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center', color: '#fff' }}>
        <h2>Data penghuni tidak ditemukan.</h2>
        <Link href="/penghuni" style={{ color: '#63b3ed' }}>Kembali ke Daftar Penghuni</Link>
      </main>
    )
  }

  // Ambil riwayat tagihan/invoice yang berkaitan dengan kamar ini (jika ada kamar)
  const daftarInvoice = penghuni.kamarId ? await prisma.invoice.findMany({
    where: { kamarId: penghuni.kamarId },
    orderBy: { createdAt: 'desc' }
  }) : []

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header Halaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#fff' }}>
            👤 Profil Detail Penghuni
          </h1>
          <p style={{ color: '#a0aec0', margin: 0, fontSize: '14px' }}>
            Informasi lengkap identitas, kontrak sewa, dan riwayat tagihan penyewa.
          </p>
        </div>
        
        <Link 
          href="/penghuni" 
          style={{ backgroundColor: '#4a5568', color: '#fff', padding: '10px 14px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}
        >
          ← Kembali ke Daftar Penghuni
        </Link>
      </div>

      {/* Kartu Informasi Utama Penghuni */}
      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', padding: '30px', marginBottom: '25px' }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '20px', borderBottom: '1px solid #2d3748', paddingBottom: '10px' }}>
          {penghuni.nama}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', color: '#cbd5e0', fontSize: '14px' }}>
          <div>
            <p style={{ margin: '0 0 5px 0', color: '#a0aec0' }}>Nomor WhatsApp / HP:</p>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{penghuni.nomorHp}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 5px 0', color: '#a0aec0' }}>Nomor Induk Kependudukan (NIK):</p>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{penghuni.nik || '-'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 5px 0', color: '#a0aec0' }}>Kamar yang Ditempati:</p>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#63b3ed', fontSize: '16px' }}>
              {penghuni.kamar ? `Kamar ${penghuni.kamar.nomorKamar} (${penghuni.kamar.tipe})` : 'Belum menempati kamar (Check-out)'}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 5px 0', color: '#a0aec0' }}>Tanggal Masuk Awal:</p>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>
              {new Date(penghuni.tanggalMasuk).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Riwayat Kontrak Sewa */}
      <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '15px' }}>📄 Riwayat Kontrak Sewa</h3>
      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
        {!penghuni.kamar || !penghuni.kamar.kontrakList || penghuni.kamar.kontrakList.length === 0 ? (
          <p style={{ color: '#718096', fontStyle: 'italic', margin: 0 }}>Belum ada data kontrak aktif tercatat.</p>
        ) : (
          penghuni.kamar.kontrakList.map((ktr: { id: number; durasiBulan: number; tanggalMulai: Date; status: string }) => (
            <div key={ktr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #2d3748' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#fff', fontWeight: 'bold' }}>
                  Durasi: {ktr.durasiBulan} Bulan (Mulai: {new Date(ktr.tanggalMulai).toLocaleDateString('id-ID')})
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#a0aec0' }}>ID Kontrak: #{ktr.id}</p>
              </div>
              <span style={{ 
                padding: '4px 10px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                backgroundColor: ktr.status === 'Aktif' ? '#22543d' : '#744210',
                color: ktr.status === 'Aktif' ? '#c6f6d5' : '#ffe3a8'
              }}>
                {ktr.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Riwayat Tagihan / Invoice Kamar Terkait */}
      <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '15px' }}>💰 Riwayat Tagihan Kamar</h3>
      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e0', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2d3748', color: '#fff', borderBottom: '1px solid #4a5568' }}>
                <th style={{ padding: '12px 15px' }}>ID Invoice</th>
                <th style={{ padding: '12px 15px' }}>Nominal</th>
                <th style={{ padding: '12px 15px' }}>Jatuh Tempo</th>
                <th style={{ padding: '12px 15px' }}>Status Pembayaran</th>
              </tr>
            </thead>
            <tbody>
              {daftarInvoice.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#718096', fontStyle: 'italic' }}>
                    Belum ada tagihan untuk kamar ini.
                  </td>
                </tr>
              ) : (
                daftarInvoice.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #2d3748' }}>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>#{inv.id}</td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#68d391' }}>
                      Rp {inv.jumlah.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '12px 15px', fontSize: '13px', color: '#a0aec0' }}>
                      {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        backgroundColor: inv.status === 'Lunas' ? '#22543d' : '#742a2a',
                        color: inv.status === 'Lunas' ? '#c6f6d5' : '#fed7d7'
                      }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  )
}