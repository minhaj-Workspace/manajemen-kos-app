import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { writeFile } from 'fs/promises'
import path from 'path'
import { revalidatePath } from 'next/cache'

// Server Action untuk memproses unggah file KTP dari halaman Profil
async function uploadKtpAction(formData: FormData) {
  'use server'
  const file = formData.get('fileKtp') as File
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)

  if (!file || file.size === 0 || !penghuniId) return

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `ktp-${penghuniId}-${Date.now()}.${file.name.split('.').pop()}`
  const filePath = path.join(process.cwd(), 'public/uploads', fileName)

  await writeFile(filePath, buffer)

  await prisma.penghuni.update({
    where: { id: penghuniId },
    data: { fotoKtp: `/uploads/${fileName}` }
  })

  revalidatePath('/portal-penghuni/profil')
}

export default async function ProfilPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  // Proteksi Akses: Hanya Tenant (aman dari case-sensitivity)
  if (!userId || userRole !== 'tenant') {
    redirect('/')
  }

  const idUser = parseInt(userId, 10)
  if (isNaN(idUser)) {
    redirect('/')
  }

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: idUser },
    include: {
      kamar: true,
      kontrak: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!penghuni) redirect('/')

  return (
    <div style={{ backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Pengaturan Akun</span>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>Profil & Tata Tertib</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Kelola data administratif dan pelajari aturan fasilitas hunian Anda.</p>
          </div>
          <div>
            <Link href="/portal-penghuni" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>
              ← Kembali ke Dasbor
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* KOLOM KIRI: DATA ADMINISTRATIF & KTP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* DATA PENGHUNI BENTO CARD */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>📋 Data Administratif</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Nama Lengkap</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{penghuni.nama}</span>
                </div>
                <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>No. WhatsApp</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{penghuni.nomorHp}</span>
                </div>
                <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>NIK KTP</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{penghuni.nik || '-'}</span>
                </div>
                <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Kamar Terdaftar</span>
                  <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: 'bold' }}>Kamar {penghuni.kamar?.nomorKamar || '-'}</span>
                </div>
              </div>
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
                <form action={uploadKtpAction} style={{ backgroundColor: '#090d16', border: '1px dashed #334155', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>Anda belum mengunggah foto KTP. Hal ini wajib untuk administrasi hunian.</p>
                  <input type="hidden" name="penghuniId" value={penghuni.id} />
                  <input type="file" name="fileKtp" accept="image/*" required style={{ backgroundColor: '#1e293b', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155' }} />
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