import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DetailPenghuniPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Validasi Akses
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // 2. Proteksi Crash Parameter URL
  const resolvedParams = await params
  const penghuniId = parseInt(resolvedParams.id, 10)

  if (isNaN(penghuniId)) {
    return (
      <main className="p-4 md:p-8 min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center shadow-xl">
          <h2 className="text-red-400 font-bold text-xl mb-4">ID Penghuni Tidak Valid</h2>
          <Link href="/penghuni" className="text-sky-400 hover:text-sky-300 font-bold transition-colors">
            &larr; Kembali ke Daftar Penghuni
          </Link>
        </div>
      </main>
    )
  }

  // 3. Pengambilan Data Mutakhir: Relasi Langsung ke Penghuni (Mencegah data tercampur)
  const penghuni = await prisma.penghuni.findUnique({
    where: { id: penghuniId },
    include: {
      kamar: true,
      user: true,
      kontrak: {
        orderBy: { createdAt: 'desc' }
      },
      invoices: { // Mengambil invoice langsung dari relasi penghuni (Fitur Baru)
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!penghuni) {
    return (
      <main className="p-4 md:p-8 min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center shadow-xl">
          <h2 className="text-yellow-400 font-bold text-xl mb-4">Data Penghuni Tidak Ditemukan</h2>
          <Link href="/penghuni" className="text-sky-400 hover:text-sky-300 font-bold transition-colors">
            &larr; Kembali ke Daftar Penghuni
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2">
            👤 Profil Detail Penghuni
          </h1>
          <p className="text-sm text-slate-400 m-0">
            Informasi lengkap identitas, riwayat kontrak sewa, dan riwayat tagihan pribadi.
          </p>
        </div>
        
        <Link 
          href="/penghuni" 
          className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center shrink-0 w-fit"
        >
          &larr; Kembali ke Daftar
        </Link>
      </div>

      {/* Kartu Informasi Utama Penghuni (Bento Grid) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-8 shadow-xl">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-5 mb-5">
          <div className="w-14 h-14 bg-sky-900/30 text-sky-400 rounded-full flex items-center justify-center text-2xl font-bold border border-sky-800/50 shrink-0">
            {penghuni.nama.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white m-0">{penghuni.nama}</h2>
            {penghuni.isAkunUtama && (
              <span className="inline-block mt-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Penghuni Utama (Pemegang Akun)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nomor WhatsApp / HP</span>
            <span className="text-base font-bold text-white">{penghuni.nomorHp}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NIK (KTP)</span>
            <span className="text-base font-bold text-white">{penghuni.nik || '-'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lokasi Saat Ini</span>
            <span className="text-base font-bold text-sky-400">
              {penghuni.kamar ? `Kamar ${penghuni.kamar.nomorKamar} (${penghuni.kamar.tipe})` : 'Telah Check-out'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Terdaftar Sejak</span>
            <span className="text-base font-bold text-white">
              {new Date(penghuni.tanggalMasuk).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Riwayat Kontrak Sewa */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 pb-3 border-b border-slate-800 flex items-center gap-2">
            📄 Riwayat Kontrak Pribadi
          </h3>
          
          <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {(!penghuni.kontrak || penghuni.kontrak.length === 0) ? (
              <div className="text-center p-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                Belum ada data kontrak tercatat.
              </div>
            ) : (
              penghuni.kontrak.map((ktr) => (
                <div key={ktr.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex justify-between items-center hover:border-slate-700 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-white text-sm">
                      Durasi: {ktr.durasiBulan} Bulan
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Mulai: {new Date(ktr.tanggalMulai).toLocaleDateString('id-ID')} • ID: #{ktr.id}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    ktr.status === 'AKTIF' 
                      ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {ktr.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Riwayat Tagihan / Invoice */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 pb-3 border-b border-slate-800 flex items-center gap-2">
            💰 Riwayat Tagihan Pribadi
          </h3>
          
          <div className="overflow-x-auto custom-scrollbar">
            {(!penghuni.invoices || penghuni.invoices.length === 0) ? (
              <div className="text-center p-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                Belum ada tagihan terbit untuk penghuni ini.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-300 min-w-[400px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/50">
                  <tr>
                    <th className="p-3 font-semibold">Invoice</th>
                    <th className="p-3 font-semibold">Nominal</th>
                    <th className="p-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {penghuni.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white">#{inv.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tempo: {new Date(inv.jatuhTempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-sky-400">
                        Rp {inv.jumlah.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          inv.status === 'LUNAS' 
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' 
                            : inv.status === 'MENUNGGU_VERIFIKASI'
                            ? 'bg-yellow-900/20 text-yellow-500 border-yellow-800/50'
                            : 'bg-red-900/20 text-red-400 border-red-800/50'
                        }`}>
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}