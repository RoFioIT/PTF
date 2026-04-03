'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, CheckCircle, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface DividendResult {
  totalImported: number
  totalSkipped: number
  failed: number
}

export function DividendImportButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<DividendResult | null>(null)
  const router = useRouter()

  async function handleImport() {
    setState('loading')
    setResult(null)

    try {
      const res = await fetch('/api/dividends', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DividendResult = await res.json()
      setResult(data)
      setState(data.failed === 0 ? 'success' : 'error')
      router.refresh()
    } catch {
      setState('error')
    }

    setTimeout(() => setState('idle'), 5000)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleImport}
        disabled={state === 'loading'}
        className={clsx(
          'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all',
          state === 'idle'    && 'bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-300',
          state === 'loading' && 'bg-[#1e1e2e] text-gray-500 cursor-not-allowed',
          state === 'success' && 'bg-emerald-400/10 text-emerald-400',
          state === 'error'   && 'bg-red-400/10 text-red-400',
        )}
      >
        <Download className={clsx('w-4 h-4', state === 'loading' && 'animate-pulse')} />
        {state === 'idle'    && 'Import dividends'}
        {state === 'loading' && 'Importing…'}
        {state === 'success' && `${result?.totalImported} imported`}
        {state === 'error'   && (result ? `${result.failed} failed` : 'Error')}
      </button>

      {state === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
      {state === 'error'   && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
    </div>
  )
}
