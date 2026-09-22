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
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#04060b', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '260px', backgroundColor: '#090d16', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10 }}>
        <div style={{ padding: '28px 24px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            ✦ Kos-App <span style={{ fontSize: '10px', backgroundColor: '#38bdf8', color: '#090d16', padding: '3px 6px', borderRadius: '4px' }}>PRO</span>
          </h2>
        </div>

        {/* DAFTAR MENU NAVIGASI UTAMA */}
        <nav style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          <Link href="/dashboard-operator" style={getMenuStyle('/dashboard-operator')}>⊞ Dashboard</Link>
          <Link href="/penghuni" style={getMenuStyle('/penghuni')}>👥 Kelola Penghuni</Link>
          <Link href="/edit-kamar" style={getMenuStyle('/edit-kamar')}>🚪 Manajemen Kamar</Link>
          <Link href="/tagihan" style={getMenuStyle('/tagihan')}>💳 Tagihan & Invoice</Link>
          <Link href="/verifikasi" style={getMenuStyle('/verifikasi')}>🛡️ Verifikasi Bayar</Link>
          <Link href="/laporan-keuangan" style={getMenuStyle('/laporan-keuangan')}>📊 Laporan Keuangan</Link>
          <Link href="/maintenance" style={getMenuStyle('/maintenance')}>🛠️ Maintenance</Link>
        </nav>

        {/* ⚙️ PROFIL & POPUP DROPDOWN INTERAKTIF */}
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
                <p style={{ margin: 0, fontSize: '11px', color: '#38bdf8' }}>{initialRole} (PRO)</p>
              </div>

              <Link 
                href="/settings" 
                onClick={() => setIsMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px', color: '#cbd5e1', textDecoration: 'none', fontSize: '13px', transition: 'background 0.2s' }}
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
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', color: '#090d16' }}>
                {inisialNama}
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{initialName}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{initialRole}</p>
              </div>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>⚙️</span>
          </button>

        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <div style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#04060b' }}>
        
        <header style={{ height: '70px', borderBottom: '1px solid #1e293b', backgroundColor: '#090d16', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', position: 'sticky', top: 0, zIndex: 9 }}>
          
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 14px', width: '340px', gap: '10px' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>🔍</span>
            <input 
              type="text" 
              placeholder={isSearching ? "Mencari..." : "Cari data penghuni/kamar (Tekan Enter)..."} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' }}
            />
            <span style={{ fontSize: '10px', backgroundColor: '#1e293b', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px' }}>↵</span>
          </form>

          <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>{initialRole} Aktif</span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '40px', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>

    </div>
  )
}