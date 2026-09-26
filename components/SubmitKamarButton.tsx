'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitKamarButton() {
  // Hook ini otomatis mendeteksi apakah Server Action sedang memproses data
  const { pending } = useFormStatus()

  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`
        w-full md:w-auto px-6 py-3 rounded-lg font-bold transition-all mt-4
        ${pending 
          ? 'bg-yellow-600/50 text-yellow-900 cursor-not-allowed' 
          : 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 shadow-lg'
        }
      `}
    >
      {pending ? 'Menyimpan Perubahan...' : 'Update Kamar'}
    </button>
  )
}