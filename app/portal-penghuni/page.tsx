import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PortalPenghuniBerandaPage() {
  const cookieStore = await cookies()
  const userIdStr = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (!userIdStr || userRole !== 'tenant') redirect('/')
  const idUser = parseInt(userIdStr, 10)
  if (isNaN(idUser)) redirect('/')

  const penghuni = await prisma.penghuni.findUnique({
    where: { userId: idUser },
    include: {
      kamar: { 
        include: { 
          invoices: { orderBy: { jatuhTempo: 'desc' } },
          maintenances: { orderBy: { createdAt: 'desc' }, take: 3 }
        } 
      },
      kontrak: { orderBy: { createdAt: 'desc' }, take: 3 }
    }
  })

  if (!penghuni) redirect('/')

  const daftarInvoice = penghuni.kamar?.invoices || []
  const tagihanAktif = daftarInvoice.find(inv => inv.status !== 'Lunas')
  const kontrakAktif = penghuni.kontrak[0]
  const daftarTiket = penghuni.kamar?.maintenances || []

  // Logika Hitung Sisa Hari Menuju Jatuh Tempo
  let sisaHari = null
  let isMendekatiJatuhTempo = false
  if (tagihanAktif) {
    const hariIni = new Date()
    const tglJatuhTempo = new Date(tagihanAktif.jatuhTempo)
    const selisihWaktu = tglJatuhTempo.getTime() - hariIni.getTime()
    sisaHari = Math.ceil(selisihWaktu / (1000 * 3600 * 24))
    if (sisaHari <= 3) isMendekatiJatuhTempo = true
  }

  return (
    // PERBAIKAN: Menghapus minHeight: '100vh' agar tinggi halaman tidak tumpah dan memicu scrollbar!
    <div style={{ padding: '24px 30px', fontFamily: 'sans-serif', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* HEADER UTAMA BENTUK MELEBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>TENANT OVERVIEW</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: '4px 0 4px 0' }}>
            Tenant Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            Selamat datang kembali, <strong style={{ color: '#fff' }}>{penghuni.nama}</strong>! Pantau tagihan, kontrak, dan fasilitas Anda di sini.
          </p>
        </div>
      </div>

      {/* 🔔 BANNER NOTIFIKASI & PERINGATAN JATUH TEMPO */}
      {tagihanAktif ? (
        <div style={{ 
          backgroundColor: '#0f172a', 
          border: `1px solid ${isMendekatiJatuhTempo ? '#ef4444' : '#eab308'}`, 
          borderRadius: '12px', 
          padding: '18px 22px', 
          marginBottom: '24px', 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: isMendekatiJatuhTempo ? '#ef4444' : '#eab308' }}></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '22px' }}>{isMendekatiJatuhTempo ? '⚠️' : '🔔'}</span>
            <div>
              <h3 style={{ margin: '0 0 2px 0', color: isMendekatiJatuhTempo ? '#f87171' : '#facc15', fontSize: '14px', fontWeight: 'bold' }}>
                {sisaHari !== null && sisaHari < 0 
                  ? `Tagihan Telah Lewat Waktu (${Math.abs(sisaHari)} hari lalu)` 
                  : sisaHari === 0 
                  ? 'Jatuh Tempo Pembayaran Hari Ini!' 
                  : `Peringatan Tagihan: Jatuh tempo dalam ${sisaHari} hari`}
              </h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                Terdapat tagihan aktif sebesar <strong style={{ color: '#fff' }}>Rp {tagihanAktif.jumlah.toLocaleString('id-ID')}</strong> ({tagihanAktif.status}). Segera unggah bukti bayar.
              </p>
            </div>
          </div>

          <Link href="/portal-penghuni/keuangan" style={{ backgroundColor: isMendekatiJatuhTempo ? '#dc2626' : '#eab308', color: isMendekatiJatuhTempo ? '#fff' : '#000', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Bayar & Cek Keuangan →
          </Link>
        </div>
      ) : (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #065f46', borderRadius: '12px', padding: '18px 22px', marginBottom: '24px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
          <span style={{ fontSize: '22px' }}>✨</span>
          <div>
            <h3 style={{ margin: '0 0 2px 0', color: '#4ade80', fontSize: '14px', fontWeight: 'bold' }}>Status Keuangan Aman</h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Semua kewajiban tagihan sewa Anda saat ini sudah lunas.</p>
          </div>
        </div>
      )}

      {/* BARIS 1: KARTU METRIK UTAMA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* KARTU KAMAR */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#38bdf8' }}></div>
          <p style={{ margin: '0 0 6px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kamar Saat Ini</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            {penghuni.kamar ? `Kamar ${penghuni.kamar.nomorKamar}` : '-'}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#38bdf8' }}>
            Tipe {penghuni.kamar?.tipe || 'Kamar'}
          </p>
        </div>

        {/* KARTU DURASI KONTRAK */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4ade80' }}></div>
          <p style={{ margin: '0 0 6px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sisa Kontrak</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            {kontrakAktif ? `${kontrakAktif.durasiBulan} Bulan` : '-'}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#4ade80' }}>
            Status: {kontrakAktif?.status || 'Aktif'}
          </p>
        </div>

        {/* KARTU STATUS TAGIHAN */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: tagihanAktif ? '#f87171' : '#facc15' }}></div>
          <p style={{ margin: '0 0 6px 0', color: '#64748b', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Pembayaran</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            {tagihanAktif ? `Rp ${tagihanAktif.jumlah.toLocaleString('id-ID')}` : 'Lunas'}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: tagihanAktif ? '#f87171' : '#facc15' }}>
            {tagihanAktif ? 'Anda memiliki tagihan tertunda' : 'Semua tagihan lunas'}
          </p>
        </div>

      </div>

      {/* BARIS 2: GRID TAMBAHAN (RINGKASAN TIKET & PENGUMUMAN) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* WIDGET STATUS TIKET BANTUAN TERBARU */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 2px 0' }}>🛠️ Status Tiket Pemeliharaan</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Pantauan penanganan kendala kamar Anda.</p>
            </div>
            <Link href="/portal-penghuni/bantuan" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>
              Lihat Semua →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {daftarTiket.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0, padding: '10px 0' }}>Belum ada tiket pemeliharaan aktif.</p>
            ) : (
              daftarTiket.map(t => (
                <div key={t.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Tiket #{t.id}</span>
                    <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.deskripsi}</p>
                  </div>
                  <span style={{ fontSize: '11px', backgroundColor: '#1e293b', color: '#facc15', border: '1px solid #334155', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WIDGET PENGUMUMAN OPERASIONAL */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 2px 0' }}>📢 Pengumuman & Informasi</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Informasi terbaru dari pengelola kos.</p>
            </div>
            <Link href="/portal-penghuni/pengumuman" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>
              Lihat Semua →
            </Link>
          </div>
          
          <div style={{ backgroundColor: '#090d16', padding: '14px 18px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '36px', height: '36px', backgroundColor: '#1e293b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontSize: '16px', flexShrink: 0 }}>
              📢
            </div>
            <div>
              <p style={{ margin: '0 0 2px 0', color: '#fff', fontSize: '13px', fontWeight: '600' }}>Jadwal Pembersihan Filter AC</p>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Pembersihan rutin bulan ini dilaksanakan hari Sabtu pukul 10:00 WITA.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}