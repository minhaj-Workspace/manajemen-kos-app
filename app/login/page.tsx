import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import Link from 'next/link'

// Server Action untuk memvalidasi login
async function loginUserAction(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return

  // Ambil data user terbaru langsung dari database
  const user = await prisma.user.findUnique({ where: { email } })
  
  if (!user) {
    redirect('/login')
  }

  const isValidPassword = await bcrypt.compare(password, user.password)
  
  if (!isValidPassword) {
    redirect('/login')
  }

  // Set ulang cookie sesi dengan menimpa nilai lama secara bersih
  const cookieStore = await cookies()
  
  // Hapus cookie lama terlebih dahulu untuk mencegah konflik cache
  cookieStore.set('user_id', '', { path: '/', maxAge: 0 })
  cookieStore.set('user_role', '', { path: '/', maxAge: 0 })

  // Tulis cookie baru dengan role yang benar-benar fresh dari database
  cookieStore.set('user_id', user.id.toString(), { 
    httpOnly: true, 
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7 
  })
  
  cookieStore.set('user_role', user.role.trim().toLowerCase(), { 
    httpOnly: true, 
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7 
  })

  // Arahkan ke root (/) agar app/page.tsx mengarahkan dashboard sesuai rolenya
  redirect('/')
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a202c', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#2d3748', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 20px 0', textAlign: 'center' }}>Masuk Kos-App</h1>

        <form action={loginUserAction} style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Email</label>
            <input 
              type="email" 
              name="email" 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4a5568', backgroundColor: '#1a202c', color: '#fff', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e0', fontSize: '14px', marginBottom: '6px' }}>Kata Sandi</label>
            <input 
              type="password" 
              name="password" 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4a5568', backgroundColor: '#1a202c', color: '#fff', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <button 
            type="submit"
            style={{ backgroundColor: '#38a169', color: '#fff', padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            Masuk
          </button>
        </form>

        <p style={{ color: '#a0aec0', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          Belum punya akun? <Link href="/register" style={{ color: '#68d391', textDecoration: 'none', fontWeight: 'bold' }}>Daftar di sini</Link>
        </p>
      </div>
    </main>
  )
}