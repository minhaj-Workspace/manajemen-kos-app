import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import AutoRefresh from '@/components/AutoRefresh'
import { ActionButton, ConfirmForm } from '@/components/VerifikasiClientActions'

// ==========================================
// SERVER ACTIONS (Aman & Presisi Enum)
// ==========================================
async function verifyAdminAccess() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value?.trim().toLowerCase()
  if (role !== 'operator' && role !== 'owner') throw new Error('Akses ditolak')
}

async function setujuiDanSerahkanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  
  const invoiceId = parseInt(formData.get('invoiceId') as string)
  const kamarId = parseInt(formData.get('kamarId') as string)
  const kontrakId = formData.get('kontrakId') as string

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'LUNAS', tanggalBayar: new Date() }
    })

    if (kontrakId) {
      await tx.kontrak.update({
        where: { id: parseInt(kontrakId) },
        data: { status: 'AKTIF' }
      })
    }

    if (kamarId) {
      await tx.kamar.update({
        where: { id: kamarId },
        data: { status: 'TERISI' }
      })
    }
  })

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

async function tolakAtauBermasalahAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const invoiceId = parseInt(formData.get('invoiceId') as string)

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'BELUM_LUNAS' }
  })

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
}

async function batalkanPersetujuanAction(formData: FormData) {
  'use server'
  await verifyAdminAccess()
  const invoiceId = parseInt(formData.get('invoiceId') as string)
  const kamarId = parseInt(formData.get('kamarId') as string)

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'MENUNGGU_VERIFIKASI', tanggalBayar: null }
    })

    if (kamarId) {
      const sisaPenghuni = await tx.penghuni.count({ where: { kamarId } })
      if (sisaPenghuni === 0) {
        await tx.kamar.update({
          where: { id: kamarId },
          data: { status: 'TERSEDIA' }
        })
      }
    }
  })

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

// ==========================================
// KOMPONEN HALAMAN
// ==========================================
interface PageProps { searchParams: Promise<{ search?: string }> }

