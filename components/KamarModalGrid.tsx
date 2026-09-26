'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Penghuni {
  id: number
  nama: string
  nomorHp: string
  isAkunUtama: boolean
  user?: { email: string } | null
}

interface Kamar {
  id: number
  nomorKamar: string
  tipe: string
  harga: number
  status: string
  penghuni: Penghuni[]
}

export default function KamarModalGrid({ daftarKamar }: { daftarKamar: Kamar[] }) {
  const [selectedKamar, setSelectedKamar] = useState<Kamar | null>(null)

  const formatNoHpToWa = (hp: string) => {
    let clean = hp.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '62' + clean.slice(1)
    return clean
  }

  return (
    <>
      {/* GRID KARTU KAMAR INTERAKTIF */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {daftarKamar.map((kamar) => {
          const penghuniUtama = kamar.penghuni.find((p) => p.isAkunUtama) || kamar.penghuni[0]
          const totalPenghuni = kamar.penghuni.length
          const isTerisi = kamar.status === 'TERISI'

          return (
            <div
              key={kamar.id}
              onClick={() => setSelectedKamar(kamar)}
              className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex justify-between items-center gap-4 hover:border-sky-500/60 hover:bg-slate-900/50 transition-all cursor-pointer shadow-md group relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-slate-900 group-hover:bg-sky-950/50 border border-slate-800 group-hover:border-sky-500/40 rounded-lg flex items-center justify-center font-bold text-sky-400 text-sm shadow-inner shrink-0 transition-colors">
                  {kamar.nomorKamar}
                </div>
                <div>
                  <h4 className="m-0 text-sm font-bold text-white mb-0.5 group-hover:text-sky-300 transition-colors">
                    Kamar {kamar.nomorKamar} <span className="font-normal text-xs text-slate-400 ml-1">({kamar.tipe})</span>
                  </h4>
                  <p className="m-0 text-xs text-emerald-400 font-bold">
                    Rp {kamar.harga.toLocaleString('id-ID')} <span className="text-[10px] text-slate-500 font-normal">/ bln</span>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <div
                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                    isTerisi
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {kamar.status}
                </div>

                {isTerisi && (
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    👥 {totalPenghuni} Penghuni
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* POPUP MODAL DETAIL KAMAR */}
      {selectedKamar && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Unit Intelligence View</span>
                <h2 className="text-2xl font-bold text-white mt-0.5">
                  Kamar {selectedKamar.nomorKamar} <span className="text-sm font-normal text-slate-400">({selectedKamar.tipe})</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedKamar(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* General Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tarif Sewa Bulanan</span>
                <span className="text-base font-bold text-emerald-400">Rp {selectedKamar.harga.toLocaleString('id-ID')}</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Status Hunian</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedKamar.status === 'TERISI' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {selectedKamar.status}
                </span>
              </div>
            </div>

            {/* Section Penghuni Unit */}
            <div>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                👥 Penghuni Terdaftar ({selectedKamar.penghuni.length} Orang)
              </h3>

              {selectedKamar.penghuni.length === 0 ? (
                <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-5 text-center text-xs text-slate-500">
                  Unit ini saat ini kosong.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedKamar.penghuni.map((p) => {
                    const waNum = formatNoHpToWa(p.nomorHp)
                    const waMessage = encodeURIComponent(`Halo Kak *${p.nama}* (Kamar ${selectedKamar.nomorKamar}) 👋`)
                    const waUrl = `https://wa.me/${waNum}?text=${waMessage}`

                    return (
                      <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{p.nama}</span>
                            {p.isAkunUtama ? (
                              <span className="bg-amber-950 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                                👑 Utama
                              </span>
                            ) : (
                              <span className="bg-sky-950 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                                👥 Pendamping
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">📱 {p.nomorHp} {p.user?.email ? `• ✉️ ${p.user.email}` : ''}</span>
                        </div>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                        >
                          💬 WA
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="border-t border-slate-800 pt-4 flex gap-3 justify-end">
              <button
                onClick={() => setSelectedKamar(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
              <Link
                href="/penghuni"
                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                ⚙️ Kelola di Menu Penghuni
              </Link>
            </div>

          </div>
        </div>
      )}
    </>
  )
}