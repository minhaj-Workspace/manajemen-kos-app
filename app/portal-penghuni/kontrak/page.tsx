import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ==========================================
// SERVER ACTION: AJUKAN PERPANJANGAN / PINDAH UNIT
// ==========================================
async function ajukanPerubahanKontrakAction(formData: FormData) {
  'use server'
  const penghuniId = parseInt(formData.get('penghuniId') as string, 10)
  const jenisPengajuan = formData.get('jenisPengajuan') as string // 'PERPANJANG' atau 'PINDAH_KAMAR'
  const durasiBulan = parseInt(formData.get('durasiBulan') as string, 10)
  const catatan = formData.get('catatan') as string

  if (!penghuniId || !durasiBulan) return

  const penghuni = await prisma.penghuni.findUnique({
    where: { id: penghuniId },
    include: { kamar: true }
  })

  if (!penghuni) return

  // Buat pengajuan kontrak baru dengan status pending persetujuan operator
  await prisma.kontrak.create({
    data: {
      penghuniId: penghuni.id,
      kamarId: penghuni.kamarId || 1,
      durasiBulan: durasiBulan,
      tanggalMulai: new Date(), // Menyesuaikan dengan persyaratan skema Prisma
      status: `PENDING_${jenisPengajuan}` // Contoh: PENDING_PERPANJANG atau PENDING_PINDAH_KAMAR
    }
  })

  revalidatePath('/portal-penghuni/kontrak')
}

// ==========================================
// KOMPONEN UTAMA
// ==========================================
export default async function KontrakPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (!userId || userRole !== 'tenant') redirect('/')
  const idUser = parseInt(userId, 10)

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: idUser },
    include: {
      kamar: true,
      kontrak: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!penghuni) redirect('/')

  // Ambil daftar kamar lain yang tersedia untuk opsi pindah kamar
  const kamarTersedia = await prisma.kamar.findMany({
    where: { status: 'Tersedia' }
  })

  const daftarKontrak = penghuni.kontrak || []
  const kontrakAktif = daftarKontrak[0]

  // Hitung perkiraan tanggal selesai kontrak aktif
  let tanggalSelesaiFormatted = '-'
  if (kontrakAktif) {
    const tglMulai = new Date(kontrakAktif.createdAt)
    tglMulai.setMonth(tglMulai.getMonth() + (kontrakAktif.durasiBulan || 1))
    tanggalSelesaiFormatted = tglMulai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>LEGAL & LEASE RENEWAL</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>Kontrak Sewa & Perpanjangan Unit</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Tinjau masa berlaku hunian, ajukan perpanjangan sewa, atau pilih opsi pemindahan kamar secara mandiri.</p>
        </div>
        {penghuni.kamar && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', color: '#4ade80', fontWeight: 'bold' }}>
            Unit Aktif: Kamar {penghuni.kamar.nomorKamar}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* KOLOM KIRI: DETAIL KONTRAK AKTIF & FORM PERPANJANGAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KARTU STATUS KONTRAK */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: kontrakAktif ? '#4ade80' : '#f87171' }}></div>
            
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              📜 Status Kontrak Berjalan
            </h2>

            {kontrakAktif ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#64748b' }}>Unit Kamar</span>
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{penghuni.kamar ? `Kamar ${penghuni.kamar.nomorKamar} (${penghuni.kamar.tipe})` : '-'}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#64748b' }}>Durasi Kesepakatan</span>
                  <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{kontrakAktif.durasiBulan} Bulan</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#64748b' }}>Mulai Sewa</span>
                  <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{new Date(kontrakAktif.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#64748b' }}>Estimasi Berakhir</span>
                  <span style={{ color: '#facc15', fontWeight: 'bold' }}>{tanggalSelesaiFormatted}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: '#f87171', fontSize: '13px' }}>Tidak ada data kontrak aktif yang ditemukan.</p>
            )}
          </div>

          {/* KARTU INTERAKTIF: AJUKAN PERPANJANGAN ATAU PINDAH UNIT */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
            
            <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
              ⚡ Layanan Mandiri Perubahan Kontrak
            </h2>

            <form action={ajukanPerubahanKontrakAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="hidden" name="penghuniId" value={penghuni.id} />

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Jenis Pengajuan</label>
                <select 
                  name="jenisPengajuan" 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="PERPANJANG">🔄 Perpanjang Sewa (Tetap di Kamar Ini)</option>
                  <option value="PINDAH_KAMAR">🏠 Pindah ke Unit Kamar Lain</option>
                  <option value="UPDATE_DATA">📝 Pembaruan Klausul / Catatan Khusus</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Pilihan Durasi Perpanjangan</label>
                <select 
                  name="durasiBulan" 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="1">1 Bulan (Bulanan)</option>
                  <option value="3">3 Bulan (Triwulan)</option>
                  <option value="6">6 Bulan (Semester)</option>
                  <option value="12">12 Bulan (1 Tahun - Rekomendasi)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Catatan / Permintaan Tambahan</label>
                <textarea 
                  name="catatan" 
                  rows={3} 
                  placeholder="Misal: Ingin pindah ke kamar tipe VIP di lantai 2, atau meminta diskon pembayaran tahunan..." 
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                ></textarea>
              </div>

              <button type="submit" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-start' }}>
                🚀 Kirim Pengajuan ke Operator
              </button>
            </form>
          </div>

        </div>

        {/* KOLOM KANAN: RIWAYAT DOKUMEN KONTRAK */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px', fontWeight: 'bold' }}>
            📚 Riwayat Dokumen Kontrak ({daftarKontrak.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {daftarKontrak.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Belum ada riwayat dokumen kontrak.</p>
            ) : (
              daftarKontrak.map((k, index) => (
                <div key={k.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold' }}>Kontrak #{k.id}</span>
                      {index === 0 && (
                        <span style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid rgba(74, 222, 128, 0.3)' }}>Aktif</span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                      Durasi: {k.durasiBulan} Bulan • Status: {k.status}
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#1e293b', color: '#cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #334155' }}>
                    Arsip Sah
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}