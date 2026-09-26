import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { SubmitSettingBtn, DeleteUserForm } from '@/components/SettingsClientActions'

// ==========================================
// ENTERPRISE SERVER ACTIONS (SANGAT AMAN)
// ==========================================
// Bantuan Proteksi: Memastikan hanya Admin (Owner/Operator) yang mengeksekusi
async function verifyAdminAccess() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (role !== 'operator' && role !== 'owner') throw new Error('Otoritas Ditolak')
  return role
}

async function updateSettingAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const key = formData.get('key') as string
  const value = formData.get('value') as string
  if (!key) return
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
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
    data: { namaLengkap: namaLengkap || null, nomorHp: nomorHp || null, fotoProfil: fotoProfil || null }
  })
  revalidatePath('/settings')
}

async function changePasswordAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userId = parseInt(cookieStore.get('user_id')?.value || '0')
  const passwordBaru = formData.get('passwordBaru') as string
  
  if (!userId || !passwordBaru || passwordBaru.length < 6) return

  const hashed = await bcrypt.hash(passwordBaru, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  revalidatePath('/settings')
}

async function requestRoleChangeAction(formData: FormData) {
  'use server'
  const currentUserRole = await verifyAdminAccess()
  const cookieStore = await cookies()
  const currentUserId = parseInt(cookieStore.get('user_id')?.value || '0')
  
  const targetUserId = parseInt(formData.get('userId') as string)
  const targetRole = formData.get('targetRole') as 'OWNER' | 'OPERATOR' | 'TENANT' // ENUM Tepat

  if (!targetUserId || !targetRole || !currentUserId) return

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) return

  // Proteksi: Operator tidak boleh mengubah role Owner
  if (currentUserRole === 'operator' && targetUser.role === 'OWNER') return 

  await prisma.persetujuanRole.create({
    data: { userId: targetUserId, targetRole, requestedBy: currentUserId, status: 'PENDING' }
  })
  revalidatePath('/settings')
}

async function approveRoleChangeAction(formData: FormData) {
  'use server'
  const role = await verifyAdminAccess()
  if (role !== 'owner') throw new Error('Hanya Owner yang bisa menyetujui.')

  const requestId = parseInt(formData.get('requestId') as string)
  const userId = parseInt(formData.get('userId') as string)
  const targetRole = formData.get('targetRole') as 'OWNER' | 'OPERATOR' | 'TENANT'

  if (!requestId || !userId || !targetRole) return

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role: targetRole } }),
    prisma.persetujuanRole.update({ where: { id: requestId }, data: { status: 'APPROVED' } })
  ])
  revalidatePath('/settings')
}

async function rejectRoleChangeAction(formData: FormData) {
  'use server'
  const role = await verifyAdminAccess()
  if (role !== 'owner') throw new Error('Hanya Owner yang bisa menolak.')

  const requestId = parseInt(formData.get('requestId') as string)
  if (!requestId) return
  await prisma.persetujuanRole.update({ where: { id: requestId }, data: { status: 'REJECTED' } })
  revalidatePath('/settings')
}

async function deleteUserAction(formData: FormData) {
  'use server'
  const currentUserRole = await verifyAdminAccess()
  const userId = parseInt(formData.get('userId') as string)
  if (!userId) return

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return
  
  // Proteksi: Operator tidak bisa menghapus Owner
  if (currentUserRole === 'operator' && targetUser.role === 'OWNER') return

  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/settings')
}

async function approveKtpAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const reqId = parseInt(formData.get('reqId') as string, 10)
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const fotoKtpBaru = formData.get('fotoKtpBaru') as string

  if (!reqId || !penghuniId || !fotoKtpBaru) return

  await prisma.$transaction([
    prisma.penghuni.update({ where: { id: penghuniId }, data: { fotoKtp: fotoKtpBaru } }),
    prisma.persetujuanBerkas.update({ where: { id: reqId }, data: { status: 'APPROVED' } })
  ])
  revalidatePath('/settings')
}

