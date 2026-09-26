'use client'
import { useFormStatus } from 'react-dom'

export function CatatPengeluaranButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full p-3 rounded-lg font-bold transition-all mt-2 ${
        pending 
          ? 'bg-sky-900/50 text-sky-300 cursor-not-allowed' 
          : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-900/20'
      }`}
    >
      {pending ? 'Menyimpan Transaksi...' : 'Simpan Transaksi Kas Keluar'}
    </button>
  )
}