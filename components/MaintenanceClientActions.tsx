'use client'
import { useFormStatus } from 'react-dom'

export function SubmitMaintenanceBtn({ text }: { text: string }) {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full py-2 px-4 rounded-lg font-bold text-sm transition-all ${
        pending ? 'bg-sky-900/50 text-sky-400 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
      }`}
    >
      {pending ? 'Menyimpan...' : text}
    </button>
  )
}

export function KanbanActionBtn({ text, colorClass, pendingText }: { text: string, colorClass: string, pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all border ${colorClass} ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {pending ? (pendingText || 'Proses...') : text}
    </button>
  )
}