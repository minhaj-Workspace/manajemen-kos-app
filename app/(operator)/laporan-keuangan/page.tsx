import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ==========================================
// SERVER ACTIONS KEUANGAN & PRIVE
// ==========================================
async function tambahPengeluaranAction(formData: FormData) {
  'use server'
  const kategori = formData.get('kategori') as string
  const jumlahStr = formData.get('jumlah') as string
  const keterangan = formData.get('keterangan') as string

  if (!kategori || !jumlahStr) return

  const jumlah = parseFloat(jumlahStr)
  if (isNaN(jumlah) || jumlah <= 0) return

  await prisma.pengeluaran.create({
    data: {
      kategori,
      jumlah,
      keterangan: keterangan || '-'
    }
  })

  revalidatePath('/laporan-keuangan')
}

interface PageProps {
  searchParams: Promise<{ search?: string }>
}

// ==========================================
// KOMPONEN UTAMA LAPORAN KEUANGAN
// ==========================================
export default async function LaporanKeuanganPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const keyword = resolvedSearchParams.search || ''

  // 1. Ambil data Invoice beserta relasi kamar & penghuni dengan filter pencarian
  const daftarInvoice = await prisma.invoice.findMany({
    where: keyword ? {
      OR: [
        { status: { contains: keyword, mode: 'insensitive' } },
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } },
        { kamar: { penghuni: { is: { nama: { contains: keyword, mode: 'insensitive' } } } } }
      ]
    } : undefined,
    include: {
      kamar: {
        include: { penghuni: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // 2. Ambil data Maintenance selesai yang murni ditanggung oleh Pengelola (Beban Kas Kos)
  const daftarMaintenance = await prisma.maintenance.findMany({
    where: { 
      estimasiBiaya: { not: null }, 
      status: { in: ['Selesai', 'Resolved'] },
      tanggungJawab: 'Pengelola' 
    }
  })
  const totalBiayaMaintenance = daftarMaintenance.reduce((acc, m) => acc + (m.estimasiBiaya || 0), 0)

  // 3. Ambil data Pengeluaran & Prive Owner dengan filter pencarian keterangan/kategori
  const daftarPengeluaran = await prisma.pengeluaran.findMany({
    where: keyword ? {
      OR: [
        { kategori: { contains: keyword, mode: 'insensitive' } },
        { keterangan: { contains: keyword, mode: 'insensitive' } }
      ]
    } : undefined,
    orderBy: { tanggal: 'desc' }
  })

  const totalOperasionalRutin = daftarPengeluaran
    .filter(p => p.kategori !== 'Prive Owner')
    .reduce((acc, p) => acc + p.jumlah, 0)

  const totalPriveOwner = daftarPengeluaran
    .filter(p => p.kategori === 'Prive Owner')
    .reduce((acc, p) => acc + p.jumlah, 0)

  // 4. Statistik Finansial (Menghitung dari keseluruhan data riil agar laba & prive akurat)
  const semuaInvoiceLunas = await prisma.invoice.findMany({ where: { status: 'Lunas' } })
  const totalLunas = semuaInvoiceLunas.reduce((acc, inv) => acc + inv.jumlah, 0)

  const semuaInvoiceTagihan = await prisma.invoice.findMany()
  const totalBelumLunas = semuaInvoiceTagihan
    .filter((inv) => inv.status !== 'Lunas')
    .reduce((acc, inv) => acc + inv.jumlah, 0)

  // Ambil total seluruh pengeluaran database secara global untuk akurasi laba bersih
  const semuaPengeluaranRutinDB = await prisma.pengeluaran.findMany()
  const totalGlobalOperasional = semuaPengeluaranRutinDB
    .filter(p => p.kategori !== 'Prive Owner')
    .reduce((acc, p) => acc + p.jumlah, 0)
  
  const totalGlobalPrive = semuaPengeluaranRutinDB
    .filter(p => p.kategori === 'Prive Owner')
    .reduce((acc, p) => acc + p.jumlah, 0)

  const totalSemuaBeban = totalBiayaMaintenance + totalGlobalOperasional
  const labaBersih = totalLunas - totalSemuaBeban

  // 5. Fitur Keuangan Pintar (Smart Guard / Safe to Withdraw)
  const batasAmanPrive = labaBersih > 0 ? (labaBersih * 0.70) - totalGlobalPrive : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px 30px', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header Halaman & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Financial Management & Cashflow Guard</span>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>
            📊 Laporan Keuangan & Proteksi Kas Kos
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {keyword ? `Hasil pencarian untuk: "${keyword}"` : 'Kelola kas masuk, catat penarikan prive owner, dan pantau batas aman arus kas.'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <form method="GET" style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              name="search" 
              defaultValue={keyword} 
              placeholder="Cari kamar, nama, kategori..." 
              style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }} 
            />
            <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              Cari
            </button>
          </form>

          {keyword && (
            <a href="/laporan-keuangan" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              ✕ Reset
            </a>
          )}
        </div>
      </div>

      {/* Kartu Ringkasan Keuangan (Bento Grid Pintar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Laba Bersih */}
        <div style={{ backgroundColor: labaBersih >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(248, 113, 113, 0.08)', border: `1px solid ${labaBersih >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`, borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: labaBersih >= 0 ? '#10b981' : '#f87171' }}></div>
          <p style={{ margin: '0 0 8px 0', color: labaBersih >= 0 ? '#34d399' : '#f87171', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Laba Bersih Riil</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 'bold' }}>Rp {labaBersih.toLocaleString('id-ID')}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Pendapatan dikurangi total beban</p>
        </div>

        {/* Safe to Withdraw (Prive) */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #38bdf8', borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Safe to Withdraw (Prive)</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 'bold' }}>Rp {batasAmanPrive > 0 ? batasAmanPrive.toLocaleString('id-ID') : 0}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Batas aman dana ditarik owner</p>
        </div>

        {/* Total Kas Masuk */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#4ade80', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Kas Masuk (Lunas)</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 'bold' }}>Rp {totalLunas.toLocaleString('id-ID')}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Dari tagihan terverifikasi</p>
        </div>

        {/* Total Pengeluaran */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#f87171' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#f87171', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Beban & Prive</p>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 'bold' }}>Rp {(totalSemuaBeban + totalGlobalPrive).toLocaleString('id-ID')}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Beban: Rp {totalSemuaBeban.toLocaleString('id-ID')} • Prive: Rp {totalGlobalPrive.toLocaleString('id-ID')}</p>
        </div>

      </div>

      {/* GRID INPUT PENGELUARAN & RIWAYAT PENGELUARAN / PRIVE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* FORM CATAT PENGELUARAN / PENARIKAN OWNER */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>📝 Catat Kas Keluar / Prive Owner</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>Catat pengeluaran tunai/transfer operasional atau penarikan dana oleh owner.</p>

          <form action={tambahPengeluaranAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Kategori Transaksi</label>
              <select name="kategori" required style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="Operasional">Operasional Rutin (Listrik, Air, Wifi, Kebersihan)</option>
                <option value="Prive Owner">Prive Owner (Penarikan Dana Pribadi / Profit)</option>
                <option value="Lainnya">Pengeluaran Lainnya</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Nominal (Rp)</label>
              <input type="number" name="jumlah" required placeholder="Contoh: 750000" style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Keterangan / Metode (Cash / TF)</label>
              <input type="text" name="keterangan" placeholder="Contoh: Beli token listrik (Tunai) / Transfer ke BCA Owner..." style={{ width: '100%', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#fff', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <button type="submit" style={{ backgroundColor: '#38bdf8', color: '#090d16', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>
              Simpan Transaksi Kas Keluar
            </button>
          </form>
        </div>

        {/* RIWAYAT PENGELUARAN & PRIVE */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>📋 Riwayat Kas Keluar & Prive ({daftarPengeluaran.length})</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>Daftar pengeluaran operasional dan penarikan owner yang tercatat.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
            {daftarPengeluaran.map((p) => {
              const isPrive = p.kategori === 'Prive Owner'
              return (
                <div key={p.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ backgroundColor: isPrive ? 'rgba(56, 189, 248, 0.1)' : 'rgba(248, 113, 113, 0.1)', color: isPrive ? '#38bdf8' : '#f87171', border: `1px solid ${isPrive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                        {p.kategori}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#fff' }}>{p.keterangan}</p>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f87171' }}>
                    - Rp {p.jumlah.toLocaleString('id-ID')}
                  </span>
                </div>
              )
            })}

            {daftarPengeluaran.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                Belum ada riwayat pengeluaran atau penarikan dana tercatat.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tabel Riwayat Transaksi / Invoice */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            Riwayat Rinci Tagihan & Pendapatan ({daftarInvoice.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Potensi Piutang Belum Lunas: <strong style={{ color: '#facc15' }}>Rp {totalBelumLunas.toLocaleString('id-ID')}</strong></span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {daftarInvoice.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #1e293b', borderRadius: '10px' }}>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Belum ada catatan transaksi keuangan yang tercatat atau sesuai pencarian.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e0', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 16px' }}>ID Invoice</th>
                    <th style={{ padding: '12px 16px' }}>Kamar & Penghuni</th>
                    <th style={{ padding: '12px 16px' }}>Jumlah</th>
                    <th style={{ padding: '12px 16px' }}>Jatuh Tempo</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarInvoice.map((inv) => {
                    const nomorKamarTeks = inv.kamar?.nomorKamar ? `Kamar ${inv.kamar.nomorKamar}` : '[Kamar Arsip]'
                    const namaPenghuniTeks = inv.kamar?.penghuni?.nama || 'Penghuni belum terikat'

                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #1e293b', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#fff' }}>#{inv.id}</td>
                        <td style={{ padding: '16px' }}>
                          <strong style={{ color: '#fff' }}>{nomorKamarTeks}</strong>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {namaPenghuniTeks}
                          </div>
                        </td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#4ade80' }}>
                          Rp {inv.jumlah.toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '16px', fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontSize: '11px', 
                            fontWeight: '600',
                            backgroundColor: inv.status === 'Lunas' ? 'rgba(74, 222, 128, 0.1)' : inv.status === 'Menunggu Verifikasi' ? 'rgba(250, 204, 21, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                            color: inv.status === 'Lunas' ? '#4ade80' : inv.status === 'Menunggu Verifikasi' ? '#facc15' : '#f87171',
                            border: `1px solid ${inv.status === 'Lunas' ? 'rgba(74, 222, 128, 0.2)' : inv.status === 'Menunggu Verifikasi' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                          }}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}