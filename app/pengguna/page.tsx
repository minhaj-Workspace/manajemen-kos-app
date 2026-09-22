import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

// Server Action untuk mengubah Role pengguna
async function updateRoleAction(formData: FormData) {
  'use server'
  const userId = parseInt(formData.get('userId') as string, 10)
  const newRole = formData.get('newRole') as string

  if (!userId || !newRole) return

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  })

  revalidatePath('/pengguna')
}

export default async function PenggunaPage() {
  // Proteksi Akses: Izinkan Operator maupun Owner (fleksibel & aman dari case-sensitivity)
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value?.trim().toLowerCase()

  if (userRole !== 'operator' && userRole !== 'owner') {
    redirect('/')
  }

  // Ambil daftar seluruh user yang terdaftar di sistem
  const daftarUser = await prisma.user.findMany({
    orderBy: { id: 'asc' }
  })

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#fff' }}>
            👥 Manajemen Otoritas Pengguna
          </h1>
          <p style={{ color: '#a0aec0', margin: 0, fontSize: '14px' }}>
            Kelola hak akses akun (Tenant / Operator / Owner) yang terdaftar di sistem.
          </p>
        </div>
        
        <Link 
          href="/" 
          style={{ backgroundColor: '#4a5568', color: '#fff', padding: '10px 14px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}
        >
          ← Kembali ke Dasbor
        </Link>
      </div>

      {/* Tabel Daftar Pengguna */}
      <div style={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e0', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2d3748', color: '#fff', borderBottom: '1px solid #4a5568' }}>
                <th style={{ padding: '15px' }}>ID</th>
                <th style={{ padding: '15px' }}>Email Akun</th>
                <th style={{ padding: '15px' }}>Role Saat Ini</th>
                <th style={{ padding: '15px', textAlign: 'center' }}>Aksi Ubah Role</th>
              </tr>
            </thead>
            <tbody>
              {daftarUser.map((user) => {
                const isOperatorOrOwner = user.role.toLowerCase() === 'operator' || user.role.toLowerCase() === 'owner'
                const targetRole = isOperatorOrOwner ? 'Tenant' : 'Operator'

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #2d3748' }}>
                    <td style={{ padding: '15px' }}>{user.id}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#fff' }}>{user.email}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        backgroundColor: isOperatorOrOwner ? '#22543d' : '#2b6cb0',
                        color: isOperatorOrOwner ? '#c6f6d5' : '#ebf8ff'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <form action={updateRoleAction} style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', margin: 0 }}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input 
                          type="hidden" 
                          name="newRole" 
                          value={targetRole} 
                        />
                        <button 
                          type="submit"
                          style={{
                            backgroundColor: isOperatorOrOwner ? '#c53030' : '#38a169',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {isOperatorOrOwner ? 'Turunkan jadi Tenant' : 'Jadikan Operator'}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  )
}