async function rejectKtpAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const reqId = parseInt(formData.get('reqId') as string, 10)
  if (!reqId) return
  await prisma.persetujuanBerkas.update({ where: { id: reqId }, data: { status: 'REJECTED' } })
  revalidatePath('/settings')
}

async function buatPengumumanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const judul = formData.get('judul') as string
  const kategori = formData.get('kategori') as string
  const prioritas = formData.get('prioritas') as string
  const isi = formData.get('isi') as string

  if (!judul || !isi) return

  await prisma.pengumuman.create({
    data: { judul, kategori: kategori || 'Umum', prioritas: prioritas || 'Informasi', isi }
  })
  revalidatePath('/settings')
  revalidatePath('/portal-penghuni/pengumuman')
}

async function hapusPengumumanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const pengumumanId = parseInt(formData.get('pengumumanId') as string, 10)
  if (!pengumumanId) return
  await prisma.pengumuman.delete({ where: { id: pengumumanId } })
  revalidatePath('/settings')
  revalidatePath('/portal-penghuni/pengumuman')
}

// ==========================================
// ENTERPRISE SETTINGS COMPONENT (TAILWIND)
// ==========================================
export default async function SettingPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (!userId || (userRole !== 'operator' && userRole !== 'owner')) redirect('/')

  const currentUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } })

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

  let daftarPengumuman: any[] = []
  try {
    // @ts-ignore
    daftarPengumuman = await prisma.pengumuman.findMany({ orderBy: { createdAt: 'desc' } })
  } catch (e) { daftarPengumuman = [] }

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      
      {/* ENTERPRISE HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Enterprise Control Panel</span>
            <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded text-[9px] font-bold">SECURE v2.4</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white m-0">⚙️ Sistem & Manajemen Akses</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola identitas properti, jaringan Wi-Fi, papan pengumuman, dan tata kelola korporat.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* KOTAK PERSETUJUAN KTP */}
        {pendingKtpRequests.length > 0 && (
          <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-5 shadow-lg">
            <h2 className="text-sm text-emerald-400 font-bold border-b border-emerald-900/50 pb-3 mb-4">
              📁 Verifikasi Pembaruan KTP ({pendingKtpRequests.length} Menunggu)
            </h2>
            <div className="flex flex-col gap-3">
              {pendingKtpRequests.map(req => (
                <div key={req.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-900/50 p-4 rounded-lg gap-4 border border-slate-800/50">
                  <div>
                    <p className="text-sm font-bold text-white m-0">
                      {req.penghuni.nama} {req.penghuni.kamar ? `(Kamar ${req.penghuni.kamar.nomorKamar})` : ''}
                    </p>
                    <p className="text-xs text-slate-400 m-0 mt-1">Mengajukan pembaruan dokumen KTP.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={req.fotoKtpBaru} target="_blank" rel="noopener noreferrer" className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Lihat KTP Baru</a>
                    <form action={approveKtpAction} className="m-0">
                      <input type="hidden" name="reqId" value={req.id} />
                      <input type="hidden" name="penghuniId" value={req.penghuniId} />
                      <input type="hidden" name="fotoKtpBaru" value={req.fotoKtpBaru} />
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Setujui</button>
                    </form>
                    <form action={rejectKtpAction} className="m-0">
                      <input type="hidden" name="reqId" value={req.id} />
                      <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Tolak</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KOTAK OWNER: PERSETUJUAN ROLE */}
        {userRole === 'owner' && pendingRequests.length > 0 && (
          <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-5 shadow-lg">
            <h2 className="text-sm text-indigo-400 font-bold border-b border-indigo-900/50 pb-3 mb-4">
              🔔 Persetujuan Akses Korporat ({pendingRequests.length} Menunggu)
            </h2>
            <div className="flex flex-col gap-3">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-900/50 p-4 rounded-lg gap-4 border border-slate-800/50">
                  <div className="text-sm text-slate-300">
                    Akun <span className="font-bold text-white">{req.user.email}</span> mengajukan role ke <span className="text-sky-400 font-bold">{req.targetRole}</span>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveRoleChangeAction} className="m-0">
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="userId" value={req.userId} />
                      <input type="hidden" name="targetRole" value={req.targetRole} />
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Setujui</button>
                    </form>
                    <form action={rejectRoleChangeAction} className="m-0">
                      <input type="hidden" name="requestId" value={req.id} />
                      <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Tolak</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRID PENGATURAN (Bento Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* 1. PROFIL PENGGUNA */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">👤 Identitas Profil</h2>
            {currentUser && (
              <form action={updateProfileAction} className="flex flex-col gap-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center overflow-hidden text-emerald-500 font-bold text-lg shrink-0">
                    {currentUser.fotoProfil ? <img src={currentUser.fotoProfil} alt="Avatar" className="w-full h-full object-cover" /> : (currentUser.namaLengkap ? currentUser.namaLengkap[0] : currentUser.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{currentUser.role} Account</span>
                    <p className="text-xs text-slate-400 m-0">{currentUser.email}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">URL Foto Profil</label>
                  <input type="url" name="fotoProfil" defaultValue={currentUser.fotoProfil || ''} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Nama Lengkap</label>
                  <input type="text" name="namaLengkap" defaultValue={currentUser.namaLengkap || ''} className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Nomor Telepon</label>
                  <input type="text" name="nomorHp" defaultValue={currentUser.nomorHp || ''} className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <SubmitSettingBtn text="Simpan Profil" />
              </form>
            )}
          </div>

          {/* 2. KEAMANAN */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">🔒 Keamanan Sandi</h2>
            <form action={changePasswordAction} className="flex flex-col gap-4">
              <p className="text-xs text-slate-400 m-0 leading-relaxed">Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan sistem operasional kos.</p>
              <div className="mt-2">
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Kata Sandi Baru (Min. 6 Karakter)</label>
                <input type="password" name="passwordBaru" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 outline-none" />
              </div>
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white p-2.5 rounded-lg text-sm font-bold mt-auto transition-colors shadow-lg">Perbarui Sandi</button>
            </form>
          </div>

          {/* 3. KONFIGURASI PROPERTI */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">🏢 Konfigurasi Properti</h2>
            <div className="flex flex-col gap-4">
              <form action={updateSettingAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="key" value="nama_properti" />
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Bisnis</label>
                <div className="flex gap-2">
                  <input type="text" name="value" defaultValue={propertyNameSetting} required className="flex-1 bg-slate-950 border border-slate-800 text-white p-2 rounded-lg text-xs outline-none" />
                  <SubmitSettingBtn />
                </div>
              </form>
              <form action={updateSettingAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="key" value="hotline_darurat" />
                <label className="text-[10px] font-bold text-slate-500 uppercase">Hotline Darurat</label>
                <div className="flex gap-2">
                  <input type="text" name="value" defaultValue={hotlineSetting} required className="flex-1 bg-slate-950 border border-slate-800 text-white p-2 rounded-lg text-xs outline-none" />
                  <SubmitSettingBtn />
                </div>
              </form>
              <form action={updateSettingAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="key" value="wifi_ssid" />
                <label className="text-[10px] font-bold text-slate-500 uppercase">Wi-Fi SSID</label>
                <div className="flex gap-2">
                  <input type="text" name="value" defaultValue={wifiSsidSetting} required className="flex-1 bg-slate-950 border border-slate-800 text-white p-2 rounded-lg text-xs outline-none" />
                  <SubmitSettingBtn />
                </div>
              </form>
              <form action={updateSettingAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="key" value="wifi_password" />
                <label className="text-[10px] font-bold text-slate-500 uppercase">Wi-Fi Password</label>
                <div className="flex gap-2">
                  <input type="text" name="value" defaultValue={wifiPasswordSetting} required className="flex-1 bg-slate-950 border border-slate-800 text-white p-2 rounded-lg text-xs outline-none" />
                  <SubmitSettingBtn />
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* 5. MANAJEMEN PENGUMUMAN */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-5">📢 Manajemen Broadcast & Pengumuman</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <form action={buatPengumumanAction} className="flex flex-col gap-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
              <p className="text-xs font-bold text-yellow-500 m-0 uppercase tracking-widest">Kirim Broadcast Baru</p>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Judul Pengumuman</label>
                <input type="text" name="judul" required placeholder="Contoh: Jadwal Pembersihan Tandon" className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-yellow-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Kategori</label>
                  <select name="kategori" className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs outline-none appearance-none">
                    <option value="Maintenance">Maintenance</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="Umum">Umum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Prioritas</label>
                  <select name="prioritas" className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs outline-none appearance-none">
                    <option value="Informasi">Informasi</option>
                    <option value="Penting">⚠️ Penting</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Isi Informasi</label>
                <textarea name="isi" required rows={3} placeholder="Tuliskan isi pengumuman..." className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs outline-none resize-y"></textarea>
              </div>
              <button type="submit" className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-2.5 rounded-lg text-xs font-bold shadow-lg transition-colors mt-2">🚀 Publikasikan Pengumuman</button>
            </form>

            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest m-0 mb-1">Riwayat Pengumuman Aktif ({daftarPengumuman.length})</p>
              {daftarPengumuman.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada pengumuman.</p>
              ) : (
                daftarPengumuman.map(item => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col gap-2 relative group hover:border-slate-700 transition-colors">
                    <div className="flex gap-2 items-center">
                      <span className="text-[9px] bg-slate-800 text-sky-400 px-2 py-0.5 rounded font-bold uppercase">{item.kategori}</span>
                      <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                    <h4 className="text-sm text-white font-bold m-0">{item.judul}</h4>
                    <p className="text-xs text-slate-400 m-0 leading-relaxed line-clamp-2">{item.isi}</p>
                    <form action={hapusPengumumanAction} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity m-0">
                      <input type="hidden" name="pengumumanId" value={item.id} />
                      <button type="submit" className="text-[10px] bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded font-bold">Hapus</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 6. DIREKTORI B2B & Otoritas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 mb-4">👥 Direktori Akun & Hak Akses</h2>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="p-4 font-semibold">Akun (Email)</th>
                  <th className="p-4 font-semibold">Identitas</th>
                  <th className="p-4 font-semibold">Role</th>
                  <th className="p-4 font-semibold text-center">Tindakan Otoritas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(u => {
                  const isOwnerTarget = u.role === 'OWNER'
                  const isPrivileged = u.role === 'OPERATOR' || u.role === 'OWNER'
                  const targetRole = isPrivileged ? 'TENANT' : 'OPERATOR'

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white">{u.email}</div>
                        <div className="text-[10px] text-slate-500 mt-1">ID: #{u.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-300">{u.namaLengkap || 'Belum diatur'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.nomorHp || 'No HP -'}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'OWNER' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50' :
                          u.role === 'OPERATOR' ? 'bg-sky-900/30 text-sky-400 border border-sky-800/50' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex gap-2 justify-center flex-wrap">
                          {!(userRole === 'operator' && isOwnerTarget) ? (
                            <>
                              <form action={requestRoleChangeAction} className="m-0">
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="targetRole" value={targetRole} />
                                <button type="submit" className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  isPrivileged ? 'bg-transparent text-amber-500 border-amber-900/50 hover:bg-amber-900/20' : 'bg-transparent text-sky-400 border-sky-900/50 hover:bg-sky-900/20'
                                }`}>
                                  Jadikan {targetRole}
                                </button>
                              </form>
                              <DeleteUserForm userId={u.id} actionFn={deleteUserAction} />
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic px-3 py-1.5 bg-slate-900 rounded-lg">Protected Owner</span>
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
    </main>
  )
}