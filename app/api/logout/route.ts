import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  
  // Hapus cookie sesi dengan menimpa masa aktifnya menjadi 0
  cookieStore.set('user_id', '', { path: '/', maxAge: 0 })
  cookieStore.set('user_role', '', { path: '/', maxAge: 0 })

  // Redirect kembali ke halaman utama / login
  return NextResponse.redirect(new URL('/', request.url), { status: 302 })
}

// Menangani juga jika diakses via GET
export async function GET(request: Request) {
  const cookieStore = await cookies()
  cookieStore.set('user_id', '', { path: '/', maxAge: 0 })
  cookieStore.set('user_role', '', { path: '/', maxAge: 0 })

  return NextResponse.redirect(new URL('/', request.url), { status: 302 })
}