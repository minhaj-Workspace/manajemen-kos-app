import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import OperatorLayoutContent from './OperatorLayoutContent'
import AutoRefresh from '@/components/AutoRefresh' // <-- 1. Impor komponen Auto-Refresh

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const userIdStr = cookieStore.get('user_id')?.value
  const userRoleCookie = cookieStore.get('user_role')?.value || 'Operator'

  let namaUser = 'Minhajuddin Madi'
  let roleUser = userRoleCookie

  if (userIdStr) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userIdStr, 10) }
    })
    if (user) {
      namaUser = user.namaLengkap || user.email.split('@')[0]
      roleUser = user.role
    }
  }

  return (
    <OperatorLayoutContent initialName={namaUser} initialRole={roleUser}>
      {/* 2. Pasang Auto-Refresh di sini (senyap di latar belakang setiap 10 detik) */}
      <AutoRefresh intervalMs={10000} />
      
      {children}
    </OperatorLayoutContent>
  )
}