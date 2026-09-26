import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { writeFile } from 'fs/promises'
import path from 'path'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

// ==========================================
// SERVER ACTIONS
// ==========================================

// 1. Action untuk Mengajukan/Mengunggah KTP (Mandiri oleh Tenant)
async function ajukanPembaruanKtpAction(formData: FormData) {
  'use server'
  const file = formData.get('fileKtp') as File
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  if (!file || file.size === 0 || !penghuniId) return
  
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `ktp-req-${penghuniId}-${Date.now()}.${file.name.split('.').pop()}`
  
  // Pastikan direktori public/uploads tersedia
  const uploadDir = path.join(process.cwd(), 'public/uploads')
  await writeFile(path.join(uploadDir, fileName), buffer)
  
  const filePath = `/uploads/${fileName}`

  // Cek apakah penghuni sudah memiliki KTP sebelumnya
  const penghuni = await prisma.penghuni.findUnique({ where: { id: penghuniId } })

  if (!penghuni?.fotoKtp) {
    // Jika KTP benar-benar kosong (Pendaftaran Mandiri), langsung setel sebagai KTP utama
    await prisma.penghuni.update({
      where: { id: penghuniId },
      data: { fotoKtp: filePath }
    })
  } else {
    // Jika sudah ada, masukkan ke tabel persetujuan berkas (Approval System)
    await prisma.persetujuanBerkas.create({
      data: {
        penghuniId: penghuniId,
        fotoKtpBaru: filePath,
        status: 'PENDING'
      }
    })
  }
  
  revalidatePath('/portal-penghuni/profil')
}

// 2. Action untuk Memperbarui Nama Tampilan Akun & No HP
async function updateProfilTenantAction(formData: FormData) {
  'use server'
  const userId = parseInt(formData.get('userId') as string, 10)
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const namaAkun = formData.get('namaAkun') as string
  const nomorHp = formData.get('nomorHp') as string

  if (!userId || !penghuniId) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      namaLengkap: namaAkun ? namaAkun.trim() : null
    }
  })

  await prisma.penghuni.update({
    where: { id: penghuniId },
    data: {
      nomorHp: nomorHp ? nomorHp.trim() : ''
    }
  })

  revalidatePath('/portal-penghuni/profil')
}

// 3. Action untuk Ubah Password Mandiri oleh Tenant
async function updatePasswordAction(formData: FormData) {
  'use server'
  const userIdStr = formData.get('userId') as string
  const passwordBaru = formData.get('passwordBaru') as string

  if (!userIdStr || !passwordBaru || passwordBaru.length < 6) return

  const userId = parseInt(userIdStr, 10)
  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  })

  revalidatePath('/portal-penghuni/profil')
}

