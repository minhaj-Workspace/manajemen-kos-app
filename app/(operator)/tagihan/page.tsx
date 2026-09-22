import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ==========================================
// SERVER ACTIONS
// ==========================================
async function buatTagihanAction(formData: FormData) {
  'use server'
  const kamarId = formData.get('kamarId') as string
  const jumlah = formData.get('jumlah') as string
  const jatuhTempo = formData.get('jatuhTempo') as string

  if (!kamarId || !jumlah || !jatuhTempo) return

  await prisma.invoice.create({
    data: {
      kamarId: parseInt(kamarId),
      jumlah: parseInt(jumlah.replace(/\D/g, '')),
      jatuhTempo: new Date(jatuhTempo),
      status: 'Belum Bayar',
    }
  })

  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

async function hapusTagihanAction(formData: FormData) {
  'use server'
  const id = formData.get('idTagihan') as string
  await prisma.invoice.delete({ where: { id: parseInt(id) } })
  revalidatePath('/tagihan')
}

// ==========================================
// KOMPONEN UTAMA
// ==========================================
interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function TagihanPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  // Proteksi Halaman: Izinkan Operator maupun Owner (fleksibel & aman dari case-sensitivity)
  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const keyword = resolvedSearchParams.search || ''

  // Ambil data kamar yang terisi beserta data penghuninya
  const kamarTerisi = await prisma.kamar.findMany({
    where: { status: 'Terisi' },
    include: { penghuni: true },
    orderBy: { nomorKamar: 'asc' }
  })

  // Ambil semua invoice dengan dukungan filter pencarian global
  const daftarInvoice = await prisma.invoice.findMany({
    where: keyword ? {
      OR: [
        { status: { contains: keyword, mode: 'insensitive' } },
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } },
        { kamar: { penghuni: { nama: { contains: keyword, mode: 'insensitive' } } } }
      ]
    } : undefined,
    include: { 
      kamar: {
        include: { penghuni: true }
      } 
    },
    orderBy: { createdAt: 'desc' }
  })

  // Perhitungan Metrik Finansial
  const totalLunas = daftarInvoice
    .filter(inv => inv.status === 'Lunas')
    .reduce((acc, curr) => acc + curr.jumlah, 0)
    
  const totalMenunggu = daftarInvoice
    .filter(inv => inv.status === 'Menunggu Verifikasi')
    .reduce((acc, curr) => acc + curr.jumlah, 0)

  const totalBelumBayar = daftarInvoice
    .filter(inv => inv.status === 'Belum Bayar' || inv.status === 'Pending')
    .reduce((acc, curr) => acc + curr.jumlah, 0)

  // Fungsi pembantu warna status
  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Lunas': return { bg: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: 'rgba(74, 222, 128, 0.2)' }
      case 'Menunggu Verifikasi': return { bg: 'rgba(250, 204, 21, 0.1)', color: '#facc15', border: 'rgba(250, 204, 21, 0.2)' }
      default: return { bg: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: 'rgba(248, 113, 113, 0.2)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* HEADER HALAMAN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Billing Management</span>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>Tagihan & Invoice</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {keyword ? `Hasil pencarian untuk: "${keyword}"` : 'Kelola siklus pembayaran, terbitkan tagihan baru, dan pantau tunggakan.'}
          </p>
        </div>

        {keyword && (
          <a href="/tagihan" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>
            ✕ Reset Pencarian
          </a>
        )}
      </div>

      {/* METRIK FINANSIAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pendapatan Bersih (Lunas)</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: 'bold' }}>Rp {totalLunas.toLocaleString('id-ID')}</h2>
        </div>
        
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#facc15' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Menunggu Verifikasi</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: 'bold' }}>Rp {totalMenunggu.toLocaleString('id-ID')}</h2>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#f87171' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Tunggakan (Belum Bayar)</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: 'bold' }}>Rp {totalBelumBayar.toLocaleString('id-ID')}</h2>
        </div>
      </div>

      {/* GRID 2 KOLOM */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(550px, 2.5fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* KOLOM KIRI: FORM BUAT TAGIHAN */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38bdf8' }}>📄</span> Terbitkan Tagihan
          </h2>
          
          <form action={buatTagihanAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Tujuan (Kamar & Penghuni)</label>
              <select name="kamarId" required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">-- Pilih Penghuni Aktif --</option>
                {kamarTerisi.map(kamar => (
                  <option key={kamar.id} value={kamar.id}>
                    Kamar {kamar.nomorKamar} - {kamar.penghuni?.nama || 'Penghuni'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Nominal Tagihan (Rp)</label>
              <input type="number" name="jumlah" required placeholder="Misal: 1500000" style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Tanggal Jatuh Tempo</label>
              <input type="date" name="jatuhTempo" required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            
            <button type="submit" style={{ marginTop: '8px', width: '100%', backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
              Terbitkan Invoice
            </button>
          </form>
        </div>

        {/* KOLOM KANAN: DAFTAR INVOICE */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Daftar Invoice Aktif ({daftarInvoice.length})</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {daftarInvoice.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #1e293b', borderRadius: '10px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Belum ada riwayat tagihan atau yang cocok dengan pencarian.</p>
              </div>
            ) : (
              daftarInvoice.map((inv) => {
                const badge = getStatusStyle(inv.status)
                return (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '240px' }}>
                      <div style={{ width: '44px', height: '44px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#94a3b8', fontSize: '18px', flexShrink: 0 }}>
                        💳
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: '600' }}>
                            INV-{inv.id.toString().padStart(4, '0')}
                          </h4>
                          <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                            {inv.status}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                          Kamar {inv.kamar?.nomorKamar || '-'} • Jatuh Tempo: {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '16px', color: badge.color, fontWeight: 'bold' }}>
                          Rp {inv.jumlah.toLocaleString('id-ID')}
                        </p>
                      </div>
                      
                      <div style={{ width: '1px', height: '30px', backgroundColor: '#1e293b' }}></div>
                      
                      <form action={hapusTagihanAction} style={{ margin: 0 }}>
                        <input type="hidden" name="idTagihan" value={inv.id} />
                        <button type="submit" style={{ backgroundColor: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }} title="Hapus Invoice">
                          🗑️
                        </button>
                      </form>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}