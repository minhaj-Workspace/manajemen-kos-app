import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { StatusInvoice } from '@prisma/client' // Sesuaikan dengan enum Prisma invoice Anda jika ada

// ==========================================
// SERVER ACTION: SIMPAN TAGIHAN BARU
// ==========================================
async function simpanTagihanAction(formData: FormData) {
  'use server'
  const kamarId = formData.get('kamarId') as string
  const jumlah = formData.get('jumlah') as string
  const jatuhTempo = formData.get('jatuhTempo') as string
  const status = (formData.get('status') as string) || 'BELUM_LUNAS'

  if (!kamarId || !jumlah || !jatuhTempo) return

  await prisma.invoice.create({
    data: {
      kamarId: parseInt(kamarId, 10),
      jumlah: parseFloat(jumlah),
      jatuhTempo: new Date(jatuhTempo),
      status: status as StatusInvoice, // Type casting aman ke Enum Prisma
    },
  })

  revalidatePath('/tagihan')
  redirect('/tagihan')
}

// ==========================================
// HALAMAN UTAMA TAMBAH TAGIHAN
// ==========================================
export default async function TambahTagihanPage() {
  // Proteksi Akses: Hanya Operator atau Owner (Enum Kapital Mutakhir)
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  if (userRole !== 'OPERATOR' && userRole !== 'OWNER') {
    redirect('/')
  }

  // Ambil daftar kamar untuk pilihan dropdown
  const daftarKamar = await prisma.kamar.findMany({
    orderBy: { nomorKamar: 'asc' }
  })

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header Halaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>MANAJEMEN KEUANGAN</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0 0', color: '#fff' }}>
            ➕ Buat Tagihan Baru
          </h1>
        </div>
        <Link href="/tagihan" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#1e293b', padding: '8px 14px', borderRadius: '6px', border: '1px solid #334155' }}>
          ← Kembali
        </Link>
      </div>

      <form action={simpanTagihanAction} style={{ display: 'grid', gap: '20px', backgroundColor: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b' }}>
        
        {/* Pilih Kamar */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>Pilih Kamar</label>
          <select 
            name="kamarId" 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#090d16', color: '#fff', border: '1px solid #334155', outline: 'none', fontSize: '14px' }}
          >
            <option value="">-- Pilih Kamar --</option>
            {daftarKamar.map((kamar) => (
              <option key={kamar.id} value={kamar.id}>
                Kamar {kamar.nomorKamar} - Rp {kamar.harga.toLocaleString('id-ID')}
              </option>
            ))}
          </select>
        </div>

        {/* Jumlah Tagihan */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>Jumlah Tagihan (Rp)</label>
          <input 
            type="number" 
            name="jumlah" 
            placeholder="Contoh: 650000" 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#090d16', color: '#fff', border: '1px solid #334155', outline: 'none', fontSize: '14px' }}
          />
        </div>

        {/* Tanggal Jatuh Tempo */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>Tanggal Jatuh Tempo</label>
          <input 
            type="date" 
            name="jatuhTempo" 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#090d16', color: '#fff', border: '1px solid #334155', outline: 'none', fontSize: '14px' }}
          />
        </div>

        {/* Status Awal (Menggunakan Nilai Enum Kapital) */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>Status Pembayaran</label>
          <select 
            name="status" 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#090d16', color: '#fff', border: '1px solid #334155', outline: 'none', fontSize: '14px' }}
          >
            <option value="BELUM_LUNAS">Belum Lunas</option>
            <option value="LUNAS">Lunas</option>
          </select>
        </div>

        <button 
          type="submit" 
          style={{ 
            backgroundColor: '#38bdf8', 
            color: '#090d16', 
            padding: '14px', 
            borderRadius: '8px', 
            border: 'none', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            marginTop: '10px',
            fontSize: '14px',
            transition: 'background 0.2s'
          }}
        >
          Simpan Tagihan Baru
        </button>
      </form>
    </main>
  )
}