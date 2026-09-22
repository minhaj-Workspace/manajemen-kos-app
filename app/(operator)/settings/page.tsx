import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

// ==========================================
// ENTERPRISE SERVER ACTIONS
// ==========================================

async function updateSettingAction(formData: FormData) {
  'use server'
  const key = formData.get('key') as string
  const value = formData.get('value') as string
  if (!key) return

  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  })

  revalidatePath('/settings')
}

async function updateProfileAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userId = parseInt(cookieStore.get('user_id')?.value || '0')
  if (!userId) return

  const namaLengkap = formData.get('namaLengkap') as string
  const nomorHp = formData.get('nomorHp') as string
  const fotoProfil = formData.get('fotoProfil') as string

  await prisma.user.update({
    where: { id: userId },
    data: {
      namaLengkap: namaLengkap || null,
      nomorHp: nomorHp || null,
      fotoProfil: fotoProfil || null,
    }
  })

  revalidatePath('/settings')
}

async function changePasswordAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userId = parseInt(cookieStore.get('user_id')?.value || '0')
  if (!userId) return

  const passwordBaru = formData.get('passwordBaru') as string
  if (!passwordBaru || passwordBaru.length < 6) return

  const hashed = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed }
  })

  revalidatePath('/settings')
}

async function requestRoleChangeAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const currentUserId = parseInt(cookieStore.get('user_id')?.value || '0')
  const currentUserRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  
  const targetUserId = parseInt(formData.get('userId') as string)
  const targetRole = formData.get('targetRole') as string

  if (!targetUserId || !targetRole || !currentUserId) return

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) return

  if (currentUserRole === 'operator' && targetUser.role.toLowerCase() === 'owner') {
    return 
  }

  await prisma.persetujuanRole.create({
    data: {
      userId: targetUserId,
      targetRole: targetRole,
      requestedBy: currentUserId,
      status: 'PENDING'
    }
  })

  revalidatePath('/settings')
}

async function approveRoleChangeAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'owner') return

  const requestId = parseInt(formData.get('requestId') as string)
  const userId = parseInt(formData.get('userId') as string)
  const targetRole = formData.get('targetRole') as string

  if (!requestId || !userId || !targetRole) return

  await prisma.user.update({
    where: { id: userId },
    data: { role: targetRole }
  })

  await prisma.persetujuanRole.update({
    where: { id: requestId },
    data: { status: 'APPROVED' }
  })

  revalidatePath('/settings')
}

async function rejectRoleChangeAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'owner') return

  const requestId = parseInt(formData.get('requestId') as string)
  if (!requestId) return

  await prisma.persetujuanRole.update({
    where: { id: requestId },
    data: { status: 'REJECTED' }
  })

  revalidatePath('/settings')
}

async function deleteUserAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const currentUserRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  const userId = parseInt(formData.get('userId') as string)
  if (!userId) return

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return

  if (currentUserRole === 'operator' && targetUser.role.toLowerCase() === 'owner') {
    return
  }

  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/settings')
}

async function approveKtpAction(formData: FormData) {
  'use server'
  const reqId = parseInt(formData.get('reqId') as string, 10)
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const fotoKtpBaru = formData.get('fotoKtpBaru') as string

  if (!reqId || !penghuniId || !fotoKtpBaru) return

  await prisma.penghuni.update({
    where: { id: penghuniId },
    data: { fotoKtp: fotoKtpBaru }
  })

  await prisma.persetujuanBerkas.update({
    where: { id: reqId },
    data: { status: 'APPROVED' }
  })

  revalidatePath('/settings')
}

async function rejectKtpAction(formData: FormData) {
  'use server'
  const reqId = parseInt(formData.get('reqId') as string, 10)
  if (!reqId) return

  await prisma.persetujuanBerkas.update({
    where: { id: reqId },
    data: { status: 'REJECTED' }
  })

  revalidatePath('/settings')
}

