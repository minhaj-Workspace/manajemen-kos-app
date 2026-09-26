import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { SubmitPenghuniBtn, CheckoutForm } from '@/components/PenghuniClientActions'

// ==========================================
// SERVER ACTIONS (Aman & Logika Mutakhir)
// ==========================================
async function tambahPenghuniAction(formData: FormData) {
  'use server'
  
  // 1. Proteksi Aksi Server
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const nama = formData.get('nama') as string
  const nomorHp = formData.get('nomorHp') as string
  const email = formData.get('email') as string
  const passwordPlain = formData.get('password') as string
  const kamarIdStr = formData.get('kamarId') as string
  const durasiBulanStr = formData.get('durasiBulan') as string
  const tanggalMasukStr = formData.get('tanggalMasuk') as string
  const isAkunUtamaStr = formData.get('isAkunUtama') as string
  const ktpfile = formData.get('ktpfile') as File | null

  if (!nama || !nomorHp || !kamarIdStr) return

  const kamarId = parseInt(kamarIdStr, 10)
  const durasiBulan = durasiBulanStr ? parseInt(durasiBulanStr, 10) : 1
  const tanggalMasuk = tanggalMasukStr ? new Date(tanggalMasukStr) : new Date()
  const isAkunUtama = isAkunUtamaStr === 'true'
  
  try {
    const kamar = await prisma.kamar.findUnique({ where: { id: kamarId } })
    if (!kamar) return

    // 2. Proses Pengunggahan Berkas KTP ke Server (jika ada)
    let ktpUrlToSave = null
    if (ktpfile && ktpfile.size > 0) {
      const bytes = await ktpfile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Buat nama file unik berdasarkan timestamp
      const originalName = ktpfile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `ktp_${Date.now()}_${originalName}`
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'ktp')

      // Pastikan folder direktori upload tersedia
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      const filePath = path.join(uploadDir, fileName)
      fs.writeFileSync(filePath, buffer)
      ktpUrlToSave = `/uploads/ktp/${fileName}`
    }

    await prisma.$transaction(async (tx) => {
      let userIdToLink = null

      // Jika dia bertindak sebagai Akun Utama, buatkan akun login portal & tagihan perdana
      if (isAkunUtama && email && passwordPlain) {
        const existingUser = await tx.user.findUnique({ where: { email } })
        if (!existingUser) {
          const hashedPassword = await bcrypt.hash(passwordPlain, 10)
          const newUser = await tx.user.create({
            data: { email, password: hashedPassword, role: 'TENANT' }
          })
          userIdToLink = newUser.id
        }
      }

      // Buat data penghuni beserta path KTP
      const newPenghuni = await tx.penghuni.create({
        data: {
          nama,
          nomorHp,
          tanggalMasuk: tanggalMasuk,
          userId: userIdToLink,
          kamarId: kamarId,
          isAkunUtama: isAkunUtama,
          ktpUrl: ktpUrlToSave // Menyimpan jalur file scan KTP
        } as any
      })

      // Update status kamar menjadi TERISI
      await tx.kamar.update({
        where: { id: kamarId },
        data: { status: 'TERISI' }
      })

      // Jika dia Akun Utama, buatkan kontrak dan tagihan sewa
      if (isAkunUtama) {
        const kontrakBaru = await tx.kontrak.create({
          data: {
            kamarId: kamarId,
            penghuniId: newPenghuni.id,
            tanggalMulai: tanggalMasuk,
            durasiBulan: durasiBulan,
            status: 'AKTIF'
          }
        })

        await tx.invoice.create({
          data: {
            kamarId: kamarId,
            kontrakId: kontrakBaru.id,
            penghuniId: newPenghuni.id,
            jumlah: kamar.harga * durasiBulan, 
            jatuhTempo: tanggalMasuk,
            status: 'BELUM_LUNAS'
          }
        })
      }
    })

    revalidatePath('/penghuni')
    revalidatePath('/dashboard-operator')
    revalidatePath('/katalog-kamar')
  } catch (error) {
    console.error("Gagal mendaftarkan penghuni:", error)
  }
}

