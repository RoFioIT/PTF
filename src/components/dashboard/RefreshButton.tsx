'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react'
import { clsx } from 'clsx'

interface RefreshResult {
  totalPricePoints: number
  fetched: number
  failed: number
  results?: Array<{ name: string; symbol: string; points: number; error?: string }>
}

export function RefreshButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<RefreshResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  async function handleRefresh() {
    setState('loading')
    setResult(null)
    setErrorMsg(null)
    setShowModal(false)

    try {
      const res = await fetch('/api/prices', { method: 'POST' })

      let data: RefreshResult & { error?: string }
      try {
        data = await res.json()
      } catch {
        setErrorMsg(`HTTP ${res.status} — response is not JSON`)
        setState('error')
        setShowModal(true)
        setTimeout(() => setState('idle'), 6000)
        return
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? `HTTP ${res.status}`)
        setState('error')
        setShowModal(true)
        setTimeout(() => setState('idle'), 6000)
        return
      }

      setResult(data)
      setState(data.failed === 0 ? 'success' : 'error')
      if (data.failed > 0) {
        const failures = data.results?.filter((r) => r.error) ?? []
        const summary = failures.map((r) => `• ${r.name} (${r.symbol}): ${r.error}`).join('\n')
        setErrorMsg(summary || `${data.failed} asset(s) failed`)
        setShowModal(true)
      }
      router.refresh()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setState('error')
      setShowModal(true)
    }

    setTimeout(() => setState('idle'), 6000)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={state === 'loading'}
          className={clsx(
            'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all',
            state === 'idle'     && 'bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-300',
            state === 'loading'  && 'bg-[#1e1e2e] text-gray-500 cursor-not-allowed',
            state === 'success'  && 'bg-emerald-400/10 text-emerald-400',
            state === 'error'    && 'bg-red-400/10 text-red-400',
          )}
        >
          <RefreshCw className={clsx('w-4 h-4', state === 'loading' && 'animate-spin')} />
          {state === 'idle'    && 'Refresh prices'}
          {state === 'loading' && 'Fetching…'}
          {state === 'success' && `Updated — ${result?.totalPricePoints} pts`}
          {state === 'error'   && (
            <span className="flex items-center gap-1.5">
              {result ? `${result.failed} failed` : 'Error'}
              <span className="underline text-xs opacity-75" onClick={(e) => { e.stopPropagation(); setShowModal(true) }}>
                details
              </span>
            </span>
          )}
        </button>

        {state === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
        {state === 'error'   && (
          <button onClick={() => setShowModal(true)}>
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Error modal */}
      {showModal && errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Dialog */}
          <div className="relative bg-[#1a1a2e] border border-red-500/30 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <h2 className="text-sm font-semibold text-white">Refresh Error</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {result && (
              <div className="flex gap-4 mb-4 text-xs text-gray-400">
                <span>Fetched: <span className="text-white">{result.fetched}</span></span>
                <span>Failed: <span className="text-red-400">{result.failed}</span></span>
                <span>Price points: <span className="text-white">{result.totalPricePoints}</span></span>
              </div>
            )}

            <pre className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-4 text-xs text-red-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono">
              {errorMsg}
            </pre>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-300 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