// Server Action Baru: Buat Pengumuman / Broadcast
async function buatPengumumanAction(formData: FormData) {
  'use server'
  const judul = formData.get('judul') as string
  const kategori = formData.get('kategori') as string
  const prioritas = formData.get('prioritas') as string
  const isi = formData.get('isi') as string

  if (!judul || !isi) return

  await prisma.pengumuman.create({
    data: {
      judul,
      kategori: kategori || 'Umum',
      prioritas: prioritas || 'Informasi',
      isi
    }
  })

  revalidatePath('/settings')
  revalidatePath('/portal-penghuni/pengumuman')
}

// Server Action Baru: Hapus Pengumuman
async function hapusPengumumanAction(formData: FormData) {
  'use server'
  const pengumumanId = parseInt(formData.get('pengumumanId') as string, 10)
  if (!pengumumanId) return

  await prisma.pengumuman.delete({
    where: { id: pengumumanId }
  })

  revalidatePath('/settings')
  revalidatePath('/portal-penghuni/pengumuman')
}

// ==========================================
// ENTERPRISE SETTINGS PAGE COMPONENT
// ==========================================
export default async function SettingPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRoleRaw = cookieStore.get('user_role')?.value || ''
  const userRole = userRoleRaw.trim().toLowerCase()

  if (!userId || (userRole !== 'operator' && userRole !== 'owner')) {
    redirect('/')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: parseInt(userId) }
  })

  const settingsList = await prisma.setting.findMany()
  const hotlineSetting = settingsList.find(s => s.key === 'hotline_darurat')?.value || ''
  const ownerNameSetting = settingsList.find(s => s.key === 'nama_owner')?.value || 'Pengelola Kos'
  const propertyNameSetting = settingsList.find(s => s.key === 'nama_properti')?.value || 'Gau Deceng Property'

  const wifiSsidSetting = settingsList.find(s => s.key === 'wifi_ssid')?.value || 'KosApp_HighSpeed_VIP'
  const wifiPasswordSetting = settingsList.find(s => s.key === 'wifi_password')?.value || 'JuaraBersama2026!'

  const users = await prisma.user.findMany({
    include: { penghuni: { include: { kamar: true } } },
    orderBy: { createdAt: 'desc' }
  })

  const pendingRequests = userRole === 'owner' ? await prisma.persetujuanRole.findMany({
    where: { status: 'PENDING' },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  }) : []

  const pendingKtpRequests = await prisma.persetujuanBerkas.findMany({
    where: { status: 'PENDING' },
    include: { penghuni: { include: { kamar: true } } },
    orderBy: { createdAt: 'desc' }
  })

  // Ambil daftar pengumuman yang sudah pernah dibuat
  let daftarPengumuman: any[] = []
  try {
    // @ts-ignore
    daftarPengumuman = await prisma.pengumuman.findMany({
      orderBy: { createdAt: 'desc' }
    })
  } catch (e) {
    daftarPengumuman = []
  }

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ENTERPRISE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#10b981', fontWeight: 'bold' }}>ENTERPRISE CONTROL PANEL</span>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>SECURE v2.4</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>⚙️ Pengaturan Sistem & Manajemen Broadcast</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kelola identitas properti, keamanan kredensial, jaringan Wi-Fi, papan pengumuman penghuni, dan tata kelola hak akses.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* KOTAK PERSETUJUAN BERKAS KTP TENANT */}
        {pendingKtpRequests.length > 0 && (
          <div style={{ backgroundColor: '#064e3b', border: '1px solid #047857', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', color: '#34d399', margin: '0 0 16px 0', borderBottom: '1px solid #047857', paddingBottom: '12px', fontWeight: 'bold' }}>
              📁 Permintaan Verifikasi Pembaruan KTP ({pendingKtpRequests.length} Penghuni Menunggu ACC)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingKtpRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#022c22', padding: '14px 16px', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ fontSize: '13px' }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#fff' }}>
                      {req.penghuni.nama} {req.penghuni.kamar ? `(Kamar ${req.penghuni.kamar.nomorKamar})` : ''}
                    </p>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Mengajukan pembaruan dokumen identitas KTP.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a href={req.fotoKtpBaru} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#0284c7', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none' }}>
                      Lihat KTP Baru
                    </a>
                    
                    <form action={approveKtpAction}>
                      <input type="hidden" name="reqId" value={req.id} />
                      <input type="hidden" name="penghuniId" value={req.penghuniId} />
                      <input type="hidden" name="fotoKtpBaru" value={req.fotoKtpBaru} />
                      <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Setujui (ACC)
                      </button>
                    </form>

                    <form action={rejectKtpAction}>
                      <input type="hidden" name="reqId" value={req.id} />
                      <button type="submit" style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Tolak
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KOTAK KHUSUS OWNER: NOTIFIKASI PERSETUJUAN */}
        {userRole === 'owner' && pendingRequests.length > 0 && (
          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #312e81', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', color: '#818cf8', margin: '0 0 16px 0', borderBottom: '1px solid #312e81', paddingBottom: '12px', fontWeight: 'bold' }}>
              🔔 Kotak Persetujuan Akses ({pendingRequests.length} Permintaan Menunggu ACC)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#312e81', padding: '12px 16px', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '13px' }}>
                    Akun <span style={{ fontWeight: 'bold', color: '#fff' }}>{req.user.email}</span> mengajukan perubahan role ke <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{req.targetRole}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <form action={approveRoleChangeAction}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="userId" value={req.userId} />
                      <input type="hidden" name="targetRole" value={req.targetRole} />
                      <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Setujui (ACC)
                      </button>
                    </form>
                    <form action={rejectRoleChangeAction}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <button type="submit" style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Tolak
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRID PENGATURAN PROFIL, KEAMANAN, & KONFIGURASI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* 1. PROFIL PENGGUNA */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              👤 Identitas & Foto Profil
            </h2>

            {currentUser && (
              <form action={updateProfileAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#1e293b', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                    {currentUser.fotoProfil ? (
                      <img src={currentUser.fotoProfil} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (currentUser.namaLengkap ? currentUser.namaLengkap[0] : currentUser.email[0]).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{currentUser.role} Account</span>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{currentUser.email}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>URL Foto Profil / Avatar (Opsional)</label>
                  <input type="url" name="fotoProfil" defaultValue={currentUser.fotoProfil || ''} placeholder="https://contoh.com/foto.jpg" style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Nama Lengkap</label>
                  <input type="text" name="namaLengkap" defaultValue={currentUser.namaLengkap || ''} placeholder="Nama lengkap Anda" style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Nomor Telepon / WhatsApp</label>
                  <input type="text" name="nomorHp" defaultValue={currentUser.nomorHp || ''} placeholder="Contoh: 081234567890" style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
                  Simpan Profil
                </button>
              </form>
            )}
          </div>

          {/* 2. KEAMANAN & UBAH PASSWORD */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#f59e0b' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              🔒 Keamanan & Sandi Akses
            </h2>

            <form action={changePasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan sistem operasional kos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Kata Sandi Baru (Min. 6 Karakter)</label>
                <input type="password" name="passwordBaru" required placeholder="••••••••" style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '24px' }}>
                Perbarui Sandi
              </button>
            </form>
          </div>

          {/* 3. KONFIGURASI PROPERTI */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              🏢 Konfigurasi Properti Global
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <form action={updateSettingAction} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="hidden" name="key" value="nama_properti" />
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Nama Bisnis / Properti</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="value" defaultValue={propertyNameSetting} required style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                  <button type="submit" style={{ backgroundColor: '#0ea5e9', color: '#090d16', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                </div>
              </form>

              <form action={updateSettingAction} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="hidden" name="key" value="hotline_darurat" />
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Hotline Darurat WhatsApp</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="value" defaultValue={hotlineSetting} required placeholder="62812..." style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                  <button type="submit" style={{ backgroundColor: '#0ea5e9', color: '#090d16', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                </div>
              </form>

              <form action={updateSettingAction} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="hidden" name="key" value="nama_owner" />
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Nama Pemilik / Penanggung Jawab</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="value" defaultValue={ownerNameSetting} required style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                  <button type="submit" style={{ backgroundColor: '#0ea5e9', color: '#090d16', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                </div>
              </form>
            </div>
          </div>

          {/* 4. KONFIGURASI JARINGAN WI-FI */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              📶 Konfigurasi Jaringan Wi-Fi Penghuni
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <form action={updateSettingAction} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="hidden" name="key" value="wifi_ssid" />
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>SSID Nama Jaringan Wi-Fi</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="value" defaultValue={wifiSsidSetting} required style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                  <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                </div>
              </form>

              <form action={updateSettingAction} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="hidden" name="key" value="wifi_password" />
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Kata Sandi Wi-Fi</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" name="value" defaultValue={wifiPasswordSetting} required style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
                  <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                </div>
              </form>
            </div>
          </div>

        </div>

        {/* 5. MANAJEMEN PENGUMUMAN & BROADCAST (FITUR BARU TERINTEGRASI) */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            📢 Buat & Kelola Pengumuman Penghuni (Smart Broadcast)
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Form Buat Pengumuman */}
            <form action={buatPengumumanAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' }}>Kirim Broadcast Baru ke Portal Tenant</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Judul Pengumuman</label>
                <input type="text" name="judul" required placeholder="Contoh: Jadwal Pembersihan Tandon Air" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Kategori</label>
                  <select name="kategori" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="Umum">Umum</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Prioritas</label>
                  <select name="prioritas" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                    <option value="Informasi">Informasi</option>
                    <option value="Penting">⚠️ Penting</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Isi Pesan / Informasi</label>
                <textarea name="isi" required rows={3} placeholder="Tuliskan isi pengumuman secara lengkap di sini..." style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none', resize: 'vertical' }}></textarea>
              </div>

              <button type="submit" style={{ backgroundColor: '#eab308', color: '#000', border: 'none', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🚀 Publikasikan Pengumuman
              </button>
            </form>

            {/* Daftar Arsip Pengumuman */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>Riwayat Pengumuman Aktif ({daftarPengumuman.length})</p>
              
              {daftarPengumuman.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>Belum ada pengumuman yang dipublikasikan.</p>
              ) : (
                daftarPengumuman.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', backgroundColor: '#1e293b', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{item.kategori}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#fff' }}>{item.judul}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>{item.isi.substring(0, 90)}...</p>
                    </div>
                    
                    <form action={hapusPengumumanAction}>
                      <input type="hidden" name="pengumumanId" value={item.id} />
                      <button type="submit" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Hapus
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

        {/* 6. MANAJEMEN AKUN & OTORITAS (B2B USER DIRECTORY) */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            👥 Direktori Akun & Hak Akses Korporat
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '12px 16px' }}>ID</th>
                  <th style={{ padding: '12px 16px' }}>Email Kredensial</th>
                  <th style={{ padding: '12px 16px' }}>Nama & Kontak</th>
                  <th style={{ padding: '12px 16px' }}>Peran Korporat</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Tindakan Otoritas</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const roleLower = u.role.toLowerCase()
                  const isOwnerTarget = roleLower === 'owner'
                  const isPrivileged = roleLower === 'operator' || roleLower === 'owner'
                  const targetRole = isPrivileged ? 'Tenant' : 'Operator'

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>#{u.id}</td>
                      <td style={{ padding: '12px 16px', color: '#f8fafc', fontWeight: 'bold' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                        {u.namaLengkap ? `${u.namaLengkap} (${u.nomorHp || 'Tanpa No HP'})` : 'Belum diatur'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          backgroundColor: roleLower === 'owner' ? '#7c3aed' : (roleLower === 'operator' ? '#0369a1' : '#1e293b'), 
                          color: '#fff', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' 
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {!(userRole === 'operator' && isOwnerTarget) ? (
                            <>
                              <form action={requestRoleChangeAction}>
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="targetRole" value={targetRole} />
                                <button type="submit" style={{ backgroundColor: isPrivileged ? '#d97706' : '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  {isPrivileged ? 'Alihkan ke Tenant' : 'Alihkan ke Operator'}
                                </button>
                              </form>

                              <form action={deleteUserAction}>
                                <input type="hidden" name="userId" value={u.id} />
                                <button type="submit" style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  Hapus Akun
                                </button>
                              </form>
                            </>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Protected Owner</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}