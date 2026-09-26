import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AddKamarButton, DeleteKamarForm } from '@/components/KamarClientActions'

// ==========================================
// SERVER ACTIONS (Aman & Anti-Crash)
// ==========================================
async function tambahKamarAction(formData: FormData) {
  'use server'
  
  // 1. Proteksi Keamanan Lapis Server
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const nomorKamar = formData.get('nomorKamar') as string
  const tipe = formData.get('tipe') as string
  const harga = parseFloat(formData.get('harga') as string) || 0
  const status = formData.get('status') as string

  if (!nomorKamar) return

  try {
    await prisma.kamar.create({
      data: {
        nomorKamar,
        tipe: tipe || 'Standar',
        harga,
        // PERBAIKAN: Memaksa format teks menjadi kapital sesuai Enum di database
        status: (status ? status.toUpperCase() : 'TERSEDIA') as 'TERSEDIA' | 'BOOKING' | 'TERISI'
      }
    })
    revalidatePath('/edit-kamar')
  } catch (error) {
    console.error("Gagal menambah kamar:", error)
  }
}

async function hapusKamarAction(formData: FormData) {
  'use server'
  
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const id = parseInt(formData.get('id') as string)
  if (isNaN(id)) return

  try {
    // 2. Proteksi Crash: Cek apakah kamar masih ada penghuninya
    const kamarCek = await prisma.kamar.findUnique({ 
      where: { id }, 
      include: { penghuni: true } 
    })

    // Jika kamar terhubung dengan data penghuni aktif, batalkan penghapusan
    if (kamarCek?.penghuni && kamarCek.penghuni.length > 0) {
      console.warn(`Kamar ${kamarCek.nomorKamar} tidak bisa dihapus karena masih terisi.`)
      return 
    }

    await prisma.kamar.delete({ where: { id } })
    revalidatePath('/edit-kamar')
  } catch (error) {
    console.error("Gagal menghapus kamar:", error)
  }
}

// ==========================================
// KOMPONEN HALAMAN (Mobile-First Card Layout)
// ==========================================
export default async function DaftarKamarPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // Ambil data kamar beserta data penghuninya
  const daftarKamar = await prisma.kamar.findMany({
    include: { penghuni: true },
    orderBy: { nomorKamar: 'asc' }
  })

  return (
    <main className="p-4 md:p-8 min-h-screen bg-slate-950 font-sans text-slate-100">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 mb-6">
        <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
          Manajemen Operasional
        </span>
        <h1 className="text-2xl font-bold text-white mt-1 mb-1 flex items-center gap-2">
          <span className="text-yellow-500">🚪</span> Daftar & Pengaturan Kamar
        </h1>
        <p className="text-sm text-slate-400">
          Kelola status unit kamar, fasilitas, dan harga sewa secara real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Kolom Kiri: Daftar Kamar (Format Card List untuk HP) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 pb-3 border-b border-slate-800">
            📋 Daftar Unit Kamar
          </h2>

          <div className="flex flex-col gap-3">
            {daftarKamar.map((kamar) => {
              const isTerisi = kamar.status.toLowerCase() === 'terisi' || kamar.penghuni.length > 0;
              
              return (
                <div 
                  key={kamar.id} 
                  className="flex flex-col md:flex-row justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-lg gap-4 md:items-center hover:border-slate-700 transition-colors"
                >
                  {/* Info Kamar */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-white">Kamar {kamar.nomorKamar}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isTerisi ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                      }`}>
                        {kamar.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {kamar.tipe} • <span className="text-yellow-500/90 font-medium">Rp {kamar.harga?.toLocaleString('id-ID')}</span>/bln
                    </p>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-800 md:border-none">
                    <Link 
                      href={`/edit-kamar/${kamar.id}`}
                      className="flex-1 md:flex-none text-center bg-blue-600/80 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                      Edit Detail
                    </Link>
                    
                    {/* Menggunakan komponen form hapus klien */}
                    <DeleteKamarForm id={kamar.id} hapusAction={hapusKamarAction} />
                  </div>
                </div>
              )
            })}

            {daftarKamar.length === 0 && (
              <div className="text-center p-8 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                Belum ada data kamar terdaftar di sistem.
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Form Tambah Kamar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-xl sticky top-6">
          <h2 className="text-lg font-bold text-white mb-4 pb-3 border-b border-slate-800">
            ➕ Tambah Unit Baru
          </h2>
          
          <form action={tambahKamarAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Nomor Kamar</label>
              <input 
                type="text" 
                name="nomorKamar" 
                required 
                placeholder="Contoh: 101" 
                className="w-full p-3 bg-slate-950 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Tipe / Fasilitas</label>
              <input 
                type="text" 
                name="tipe" 
                placeholder="Contoh: AC / Deluxe" 
                className="w-full p-3 bg-slate-950 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Harga Sewa (Per Bulan)</label>
              <input 
                type="number" 
                name="harga" 
                required 
                placeholder="Contoh: 750000" 
                className="w-full p-3 bg-slate-950 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
              />
            </div>
            
            <div className="pt-2">
              <AddKamarButton />
            </div>
          </form>
        </div>

      </div>
    </main>
  )
}