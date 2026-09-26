'use client'
import { useFormStatus } from 'react-dom'

export function SubmitPenghuniBtn() {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full mt-2 p-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
        pending 
          ? 'bg-emerald-900/50 text-emerald-500/50 cursor-not-allowed' 
          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
      }`}
    >
      {pending ? 'Memproses Pendaftaran...' : 'Simpan & Daftarkan Penghuni'}
    </button>
  )
}

export function CheckoutForm({ penghuniId, kamarId, actionFn }: { penghuniId: number, kamarId: number | null, actionFn: (formData: FormData) => void }) {
  return (
    <form 
      action={actionFn} 
      onSubmit={(e) => {
        if (!confirm('Peringatan: Yakin ingin memproses Check-out? Kontrak aktif akan diselesaikan dan relasi kamar diputus.')) {
          e.preventDefault()
        }
      }}
      className="m-0"
    >
      <input type="hidden" name="penghuniId" value={penghuniId} />
      <input type="hidden" name="kamarId" value={kamarId || ''} />
      <CheckoutBtn />
    </form>
  )
}

function CheckoutBtn() {
  const { pending } = useFormStatus()
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
        pending 
          ? 'bg-red-900/20 text-red-500/50 border-red-900/30 cursor-not-allowed' 
          : 'bg-transparent text-red-400 border-red-900/50 hover:bg-red-900/20'
      }`}
    >
      {pending ? 'Memproses...' : 'Check-out'}
    </button>
  )
}