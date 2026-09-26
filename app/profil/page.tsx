import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { writeFile } from 'fs/promises'
import path from 'path'
import { revalidatePath } from 'next/cache'

// Server Action untuk memproses unggah file KTP dari halaman Profil (Tersimpan di tabel Penghuni)
async function uploadKtpAction(formData: FormData) {
  'use server'
  const file = formData.get('fileKtp') as File
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)

  if (!file || file.size === 0 || !penghuniId) return

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `ktp-${penghuniId}-${Date.now()}-${originalName}`
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName)

    await writeFile(filePath, buffer)

    await prisma.penghuni.update({
      where: { id: penghuniId },
      data: { fotoKtp: `/uploads/${fileName}` }
    })

    revalidatePath('/portal-penghuni/profil')
  } catch (error) {
    console.error('Gagal mengunggah KTP:', error)
  }
}

// Server Action untuk memproses unggah Foto Profil (Tersimpan di tabel User sesuai skema database Anda)
async function uploadFotoProfilAction(formData: FormData) {
  'use server'
  const file = formData.get('fileFotoProfil') as File
  const userId = parseInt(formData.get('userId') as string, 10)

  if (!file || file.size === 0 || !userId) return

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `profil-user-${userId}-${Date.now()}-${originalName}`
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName)

    await writeFile(filePath, buffer)

    await prisma.user.update({
      where: { id: userId },
      data: { fotoProfil: `/uploads/${fileName}` }
    })

    revalidatePath('/portal-penghuni/profil')
    revalidatePath('/portal-penghuni')
  } catch (error) {
    console.error('Gagal mengunggah foto profil:', error)
  }
}

// Server Action untuk memperbarui nomor kontak mandiri (Nama Tetap Terkunci / Read-Only)
async function updateKontakAction(formData: FormData) {
  'use server'
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const nomorHp = formData.get('nomorHp') as string

  if (!penghuniId || !nomorHp) return

  try {
    await prisma.penghuni.update({
      where: { id: penghuniId },
      data: {
        nomorHp: nomorHp.trim()
      }
    })

    revalidatePath('/portal-penghuni/profil')
    revalidatePath('/portal-penghuni')
  } catch (error) {
    console.error('Gagal memperbarui kontak:', error)
  }
}

