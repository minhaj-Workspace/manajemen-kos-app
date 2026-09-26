import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// ==========================================
// SERVER ACTION (Enum Mutakhir: PENDING, BELUM_LUNAS, BOOKING)
// ==========================================
async function submitBookingAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) redirect('/login')

  const kamarId = parseInt(formData.get('kamarId') as string, 10)
  const nama = formData.get('nama') as string
  const nomorHp = formData.get('nomorHp') as string
  const nik = formData.get('nik') as string
  const durasiBulan = parseInt(formData.get('durasiBulan') as string, 10)
  const tanggalMulai = new Date(formData.get('tanggalMulai') as string)
  
  const fileKtp = formData.get('fotoKtp') as File | null
  const fotoKtp = fileKtp && fileKtp.size > 0 ? fileKtp.name : "pending-upload.jpg" 

  try {
    const kamar = await prisma.kamar.findUnique({ where: { id: kamarId } })
    if (!kamar) return

    await prisma.$transaction(async (tx) => {
      // 1. Upsert Profil Penghuni
      const penghuni = await tx.penghuni.upsert({
        where: { userId: parseInt(userId, 10) },
        update: {
          nama,
          nomorHp,
          nik,
          fotoKtp,
          tanggalMasuk: tanggalMulai,
          kamarId: kamar.id,
          isAkunUtama: true
        },
        create: {
          nama,
          nomorHp,
          nik,
          fotoKtp,
          tanggalMasuk: tanggalMulai,
          userId: parseInt(userId, 10),
          kamarId: kamar.id,
          isAkunUtama: true
        }
      })

      // 2. Buat Kontrak dengan Enum 'PENDING'
      const kontrakBaru = await tx.kontrak.create({
        data: {
          kamarId: kamar.id,
          penghuniId: penghuni.id,
          tanggalMulai,
          durasiBulan,
          status: 'PENDING' // Enum Mutakhir
        }
      })

      // 3. Buat Tagihan (Invoice) dengan Enum 'BELUM_LUNAS'
      const totalTagihan = kamar.harga * durasiBulan
      const jatuhTempo = new Date()
      jatuhTempo.setDate(jatuhTempo.getDate() + 1) // Batas waktu 1x24 jam

      await tx.invoice.create({
        data: {
          kamarId: kamar.id,
          penghuniId: penghuni.id,
          kontrakId: kontrakBaru.id,
          jumlah: totalTagihan,
          jatuhTempo,
          status: 'BELUM_LUNAS' // Enum Mutakhir
        }
      })

      // 4. Ubah status Kamar menjadi 'BOOKING'
      await tx.kamar.update({
        where: { id: kamar.id },
        data: { status: 'BOOKING' } // Enum Mutakhir
      })
    })

  } catch (error) {
    console.error("Terjadi kesalahan saat booking:", error)
    throw new Error("Gagal melakukan booking. Silakan coba lagi.")
  }

  redirect('/pembayaran')
}

// ==========================================
// KOMPONEN HALAMAN BOOKING
// ==========================================
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const kamarId = parseInt(resolvedParams.id, 10)
  
  const kamar = await prisma.kamar.findUnique({
    where: { id: kamarId }
  })

  // Memeriksa ketersediaan menggunakan Enum 'TERSEDIA'
  if (!kamar || kamar.status !== 'TERSEDIA') {
    return (
      <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center', color: '#fff' }}>
        <h2>Mohon Maaf, kamar ini sudah tidak tersedia atau sedang dibooking orang lain.</h2>
        <Link href="/katalog-kamar" style={{ color: '#63b3ed' }}>Kembali ke Katalog</Link>
      </main>
    )
  }

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#fff' }}>
            📝 Formulir Pengajuan Sewa Kamar
          </h1>
          <p style={{ color: '#a0aec0', margin: 0, fontSize: '15px' }}>
            Lengkapi data identitas Anda untuk memesan <strong>Kamar {kamar.nomorKamar}</strong>
          </p>
        </div>
        <Link 
          href="/katalog-kamar" 
          style={{ backgroundColor: '#4a5568', color: '#fff', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
        >
          Batal
        </Link>
      </div>

      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', padding: '30px' }}>
        <div style={{ backgroundColor: '#2d3748', padding: '15px', borderRadius: '6px', marginBottom: '25px' }}>
          <p style={{ margin: '0 0 5px 0', color: '#cbd5e0', fontSize: '14px' }}>Kamar yang dipilih:</p>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Kamar {kamar.nomorKamar} - {kamar.tipe}</h3>
          <p style={{ margin: '5px 0 0 0', color: '#68d391', fontWeight: 'bold' }}>Rp {kamar.harga.toLocaleString('id-ID')} / bulan</p>
        </div>

        <form action={submitBookingAction} style={{ display: 'grid', gap: '20px' }}>
          <input type="hidden" name="kamarId" value={kamar.id} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Nama Lengkap (Sesuai KTP)</label>
              <input type="text" name="nama" required style={inputStyle} placeholder="Cth: Minhajuddin Madi" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Nomor WhatsApp</label>
              <input type="text" name="nomorHp" required style={inputStyle} placeholder="Cth: 081234567890" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Nomor Induk Kependudukan (NIK)</label>
              <input type="text" name="nik" required style={inputStyle} placeholder="16 digit NIK" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Unggah Foto KTP</label>
              <input type="file" name="fotoKtp" accept="image/*" style={inputStyle} />
              <small style={{ color: '#718096', fontSize: '12px' }}>*Untuk sementara, file tidak akan tersimpan hingga kita memasang Cloud Storage.</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Rencana Durasi Sewa (Bulan)</label>
              <input type="number" name="durasiBulan" min="1" defaultValue="1" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Tanggal Masuk</label>
              <input type="date" name="tanggalMulai" required style={inputStyle} />
            </div>
          </div>

          <button 
            type="submit"
            style={{ backgroundColor: '#3182ce', color: '#fff', padding: '15px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', fontSize: '16px' }}
          >
            Sewa Kamar & Buat Tagihan
          </button>
        </form>
      </div>
    </main>
  )
}

const inputStyle = {
  width: '100%', 
  padding: '10px', 
  borderRadius: '6px', 
  border: '1px solid #4a5568', 
  backgroundColor: '#2d3748', 
  color: '#fff', 
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit'
}