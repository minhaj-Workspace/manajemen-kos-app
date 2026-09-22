import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

// ==========================================
// SERVER ACTIONS
// ==========================================

async function tambahPenghuniAction(formData: FormData) {
  'use server'
  const nama = formData.get('nama') as string
  const nomorHp = formData.get('nomorHp') as string
  const email = formData.get('email') as string
  const passwordPlain = formData.get('password') as string
  const kamarIdStr = formData.get('kamarId') as string
  const durasiBulanStr = formData.get('durasiBulan') as string
  const tanggalMasukStr = formData.get('tanggalMasuk') as string

  if (!nama || !nomorHp || !email || !passwordPlain || !kamarIdStr) return

  const kamarId = parseInt(kamarIdStr, 10)
  const durasiBulan = durasiBulanStr ? parseInt(durasiBulanStr, 10) : 1
  const tanggalMasuk = tanggalMasukStr ? new Date(tanggalMasukStr) : new Date()
  
  const hashedPassword = await bcrypt.hash(passwordPlain, 10)

  const kamar = await prisma.kamar.findUnique({ where: { id: kamarId } })
  if (!kamar) return

  await prisma.$transaction(async (tx) => {
    // 1. Buat akun User baru untuk Tenant
    const newUser = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'Tenant'
      }
    })

    // 2. Buat profil Penghuni dengan Tanggal Masuk kustom
    const newPenghuni = await tx.penghuni.create({
      data: {
        nama,
        nomorHp,
        tanggalMasuk: tanggalMasuk,
        userId: newUser.id,
        kamarId: kamarId
      }
    })

    // 3. Ubah status kamar menjadi Terisi
    await tx.kamar.update({
      where: { id: kamarId },
      data: { status: 'Terisi' }
    })

    // 4. Buat Kontrak Aktif berdasarkan durasi sewa
    await tx.kontrak.create({
      data: {
        kamarId: kamarId,
        penghuniId: newPenghuni.id,
        tanggalMulai: tanggalMasuk,
        durasiBulan: durasiBulan,
        status: 'Aktif'
      }
    })

    // 5. Terbitkan Invoice Pembayaran Pertama
    // Jatuh tempo di-set sama dengan tanggal masuk/mulai kontrak
    await tx.invoice.create({
      data: {
        kamarId: kamarId,
        jumlah: kamar.harga * durasiBulan, // Total tagihan disesuaikan durasi sewa di awal
        jatuhTempo: tanggalMasuk,
        status: 'Belum Lunas'
      }
    })
  })

  revalidatePath('/penghuni')
  revalidatePath('/dashboard-operator')
  revalidatePath('/katalog-kamar')
}

// FITUR SOFT CHECK-OUT: Pertahankan riwayat kontrak & invoice, hanya putus relasi kamar
async function checkOutPenghuniAction(formData: FormData) {
  'use server'
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const kamarIdRaw = formData.get('kamarId') as string

  if (!penghuniId) return

  await prisma.$transaction(async (tx) => {
    // 1. Ubah status kontrak aktif menjadi 'Selesai'
    await tx.kontrak.updateMany({
      where: { penghuniId: penghuniId, status: 'Aktif' },
      data: { status: 'Selesai' }
    })

    // 2. Lepaskan ikatan kamar dari penghuni (Soft Checkout)
    // Membutuhkan skema 'kamarId Int?' di tabel Penghuni
    await tx.penghuni.update({
      where: { id: penghuniId },
      data: { kamarId: null } as any // Type assertion opsional untuk bypass TS sementara jika skema blm sinkron
    })

    // 3. Ubah status kamar kembali menjadi 'Tersedia'
    if (kamarIdRaw && kamarIdRaw !== 'null') {
      await tx.kamar.update({
        where: { id: parseInt(kamarIdRaw, 10) },
        data: { status: 'Tersedia' }
      })
    }
  })

  revalidatePath('/penghuni')
  revalidatePath('/dashboard-operator')
  revalidatePath('/katalog-kamar')
}

