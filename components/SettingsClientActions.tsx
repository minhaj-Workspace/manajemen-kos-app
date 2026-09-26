'use client'
import { useFormStatus } from 'react-dom'

export function SubmitSettingBtn({ text = 'Simpan' }: { text?: string }) {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md ${
        pending ? 'bg-emerald-900/50 text-emerald-500/50 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-900/20'
      }`}
    >
      {pending ? '...' : text}
    </button>
  )
}

export function DeleteUserForm({ userId, actionFn }: { userId: number, actionFn: (formData: FormData) => void }) {
  return (
    <form action={actionFn} onSubmit={(e) => {
      if (!confirm('Peringatan: Yakin ingin menghapus akun pengguna ini secara permanen? Data yang terkait mungkin akan hilang.')) e.preventDefault()
    }}>
      <input type="hidden" name="userId" value={userId} />
      <DeleteBtn />
    </form>
  )
}

function DeleteBtn() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      pending ? 'bg-red-900/20 text-red-500/50 cursor-not-allowed' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/30'
    }`}>
      {pending ? 'Menghapus...' : 'Hapus Akun'}
    </button>
  )
}