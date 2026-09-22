import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import AutoRefresh from '@/components/AutoRefresh' 

// ==========================================
// SERVER ACTIONS
// ==========================================

// 1. Setujui, Lunasi, & Serahkan Kamar
async function setujuiDanSerahkanAction(formData: FormData) {
  'use server'
  const invoiceId = parseInt(formData.get('invoiceId') as string)
  const kamarIdRaw = formData.get('kamarId') as string
  const kontrakId = formData.get('kontrakId') as string

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { 
      status: 'Lunas',
      tanggalBayar: new Date()
    }
  })

  if (kontrakId) {
    await prisma.kontrak.update({
      where: { id: parseInt(kontrakId) },
      data: { status: 'Aktif' }
    })
  }

  if (kamarIdRaw) {
    await prisma.kamar.update({
      where: { id: parseInt(kamarIdRaw) },
      data: { status: 'Terisi' }
    })
  }

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

// 2. Tolak / Catat Kendala Dokumen
async function tolakAtauBermasalahAction(formData: FormData) {
  'use server'
  const invoiceId = parseInt(formData.get('invoiceId') as string)

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'Belum Lunas' }
  })

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
}

// 3. Batalkan Persetujuan (Rollback jika salah klik pada arsip)
async function batalkanPersetujuanAction(formData: FormData) {
  'use server'
  const invoiceId = parseInt(formData.get('invoiceId') as string)
  const kamarIdRaw = formData.get('kamarId') as string

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { 
      status: 'Menunggu Verifikasi',
      tanggalBayar: null 
    }
  })

  if (kamarIdRaw) {
    await prisma.kamar.update({
      where: { id: parseInt(kamarIdRaw) },
      data: { status: 'Tersedia' }
    })
  }

  revalidatePath('/verifikasi')
  revalidatePath('/tagihan')
  revalidatePath('/dashboard-operator')
}