async function checkOutPenghuniAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (userRole !== 'operator' && userRole !== 'owner') throw new Error('Akses ditolak')

  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const kamarIdRaw = formData.get('kamarId') as string
  const kamarId = kamarIdRaw ? parseInt(kamarIdRaw, 10) : null

  if (!penghuniId) return

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Matikan kontrak jika dia punya
      await tx.kontrak.updateMany({
        where: { penghuniId: penghuniId, status: 'AKTIF' },
        data: { status: 'SELESAI' }
      })

      // 2. Putus relasi kamar & hapus status akun utama
      await tx.penghuni.update({
        where: { id: penghuniId },
        data: { kamarId: null, isAkunUtama: false }
      })

      // 3. Logika Kamar Pintar: Cek sisa penghuni di kamar tersebut
      if (kamarId) {
        const sisaPenghuni = await tx.penghuni.count({ where: { kamarId } })
        if (sisaPenghuni === 0) {
          await tx.kamar.update({
            where: { id: kamarId },
            data: { status: 'TERSEDIA' }
          })
        }
      }
    })

    revalidatePath('/penghuni')
    revalidatePath('/dashboard-operator')
    revalidatePath('/katalog-kamar')
  } catch (error) {
    console.error("Gagal proses checkout:", error)
  }
}

