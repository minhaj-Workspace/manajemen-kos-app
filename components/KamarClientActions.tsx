'use client'

import { useFormStatus } from 'react-dom'

// 1. Komponen Tombol Tambah Kamar
export function AddKamarButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full p-3 rounded-lg font-bold transition-all ${
        pending 
          ? 'bg-emerald-800/50 text-emerald-200 cursor-not-allowed' 
          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
      }`}
    >
      {pending ? 'Merekam Data...' : 'Simpan Kamar Baru'}
    </button>
  )
}

// 2. Komponen Form Hapus Kamar (Dengan Konfirmasi)
export function DeleteKamarForm({ id, hapusAction }: { id: number, hapusAction: (formData: FormData) => void }) {
  return (
    <form
      action={hapusAction}
      onSubmit={(e) => {
        if (!confirm('Peringatan: Yakin ingin menghapus kamar ini secara permanen?')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteBtn />
    </form>
  )
}

function DeleteBtn() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-3 py-2 rounded flex-1 md:flex-none text-xs font-bold transition-all text-center ${
        pending 
          ? 'bg-red-900/30 text-red-500/50 cursor-not-allowed' 
          : 'bg-red-900/80 text-red-200 hover:bg-red-700'
      }`}
    >
      {pending ? 'Menghapus...' : 'Hapus'}
    </button>
  )
}