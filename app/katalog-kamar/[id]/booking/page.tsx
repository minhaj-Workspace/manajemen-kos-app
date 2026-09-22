import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// Server Action untuk memproses Booking (SOP 3 & 4)
async function submitBookingAction(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) redirect('/login')

  // Ambil data dari form
  const kamarId = parseInt(formData.get('kamarId') as string)
  const nama = formData.get('nama') as string
  const nomorHp = formData.get('nomorHp') as string
  const nik = formData.get('nik') as string
  const durasiBulan = parseInt(formData.get('durasiBulan') as string)
  const tanggalMulai = new Date(formData.get('tanggalMulai') as string)
  
  // Cek file fotoKtp dari form (bisa dikembangkan ke depannya untuk cloud storage)
  const fileKtp = formData.get('fotoKtp') as File | null
  const fotoKtp = fileKtp && fileKtp.size > 0 ? fileKtp.name : "pending-upload.jpg" 

  try {
    const kamar = await prisma.kamar.findUnique({ where: { id: kamarId } })
    if (!kamar) return

    // 1. Gunakan upsert agar tidak error saat profil sudah ada
    const penghuni = await prisma.penghuni.upsert({
      where: { userId: parseInt(userId) },
      update: {
        nama,
        nomorHp,
        nik,
        fotoKtp,
        tanggalMasuk: tanggalMulai,
        kamarId: kamar.id
      },
      create: {
        nama,
        nomorHp,
        nik,
        fotoKtp,
        tanggalMasuk: tanggalMulai,
        userId: parseInt(userId),
        kamarId: kamar.id
      }
    })

    // 2. Buat Kontrak (Rentals) Sementara (SOP 4)
    await prisma.kontrak.create({
      data: {
        kamarId: kamar.id,
        penghuniId: penghuni.id,
        tanggalMulai,
        durasiBulan,
        status: 'Pending' 
      }
    })

    // 3. Buat Tagihan (Invoice) (SOP 4)
    const totalTagihan = kamar.harga * durasiBulan
    const jatuhTempo = new Date()
    jatuhTempo.setDate(jatuhTempo.getDate() + 1) // Batas waktu bayar 1x24 jam

    await prisma.invoice.create({
      data: {
        kamarId: kamar.id,
        jumlah: totalTagihan,
        jatuhTempo,
        status: 'Belum Lunas'
      }
    })

    // 4. Ubah status Kamar agar tidak dipesan orang lain (SOP 4)
    await prisma.kamar.update({
      where: { id: kamar.id },
      data: { status: 'Booking' }
    })

  } catch (error) {
    console.error("Terjadi kesalahan saat booking:", error)
    throw new Error("Gagal melakukan booking. Silakan coba lagi.")
  }

  // 5. Redirect harus berada di luar try-catch 
  redirect('/pembayaran')
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const kamarId = parseInt(resolvedParams.id)
  
  const kamar = await prisma.kamar.findUnique({
    where: { id: kamarId }
  })

  if (!kamar || kamar.status !== 'Tersedia') {
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