import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import OperatorLayoutContent from './OperatorLayoutContent'
import AutoRefresh from '@/components/AutoRefresh'

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Ambil cookie secara asinkron (standar Next.js terbaru)
  const cookieStore = await cookies()
  const userIdStr = cookieStore.get('user_id')?.value
  const userRoleCookie = cookieStore.get('user_role')?.value || 'OPERATOR'

  let namaUser = 'Operator Sistem'
  let roleUser = userRoleCookie.toUpperCase()

  // 2. Ambil data profil terbaru dari database jika ID valid
  if (userIdStr) {
    const parsedId = parseInt(userIdStr, 10)
    
    if (!isNaN(parsedId)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: parsedId }
        })
        
        if (user) {
          namaUser = user.namaLengkap || user.email.split('@')[0]
          roleUser = user.role // Sudah berupa Enum kapital dari database (OPERATOR / OWNER)
        }
      } catch (error) {
        console.error('Gagal memuat data pengguna untuk layout:', error)
      }
    }
  }

  return (
    <OperatorLayoutContent initialName={namaUser} initialRole={roleUser}>
      {/* Auto-refresh bekerja di latar belakang untuk memperbarui data secara berkala */}
      <AutoRefresh intervalMs={10000} />
      
      {children}
    </OperatorLayoutContent>
  )
}