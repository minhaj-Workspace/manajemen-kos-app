'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

function SettingsPopover({ userName, userRole }: { userName: string, userRole: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    window.location.href = '/api/logout'
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={menuRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#38bdf8', color: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
            {userName ? userName.charAt(0).toUpperCase() : 'T'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userName}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{userRole}</p>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
          title="Pengaturan Akun"
        >
          <span style={{ fontSize: '18px' }}>⚙️</span>
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          marginBottom: '8px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '4px'
        }}>
          <Link 
            href="/portal-penghuni/profil" 
            onClick={() => setIsOpen(false)}
            style={{ padding: '10px 12px', color: '#f8fafc', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ⚙️ Pengaturan & Profil
          </Link>

          <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }}></div>

          <button 
            onClick={handleLogout}
            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#f87171', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🚪 Keluar Sesi
          </button>
        </div>
      )}
    </div>
  )
}

export default function PortalPenghuniLayout({ 
  children, 
  nomorDarurat, 
  namaTenant = 'Penghuni Kos' 
}: { 
  children: React.ReactNode, 
  nomorDarurat?: string,
  namaTenant?: string 
}) {
  const pathname = usePathname()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Menutup sidebar otomatis saat berpindah halaman di mobile
  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [pathname])

  const navItems = [
    { name: 'Dashboard', path: '/portal-penghuni', icon: '⊞' },
    { name: 'Keuangan Saya', path: '/portal-penghuni/keuangan', icon: '💳' },
    { name: 'Kontrak Sewa', path: '/portal-penghuni/kontrak', icon: '📄' },
    { name: 'Lapor Bantuan', path: '/portal-penghuni/bantuan', icon: '🛠️' },
    { name: 'Papan Pengumuman', path: '/portal-penghuni/pengumuman', icon: '📢' },
  ]

  const hotlineWa = nomorDarurat || '6280000000000'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#04060b', color: '#f1f5f9', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* CSS RESPONSIF UNTUK TABLET & MOBILE */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .tenant-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
          }
          .tenant-sidebar.mobile-open {
            transform: translateX(0) !important;
          }
          .tenant-main-wrapper {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .tenant-mobile-btn {
            display: flex !important;
          }
        }
        @media (min-width: 1025px) {
          .tenant-mobile-btn {
            display: none !important;
          }
          .tenant-menu-overlay {
            display: none !important;
          }
        }
      `}</style>

      {/* OVERLAY GELAP SAAT SIDEBAR MOBILE DIBUKA */}
      {isMobileSidebarOpen && (
        <div 
          className="tenant-menu-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 40,
          }}
        />
      )}

      {/* SIDEBAR KIRI (RESPONSIF) */}
      <aside 
        className={`tenant-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
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
        
        <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', color: '#f8fafc' }}>✦</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', letterSpacing: '0.5px' }}>
              Kos-App <span style={{ backgroundColor: '#0ea5e9', color: '#090d16', fontSize: '10px', padding: '3px 6px', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 'bold' }}>TENANT</span>
            </span>
          </div>
          {/* Tombol Close Mobile */}
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
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link key={item.name} href={item.path} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', 
                textDecoration: 'none', fontSize: '14px', fontWeight: isActive ? '600' : '500', 
                color: isActive ? '#fff' : '#94a3b8', 
                backgroundColor: isActive ? '#1e293b' : 'transparent',
                border: `1px solid ${isActive ? '#334155' : 'transparent'}`,
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* WIDGET HOTLINE */}
        <div style={{ padding: '16px', flexShrink: 0 }}>
          <a 
            href={`https://wa.me/${hotlineWa}?text=Halo%20Operator,%20saya%20penghuni%20ingin%20melaporkan%20keadaan%20darurat%20di%20kamar.`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '10px', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', 
              padding: '10px 12px', borderRadius: '8px', textDecoration: 'none'
            }}
          >
            <span style={{ fontSize: '16px' }}>🚨</span>
            <div>
              <p style={{ margin: '0 0 2px 0', color: '#f87171', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Darurat / Hotline</p>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '12px', fontWeight: '500' }}>WhatsApp Operator</p>
            </div>
          </a>
        </div>

        {/* PROFIL & SETTINGS */}
        <div style={{ padding: '16px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <SettingsPopover userName={namaTenant} userRole="TENANT AKTIF" />
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <div 
        className="tenant-main-wrapper"
        style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#04060b', width: 'calc(100% - 260px)', boxSizing: 'border-box' }}
      >
        
        {/* HEADER / TOPBAR DENGAN TOMBOL MENU HAMBURGER */}
        <header style={{ height: '70px', borderBottom: '1px solid #1e293b', backgroundColor: '#090d16', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 30, boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Tombol Hamburger Mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="tenant-mobile-btn"
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

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>🔍 Portal Tenant Kos-App</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Sistem Online</span>
          </div>
        </header>

        {/* KONTEN DINAMIS HALAMAN */}
        <main style={{ flex: 1, padding: '24px', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

    </div>
  )
}