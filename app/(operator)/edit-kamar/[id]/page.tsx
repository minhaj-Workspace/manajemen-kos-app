import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'

// ==========================================
// SERVER ACTION (Diletakkan di luar komponen)
// ==========================================
async function editKamarAction(formData: FormData) {
  'use server'

  const id = parseInt(formData.get('id') as string)
  const nomorKamar = formData.get('nomorKamar') as string
  const tipe = formData.get('tipe') as string
  const harga = parseFloat(formData.get('harga') as string)
  const status = formData.get('status') as string

  // Update data di database menggunakan Prisma
  await prisma.kamar.update({
    where: { id },
    data: {
      nomorKamar,
      tipe,
      harga,
      status,
    },
  })

  // Disesuaikan dengan rute folder Anda: diarahkan kembali ke /edit-kamar
  redirect('/edit-kamar')
}

// ==========================================
// KOMPONEN UTAMA HALAMAN EDIT KAMAR
// ==========================================
export default async function EditKamarPage({ params }: { params: Promise<{ id: string }> }) {
  // Proteksi Halaman: Izinkan Operator maupun Owner (fleksibel & aman dari case-sensitivity)
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // Tunggu params dari URL (Standar Next.js 15)
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);

  // Ambil data kamar lama berdasarkan ID untuk mengisi form (Pre-fill)
  const kamar = await prisma.kamar.findUnique({
    where: { id },
  })

  if (!kamar) {
    return <main style={{ padding: '40px', color: '#fff', fontFamily: 'sans-serif' }}>Data kamar tidak ditemukan.</main>
  }

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>✏️ Edit Data Kamar</h1>
        {/* Tautan kembali disesuaikan ke /edit-kamar */}
        <Link href="/edit-kamar" style={{ color: '#63b3ed', textDecoration: 'none', fontSize: '14px' }}>
          &larr; Kembali ke Manajemen Kamar
        </Link>
      </div>

      <form action={editKamarAction} style={{ display: 'grid', gap: '15px', background: '#1a202c', padding: '25px', borderRadius: '8px', border: '1px solid #2d3748' }}>
        {/* Input tersembunyi untuk membawa ID */}
        <input type="hidden" name="id" value={kamar.id} />

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#a0aec0' }}>Nomor Kamar</label>
          <input 
            type="text" 
            name="nomorKamar" 
            required 
            defaultValue={kamar.nomorKamar}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#a0aec0' }}>Tipe Kamar</label>
          <input 
            type="text" 
            name="tipe" 
            required 
            defaultValue={kamar.tipe}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#a0aec0' }}>Harga per Bulan (Rp)</label>
          <input 
            type="number" 
            name="harga" 
            required 
            defaultValue={kamar.harga}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#a0aec0' }}>Status</label>
          <select 
            name="status" 
            defaultValue={kamar.status}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff', boxSizing: 'border-box' }}
          >
            <option value="Tersedia">Tersedia</option>
            <option value="Booking">Booking</option>
            <option value="Terisi">Terisi</option>
          </select>
        </div>

        <button 
          type="submit" 
          style={{ 
            backgroundColor: '#ecc94b', 
            color: '#744210', 
            padding: '12px', 
            borderRadius: '4px', 
            border: 'none', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Update Kamar
        </button>
      </form>
    </main>
  )
}