import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const userRole = cookieStore.get('user_role')?.value

  // Jika belum login, arahkan ke halaman login
  if (!userId || !userRole) {
    redirect('/login')
  }

  // Normalisasi role ke lowercase untuk menghindari error perbedaan huruf besar/kecil
  const normalizedRole = userRole.trim().toLowerCase()

  // Pengalihan otomatis berdasarkan peran (Operator & Owner digabung ke dashboard operator)
  if (normalizedRole === 'operator' || normalizedRole === 'owner') {
    redirect('/dashboard-operator') 
  }

  if (normalizedRole === 'tenant' || normalizedRole === 'penghuni') {
    redirect('/portal-penghuni')
  }

  // Fallback jika role benar-benar tidak dikenali
  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '30px', borderRadius: '12px', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '20px', color: '#f87171', marginBottom: '10px' }}>Akses Terbatas</h1>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>Peran akun Anda ({userRole}) tidak valid atau tidak memiliki izin akses ke sistem.</p>
        <Link href="/login" style={{ backgroundColor: '#0ea5e9', color: '#fff', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
          Kembali ke Login
        </Link>
      </div>
    </main>
  )
}