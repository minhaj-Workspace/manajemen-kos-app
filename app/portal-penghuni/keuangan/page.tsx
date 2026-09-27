import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ==========================================
// SERVER ACTIONS (Base64 Database Storage & Validasi Maks 2 MB)
// ==========================================
async function uploadBuktiBayarAction(formData: FormData) {
  'use server'
  const file = formData.get('fileBukti') as File
  const invoiceId = parseInt(formData.get('invoiceId') as string, 10)
  
  if (!file || file.size === 0 || !invoiceId) return

  // PENGAMANAN: Batas maksimal ukuran file adalah 2 MB (2 * 1024 * 1024 bytes)
  const MAX_SIZE = 2 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    console.error('Gagal: Ukuran file terlalu besar (Maksimal 2 MB)')
    return
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Flag = `data:${file.type};base64,`
    const base64String = buffer.toString('base64')
    const fileDataUrl = base64Flag + base64String

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { 
        buktiBayarUrl: fileDataUrl, 
        status: 'MENUNGGU_VERIFIKASI' 
      }
    })
    
    revalidatePath('/portal-penghuni/keuangan')
    revalidatePath('/verifikasi')
    revalidatePath('/tagihan')
  } catch (error) {
    console.error('Gagal mengunggah bukti bayar:', error)
  }
}

// ==========================================
// KOMPONEN UTAMA KEUANGAN PENGHUNI
// ==========================================
export default async function KeuanganPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  if (!userId || userRole !== 'TENANT') redirect('/')
  
  const idUser = parseInt(userId, 10)

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: idUser },
    include: { 
      kamar: { 
        include: { 
          invoices: { orderBy: { jatuhTempo: 'desc' } } 
        } 
      } 
    }
  })
  
  if (!penghuni) redirect('/')

  const settingProperti = await prisma.setting.findUnique({ where: { key: 'nama_properti' } })
  const namaProperti = settingProperti?.value || 'Gau Deceng Property'

  const daftarInvoice = penghuni.kamar?.invoices || []
  
  const tagihanAktif = daftarInvoice.filter(inv => inv.status !== 'LUNAS')
  const riwayatLunas = daftarInvoice.filter(inv => inv.status === 'LUNAS')

  return (
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#0ea5e9', fontWeight: 'bold' }}>FINANCIAL SELF-SERVICE</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>Keuangan & Kuitansi Pembayaran</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Kelola tagihan sewa, unggah bukti transfer, dan unduh e-receipt resmi Kamar {penghuni.kamar?.nomorKamar || '-'}.</p>
        </div>
        {penghuni.kamar && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', color: '#4ade80', fontWeight: 'bold' }}>
            {namaProperti} • Unit {penghuni.kamar.nomorKamar}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* KOLOM KIRI: TAGIHAN AKTIF / TERTUNDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 'bold' }}>⏳ Tagihan Aktif & Verifikasi</h2>
          
          {tagihanAktif.length === 0 ? (
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #166534', borderRadius: '12px', padding: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
              <span style={{ fontSize: '24px' }}>🎉</span>
              <h3 style={{ color: '#4ade80', margin: '8px 0 4px 0', fontSize: '16px' }}>Hore! Tidak ada tagihan tertunggak.</h3>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Semua kewajiban finansial Anda bulan ini telah diselesaikan.</p>
            </div>
          ) : (
            tagihanAktif.map(inv => {
              const isMenungguVerifikasi = inv.status === 'MENUNGGU_VERIFIKASI'

              return (
                <div key={inv.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: isMenungguVerifikasi ? '#facc15' : '#f87171' }}></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Nominal Tagihan</span>
                      <h3 style={{ fontSize: '22px', margin: '2px 0 4px 0', color: '#fff', fontWeight: 'bold' }}>Rp {inv.jumlah.toLocaleString('id-ID')}</h3>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Jatuh Tempo: {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <span style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', color: isMenungguVerifikasi ? '#facc15' : '#f87171' }}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {isMenungguVerifikasi ? (
                    <div style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', color: '#facc15', fontSize: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⏳</span>
                        <span>Bukti transfer telah dikirim dan sedang dalam antrean verifikasi operator.</span>
                      </div>
                      {inv.buktiBayarUrl && (
                        <a href={inv.buktiBayarUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: '11px', textDecoration: 'underline', fontWeight: 'bold' }}>
                          🔍 Lihat Bukti Terunggah
                        </a>
                      )}
                    </div>
                  ) : (
                    <form action={uploadBuktiBayarAction} method="POST" encType="multipart/form-data" style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', fontWeight: 'bold' }}>Unggah Bukti Transfer Pembayaran:</p>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>* Format gambar (JPG/PNG), Maksimal ukuran 2 MB.</span>
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <input type="file" name="fileBukti" accept="image/*" required style={{ backgroundColor: '#1e293b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155', cursor: 'pointer' }} />
                      <button type="submit" style={{ backgroundColor: '#0ea5e9', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', alignSelf: 'flex-start' }}>
                        📤 Kirim Bukti Bayar
                      </button>
                    </form>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* KOLOM KANAN: RIWAYAT PEMBAYARAN & E-RECEIPT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 'bold' }}>📚 Riwayat & Kuitansi Digital (E-Receipt)</h2>
          
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <tr>
                  <th style={{ padding: '14px 16px' }}>Detail Invoice</th>
                  <th style={{ padding: '14px 16px' }}>Tanggal Lunas</th>
                  <th style={{ padding: '14px 16px' }}>Nominal</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Aksi Kuitansi</th>
                </tr>
              </thead>
              <tbody>
                {riwayatLunas.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      Belum ada riwayat pembayaran lunas.
                    </td>
                  </tr>
                ) : (
                  riwayatLunas.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>Invoice #{inv.id}</span>
                        <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '11px' }}>Kamar {penghuni.kamar?.nomorKamar}</p>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                        {inv.tanggalBayar ? new Date(inv.tanggalBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#4ade80', fontWeight: 'bold' }}>
                        Rp {inv.jumlah.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <a 
                          href="javascript:window.print()" 
                          style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }}
                        >
                          🖨️ Cetak Kuitansi
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}