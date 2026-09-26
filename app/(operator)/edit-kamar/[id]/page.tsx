import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import SubmitKamarButton from '@/components/SubmitKamarButton'

// ==========================================
// SERVER ACTION (Aman & Tervalidasi)
// ==========================================
async function editKamarAction(formData: FormData) {
  'use server'

  // 1. Validasi Keamanan: Cek otoritas langsung di dalam Action
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    throw new Error('Akses ditolak: Anda tidak memiliki otoritas untuk mengubah data.')
  }

  // 2. Validasi Input: Cegah Error 500 (NaN) dari input yang tidak valid
  const rawId = formData.get('id') as string
  const id = parseInt(rawId)
  const harga = parseFloat(formData.get('harga') as string)
  
  const nomorKamar = formData.get('nomorKamar') as string
  const tipe = formData.get('tipe') as string
  const status = formData.get('status') as string

  if (isNaN(id) || isNaN(harga)) {
    throw new Error('Validasi gagal: ID atau Harga tidak valid.')
  }

  try {
    // 3. Eksekusi Database yang dilindungi try-catch
    await prisma.kamar.update({
      where: { id },
      data: { 
        nomorKamar, 
        tipe, 
        harga, 
        // PERBAIKAN: Memaksa format teks menjadi kapital sesuai Enum di database
        status: (status ? status.toUpperCase() : 'TERSEDIA') as 'TERSEDIA' | 'BOOKING' | 'TERISI'
      },
    })
  } catch (error) {
    console.error("Database Update Error:", error)
    throw new Error('Gagal memperbarui data di database.')
  }

  // 4. Hapus Cache Lama: Pastikan pengguna melihat data terbaru
  revalidatePath('/edit-kamar')
  redirect('/edit-kamar')
}

// ==========================================
// KOMPONEN HALAMAN (Mobile-First dengan Tailwind)
// ==========================================
export default async function EditKamarPage({ params }: { params: Promise<{ id: string }> }) {
  // Proteksi Tampilan Halaman
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // Resolusi Params (Next.js 15) & Jaring Pengaman ID
  const resolvedParams = await params
  const id = parseInt(resolvedParams.id)

  if (isNaN(id)) {
    return (
      <main className="p-4 max-w-lg mx-auto mt-10">
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg text-center">
          Kesalahan URL: ID Kamar tidak valid.
        </div>
      </main>
    )
  }

  // Ambil data (Pre-fill) dengan proteksi error
  let kamar
  try {
    kamar = await prisma.kamar.findUnique({ where: { id } })
  } catch (error) {
    return (
      <main className="p-4 max-w-lg mx-auto mt-10">
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg text-center">
          Gagal terhubung ke database. Coba lagi nanti.
        </div>
      </main>
    )
  }

  if (!kamar) {
    return (
      <main className="p-4 max-w-lg mx-auto mt-10">
        <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 p-4 rounded-lg text-center">
          Data kamar tidak ditemukan.
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto font-sans text-gray-100">
      
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold m-0">✏️ Edit Data Kamar</h1>
        <Link 
          href="/edit-kamar" 
          className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
        >
          &larr; Kembali ke Manajemen
        </Link>
      </div>

      <form 
        action={editKamarAction} 
        className="grid gap-5 bg-gray-800 p-5 md:p-8 rounded-xl border border-gray-700 shadow-2xl"
      >
        <input type="hidden" name="id" value={kamar.id} />

        <div>
          <label className="block mb-2 font-semibold text-sm text-gray-400">Nomor Kamar</label>
          <input 
            type="text" 
            name="nomorKamar" 
            required 
            defaultValue={kamar.nomorKamar}
            className="w-full p-3 rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-sm text-gray-400">Tipe Kamar</label>
          <input 
            type="text" 
            name="tipe" 
            required 
            defaultValue={kamar.tipe}
            className="w-full p-3 rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-sm text-gray-400">Harga per Bulan (Rp)</label>
          <input 
            type="number" 
            name="harga" 
            required 
            defaultValue={kamar.harga}
            className="w-full p-3 rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-sm text-gray-400">Status</label>
          <select 
            name="status" 
            defaultValue={kamar.status}
            className="w-full p-3 rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all appearance-none"
          >
            {/* PERBAIKAN: Value diubah menjadi huruf kapital agar langsung selaras dengan Enum database */}
            <option value="TERSEDIA">Tersedia</option>
            <option value="BOOKING">Booking</option>
            <option value="TERISI">Terisi</option>
          </select>
        </div>

        <div className="pt-2">
          <SubmitKamarButton />
        </div>
      </form>
    </main>
  )
}