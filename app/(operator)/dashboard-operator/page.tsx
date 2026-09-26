import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AutoRefresh from '@/components/AutoRefresh'
import KamarModalGrid from '@/components/KamarModalGrid'

export default async function DashboardOperatorPage() {
  // 1. Proteksi Halaman Aman
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }
  
  // 2. LOGIKA ZONA WAKTU PRESISI (WITA - Asia/Makassar)
  const hariIni = new Date()
  const utcOffset = hariIni.getTimezoneOffset() * 60000
  const witaOffset = 8 * 3600000 // UTC+8
  const hariIniWITA = new Date(hariIni.getTime() + utcOffset + witaOffset)
  hariIniWITA.setHours(0, 0, 0, 0)

  // 3. PENGAMBILAN DATA METRIK
  const totalKamar = await prisma.kamar.count()
  const kamarTerisi = await prisma.kamar.count({ where: { status: 'TERISI' } })
  const tingkatOkupansi = totalKamar > 0 ? Math.round((kamarTerisi / totalKamar) * 100) : 0

  const listSemuaInvoice = await prisma.invoice.findMany()
  
  const invoiceLunas = listSemuaInvoice.filter(inv => inv.status === 'LUNAS').length
  const totalKasMasuk = listSemuaInvoice
    .filter(inv => inv.status === 'LUNAS')
    .reduce((acc, inv) => acc + inv.jumlah, 0)
    
  const invoiceMenunggu = listSemuaInvoice.filter(inv => inv.status === 'MENUNGGU_VERIFIKASI').length
  
  const invoiceOverdue = listSemuaInvoice.filter(inv => 
    inv.status === 'BELUM_LUNAS' && new Date(inv.jatuhTempo) < hariIniWITA
  ).length

  // 4. DATA KAMAR LENGKAP BERSAMA SELURUH PENGHUNI (AKUN UTAMA & PENDAMPING)
  const daftarKamar = await prisma.kamar.findMany({
    include: { 
      penghuni: { 
        include: { user: true },
        orderBy: { isAkunUtama: 'desc' }
      } 
    },
    orderBy: { nomorKamar: 'asc' }
  })

  // 5. MODUL RISET 1: KONTRAK AKTIF TERDEKAT
  const kontrakAktif = await prisma.kontrak.findMany({
    where: { status: 'AKTIF' },
    include: { kamar: true, penghuni: true },
    take: 5,
    orderBy: { tanggalMulai: 'asc' }
  })

  // 6. MODUL RISET 2: TIKET MAINTENANCE PENDING/DIPROSES (Menggunakan Enum 'DIPROSES')
  const tiketMaintenance = await prisma.maintenance.findMany({
    where: { status: { in: ['PENDING', 'DIPROSES'] } },
    include: { kamar: true },
    take: 5,
    orderBy: { createdAt: 'desc' }
  })

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      
      <AutoRefresh intervalMs={10000} />

      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-sky-400 font-bold">Enterprise Overview</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">Operations Dashboard</h1>
          <p className="text-sm text-slate-400 m-0">Pemantauan real-time finansial, okupansi unit, dan pemeliharaan properti.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-xs text-slate-200 flex items-center gap-2 shadow-lg shrink-0 w-fit">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
          <span className="font-bold tracking-wide">System Normal & Auto-Scan Active</span>
        </div>
      </div>

      {/* KARTU METRIK UTAMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
          <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest m-0 mb-2">Total Kas Masuk (Lunas)</p>
          <h3 className="text-2xl font-bold text-white m-0 mb-1">Rp {totalKasMasuk.toLocaleString('id-ID')}</h3>
          <p className="text-[11px] text-emerald-400 font-bold m-0 mt-2">↑ {invoiceLunas} invoice terverifikasi</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest m-0 mb-2">Tingkat Okupansi</p>
          <h3 className="text-2xl font-bold text-white m-0 mb-1">{tingkatOkupansi}%</h3>
          <p className="text-[11px] text-slate-400 font-bold m-0 mt-2">{kamarTerisi} dari {totalKamar} unit terisi</p>
        </div>

        <Link href="/verifikasi" className="block outline-none group">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-xl group-hover:bg-slate-800/80 transition-colors h-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest m-0 mb-2">Menunggu Verifikasi</p>
            <h3 className="text-2xl font-bold text-white m-0 mb-1">{invoiceMenunggu}</h3>
            <p className="text-[11px] text-amber-400 font-bold m-0 mt-2 flex justify-between items-center">
              Periksa bukti transfer <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </p>
          </div>
        </Link>

        <Link href="/tagihan" className="block outline-none group">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-xl group-hover:bg-slate-800/80 transition-colors h-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest m-0 mb-2">Tagihan Overdue</p>
            <h3 className="text-2xl font-bold text-white m-0 mb-1">{invoiceOverdue}</h3>
            <p className="text-[11px] text-red-400 font-bold m-0 mt-2 flex justify-between items-center">
              Penyewa terlambat bayar <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </p>
          </div>
        </Link>

      </div>

      {/* DAFTAR UNIT KAMAR INTERAKTIF (KLIK KARTU UNTUK BUKA POPUP MODAL) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-2xl mt-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-800 pb-4 mb-5 gap-3">
          <div>
            <h2 className="text-base font-bold text-white m-0 mb-1 flex items-center gap-2">
              <span className="text-sky-400">📋</span> Manajemen Unit & Status Kamar
            </h2>
            <p className="text-xs text-slate-400 m-0">Klik kartu unit untuk membuka detail profil penghuni & aksi cepat.</p>
          </div>
          <span className="bg-slate-950 border border-slate-800 text-sky-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider w-fit">
            Total {totalKamar} Unit
          </span>
        </div>

        {/* MODAL GRID CLIENT COMPONENT */}
        <KamarModalGrid daftarKamar={daftarKamar} />
      </div>

      {/* MODUL RISET STANDAR INDUSTRI (Dua Panel Berdampingan) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        
        {/* PANEL 1: MONITORING KONTRAK SEWA AKTIF */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white m-0 flex items-center gap-2">
                <span className="text-amber-400">📅</span> Kontrak Sewa Aktif ({kontrakAktif.length})
              </h3>
              <Link href="/penghuni" className="text-xs text-sky-400 hover:underline font-semibold">Lihat Semua →</Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {kontrakAktif.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Belum ada kontrak aktif tercatat.
                </div>
              ) : (
                kontrakAktif.map((k) => (
                  <div key={k.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">Kamar {k.kamar.nomorKamar}</span>
                      <span className="text-slate-400 block text-[11px]">Penghuni: {k.penghuni.nama}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold block">{k.durasiBulan} Bulan</span>
                      <span className="text-[10px] text-slate-500">Mulai: {new Date(k.tanggalMulai).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PANEL 2: TIKET MAINTENANCE & PERBAIKAN AKTIF */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white m-0 flex items-center gap-2">
                <span className="text-red-400">🛠️</span> Tiket Maintenance Aktif ({tiketMaintenance.length})
              </h3>
              <Link href="/maintenance" className="text-xs text-sky-400 hover:underline font-semibold">Kelola Tiket →</Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {tiketMaintenance.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Tidak ada tiket perbaikan yang pending.
                </div>
              ) : (
                tiketMaintenance.map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">Kamar {t.kamar ? t.kamar.nomorKamar : '-'}</span>
                      <span className="text-slate-400 block text-[11px] truncate max-w-[200px]">{t.deskripsi}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      t.status === 'PENDING' ? 'bg-red-950 text-red-400 border border-red-800/50' : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </main>
  )
}