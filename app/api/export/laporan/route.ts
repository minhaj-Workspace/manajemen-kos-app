import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const daftarInvoice = await prisma.invoice.findMany({
      include: {
        kamar: {
          include: { penghuni: true }
        }
      },
      orderBy: { jatuhTempo: 'desc' }
    })

    let csvContent = 'ID Tagihan,Nomor Kamar,Nama Penghuni,Jumlah (Rp),Status,Tanggal Jatuh Tempo,Tanggal Bayar\n'

    daftarInvoice.forEach((inv) => {
      const nomorKamar = inv.kamar?.nomorKamar || '-'
      const namaPenghuni = inv.kamar?.penghuni?.nama || 'Kosong'
      const jatuhTempo = inv.jatuhTempo ? new Date(inv.jatuhTempo).toLocaleDateString('id-ID') : '-'
      const tanggalBayar = inv.tanggalBayar ? new Date(inv.tanggalBayar).toLocaleDateString('id-ID') : '-'
      
      csvContent += `${inv.id},"${nomorKamar}","${namaPenghuni}",${inv.jumlah},"${inv.status}","${jatuhTempo}","${tanggalBayar}"\n`
    })

    const tanggalHariIni = new Date().toISOString().split('T')[0]
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Laporan_Keuangan_Kos_${tanggalHariIni}.csv"`,
      },
    })
  } catch (error) {
    console.error('Gagal mengekspor laporan:', error)
    return new NextResponse('Terjadi kesalahan saat mengekspor data', { status: 500 })
  }
}