// ==========================================
// KOMPONEN UTAMA
// ==========================================
interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function VerifikasiPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const keyword = resolvedSearchParams.search || ''

  const searchFilter = keyword ? {
    OR: [
      { status: { contains: keyword, mode: 'insensitive' as const } },
      { kamar: { nomorKamar: { contains: keyword, mode: 'insensitive' as const } } },
      { kamar: { penghuni: { is: { nama: { contains: keyword, mode: 'insensitive' as const } } } } }
    ]
  } : {}

  const antreanPending = await prisma.invoice.findMany({
    where: { 
      AND: [
        { status: { in: ['Belum Lunas', 'Menunggu Verifikasi', 'Pending', 'Belum Bayar'] } },
        searchFilter
      ]
    },
    include: { 
      kamar: {
        include: { 
          penghuni: true,
          kontrakList: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      } 
    },
    orderBy: { createdAt: 'desc' }
  })

  const riwayatDisetujui = await prisma.invoice.findMany({
    where: { 
      AND: [
        { status: 'Lunas' },
        searchFilter
      ]
    },
    include: { 
      kamar: {
        include: { 
          penghuni: true,
          kontrakList: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      } 
    },
    orderBy: { tanggalBayar: 'desc' },
    take: 10
  })

  const formatNoHpToWa = (hp?: string | null) => {
    if (!hp) return ''
    let clean = hp.replace(/\D/g, '')
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1)
    }
    return clean
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', fontFamily: 'sans-serif', padding: '24px 30px', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      <AutoRefresh intervalMs={8000} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>Payment & Document Audit</span>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', margin: '4px 0 6px 0' }}>Verifikasi & Tinjau Dokumen</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {keyword ? `Hasil pencarian verifikasi untuk: "${keyword}"` : 'Validasi berkas upload, tinjau KTP & bukti bayar, serta kelola pembatalan arsip secara aman.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {keyword && (
            <a href="/verifikasi" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>
              ✕ Reset Pencarian
            </a>
          )}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>Antrean Aktif</p>
              <p style={{ fontSize: '18px', color: '#facc15', fontWeight: 'bold', margin: 0 }}>{antreanPending.length} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>Tiket</span></p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>⏳ Antrean Masuk (Validasi Dokumen & Pembayaran)</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Periksa berkas unggahan KTP dan bukti transfer secara mendetail sebelum menyerahkan kunci.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {antreanPending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #1e293b', borderRadius: '10px' }}>
              <p style={{ color: '#4ade80', fontSize: '14px', margin: '0 0 4px 0', fontWeight: 'bold' }}>✅ Semua antrean verifikasi sudah bersih atau sesuai pencarian!</p>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Tidak ada dokumen baru yang memerlukan tindakan.</p>
            </div>
          ) : (
            antreanPending.map((inv) => {
              // PERBAIKAN: Gunakan optional chaining (?.) untuk menghindari error jika data kamar telah dihapus
              const penghuni = inv.kamar?.penghuni
              const kontrak = inv.kamar?.kontrakList[0]

              const waNum = formatNoHpToWa(penghuni?.nomorHp)
              const nomorKamarTeks = inv.kamar?.nomorKamar || '[Kamar Arsip]'
              const waText = encodeURIComponent(`Halo Kak ${penghuni?.nama || 'Penyewa'}, terkait pembayaran sewa Kamar ${nomorKamarTeks} sebesar Rp ${inv.jumlah.toLocaleString('id-ID')}, berkas/bukti transfer Anda sedang kami tinjau.`)
              const waLink = waNum ? `https://wa.me/${waNum}?text=${waText}` : ''

              return (
                <div key={inv.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: '600' }}>
                      Kamar {nomorKamarTeks} <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'normal' }}>({inv.kamar?.tipe || '-'})</span>
                    </h3>
                    <span style={{ backgroundColor: 'rgba(250, 204, 21, 0.1)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.2)', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      {inv.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', fontSize: '13px' }}>
                    <div>
                      <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>Nama Penghuni:</p>
                      <p style={{ margin: 0, fontWeight: '600', color: '#fff' }}>{penghuni?.nama || 'Belum diisi'}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>WhatsApp / NIK:</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#fff', fontWeight: '600' }}>{penghuni?.nomorHp || '-'}</span>
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noreferrer" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textDecoration: 'none' }}>
                            💬 Chat WA
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>Nominal Tagihan:</p>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#4ade80', fontSize: '15px' }}>Rp {inv.jumlah.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#facc15' }}>📁 Berkas & Dokumen Terlampir untuk Ditinjau:</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#94a3b8' }}>Scan KTP / Identitas</p>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{penghuni?.nik ? `NIK: ${penghuni.nik}` : 'Belum Diunggah'}</p>
                        </div>
                        {penghuni?.fotoKtp ? (
                          <a href={penghuni.fotoKtp} target="_blank" rel="noreferrer" style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>
                            🔍 Tinjau KTP
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Tidak Ada Berkas</span>
                        )}
                      </div>

                      <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#94a3b8' }}>Bukti Pembayaran / Transfer</p>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#4ade80' }}>Rp {inv.jumlah.toLocaleString('id-ID')}</p>
                        </div>
                        {inv.buktiBayarUrl ? (
                          <a href={inv.buktiBayarUrl} target="_blank" rel="noreferrer" style={{ backgroundColor: '#1e293b', color: '#4ade80', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>
                            🔍 Tinjau Bukti
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '500' }}>Validasi Manual</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', borderTop: '1px solid #1e293b' }}>
                    <form action={tolakAtauBermasalahAction} style={{ margin: 0 }}>
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <button type="submit" style={{ backgroundColor: 'transparent', border: '1px solid #f87171', color: '#f87171', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                        ⚠️ Tolak / Dokumen Bermasalah
                      </button>
                    </form>

                    {/* Fallback string kosong jika null agar tidak error Type 'number | null' */}
                    {kontrak && (
                      <form action={setujuiDanSerahkanAction} style={{ margin: 0 }}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="hidden" name="kamarId" value={inv.kamarId || ''} />
                        <input type="hidden" name="kontrakId" value={kontrak.id} />
                        <button type="submit" style={{ backgroundColor: '#4ade80', color: '#090d16', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                          ✅ Setujui, Lunasi & Serahkan Kunci Kamar
                        </button>
                      </form>
                    )}
                  </div>

                </div>
              )
            })
          )}
        </div>
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>📚 Arsip Riwayat & Pembatalan Persetujuan ({riwayatDisetujui.length})</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Daftar kamar yang telah disetujui. Anda dapat membuka detail arsip atau membatalkan persetujuan jika terjadi kesalahan.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riwayatDisetujui.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', border: '1px dashed #1e293b', borderRadius: '10px' }}>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Belum ada riwayat persetujuan di dalam arsip atau yang cocok dengan pencarian.</p>
            </div>
          ) : (
            riwayatDisetujui.map((inv) => {
              const penghuni = inv.kamar?.penghuni
              const waNum = formatNoHpToWa(penghuni?.nomorHp)
              const nomorKamarTeks = inv.kamar?.nomorKamar || '[Kamar Arsip]'
              const waText = encodeURIComponent(`Halo Kak ${penghuni?.nama || 'Penyewa'}, pembayaran sewa Kamar ${nomorKamarTeks} telah kami verifikasi lunas. Terima kasih!`)
              const waLink = waNum ? `https://wa.me/${waNum}?text=${waText}` : ''

              return (
                <details key={inv.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px 20px', color: '#fff', cursor: 'pointer' }}>
                  <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px', display: 'inline-block' }}>
                        Kamar {nomorKamarTeks} - <span style={{ color: '#4ade80' }}>{penghuni?.nama || 'Penghuni'}</span>
                      </h4>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                        Nominal: Rp {inv.jumlah.toLocaleString('id-ID')} • Lunas pada: {inv.tanggalBayar ? new Date(inv.tanggalBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                    </div>
                    <span style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      🔍 Buka Arsip & Opsi Edit
                    </span>
                  </summary>

                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#94a3b8' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>Nomor WhatsApp:</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#fff', fontWeight: '600' }}>{penghuni?.nomorHp || '-'}</span>
                          {waLink && (
                            <a href={waLink} target="_blank" rel="noreferrer" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textDecoration: 'none' }}>
                              💬 Chat WA
                            </a>
                          )}
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>Nomor KTP (NIK):</p>
                        <p style={{ margin: 0, fontWeight: '600', color: '#fff' }}>{penghuni?.nik || '-'}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px 0', color: '#64748b' }}>Status Kamar:</p>
                        <p style={{ margin: 0, fontWeight: '600', color: '#4ade80' }}>Terisi (Aktif)</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293b', marginTop: '6px', flexWrap: 'wrap', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#facc15' }}>⚠️ Perhatian: Jika persetujuan ini dilakukan karena salah klik, Anda dapat membatalkannya kembali ke antrean verifikasi.</span>
                      
                      <form action={batalkanPersetujuanAction} style={{ margin: 0 }}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        {/* Fallback string kosong untuk mencegah error tipe data */}
                        <input type="hidden" name="kamarId" value={inv.kamarId || ''} />
                        <button type="submit" style={{ backgroundColor: 'transparent', border: '1px solid #f87171', color: '#f87171', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Batalkan Persetujuan
                        </button>
                      </form>
                    </div>

                  </div>
                </details>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}