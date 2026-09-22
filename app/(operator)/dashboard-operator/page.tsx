import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AutoRefresh from '@/components/AutoRefresh' // <-- 1. Impor komponen Auto-Refresh

export default async function DashboardOperatorPage() {
  // 1. Proteksi Halaman (Operator & Owner)
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }
  
  // 2. PEMINDAI OTOMATIS (AUTO-SCANNER OVERDUE)
  try {
    const hariIni = new Date()
    hariIni.setHours(0, 0, 0, 0)

    await prisma.invoice.updateMany({
      where: {
        status: { notIn: ['Lunas', 'Menunggu Verifikasi', 'Overdue'] },
        jatuhTempo: { lt: hariIni }
      },
      data: { status: 'Overdue' }
    })
  } catch (error) {
    console.error('Gagal memperbarui status tagihan otomatis:', error)
  }

  // 3. PENGAMBILAN DATA METRIK
  const totalKamar = await prisma.kamar.count()
  const kamarTerisi = await prisma.kamar.count({ where: { status: 'Terisi' } })
  const tingkatOkupansi = totalKamar > 0 ? Math.round((kamarTerisi / totalKamar) * 100) : 0

  const invoiceLunas = await prisma.invoice.count({ where: { status: 'Lunas' } })
  const invoiceMenunggu = await prisma.invoice.count({ where: { status: 'Menunggu Verifikasi' } })
  const invoiceOverdue = await prisma.invoice.count({ where: { status: 'Overdue' } })
  
  const listInvoiceLunas = await prisma.invoice.findMany({ where: { status: 'Lunas' } })
  const totalKasMasuk = listInvoiceLunas.reduce((acc, inv) => acc + inv.jumlah, 0)

  const totalTiketPending = await prisma.maintenance.count({ where: { status: 'Pending' } })
  
  const daftarKamar = await prisma.kamar.findMany({
    include: { penghuni: true },
    orderBy: { nomorKamar: 'asc' }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '24px 30px', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* 2. Pasang komponen AutoRefresh (bekerja senyap di latar belakang tiap 10 detik) */}
      <AutoRefresh intervalMs={10000} />

      {/* HEADER UTAMA & STATUS OPERASIONAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Enterprise Overview</span>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>Operations Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Real-time monitoring kesehatan finansial, okupansi unit, dan pemeliharaan kos.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px rgba(74,222,128,0.5)' }}></span>
            <span>System Status: <strong style={{ color: '#4ade80' }}>Normal & Auto-Scan Active</strong></span>
          </div>
        </div>
      </div>

      {/* KARTU METRIK UTAMA (BENTO GRID STYLE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* KARTU 1: KAS MASUK */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Kas Masuk (Lunas)</p>
          <h3 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            Rp {totalKasMasuk.toLocaleString('id-ID')}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#4ade80' }}>
            <span>↑ {invoiceLunas} invoice terverifikasi</span>
          </p>
        </div>

        {/* KARTU 2: OKUPANSI */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tingkat Okupansi</p>
          <h3 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            {tingkatOkupansi}%
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#38bdf8' }}>
            {kamarTerisi} dari {totalKamar} unit terisi penuh
          </p>
        </div>

        {/* KARTU 3: MENUNGGU VERIFIKASI (Bisa Diklik) */}
        <Link href="/verifikasi" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '22px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#facc15' }}></div>
            <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Menunggu Verifikasi</p>
            <h3 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
              {invoiceMenunggu}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#facc15' }}>
              Klik untuk verifikasi bukti TF ➔
            </p>
          </div>
        </Link>

        {/* KARTU 4: KELUHAN PENDING (Bisa Diklik) */}
        <Link href="/maintenance" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '22px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#f87171' }}></div>
            <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Keluhan Pending</p>
            <h3 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
              {totalTiketPending}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#f87171' }}>
              Klik untuk proses perbaikan ➔
            </p>
          </div>
        </Link>

        {/* KARTU 5: TAGIHAN OVERDUE */}
        <Link href="/tagihan" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '14px', padding: '22px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#ef4444' }}></div>
            <p style={{ margin: '0 0 8px 0', color: '#fca5a5', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tagihan Overdue</p>
            <h3 style={{ fontSize: '26px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#fff', letterSpacing: '-0.5px' }}>
              {invoiceOverdue}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#f87171' }}>
              Penyewa terlambat bayar ➔
            </p>
          </div>
        </Link>

      </div>

      {/* SECTION DAFTAR UNIT KAMAR */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>📋 Manajemen Unit & Status Kamar</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Daftar seluruh kamar aktif beserta informasi penghuni saat ini.</p>
          </div>
          <span style={{ fontSize: '12px', backgroundColor: '#1e293b', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontWeight: '600' }}>
            Total: {totalKamar} Unit
          </span>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {daftarKamar.map((kamar) => {
            const namaPenghuni = kamar.penghuni ? kamar.penghuni.nama : ''
            const statusLabel = kamar.status === 'Terisi' && namaPenghuni ? `Terisi • ${namaPenghuni}` : kamar.status

            return (
              <div key={kamar.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', padding: '16px 20px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '42px', height: '42px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#38bdf8', fontSize: '14px' }}>
                    {kamar.nomorKamar}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff', fontWeight: '600' }}>
                      Kamar {kamar.nomorKamar} <span style={{ fontWeight: 'normal', fontSize: '13px', color: '#64748b' }}>• {kamar.tipe}</span>
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#4ade80', fontWeight: '500' }}>
                      Rp {kamar.harga.toLocaleString('id-ID')} <span style={{ color: '#64748b', fontWeight: 'normal' }}>/ bulan</span>
                    </p>
                  </div>
                </div>
                <div>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    backgroundColor: kamar.status === 'Terisi' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                    color: kamar.status === 'Terisi' ? '#4ade80' : '#38bdf8',
                    border: kamar.status === 'Terisi' ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid rgba(56, 189, 248, 0.2)'
                  }}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}