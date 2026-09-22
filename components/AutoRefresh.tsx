'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  intervalMs?: number // Default 10 detik (10000 ms)
}

export default function AutoRefresh({ intervalMs = 10000 }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    // Fungsi untuk merefresh data saat tab aktif
    const handleInterval = () => {
      if (document.visibilityState === 'visible') {
        router.refresh() // Sinkronisasi data senyap ke server tanpa kedipan
      }
    }

    const timer = setInterval(handleInterval, intervalMs)

    return () => clearInterval(timer)
  }, [router, intervalMs])

  return null // Komponen ini bekerja di latar belakang secara tak kasat mata
}