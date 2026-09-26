'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function OperatorLayoutContent({
  children,
  initialName,
  initialRole,
}: {
  children: React.ReactNode
  initialName: string
  initialRole: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false) // State khusus menu mobile/tablet
  const menuRef = useRef<HTMLDivElement>(null)

  // Menutup dropdown profil jika pengguna mengklik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Menutup sidebar mobile otomatis saat berpindah halaman
  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [pathname])

  // Fungsi pengatur gaya menu aktif secara dinamis
  const getMenuStyle = (path: string) => {
    const isActive = pathname === path
    return {
      padding: '12px 16px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: isActive ? '600' : '500',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      backgroundColor: isActive ? '#1e293b' : 'transparent',
      color: isActive ? '#fff' : '#94a3b8',
      border: `1px solid ${isActive ? '#334155' : 'transparent'}`,
    }
  }

  // Aksi submit pencarian global
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    router.push(`/penghuni?search=${encodeURIComponent(searchQuery.trim())}`)
    
    setTimeout(() => {
      setIsSearching(false)
    }, 500)
  }

  const inisialNama = initialName ? initialName.charAt(0).toUpperCase() : 'M'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#04060b', color: '#f1f5f9', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* CSS RESPONSIF UNTUK MEDIA QUERIES (TABLET & MOBILE) */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .desktop-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
          }
          .desktop-sidebar.mobile-open {
            transform: translateX(0) !important;
          }
          .main-content-wrapper {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .mobile-top-bar {
            display: flex !important;
          }
        }
        @media (min-width: 1025px) {
          .mobile-top-bar {
            display: none !important;
          }
          .mobile-menu-overlay {
            display: none !important;
          }
        }
      `}</style>

      {/* OVERLAY GELAP SAAT SIDEBAR MOBILE DIBUKA */}
      {isMobileSidebarOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 40,
          }}
        />
      )}

      {/* SIDEBAR UTAMA (RESPONSIF UNTUK DESKTOP, TABLET, & HP) */}
      <aside 
        className={`desktop-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
        style={{ 
          width: '260px', 
          backgroundColor: '#090d16', 
          borderRight: '1px solid #1e293b', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'fixed', 
          top: 0, 
          bottom: 0, 
          left: 0, 
          zIndex: 50,
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        <div style={{ padding: '28px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            ✦ Kos-App <span style={{ fontSize: '10px', backgroundColor: '#38bdf8', color: '#090d16', padding: '3px 6px', borderRadius: '4px' }}>PRO</span>
          </h2>
          {/* Tombol Close khusus tampilan Mobile/Tablet */}
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
            className="lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* DAFTAR MENU NAVIGASI */}
        <nav style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          <Link href="/dashboard-operator" style={getMenuStyle('/dashboard-operator')}>⊞ Dashboard</Link>
          <Link href="/penghuni" style={getMenuStyle('/penghuni')}>👥 Kelola Penghuni</Link>
          <Link href="/edit-kamar" style={getMenuStyle('/edit-kamar')}>🚪 Manajemen Kamar</Link>
          <Link href="/tagihan" style={getMenuStyle('/tagihan')}>💳 Tagihan & Invoice</Link>
          <Link href="/verifikasi" style={getMenuStyle('/verifikasi')}>🛡️ Verifikasi Bayar</Link>
          <Link href="/laporan-keuangan" style={getMenuStyle('/laporan-keuangan')}>📊 Laporan Keuangan</Link>
          <Link href="/maintenance" style={getMenuStyle('/maintenance')}>🛠️ Maintenance</Link>
        </nav>

        {/* PROFIL & POPUP DROPDOWN */}
        <div ref={menuRef} style={{ padding: '16px', borderTop: '1px solid #1e293b', position: 'relative' }}>
          
          {isMenuOpen && (
            <div style={{
              position: 'absolute',
              bottom: '70px',
              left: '16px',
              right: '16px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 100
            }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', marginBottom: '4px' }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{initialName}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#38bdf8' }}>{initialRole}</p>
              </div>

              <Link 
                href="/settings" 
                onClick={() => setIsMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px', color: '#cbd5e1', textDecoration: 'none', fontSize: '13px' }}
              >
                <span>⚙️</span> Pengaturan Sistem
              </Link>

              <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }}></div>

              <form action="/api/logout" method="POST">
                <button 
                  type="submit" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px', background: 'none', border: 'none', color: '#f87171', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                >
                  <span>⎋</span> Keluar Sesi
                </button>
              </form>
            </div>
          )}

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isMenuOpen ? '#1e293b' : '#0f172a',
              border: '1px solid #1e293b',
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#fff',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', color: '#090d16', flexShrink: 0 }}>
                {inisialNama}
              </div>
              <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{initialName}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{initialRole}</p>
              </div>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>⚙️</span>
          </button>

        </div>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <div 
        className="main-content-wrapper"
        style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#04060b', width: 'calc(100% - 260px)', boxSizing: 'border-box' }}
      >
        
        {/* HEADER ATAS DENGAN HAMBURGER MENU KHUSUS MOBILE & TABLET */}
        <header style={{ height: '70px', borderBottom: '1px solid #1e293b', backgroundColor: '#090d16', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', position: 'sticky', top: 0, zIndex: 30, boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '400px' }}>
            {/* Tombol Hamburger Menu untuk Tablet & HP */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mobile-top-bar"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                padding: '8px 12px',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0
              }}
            >
              <span>☰ Menu</span>
            </button>

            {/* Kolom Pencarian */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 12px', width: '100%', gap: '8px', boxSizing: 'border-box' }}>
              <span style={{ color: '#64748b', fontSize: '14px' }}>🔍</span>
              <input 
                type="text" 
                placeholder={isSearching ? "Mencari..." : "Cari data penghuni..."} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' }}
              />
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{initialRole}</span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

    </div>
  )
}