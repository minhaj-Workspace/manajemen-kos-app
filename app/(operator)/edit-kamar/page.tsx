import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Server Action untuk Menambah Kamar Baru
async function tambahKamarAction(formData: FormData) {
  'use server'
  const nomorKamar = formData.get('nomorKamar') as string
  const tipe = formData.get('tipe') as string
  const harga = parseFloat(formData.get('harga') as string) || 0
  const status = formData.get('status') as string

  if (!nomorKamar) return

  await prisma.kamar.create({
    data: {
      nomorKamar,
      tipe: tipe || 'Standar',
      harga,
      status: status || 'TERSEDIA'
    }
  })

  revalidatePath('/edit-kamar')
}

// Server Action untuk Menghapus Kamar
async function hapusKamarAction(formData: FormData) {
  'use server'
  const id = parseInt(formData.get('id') as string)
  if (!id) return

  await prisma.kamar.delete({
    where: { id }
  })

  revalidatePath('/edit-kamar')
}

export default async function DaftarKamarPage() {
  // Proteksi Halaman: Izinkan Operator maupun Owner (fleksibel & aman dari case-sensitivity)
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // Ambil seluruh daftar kamar dari database
  const daftarKamar = await prisma.kamar.findMany({
    include: { penghuni: true },
    orderBy: { nomorKamar: 'asc' }
  })

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#04060b', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header Halaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>MANAJEMEN OPERASIONAL</span>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>🚪 Daftar & Pengaturan Kamar Kos</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kelola status unit kamar, fasilitas, dan harga sewa secara real-time.</p>
        </div>
      </div>

      {/* Grid Konten: Tabel Daftar Kamar & Form Tambah */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Tabel Daftar Kamar */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            📋 Daftar Unit Kamar
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Nomor Kamar</th>
                  <th style={{ padding: '12px 16px' }}>Tipe / Fasilitas</th>
                  <th style={{ padding: '12px 16px' }}>Harga / Bulan</th>
                  <th style={{ padding: '12px 16px' }}>Status Penghuni</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftarKamar.map((kamar) => (
                  <tr key={kamar.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 16px', color: '#f8fafc', fontWeight: 'bold' }}>Kamar {kamar.nomorKamar}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{kamar.tipe || 'Standar'}</td>
                    <td style={{ padding: '12px 16px', color: '#38bdf8' }}>Rp {kamar.harga?.toLocaleString('id-ID') || '0'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        backgroundColor: kamar.status === 'TERISI' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                        color: kamar.status === 'TERISI' ? '#60a5fa' : '#4ade80', 
                        padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' 
                      }}>
                        {kamar.status || 'TERSEDIA'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {/* Tautan menuju folder [id] untuk mengedit kamar spesifik */}
                      <Link 
                        href={`/edit-kamar/${kamar.id}`}
                        style={{ backgroundColor: '#0284c7', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Edit Detail
                      </Link>

                      {/* Tombol Hapus Kamar */}
                      <form action={hapusKamarAction}>
                        <input type="hidden" name="id" value={kamar.id} />
                        <button type="submit" style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Hapus
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {daftarKamar.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      Belum ada data kamar terdaftar di sistem.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Tambah Kamar Baru */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            ➕ Tambah Unit Kamar Baru
          </h2>
          <form action={tambahKamarAction} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Nomor Kamar</label>
              <input type="text" name="nomorKamar" required placeholder="Contoh: 101" style={{ width: '100%', padding: '10px', backgroundColor: '#04060b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Tipe / Fasilitas</label>
              <input type="text" name="tipe" placeholder="Contoh: AC / Deluxe" style={{ width: '100%', padding: '10px', backgroundColor: '#04060b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Harga Sewa (Bulan)</label>
              <input type="number" name="harga" required placeholder="Contoh: 750000" style={{ width: '100%', padding: '10px', backgroundColor: '#04060b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <button type="submit" style={{ width: '100%', backgroundColor: '#10b981', color: '#04060b', padding: '11px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                Simpan Kamar Baru
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}