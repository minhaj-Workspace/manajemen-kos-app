import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import Link from 'next/link'

// Server Action untuk memproses registrasi
async function registerUserAction(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return

  // Cek apakah email sudah terdaftar
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    redirect('/register?error=Email sudah terdaftar')
  }

  // Enkripsi kata sandi
  const hashedPassword = await bcrypt.hash(password, 10)

  // Buat akun dengan role default 'Tenant' (Calon Penghuni)
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'Tenant'
    }
  })

  // Arahkan ke halaman login setelah sukses
  redirect('/login')
}

export default function RegisterPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a202c', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#2d3748', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 10px 0', textAlign: 'center' }}>Buat Akun Penghuni</h1>
        <p style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '25px', textAlign: 'center' }}>
          Daftar untuk mulai menyewa dan mengelola kamar kos Anda.
        </p>

        <form action={registerUserAction} style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Email</label>
            <input 
              type="email" 
              name="email" 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4a5568', backgroundColor: '#1a202c', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Kata Sandi</label>
            <input 
              type="password" 
              name="password" 
              required 
              minLength={6}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4a5568', backgroundColor: '#1a202c', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>

          <button 
            type="submit"
            style={{ backgroundColor: '#3182ce', color: '#fff', padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            Daftar Sekarang
          </button>
        </form>

        <p style={{ color: '#a0aec0', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          Sudah punya akun? <Link href="/login" style={{ color: '#63b3ed', textDecoration: 'none', fontWeight: 'bold' }}>Masuk di sini</Link>
        </p>
      </div>
    </main>
  )
}