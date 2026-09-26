import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { CatatPengeluaranButton } from '@/components/KeuanganClientActions'

// ==========================================
// SERVER ACTIONS KEUANGAN & PRIVE (Aman)
// ==========================================
async function tambahPengeluaranAction(formData: FormData) {
  'use server'
  
  // Proteksi & Dapatkan ID User yang mencatat
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  const userIdStr = cookieStore.get('user_id')?.value

  if (userRole !== 'operator' && userRole !== 'owner') {
    throw new Error('Akses ditolak')
  }

  const kategori = formData.get('kategori') as string
  const jumlahStr = formData.get('jumlah') as string
  const keterangan = formData.get('keterangan') as string

  if (!kategori || !jumlahStr) return

  const jumlah = parseFloat(jumlahStr)
  if (isNaN(jumlah) || jumlah <= 0) return

  try {
    await prisma.pengeluaran.create({
      data: {
        kategori,
        jumlah,
        keterangan: keterangan || '-',
        // Relasi ke User pencatat (jika ID tersedia)
        dicatatOlehId: userIdStr ? parseInt(userIdStr) : null 
      }
    })
    revalidatePath('/laporan-keuangan')
  } catch (error) {
    console.error("Gagal mencatat pengeluaran:", error)
  }
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

  // 1. Ambil data Invoice dengan relasi langsung ke penghuni dan kamar
  const daftarInvoice = await prisma.invoice.findMany({
    where: keyword ? {
      OR: [
        { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' } } },
        { penghuni: { nama: { contains: keyword, mode: 'insensitive' } } }
        // Note: Filter status ditiadakan dari teks bebas karena sekarang berbasis Enum
      ]
    } : undefined,
    include: {
      kamar: true,
      penghuni: true // Mengambil data penghuni utama dari relasi baru
    },
    orderBy: { createdAt: 'desc' }
  })

  // 2. Ambil data Maintenance selesai yang murni ditanggung oleh Pengelola (Beban Kas Kos)
  // PERBAIKAN: Menggunakan Enum mutakhir 'SELESAI' dan 'RESOLVED'
  const daftarMaintenance = await prisma.maintenance.findMany({
    where: { 
      estimasiBiaya: { not: null }, 
      status: { in: ['SELESAI', 'RESOLVED'] },
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
    include: { pencatat: true }, // Mengambil info siapa yang mencatat
    orderBy: { tanggal: 'desc' }
  })

  // 4. Statistik Finansial (Menghitung dari keseluruhan data riil agar laba & prive akurat)
  // PERBAIKAN: Menggunakan Enum 'LUNAS'
  const semuaInvoiceLunas = await prisma.invoice.findMany({ where: { status: 'LUNAS' } })
  const totalLunas = semuaInvoiceLunas.reduce((acc, inv) => acc + inv.jumlah, 0)

  const semuaInvoiceTagihan = await prisma.invoice.findMany()
  const totalBelumLunas = semuaInvoiceTagihan
    .filter((inv) => inv.status !== 'LUNAS')
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
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-8">
      
      {/* Header Halaman & Search */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-sky-400 font-bold">
            Financial Management & Cashflow Guard
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">
            📊 Laporan Keuangan & Proteksi Kas
          </h1>
          <p className="text-sm text-slate-400">
            {keyword ? `Hasil pencarian untuk: "${keyword}"` : 'Kelola kas masuk, catat penarikan prive owner, dan pantau batas aman arus kas.'}
          </p>
        </div>
        
        <div className="flex gap-3 items-center flex-wrap">
          <form method="GET" className="flex gap-2 w-full md:w-auto">
            <input 
              type="text" 
              name="search" 
              defaultValue={keyword} 
              placeholder="Cari kamar, nama..." 
              className="bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none w-full md:w-48"
            />
            <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0">
              Cari
            </button>
          </form>

          {keyword && (
            <Link href="/laporan-keuangan" className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center shrink-0">
              ✕ Reset
            </Link>
          )}
        </div>
      </div>

      {/* Kartu Ringkasan Keuangan (Bento Grid Pintar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* Laba Bersih */}
        <div className={`relative overflow-hidden rounded-xl p-5 md:p-6 border ${labaBersih >= 0 ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
          <div className={`absolute top-0 left-0 w-1 h-full ${labaBersih >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Laba Bersih Riil</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white m-0">Rp {labaBersih.toLocaleString('id-ID')}</h2>
          <p className="text-xs text-slate-400 mt-1">Pendapatan dikurangi total beban</p>
        </div>

        {/* Safe to Withdraw (Prive) */}
        <div className="relative overflow-hidden rounded-xl p-5 md:p-6 border bg-slate-900 border-sky-500/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-400"></div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 text-sky-400">Safe to Withdraw (Prive)</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white m-0">Rp {batasAmanPrive > 0 ? batasAmanPrive.toLocaleString('id-ID') : 0}</h2>
          <p className="text-xs text-slate-400 mt-1">Batas aman dana ditarik owner</p>
        </div>

        {/* Total Kas Masuk */}
        <div className="relative overflow-hidden rounded-xl p-5 md:p-6 border bg-slate-900 border-slate-800">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 text-emerald-400">Total Kas Masuk (Lunas)</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white m-0">Rp {totalLunas.toLocaleString('id-ID')}</h2>
          <p className="text-xs text-slate-400 mt-1">Dari tagihan terverifikasi</p>
        </div>

        {/* Total Pengeluaran */}
        <div className="relative overflow-hidden rounded-xl p-5 md:p-6 border bg-slate-900 border-slate-800">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-400">Total Beban & Prive</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white m-0">Rp {(totalSemuaBeban + totalGlobalPrive).toLocaleString('id-ID')}</h2>
          <p className="text-xs text-slate-400 mt-1">Bbn: Rp {totalSemuaBeban.toLocaleString('id-ID')} • Prv: Rp {totalGlobalPrive.toLocaleString('id-ID')}</p>
        </div>

      </div>

      {/* GRID INPUT PENGELUARAN & RIWAYAT PENGELUARAN / PRIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* FORM CATAT PENGELUARAN / PENARIKAN OWNER */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-1">📝 Catat Kas Keluar / Prive</h3>
          <p className="text-xs text-slate-400 mb-5">Catat pengeluaran tunai/transfer operasional atau penarikan dana oleh owner.</p>

          <form action={tambahPengeluaranAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Kategori Transaksi</label>
              <select name="kategori" required className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none appearance-none">
                <option value="Operasional">Operasional Rutin (Listrik, Air, Wifi...)</option>
                <option value="Prive Owner">Prive Owner (Penarikan Dana / Profit)</option>
                <option value="Lainnya">Pengeluaran Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Nominal (Rp)</label>
              <input type="number" name="jumlah" required placeholder="Contoh: 750000" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Keterangan / Metode</label>
              <input type="text" name="keterangan" placeholder="Contoh: Beli token listrik (Tunai)" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>

            <CatatPengeluaranButton />
          </form>
        </div>

        {/* RIWAYAT PENGELUARAN & PRIVE */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-1">📋 Riwayat Kas Keluar ({daftarPengeluaran.length})</h3>
          <p className="text-xs text-slate-400 mb-5">Daftar pengeluaran operasional dan penarikan yang tercatat.</p>

          <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {daftarPengeluaran.map((p) => {
              const isPrive = p.kategori === 'Prive Owner'
              return (
                <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex justify-between items-center hover:border-slate-700 transition-colors">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isPrive ? 'bg-sky-900/30 text-sky-400 border border-sky-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'
                      }`}>
                        {p.kategori}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-white m-0">{p.keterangan}</p>
                    {p.pencatat && (
                      <p className="text-[10px] text-slate-500 m-0">Dicatat oleh: {p.pencatat.namaLengkap || p.pencatat.email}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-red-400 shrink-0 ml-3">
                    - Rp {p.jumlah.toLocaleString('id-ID')}
                  </span>
                </div>
              )
            })}

            {daftarPengeluaran.length === 0 && (
              <div className="text-center p-8 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                Belum ada riwayat pengeluaran yang tercatat.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tabel Riwayat Transaksi / Invoice (Card List di Mobile, Tabel di Desktop) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
          <h2 className="text-lg font-bold text-white m-0">
            Riwayat Rinci Tagihan & Pendapatan ({daftarInvoice.length})
          </h2>
          <span className="text-xs text-slate-400">
            Potensi Piutang Belum Lunas: <strong className="text-yellow-500 text-sm">Rp {totalBelumLunas.toLocaleString('id-ID')}</strong>
          </span>
        </div>

        {daftarInvoice.length === 0 ? (
          <div className="text-center p-10 border border-dashed border-slate-800 rounded-lg">
            <p className="text-slate-500 text-sm m-0">Belum ada catatan transaksi keuangan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Tampilan Desktop (Tabel) - Akan bergeser jika layar kecil, tapi tetap rapi */}
            <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="p-4 font-semibold">ID Inv</th>
                  <th className="p-4 font-semibold">Kamar & Penghuni Utama</th>
                  <th className="p-4 font-semibold">Jumlah Tagihan</th>
                  <th className="p-4 font-semibold">Jatuh Tempo</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {daftarInvoice.map((inv) => {
                  const nomorKamarTeks = inv.kamar?.nomorKamar ? `Kamar ${inv.kamar.nomorKamar}` : '[Kamar Arsip]'
                  // PERBAIKAN: Mengambil nama dari relasi langsung ke penghuni (Lead Tenant)
                  const namaPenghuniTeks = inv.penghuni?.nama || 'Tanpa Nama Penghuni'

                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold text-slate-400">#{inv.id}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{nomorKamarTeks}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{namaPenghuniTeks}</div>
                      </td>
                      <td className="p-4 font-bold text-emerald-400">
                        Rp {inv.jumlah.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                          inv.status === 'LUNAS' 
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' 
                            : inv.status === 'MENUNGGU_VERIFIKASI'
                            ? 'bg-yellow-900/20 text-yellow-500 border-yellow-800/50'
                            : 'bg-red-900/20 text-red-400 border-red-800/50'
                        }`}>
                          {/* Mempercantik tampilan Enum (menghilangkan garis bawah jika ada) */}
                          {inv.status.replace('_', ' ')}
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

    </main>
  )
}