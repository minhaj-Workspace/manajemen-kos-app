import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Ambil cookie sesi dengan aman dan normalisasi ke huruf kecil
  const userId = request.cookies.get('user_id')?.value
  const userRole = request.cookies.get('user_role')?.value?.trim().toLowerCase()

  // 2. Daftar rute yang wajib dilindungi (hanya bisa diakses jika sudah login)
  const isProtectedPath = 
    pathname.startsWith('/portal-penghuni') || 
    pathname.startsWith('/dashboard-operator') || 
    pathname.startsWith('/penghuni') || 
    pathname.startsWith('/settings') || 
    pathname.startsWith('/kamar') ||
    pathname.startsWith('/tagihan') ||
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/verifikasi') ||
    pathname.startsWith('/laporan-keuangan')

  // Jika belum login dan mencoba masuk ke rute privat -> arahkan ke /login
  if (!userId && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Jika sudah login, atur hak akses berdasarkan role
  if (userId) {
    // A. Jika akun adalah TENANT / PENGHUNI
    if (userRole === 'tenant' || userRole === 'penghuni') {
      // Jika tenant mencoba keluar dari area portal-penghuni, paksa kembali ke portalnya
      if (!pathname.startsWith('/portal-penghuni')) {
        return NextResponse.redirect(new URL('/portal-penghuni', request.url))
      }
    } 
    // B. Jika akun adalah OPERATOR atau OWNER
    else if (userRole === 'operator' || userRole === 'owner') {
      // Jika pengelola (operator/owner) mencoba masuk ke portal penghuni, arahkan ke dashboard operator
      if (pathname.startsWith('/portal-penghuni')) {
        return NextResponse.redirect(new URL('/dashboard-operator', request.url))
      }
    }
  }

  // 3. Mencegah Celah Cache Browser
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

// Konfigurasi rute universal yang diawasi middleware
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register).*)',
  ],
}