// ==========================================
// KOMPONEN HALAMAN (Mobile-First & Tailwind)
// ==========================================
export default async function KelolaPenghuniPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') redirect('/')

  // Ambil SEMUA kamar (baik Tersedia maupun Terisi, agar anggota tambahan bisa dimasukkan ke kamar yang sudah terisi)
  const semuaKamar = await prisma.kamar.findMany({
    orderBy: { nomorKamar: 'asc' }
  })

  const daftarPenghuni = await prisma.penghuni.findMany({
    where: { kamarId: { not: null } },
    include: { kamar: true, user: true },
    orderBy: { tanggalMasuk: 'desc' }
  })

  const formatNoHpToWa = (hp: string) => {
    let clean = hp.replace(/\D/g, '') 
    if (clean.startsWith('0')) clean = '62' + clean.slice(1) 
    return clean
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      
      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Tenant Management</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">Manajemen Penghuni & Onboarding</h1>
          <p className="text-sm text-slate-400 m-0">Kelola registrasi penyewa, penambahan anggota kamar, arsip KTP, dan *check-out*.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shrink-0 w-fit">
          Total Penghuni: <span className="text-emerald-400">{daftarPenghuni.length} Aktif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 items-start">
        
        {/* FORM REGISTRASI / TAMBAH PENGHUNI */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl sticky top-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <span className="text-yellow-500">➕</span> Registrasi / Tambah Penghuni
          </h3>
          <p className="text-xs text-slate-400 mb-5">Daftarkan penyewa utama atau pendamping lengkap dengan berkas KTP.</p>

          <form action={tambahPenghuniAction} method="POST" encType="multipart/form-data" className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nama Lengkap Resmi</label>
              <input type="text" name="nama" required placeholder="Sesuai KTP..." className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nomor HP / WhatsApp Aktif</label>
              <input type="text" name="nomorHp" required placeholder="Contoh: 08123456789" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Status Peran di Kamar</label>
              <select name="isAkunUtama" defaultValue="true" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="true">👑 Penghuni Utama (Pemegang Akun & Penanggung Jawab Tagihan)</option>
                <option value="false">👥 Penghuni Pendamping / Anggota Kamar (Suami/Istri/Rekan)</option>
              </select>
            </div>

            {/* UPLOAD BERKAS KTP */}
            <div>
              <label className="block text-xs font-bold text-sky-400 mb-1.5">Scan / Foto KTP (PDF/JPG/PNG)</label>
              <input type="file" name="ktpfile" accept=".jpg,.jpeg,.png,.pdf" className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2.5 rounded-lg text-xs file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-950 file:text-sky-400 hover:file:bg-sky-900 cursor-pointer" />
              <span className="text-[10px] text-slate-500 mt-1 block">Arsip identitas resmi untuk keamanan data properti.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Durasi Sewa Awal</label>
                <select name="durasiBulan" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="1">1 Bulan</option>
                  <option value="3">3 Bulan</option>
                  <option value="6">6 Bulan</option>
                  <option value="12">1 Tahun</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mulai Masuk</label>
                <input type="date" name="tanggalMasuk" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-1 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-yellow-500 mb-1.5">Email Login Tenant (Opsional untuk Pendamping)</label>
                <input type="email" name="email" placeholder="email@tenant.com (Wajib jika Akun Utama)" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs font-bold text-yellow-500 mb-1.5">Password Awal (Opsional untuk Pendamping)</label>
                <input type="text" name="password" placeholder="Kata sandi portal..." className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none transition-all" />
              </div>
            </div>

            <div className="mt-1">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Alokasi Kamar</label>
              <select name="kamarId" required className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">-- Pilih Kamar (Tersedia / Terisi untuk Pendamping) --</option>
                {semuaKamar.map(k => (
                  <option key={k.id} value={k.id}>
                    Kamar {k.nomorKamar} ({k.tipe}) - Status: {k.status}
                  </option>
                ))}
              </select>
            </div>

            <SubmitPenghuniBtn />
          </form>
        </div>

        {/* DAFTAR PENGHUNI AKTIF */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-1">📋 Daftar Penghuni Aktif</h3>
          <p className="text-xs text-slate-400 mb-5">Daftar seluruh penyewa dan anggota kamar yang aktif.</p>

          <div className="flex flex-col gap-3">
            {daftarPenghuni.map((p: any) => {
              const waNumber = formatNoHpToWa(p.nomorHp)
              const tenantEmail = p.user?.email || 'Tidak Memiliki Akun Portal'
              const nomorKamarInfo = p.kamar?.nomorKamar ? `Kamar ${p.kamar.nomorKamar}` : 'Kamar Kos'
              
              const defaultWaMessage = encodeURIComponent(
                `Halo Kak *${p.nama}* 👋\n\nSelamat datang di hunian kami! Data Anda untuk *${nomorKamarInfo}* telah tercatat dalam sistem.\n\nAkses portal kos melalui link:\n🔗 http://localhost:3000\n\n*Kredensial Login:* ${p.user ? `\n📧 Email: ${tenantEmail}\n🔑 Password: (Sesuai yang diberikan)` : '\n(Anda terdaftar sebagai penghuni pendamping kamar)'}`
              )
              const waLink = `https://wa.me/${waNumber}?text=${defaultWaMessage}`

              return (
                <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-700 transition-colors shadow-lg">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="m-0 text-base font-bold text-white">{p.nama}</h4>
                      <span className="bg-emerald-900/20 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
                        Kamar {p.kamar?.nomorKamar || '-'}
                      </span>
                      {p.isAkunUtama ? (
                        <span className="bg-yellow-900/20 text-yellow-500 border border-yellow-800/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
                          👑 Akun Utama
                        </span>
                      ) : (
                        <span className="bg-sky-900/20 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
                          👥 Pendamping
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">📱 {p.nomorHp}</span>
                      <span className="flex items-center gap-1">✉️ {tenantEmail}</span>
                      {p.ktpUrl ? (
                        <a href={p.ktpUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-bold">
                          📄 Lihat KTP
                        </a>
                      ) : (
                        <span className="text-slate-600">KTP Belum Diunggah</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap sm:justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <a 
                      href={waLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      💬 Kirim Info WA
                    </a>

                    <CheckoutForm penghuniId={p.id} kamarId={p.kamarId} actionFn={checkOutPenghuniAction} />
                  </div>
                </div>
              )
            })}

            {daftarPenghuni.length === 0 && (
              <div className="text-center p-10 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                Belum ada data penghuni aktif di kamar mana pun.
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}