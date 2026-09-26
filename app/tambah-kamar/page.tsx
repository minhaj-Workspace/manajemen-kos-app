import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { StatusKamar } from '@prisma/client'

// ==========================================
// SERVER ACTION
// ==========================================
async function tambahKamarAction(formData: FormData) {
  'use server'

  const nomorKamar = formData.get('nomorKamar') as string
  const tipe = formData.get('tipe') as string
  const harga = parseFloat(formData.get('harga') as string)
  const status = (formData.get('status') as string) || 'TERSEDIA'

  if (!nomorKamar || !tipe || isNaN(harga)) return

  await prisma.kamar.create({
    data: {
      nomorKamar,
      tipe,
      harga,
      status: status as StatusKamar,
    },
  })

  revalidatePath('/')
  redirect('/')
}

// ==========================================
// HALAMAN UTAMA (WAJIB ADA EXPORT DEFAULT)
// ==========================================
export default async function TambahKamarPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toUpperCase()

  if (userRole !== 'OPERATOR' && userRole !== 'OWNER') {
    redirect('/')
  }

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', backgroundColor: '#090d16', minHeight: '100vh', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* Header Halaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 'bold' }}>MANAJEMEN KOS</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0 0', color: '#fff' }}>➕ Tambah Kamar Baru</h1>
        </div>
        <Link href="/" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#1e293b', padding: '8px 14px', borderRadius: '6px', border: '1px solid #334155' }}>
          &larr; Kembali
        </Link>
      </div>

      {/* Formulir Input Kamar */}
      <form action={tambahKamarAction} style={{ display: 'grid', gap: '18px', background: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#cbd5e1' }}>Nomor Kamar</label>
          <input 
            type="text" 
            name="nomorKamar" 
            required 
            placeholder="Contoh: 01, A02" 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#090d16', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '14px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#cbd5e1' }}>Tipe Kamar</label>
          <input 
            type="text" 
            name="tipe" 
            required 
            placeholder="Contoh: AC / Non-AC / Deluxe" 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#090d16', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '14px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#cbd5e1' }}>Harga per Bulan (Rp)</label>
          <input 
            type="number" 
            name="harga" 
            required 
            placeholder="Contoh: 750000" 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#090d16', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '14px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#cbd5e1' }}>Status Awal</label>
          <select 
            name="status" 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', boxSizing: 'border-box', background: '#090d16', color: '#fff', outline: 'none', fontSize: '14px' }}
          >
            <option value="TERSEDIA">Tersedia</option>
            <option value="TERISI">Terisi</option>
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
          Simpan Kamar Baru
        </button>
      </form>
    </main>
  )
}