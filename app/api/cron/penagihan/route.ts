import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint ini dirancang untuk dipanggil oleh Cron Job otomatis setiap pukul 00:01 WITA
export async function GET(request: Request) {
  try {
    // 1. Keamanan Opsional: Cek Secret Token dari Header Cron (Vercel Cron / External Scheduler)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Presisi Zona Waktu Lokal (WITA - Asia/Makassar / UTC+8)
    const hariIni = new Date()
    const utcOffset = hariIni.getTimezoneOffset() * 60000
    const witaOffset = 8 * 3600000 // UTC+8
    const hariIniWITA = new Date(hariIni.getTime() + utcOffset + witaOffset)
    hariIniWITA.setHours(0, 0, 0, 0)

    // 3. Ambil semua invoice yang BELUM_LUNAS dan sudah melewati jatuh tempo
    // Menggunakan Enum Mutakhir: 'LUNAS', 'MENUNGGU_VERIFIKASI', 'BELUM_LUNAS'
    const tagihanExpired = await prisma.invoice.findMany({
      where: {
        status: 'BELUM_LUNAS',
        jatuhTempo: {
          lt: hariIniWITA
        }
      },
      include: {
        kamar: {
          include: {
            penghuni: true
          }
        },
        penghuni: true
      }
    })

    let jumlahTeridentifikasi = tagihanExpired.length

    // 4. Proses log atau persiapan integrasi pengingat WhatsApp otomatis
    const detailLog = tagihanExpired.map(inv => {
      const namaPenghuni = inv.penghuni?.nama || 'Penyewa'
      const nomorHp = inv.penghuni?.nomorHp
      
      // Di sini Anda bisa memicu fungsi pengiriman WhatsApp Gateway di masa depan
      if (nomorHp) {
        // console.log(`Mengirim pengingat ke ${nomorHp} untuk Invoice #${inv.id}`)
      }

      return `Invoice #${inv.id} - Kamar ${inv.kamar?.nomorKamar || '-'} (${namaPenghuni}) melewati jatuh tempo.`
    })

    return NextResponse.json({
      success: true,
      message: 'Cron job pengecekan penagihan berhasil dijalankan.',
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Makassar (WITA)',
      totalOverdueDetected: jumlahTeridentifikasi,
      detail: detailLog
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error Cron Job Penagihan:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan pada server cron job.'
    }, { status: 500 })
  }
}