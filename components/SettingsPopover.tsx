'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function SettingsPopover({ userName, userRole }: { userName: string, userRole: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Menutup pop-up jika klik di luar area menu
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
    document.cookie = "user_id=; path=/; max-age=0"
    document.cookie = "user_role=; path=/; max-age=0"
    window.location.href = '/'
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={menuRef}>
      
      {/* Tombol Profil & Ikon Roda Gigi di Sidebar Bawah */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#38bdf8', color: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userName}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{userRole}</p>
          </div>
        </div>

        {/* Tombol Ikon Roda Gigi (Trigger Pop-up) */}
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'color 0.2s' }}
          title="Pengaturan Akun"
        >
          <span style={{ fontSize: '18px' }}>⚙️</span>
        </button>
      </div>

      {/* Kotak Menu Pop-up (Popup Panel) */}
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
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '4px'
        }}>
          <Link 
            href="/portal-penghuni/profil" 
            onClick={() => setIsOpen(false)}
            style={{ padding: '10px 12px', color: '#f8fafc', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            👤 Pengaturan Profil & Akun
          </Link>

          <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }}></div>

          <button 
            onClick={handleLogout}
            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#f87171', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px', transition: 'background 0.2s' }}
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