// ==========================================
// HALAMAN PENGATURAN / PROFIL TENANT (PRO B2B VERSION)
// ==========================================
export default async function ProfilPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  if (!userId || userRole !== 'TENANT') redirect('/')

  const parsedUserId = parseInt(userId, 10)

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: parsedUserId },
    include: { kamar: true, user: true }
  })
  if (!penghuni) redirect('/')

  const pengajuanAktif = await prisma.persetujuanBerkas.findFirst({
    where: { penghuniId: penghuni.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' }
  })

  const settingsList = await prisma.setting.findMany({
    where: {
      key: { in: ['wifi_ssid', 'wifi_password'] }
    }
  })
  const wifiSsid = settingsList.find(s => s.key === 'wifi_ssid')?.value || 'KosApp_HighSpeed_VIP'
  const wifiPassword = settingsList.find(s => s.key === 'wifi_password')?.value || 'JuaraBersama2026!'

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>TENANT SELF-SERVICE PORTAL</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>⚙️ Pengaturan Akun & Profil Mandiri</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kelola data personal, keamanan kredensial akun, serta akses fasilitas hunian Anda dalam satu tempat terpadu.</p>
        </div>
      </div>

      {/* GRID KONTEN UTAMA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* KOLOM KIRI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KOTAK 1: EDIT DATA AKUN & KONTAK */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              📋 Informasi Personal & Akun
            </h2>

            <form action={updateProfilTenantAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="hidden" name="penghuniId" value={penghuni.id} />
              <input type="hidden" name="userId" value={parsedUserId} />

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Nama Lengkap Resmi (Sesuai Kontrak/KTP)</label>
                <input 
                  type="text" 
                  value={penghuni.nama} 
                  disabled 
                  style={{ width: '100%', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none', cursor: 'not-allowed' }} 
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>*Data hukum resmi tidak dapat diubah sendiri.</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Nama Panggilan / Nama Tampilan Akun</label>
                <input 
                  type="text" 
                  name="namaAkun" 
                  defaultValue={penghuni.user?.namaLengkap || ''} 
                  placeholder="Contoh: Rahmat S." 
                  style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Nomor WhatsApp Aktif</label>
                <input 
                  type="text" 
                  name="nomorHp" 
                  defaultValue={penghuni.nomorHp || ''} 
                  placeholder="Contoh: 081234567890" 
                  style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Kamar Terdaftar</span>
                <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{penghuni.kamar ? `Kamar ${penghuni.kamar.nomorKamar} (${penghuni.kamar.tipe})` : 'Belum Terikat'}</span>
              </div>

              <button 
                type="submit" 
                style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', alignSelf: 'flex-start', marginTop: '4px' }}
              >
                Simpan Perubahan Profil
              </button>
            </form>
          </div>

          {/* KOTAK 2: KEAMANAN AKUN (UBAH PASSWORD) */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#f59e0b' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              🔒 Keamanan & Sandi Akses
            </h2>
            
            <form action={updatePasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="hidden" name="userId" value={parsedUserId} />
              
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Gunakan sandi yang kuat (minimal 6 karakter) untuk mengamankan akses login portal penghuni Anda.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Kata Sandi Baru</label>
                <input 
                  type="password" 
                  name="passwordBaru" 
                  required 
                  placeholder="••••••••" 
                  style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} 
                />
              </div>

              <button 
                type="submit" 
                style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', alignSelf: 'flex-start' }}
              >
                Perbarui Kata Sandi
              </button>
            </form>
          </div>

        </div>

        {/* KOLOM KANAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KOTAK 3: AKSES FASILITAS (WIFI) */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', fontWeight: 'bold' }}>📶 Akses Jaringan Wi-Fi Khusus Penghuni</h2>
            <div style={{ backgroundColor: '#090d16', border: '1px solid #065f46', padding: '16px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 2px 0', color: '#6ee7b7', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>SSID Jaringan</p>
              <p style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>{wifiSsid}</p>
              <p style={{ margin: '0 0 2px 0', color: '#6ee7b7', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Kata Sandi Wi-Fi</p>
              <p style={{ margin: 0, color: '#4ade80', fontSize: '15px', fontFamily: 'monospace', fontWeight: 'bold' }}>{wifiPassword}</p>
            </div>
          </div>

          {/* KOTAK 4: DOKUMEN IDENTITAS (KTP) */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: penghuni.fotoKtp ? '#4ade80' : '#eab308' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', fontWeight: 'bold' }}>📁 Berkas Identitas KTP</h2>
            
            {penghuni.fotoKtp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ backgroundColor: '#090d16', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 2px 0', color: '#4ade80', fontSize: '13px', fontWeight: 'bold' }}>✅ Berkas Terverifikasi</p>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Scan KTP Anda sudah tersimpan di arsip[cite: 10].</p>
                  </div>
                  <a href={penghuni.fotoKtp} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#166534', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>Lihat KTP[cite: 10]</a>
                </div>

                {pengajuanAktif ? (
                  <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}>⏳ Pengajuan Perubahan KTP Sedang Ditinjau[cite: 10]</p>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>Berkas baru Anda sedang menunggu persetujuan dari pengelola/owner kos[cite: 10].</p>
                  </div>
                ) : (
                  <form action={ajukanPembaruanKtpAction} style={{ backgroundColor: '#090d16', border: '1px dashed #334155', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="hidden" name="penghuniId" value={penghuni.id} />
                    <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1' }}>Ingin memperbarui data KTP? Ajukan file baru ke pengelola[cite: 10]:</p>
                    <input type="file" name="fileKtp" accept="image/*" required style={{ backgroundColor: '#1e293b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '11px', border: '1px solid #334155' }} />
                    <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', alignSelf: 'flex-start' }}>Ajukan Pembaruan KTP[cite: 10]</button>
                  </form>
                )}
              </div>
            ) : (
              <form action={ajukanPembaruanKtpAction} style={{ backgroundColor: '#090d16', border: '1px dashed #334155', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="hidden" name="penghuniId" value={penghuni.id} />
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>Unggah foto/scan KTP Anda untuk keperluan validasi hukum sewa:</p>
                <input type="file" name="fileKtp" accept="image/*" required style={{ backgroundColor: '#1e293b', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155' }} />
                <button type="submit" style={{ backgroundColor: '#4ade80', color: '#090d16', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', alignSelf: 'flex-start' }}>Unggah KTP Sekarang</button>
              </form>
            )}
          </div>

          {/* KOTAK 5: PERATURAN KOS */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              📜 Tata Tertib & Peraturan Kos
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontWeight: 'bold' }}>🌙 Kebijakan Jam Malam Tamu</h4>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Tamu non-penghuni/lawan jenis di area kamar maksimal pukul 22.00 WITA demi kenyamanan bersama.</p>
              </div>
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontWeight: 'bold' }}>🧹 Kebersihan & Fasilitas Bersama</h4>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Wajib menjaga kebersihan dapur bersama, membuang sampah pada tempatnya, dan merawat fasilitas unit.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}