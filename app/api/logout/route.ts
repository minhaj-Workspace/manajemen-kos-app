import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Fungsi pembantu untuk membersihkan cookie sesi
async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.set('user_id', '', { path: '/', maxAge: 0 })
  cookieStore.set('user_role', '', { path: '/', maxAge: 0 })
}

export async function POST(request: Request) {
  await destroySession()
  
  // Menggunakan URL asal request untuk keamanan redirect di production
  const loginUrl = new URL('/', request.url)
  return NextResponse.redirect(loginUrl, { status: 302 })
}

export async function GET(request: Request) {
  await destroySession()

  const loginUrl = new URL('/', request.url)
  return NextResponse.redirect(loginUrl, { status: 302 })
}