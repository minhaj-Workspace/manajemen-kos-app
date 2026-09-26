import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Ambil data invoice dengan relasi lengkap ke kamar dan penghuni
    const invoicesEnterprise = await prisma.invoice.findMany({
      include: {
        kamar: true,
        penghuni: true
      },
      orderBy: { jatuhTempo: 'desc' }
    })

    // Tambahkan BOM (\uFEFF) di awal agar Excel Windows membaca UTF-8 dengan benar
    let csvContent = '\uFEFFID Tagihan,Nomor Kamar,Nama Penghuni,Jumlah (Rp),Status,Tanggal Jatuh Tempo,Tanggal Bayar\n'

    invoicesEnterprise.forEach((inv) => {
      const nomorKamar = inv.kamar?.nomorKamar || '-'
      const namaPenghuni = inv.penghuni?.nama || 'Tanpa Nama'
      const jatuhTempo = inv.jatuhTempo ? new Date(inv.jatuhTempo).toLocaleDateString('id-ID') : '-'
      const tanggalBayar = inv.tanggalBayar ? new Date(inv.tanggalBayar).toLocaleDateString('id-ID') : '-'
      const statusBersih = inv.status.replace('_', ' ')
      
      csvContent += `${inv.id},"${nomorKamar}","${namaPenghuni}",${inv.jumlah},"${statusBersih}","${jatuhTempo}","${tanggalBayar}"\n`
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