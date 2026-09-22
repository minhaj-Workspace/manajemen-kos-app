import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

// Server Action untuk memproses pembayaran & menyimpan referensi bukti bayar
async function bayarTagihanAction(formData: FormData) {
  'use server'
  const invoiceId = parseInt(formData.get('invoiceId') as string)
  const fileBukti = formData.get('buktiBayar') as File | null
  
  const buktiBayarUrl = fileBukti && fileBukti.size > 0 ? fileBukti.name : "bukti-transfer.jpg"
  
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { 
      status: 'Menunggu Verifikasi',
      buktiBayarUrl: buktiBayarUrl 
    }
  })

  revalidatePath('/pembayaran')
  revalidatePath('/verifikasi')
}

export default async function PembayaranPenghuniPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (!userId || userRole !== 'tenant') {
    redirect('/')
  }

  // Cari data penghuni beserta kamarnya
  const penghuni = await prisma.penghuni.findFirst({
    where: { userId: parseInt(userId, 10) },
    include: { kamar: true }
  })

  // Validasi jika penghuni tidak ditemukan atau belum memiliki kamar
  if (!penghuni || !penghuni.kamarId) {
    return (
      <main style={{ padding: '40px 20px', fontFamily: 'sans-serif', textAlign: 'center', color: '#fff', backgroundColor: '#090d16', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '20px', color: '#f87171' }}>⚠️ Akun Belum Terikat Kamar</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Anda belum terdaftar di kamar manapun atau sedang dalam status check-out.</p>
        <Link href="/" style={{ backgroundColor: '#38bdf8', color: '#090d16', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>
          ← Kembali ke Beranda
        </Link>
      </main>
    )
  }

  // Ambil semua riwayat invoice untuk kamar ini secara aman
  const semuaTagihan = await prisma.invoice.findMany({
    where: { kamarId: penghuni.kamarId },
    orderBy: { jatuhTempo: 'asc' }
  })

  const tagihanAktif = semuaTagihan.filter((inv) => inv.status !== 'Lunas')
  const riwayatLunas = semuaTagihan.filter((inv) => inv.status === 'Lunas')

  const nomorKamarTeks = penghuni.kamar?.nomorKamar || '-'

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#fff' }}>
            💳 Keuangan Saya
          </h1>
          <p style={{ color: '#a0aec0', margin: 0, fontSize: '14px' }}>
            Kelola tagihan dan riwayat pembayaran Kamar {nomorKamarTeks}.
          </p>
        </div>
        <Link 
          href="/" 
          style={{ backgroundColor: '#4a5568', color: '#fff', padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px' }}
        >
          ← Beranda
        </Link>
      </div>

      {/* Bagian 1: Tagihan Aktif / Menunggu Pembayaran */}
      <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #2d3748', paddingBottom: '10px' }}>
        Tagihan Saat Ini
      </h2>

      {tagihanAktif.length === 0 ? (
        <div style={{ backgroundColor: '#1c4532', border: '1px solid #38a169', borderRadius: '8px', padding: '20px', marginBottom: '30px', textAlign: 'center' }}>
          <p style={{ color: '#9ae6b4', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
            🎉 Hore! Tidak ada tagihan yang tertunggak.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px', marginBottom: '30px' }}>
          {tagihanAktif.map((inv) => (
            <div key={inv.id} style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '18px' }}>Sewa Bulanan</h3>
                  <p style={{ margin: 0, color: '#fc8181', fontSize: '13px' }}>
                    Jatuh tempo: {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <h3 style={{ margin: 0, color: '#68d391', fontSize: '20px' }}>
                  Rp {inv.jumlah.toLocaleString('id-ID')}
                </h3>
              </div>

              {inv.status === 'Menunggu Verifikasi' ? (
                <div style={{ backgroundColor: '#744210', color: '#ffe3a8', padding: '12px', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                  ⏳ Pembayaran sedang diverifikasi oleh Operator.
                </div>
              ) : (
                <form action={bayarTagihanAction} style={{ backgroundColor: '#2d3748', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#e2e8f0', fontSize: '13px', fontWeight: 'bold' }}>Konfirmasi Pembayaran</p>
                  <p style={{ margin: '0 0 10px 0', color: '#a0aec0', fontSize: '12px' }}>Silakan transfer ke rekening <strong>BCA 1234567890 a.n Kos-App</strong>, lalu unggah bukti bayar di bawah ini.</p>
                  
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <input 
                    type="file" 
                    name="buktiBayar"
                    required
                    accept="image/*"
                    style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '15px', color: '#fff', backgroundColor: '#1a202c', border: '1px solid #4a5568', borderRadius: '4px', fontSize: '12px' }}
                  />
                  <button 
                    type="submit"
                    style={{ width: '100%', backgroundColor: '#3182ce', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                  >
                    Kirim Bukti Pembayaran
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bagian 2: Riwayat Pembayaran (Lunas) */}
      <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #2d3748', paddingBottom: '10px' }}>
        Riwayat Pembayaran
      </h2>

      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', overflow: 'hidden' }}>
        {riwayatLunas.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#718096', margin: 0, fontStyle: 'italic', fontSize: '13px' }}>
            Belum ada riwayat pembayaran yang lunas.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e0', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#2d3748', color: '#fff', borderBottom: '1px solid #4a5568' }}>
                  <th style={{ padding: '12px 15px' }}>ID</th>
                  <th style={{ padding: '12px 15px' }}>Tanggal Jatuh Tempo</th>
                  <th style={{ padding: '12px 15px' }}>Nominal</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {riwayatLunas.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #2d3748' }}>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>#{inv.id}</td>
                    <td style={{ padding: '12px 15px' }}>
                      {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#68d391' }}>
                      Rp {inv.jumlah.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                      <span style={{ backgroundColor: '#22543d', color: '#c6f6d5', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                        Lunas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  )
}