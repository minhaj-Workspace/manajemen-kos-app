'use client'
import { useFormStatus } from 'react-dom'

export function SubmitTagihanBtn() {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full p-3 rounded-lg text-sm font-bold transition-all shadow-md mt-2 ${
        pending ? 'bg-sky-900/50 text-sky-500/50 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-900/20'
      }`}
    >
      {pending ? 'Menerbitkan...' : 'Terbitkan Invoice'}
    </button>
  )
}

export function HapusTagihanForm({ idTagihan, actionFn }: { idTagihan: number, actionFn: (formData: FormData) => void }) {
  return (
    <form action={actionFn} className="m-0" onSubmit={(e) => {
      if (!confirm('Peringatan: Yakin ingin menghapus tagihan ini secara permanen? Catatan keuangan akan hilang.')) e.preventDefault()
    }}>
      <input type="hidden" name="idTagihan" value={idTagihan} />
      <HapusBtn />
    </form>
  )
}

function HapusBtn() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} title="Hapus Invoice" className={`p-2 rounded text-lg transition-colors ${
      pending ? 'text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-red-900/20'
    }`}>
      🗑️
    </button>
  )
}