export default async function ProfilPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  if (!userId || userRole !== 'TENANT') {
    redirect('/')
  }

  const idUser = parseInt(userId, 10)
  if (isNaN(idUser)) {
    redirect('/')
  }

  // Mengambil data User beserta relasi Penghuni, Kamar, dan Kontrak
  const userData = await prisma.user.findUnique({
    where: { id: idUser },
    include: {
      penghuni: {
        include: {
          kamar: true,
          kontrak: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }
    }
  })

  if (!userData || !userData.penghuni) redirect('/')
  const penghuni = userData.penghuni

  return (
    <div style={{ backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>TENANT SELF-SERVICE PORTAL</span>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>⚙️ Profil & Tata Tertib Hunian</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Kelola foto profil akun, nomor kontak, dokumen KTP, dan pelajari aturan hunian.</p>
          </div>
          <div>
            <Link href="/portal-penghuni" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>
              ← Kembali ke Dasbor
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* KOLOM KIRI: FOTO PROFIL, KONTAK, & KTP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* UPLOAD FOTO PROFIL CARD */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#38bdf8', color: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', overflow: 'hidden', flexShrink: 0, border: '2px solid #334155' }}>
                {userData.fotoProfil ? (
                  <img src={userData.fotoProfil} alt="Foto Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  penghuni.nama ? penghuni.nama.charAt(0).toUpperCase() : 'T'
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', color: '#fff', margin: '0 0 4px 0' }}>Foto Profil Akun</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>Unggah foto diri terbaik Anda untuk identitas akun portal.</p>
                
                <form action={uploadFotoProfilAction} encType="multipart/form-data" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="hidden" name="userId" value={userData.id} />
                  <input type="file" name="fileFotoProfil" accept="image/*" required style={{ fontSize: '11px', color: '#cbd5e1' }} />
                  <button type="submit" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}>
                    📷 Perbarui Foto Profil
                  </button>
                </form>
              </div>
            </div>

            {/* FORM KONTAK (NAMA LENGKAP TERKUNCI / READ-ONLY) */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>📋 Informasi Administratif</h2>
              
              <form action={updateKontakAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input type="hidden" name="penghuniId" value={penghuni.id} />

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>Nama Lengkap Resmi (Terkunci Sesuai Kontrak)</label>
                  <input 
                    type="text" 
                    value={penghuni.nama} 
                    disabled 
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#04060b', border: '1px solid #1e293b', color: '#64748b', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'not-allowed' }} 
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Perubahan nama lengkap wajib melalui persetujuan operator.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px' }}>No. WhatsApp / Telepon Aktif</label>
                  <input 
                    type="text" 
                    name="nomorHp" 
                    defaultValue={penghuni.nomorHp} 
                    required 
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }} 
                  />
                </div>

                <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Kamar Terdaftar</span>
                  <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>Kamar {penghuni.kamar?.nomorKamar || '-'}</span>
                </div>

                <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>
                  💾 Simpan Kontak WhatsApp
                </button>
              </form>
            </div>

            {/* UPLOAD KTP CARD */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: penghuni.fotoKtp ? '#4ade80' : '#facc15' }}></div>
              <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0' }}>📁 Dokumen Identitas (KTP)</h2>
              
              {penghuni.fotoKtp ? (
                <div style={{ backgroundColor: '#090d16', border: '1px solid #166534', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#4ade80', fontSize: '14px', fontWeight: 'bold' }}>✅ Terverifikasi</p>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>KTP sudah diunggah ke sistem.</p>
                  </div>
                  <a href={penghuni.fotoKtp} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#166534', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
                    Lihat KTP
                  </a>
                </div>
              ) : (
                <form action={uploadKtpAction} encType="multipart/form-data" style={{ backgroundColor: '#090d16', border: '1px dashed #334155', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>Anda belum mengunggah foto KTP. Hal ini wajib untuk administrasi hunian.</p>
                  <input type="hidden" name="penghuniId" value={penghuni.id} />
                  <input type="file" name="fileKtp" accept="image/*,.pdf" required style={{ backgroundColor: '#1e293b', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155', cursor: 'pointer' }} />
                  <button type="submit" style={{ backgroundColor: '#4ade80', color: '#064e3b', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    ⬆️ Unggah KTP Sekarang
                  </button>
                </form>
              )}
            </div>

          </div>

          {/* KOLOM KANAN: WIFI & TATA TERTIB */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* FASILITAS WIFI CARD */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
              <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0' }}>📶 Akses Fasilitas (WiFi)</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                Password WiFi diperbarui setiap awal bulan demi keamanan bersama. Akses ini khusus untuk penghuni aktif.
              </p>
              <div style={{ backgroundColor: '#090d16', border: '1px solid #0369a1', padding: '16px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 4px 0', color: '#7dd3fc', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SSID Jaringan</p>
                <p style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>KosApp_HighSpeed</p>
                <p style={{ margin: '0 0 4px 0', color: '#7dd3fc', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kata Sandi Saat Ini</p>
                <p style={{ margin: 0, color: '#4ade80', fontSize: '16px', fontFamily: 'monospace', fontWeight: 'bold' }}>JuaraBersama2026!</p>
              </div>
            </div>

            {/* TATA TERTIB CARD */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>📜 Peraturan Kos (House Rules)</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px' }}>🌙</span>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px' }}>Jam Malam Tamu</h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>Tamu lawan jenis dilarang berada di dalam kamar melebihi pukul 22.00 WITA.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px' }}>🧹</span>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px' }}>Kebersihan Lingkungan</h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>Wajib menjaga kebersihan area dapur umum dan lorong depan kamar masing-masing.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px' }}>Penghematan Energi</h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>Harap mematikan AC dan lampu saat meninggalkan kamar dalam waktu lama.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}