export default async function VerifikasiPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') redirect('/')

  const resolvedSearchParams = await searchParams
  const keyword = resolvedSearchParams.search || ''

  const searchFilter = keyword ? {
    OR: [
      { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' as const } } },
      { penghuni: { nama: { contains: keyword, mode: 'insensitive' as const } } }
    ]
  } : {}

  // PERBAIKAN 1: Relasi 'kontrak' dipindah ke dalam 'penghuni' (Sesuai Skema Prisma)
  const antreanPending = await prisma.invoice.findMany({
    where: { 
      AND: [
        { status: { in: ['BELUM_LUNAS', 'MENUNGGU_VERIFIKASI'] } },
        searchFilter
      ]
    },
    include: { 
      kamar: true,
      penghuni: { include: { kontrak: { orderBy: { createdAt: 'desc' }, take: 1 } } } 
    },
    orderBy: { createdAt: 'desc' }
  })

  const riwayatDisetujui = await prisma.invoice.findMany({
    where: { AND: [{ status: 'LUNAS' }, searchFilter] },
    include: { 
      kamar: true,
      penghuni: true 
    },
    orderBy: { tanggalBayar: 'desc' },
    take: 10
  })

  const formatNoHpToWa = (hp?: string | null) => {
    if (!hp) return ''
    let clean = hp.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '62' + clean.slice(1)
    return clean
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col gap-6">
      <AutoRefresh intervalMs={8000} />

      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-sky-400 font-bold">Payment & Document Audit</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2">Verifikasi & Tinjau Dokumen</h1>
          <p className="text-sm text-slate-400 m-0">Validasi berkas upload, tinjau identitas & bukti bayar, serta kelola arsip.</p>
        </div>

        <div className="flex items-center gap-3">
          {keyword && (
            <a href="/verifikasi" className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
              ✕ Reset Filter
            </a>
          )}
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-right shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold m-0">Antrean Aktif</p>
            <p className="text-xl font-bold text-amber-400 m-0">{antreanPending.length} <span className="text-xs font-normal text-slate-400">Tiket</span></p>
          </div>
        </div>
      </div>

      {/* ANTREAN MASUK */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-1">⏳ Antrean Verifikasi Dokumen & Pembayaran</h2>
        <p className="text-xs text-slate-400 mb-5">Periksa berkas unggahan KTP dan bukti transfer secara mendetail sebelum menyetujui transaksi.</p>

        <div className="flex flex-col gap-5">
          {antreanPending.length === 0 ? (
            <div className="text-center p-10 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-bold text-emerald-400 m-0 mb-1">✅ Semua antrean verifikasi sudah bersih!</p>
              <p className="text-xs text-slate-500 m-0">Tidak ada dokumen baru yang memerlukan tindakan.</p>
            </div>
          ) : (
            antreanPending.map((inv) => {
              const penghuni = inv.penghuni
              const kontrak = inv.penghuni?.kontrak?.[0] // Mengambil kontrak dari penghuni
              const waNum = formatNoHpToWa(penghuni?.nomorHp)
              const waText = encodeURIComponent(`Halo Kak ${penghuni?.nama || 'Penyewa'}, terkait pembayaran INV-${inv.id.toString().padStart(4, '0')} sebesar Rp ${inv.jumlah.toLocaleString('id-ID')}, berkas Anda sedang kami tinjau.`)
              const waLink = waNum ? `https://wa.me/${waNum}?text=${waText}` : ''

              return (
                <div key={inv.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:border-slate-700 transition-colors">
                  
                  {/* Info Utama */}
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-800 pb-4 gap-3">
                    <div>
                      <h3 className="m-0 text-base font-bold text-white flex items-center gap-2">
                        Kamar {inv.kamar?.nomorKamar || '-'} <span className="text-xs text-sky-400 font-normal">({inv.kamar?.tipe || 'Tipe Umum'})</span>
                      </h3>
                      <p className="text-xs text-slate-400 m-0 mt-1">INV-{inv.id.toString().padStart(4, '0')} • Penghuni: <strong className="text-slate-200">{penghuni?.nama || 'Tanpa Nama'}</strong></p>
                    </div>
                    <span className="bg-amber-900/20 text-amber-500 border border-amber-800/50 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase w-fit">
                      {inv.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Panel Berkas */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                    <p className="m-0 text-xs font-bold text-amber-400 tracking-wider uppercase">📁 Dokumen Lampiran</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest m-0 mb-1">Scan KTP</p>
                          <p className="text-xs font-bold text-white m-0">{penghuni?.nik ? `NIK: ${penghuni.nik}` : 'Belum Diunggah'}</p>
                        </div>
                        {penghuni?.fotoKtp ? (
                          <a href={penghuni.fotoKtp} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">🔍 Tinjau</a>
                        ) : <span className="text-[10px] text-slate-500 italic">Kosong</span>}
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest m-0 mb-1">Bukti Transfer</p>
                          <p className="text-xs font-bold text-emerald-400 m-0">Rp {inv.jumlah.toLocaleString('id-ID')}</p>
                        </div>
                        {(inv as any).buktiBayarUrl ? (
                          <a href={(inv as any).buktiBayarUrl} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">🔍 Bukti</a>
                        ) : <span className="text-[10px] text-slate-500 italic">Validasi Manual</span>}
                      </div>
                    </div>
                  </div>

                  {/* Aksi Keputusan */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noreferrer" className="bg-emerald-900/20 text-emerald-400 border border-emerald-800/30 px-3 py-2 rounded-lg text-xs font-bold w-full sm:w-auto text-center hover:bg-emerald-900/40 transition-colors">
                        💬 Hubungi Penyewa via WA
                      </a>
                    )}
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                      {/* PERBAIKAN 2: Menggunakan type="submit" yang valid dan variant untuk warna */}
                      <ConfirmForm actionFn={tolakAtauBermasalahAction} confirmMsg="Yakin menolak bukti ini dan mereset tagihan ke status Belum Lunas?">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <ActionButton type="submit" variant="danger" text="⚠️ Tolak Berkas" pendingText="Menolak..." />
                      </ConfirmForm>

                      {kontrak && (
                        <form action={setujuiDanSerahkanAction} className="m-0">
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <input type="hidden" name="kamarId" value={inv.kamarId?.toString() || ''} />
                          <input type="hidden" name="kontrakId" value={kontrak.id} />
                          <ActionButton type="submit" variant="success" text="✅ Setujui & LUNAS" pendingText="Memproses..." />
                        </form>
                      )}
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ARSIP RIWAYAT & PEMBATALAN */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-1">📚 Arsip Persetujuan Terbaru</h2>
        <p className="text-xs text-slate-400 mb-5">Daftar transaksi yang telah disetujui. Anda dapat membatalkan persetujuan jika terjadi human error.</p>

        <div className="flex flex-col gap-3">
          {riwayatDisetujui.length === 0 ? (
            <div className="text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 m-0">Belum ada riwayat persetujuan di dalam arsip.</p>
            </div>
          ) : (
            riwayatDisetujui.map((inv) => (
              <details key={inv.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-white group cursor-pointer hover:border-slate-700 transition-colors">
                <summary className="flex flex-col sm:flex-row justify-between sm:items-center outline-none gap-3">
                  <div>
                    <h4 className="m-0 text-sm font-bold text-white flex items-center gap-2">
                      Kamar {inv.kamar?.nomorKamar || '-'} <span className="text-emerald-400 font-normal">({inv.penghuni?.nama || 'Tanpa Nama'})</span>
                    </h4>
                    <p className="text-xs text-slate-400 m-0 mt-1">
                      Rp {inv.jumlah.toLocaleString('id-ID')} • Lunas: {inv.tanggalBayar ? new Date(inv.tanggalBayar).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </div>
                  <span className="bg-slate-900 text-sky-400 border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold group-open:bg-sky-900/30 transition-colors w-fit">
                    Lihat Detail
                  </span>
                </summary>

                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between md:items-end gap-4 cursor-auto">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 m-0 mb-1">ID Tagihan</p>
                      <p className="font-bold text-slate-300 m-0">INV-{inv.id.toString().padStart(4, '0')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 m-0 mb-1">Status Kamar</p>
                      <p className="font-bold text-emerald-400 m-0">Terisi (Aktif)</p>
                    </div>
                  </div>
                  
                  {/* PERBAIKAN 2: Menggunakan type="submit" yang valid */}
                  <ConfirmForm actionFn={batalkanPersetujuanAction} confirmMsg="Yakin ingin membatalkan persetujuan ini? Tagihan akan kembali ke Antrean Verifikasi.">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <input type="hidden" name="kamarId" value={inv.kamarId?.toString() || ''} />
                    <ActionButton type="submit" variant="warning" text="Batalkan Persetujuan (Rollback)" pendingText="Membatalkan..." />
                  </ConfirmForm>
                </div>
              </details>
            ))
          )}
        </div>
      </div>

    </main>
  )
}