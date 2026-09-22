import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function KatalogKamarPage() {
  // Proteksi Halaman: Pastikan yang mengakses adalah pengguna yang sudah login dengan role Tenant
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  // Jika belum login atau bukan tenant (aman dari perbedaan huruf besar/kecil)
  if (!userId || userRole !== 'tenant') {
    redirect('/login')
  }

  // Ambil user data untuk menyapa (Opsional tapi bagus untuk UX)
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId, 10) }
  })

  // SOP 2: HANYA menampilkan kamar yang berstatus 'Tersedia'
  const kamarTersedia = await prisma.kamar.findMany({
    where: { status: 'Tersedia' },
    orderBy: { nomorKamar: 'asc' }
  })

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header Katalog Publik */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#fff' }}>
             Katalog Kamar Kos
          </h1>
          <p style={{ color: '#a0aec0', margin: 0, fontSize: '15px' }}>
            Selamat datang, <strong>{user?.email}</strong>! Silakan pilih kamar yang ingin Anda sewa.
          </p>
        </div>

        {/* Tombol Logout Sederhana */}
        <Link 
          href="/login" 
          style={{ backgroundColor: '#e53e3e', color: '#fff', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
        >
          Keluar
        </Link>
      </div>

      {/* Daftar Kamar Tersedia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {kamarTersedia.length === 0 ? (
          <div style={{ padding: '20px', backgroundColor: '#1a202c', borderRadius: '8px', border: '1px solid #2d3748', color: '#718096', fontStyle: 'italic', gridColumn: '1 / -1' }}>
            Mohon maaf, saat ini semua kamar sedang penuh atau tidak ada yang tersedia.
          </div>
        ) : (
          kamarTersedia.map((kamar) => (
            <div 
              key={kamar.id} 
              style={{ 
                border: '1px solid #2d3748', 
                borderRadius: '8px', 
                padding: '25px',
                backgroundColor: '#1a202c',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>
                    Kamar {kamar.nomorKamar}
                  </h2>
                  <span style={{ backgroundColor: '#22543d', color: '#c6f6d5', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    Tersedia
                  </span>
                </div>
                
                <p style={{ margin: '0 0 15px 0', color: '#a0aec0', fontSize: '15px' }}>
                  Tipe: <strong>{kamar.tipe}</strong>
                </p>
                <p style={{ margin: '0 0 20px 0', color: '#63b3ed', fontWeight: 'bold', fontSize: '18px' }}>
                  Rp {kamar.harga.toLocaleString('id-ID')} <span style={{ fontSize: '13px', color: '#718096', fontWeight: 'normal' }}>/ bulan</span>
                </p>
              </div>

              {/* Tombol untuk melanjutkan ke SOP 3 (Pengisian Profil & KTP) */}
              <Link 
                href={`/katalog-kamar/${kamar.id}/booking`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  backgroundColor: '#3182ce',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  transition: 'background-color 0.2s'
                }}
              >
                Pilih Kamar Ini
              </Link>
            </div>
          ))
        )}
      </div>

    </main>
  )
}