// ==========================================
// KOMPONEN UTAMA KELOLA PENGHUNI
// ==========================================
export default async function KelolaPenghuniPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  const kamarTersedia = await prisma.kamar.findMany({
    where: { status: 'Tersedia' },
    orderBy: { nomorKamar: 'asc' }
  })

  // Hanya ambil penghuni yang masih menempati kamar (kamarId tidak null)
  const daftarPenghuni = await prisma.penghuni.findMany({
    where: { kamarId: { not: null } },
    include: { kamar: true, user: true },
    orderBy: { tanggalMasuk: 'desc' }
  })

  const formatNoHpToWa = (hp: string) => {
    let clean = hp.replace(/\D/g, '') 
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1) 
    }
    return clean
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER HALAMAN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>TENANT MANAGEMENT</span>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>Manajemen Penghuni & Onboarding</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kelola registrasi penyewa baru, durasi kontrak, dan operasional check-out aman.</p>
        </div>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
          Total Penghuni: <span style={{ color: '#4ade80' }}>{daftarPenghuni.length} Aktif</span>
        </div>
      </div>

      {/* GRID KONTEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* FORM REGISTRASI (DIPERBARUI) */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>➕ Registrasi Penghuni Baru</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>Daftarkan penyewa, alokasikan kamar, dan atur durasi tagihan perdana.</p>

          <form action={tambahPenghuniAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Nama Lengkap Resmi</label>
              <input type="text" name="nama" required placeholder="Sesuai KTP..." style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Nomor HP / WhatsApp Aktif</label>
              <input type="text" name="nomorHp" required placeholder="Contoh: 08123456789" style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Durasi Sewa Awal</label>
                <select name="durasiBulan" required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="1">1 Bulan</option>
                  <option value="3">3 Bulan</option>
                  <option value="6">6 Bulan</option>
                  <option value="12">1 Tahun</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Tanggal Mulai Sewa</label>
                <input type="date" name="tanggalMasuk" defaultValue={new Date().toISOString().split('T')[0]} required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #1e293b', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginBottom: '6px', fontWeight: 'bold' }}>Email Login Tenant</label>
                <input type="email" name="email" required placeholder="email@tenant.com" style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginBottom: '6px', fontWeight: 'bold' }}>Password Awal</label>
                <input type="text" name="password" required placeholder="Kata sandi portal..." style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Alokasi Kamar</label>
              <select name="kamarId" required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">-- Pilih Kamar Tersedia --</option>
                {kamarTersedia.map(k => (
                  <option key={k.id} value={k.id}>Kamar {k.nomorKamar} ({k.tipe}) - Rp {k.harga.toLocaleString('id-ID')} / bln</option>
                ))}
              </select>
            </div>

            <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>
              Simpan & Daftarkan Penghuni
            </button>
          </form>
        </div>

        {/* DAFTAR PENGHUNI AKTIF */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>📋 Daftar Penghuni Aktif</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>Daftar penyewa yang saat ini masih menyewa kamar.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {daftarPenghuni.map((p) => {
              const waNumber = formatNoHpToWa(p.nomorHp)
              const tenantEmail = p.user?.email || '[Email Belum Tersedia]'
              const nomorKamarInfo = p.kamar?.nomorKamar ? `Kamar ${p.kamar.nomorKamar}` : 'Kamar Kos'
              
              const defaultWaMessage = encodeURIComponent(
                `Halo Kak *${p.nama}* 👋\n\nSelamat datang di hunian kami! Akun Portal Penghuni Anda untuk *${nomorKamarInfo}* telah berhasil didaftarkan oleh pengelola.\n\nSilakan akses portal kos melalui link berikut:\n🔗 http://localhost:3000\n\n*Kredensial Login Anda:*\n📧 Email: ${tenantEmail}\n🔑 Password: (Sesuai yang telah diberikan)\n\nSilakan login untuk melihat tagihan, memperbarui data KTP, dan mengakses fasilitas kos. Terima kasih! 🙏`
              )
              const waLink = `https://wa.me/${waNumber}?text=${defaultWaMessage}`

              return (
                <div key={p.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{p.nama}</h4>
                      <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                        Kamar {p.kamar?.nomorKamar || '-'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>📱 {p.nomorHp} • ✉️ {p.user?.email || '-'}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* TOMBOL KIRIM KREDENSIAL VIA WHATSAPP */}
                    <a 
                      href={waLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      💬 Kirim Info Akun WA
                    </a>

                    {/* TOMBOL CHECK-OUT AMAN (Diperbaiki tanpa onSubmit) */}
                    <form action={checkOutPenghuniAction} style={{ margin: 0 }}>
                      <input type="hidden" name="penghuniId" value={p.id} />
                      <input type="hidden" name="kamarId" value={p.kamarId || ''} />
                      <button type="submit" style={{ backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Check-out
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}

            {daftarPenghuni.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                Belum ada data penghuni aktif di kamar mana pun.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}