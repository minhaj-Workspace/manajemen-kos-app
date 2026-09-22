'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalCommandMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  // Mendengarkan tombol Ctrl + K atau Cmd + K di keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isOpen) return null

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '100px' }}>
      <div style={{ width: '600px', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Kotak Input Pencarian */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#38bdf8', fontSize: '18px' }}>🔍</span>
          <input 
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik menu tujuan atau navigasi..."
            style={{ width: '100%', backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '15px', outline: 'none' }}
          />
          <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>ESC</span>
        </div>

        {/* Daftar Menu Pintasan */}
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', padding: '4px 8px' }}>
            Menu Utama Enterprise
          </div>

          <div 
            onClick={() => handleNavigate('/dashboard-operator')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>📊 Dasbor Operator Utama</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>

          <div 
            onClick={() => handleNavigate('/tagihan')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>💳 Manajemen Tagihan & Invoice</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>

          <div 
            onClick={() => handleNavigate('/maintenance')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>🛠️ Papan Kanban Maintenance</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>

          <div 
            onClick={() => handleNavigate('/verifikasi')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>📁 Verifikasi Dokumen & Pembayaran</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>

          <div 
            onClick={() => handleNavigate('/laporan-keuangan')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>📈 Laporan Keuangan Enterprise</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>

          <div 
            onClick={() => handleNavigate('/portal-penghuni')} 
            style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}
          >
            <span>👤 Portal Penghuni (Tenant Portal)</span>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Buka →</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
          <span>Klik menu untuk berpindah halaman seketika</span>
          <span style={{ color: '#38bdf8' }}>KosApp Enterprise OS</span>
        </div>

      </div>
    </div>
  )
}