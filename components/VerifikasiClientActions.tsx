'use client'

import React from 'react'

// Komponen Tombol Aksi Kustom
export function ActionButton({ 
  children, 
  onClick, 
  style, 
  variant = 'primary',
  type = 'button',
  text,
  pendingText
}: { 
  children?: React.ReactNode, 
  onClick?: () => void, 
  style?: React.CSSProperties,
  variant?: 'primary' | 'danger' | 'success' | 'warning',
  type?: string, // Diubah menjadi string agar menerima 'reject', 'approve', dll.
  text?: string,
  pendingText?: string
}) {
  let bg = '#0ea5e9'
  if (variant === 'danger') bg = '#ef4444'
  if (variant === 'success') bg = '#22c55e'
  if (variant === 'warning') bg = '#f59e0b'

  return (
    <button 
      type={type as 'button' | 'submit' | 'reset'}
      onClick={onClick}
      style={{
        backgroundColor: bg,
        color: '#fff',
        border: 'none',
        padding: '8px 14px',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'opacity 0.2s',
        ...style
      }}
    >
      {text || children}
    </button>
  )
}

// Komponen Form Konfirmasi
export function ConfirmForm({ 
  action, 
  actionFn,
  confirmMsg,
  children, 
  style 
}: { 
  action?: (formData: FormData) => void | Promise<void>, 
  actionFn?: (formData: FormData) => void | Promise<void>,
  confirmMsg?: string,
  children: React.ReactNode,
  style?: React.CSSProperties 
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (confirmMsg && !window.confirm(confirmMsg)) {
      e.preventDefault()
    }
  }

  return (
    <form 
      action={action || actionFn} 
      onSubmit={handleSubmit} 
      style={{ display: 'inline-block', ...style }}
    >
      {children}
    </form>
  )
}