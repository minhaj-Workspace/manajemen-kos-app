import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint ini dirancang untuk dipanggil oleh Cron Job otomatis setiap pukul 00:01
export async function GET(request: Request) {
  try {
    // 1. Keamanan Opsional: Cek Secret Token dari Header Cron (jika menggunakan Vercel/External Scheduler)
    const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const hariIni = new Date()
    hariIni.setHours(0, 0, 0, 0)

    // 2. Ambil semua invoice yang belum lunas/diverifikasi dan sudah melewati jatuh tempo
    const tagihanExpired = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['Lunas', 'Menunggu Verifikasi'] },
        jatuhTempo: {
          lt: hariIni
        }
      },
      include: {
        kamar: {
          include: {
            penghuni: true
          }
        }
      }
    })

    let jumlahDiupdate = 0

    // 3. Ubah status menjadi Overdue (Menunggak) secara massal
    for (const inv of tagihanExpired) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'Overdue' } // Menandai bahwa tagihan ini menunggak
      })
      jumlahDiupdate++
      
      // Contoh integrasi WhatsApp API di masa depan:
      // const nomorHp = inv.kamar?.penghuni?.nomorHp;
      // if (nomorHp) {
      //   kirimPesanWhatsApp(nomorHp, `Tagihan Anda senilai Rp ${inv.jumlah.toLocaleString('id-ID')} telah menunggak.`);
      // }
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job pengecekan penagihan berhasil dijalankan.',
      timestamp: new Date().toISOString(),
      totalOverdueUpdated: jumlahDiupdate,
      detail: tagihanExpired.map(i => `Invoice #${i.id} - Kamar ${i.kamar?.nomorKamar} diubah ke Overdue`)
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error Cron Job Penagihan:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan pada server cron job.'
    }, { status: 500 })
  }
}