'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search } from 'lucide-react'
import type { TransactionType } from '@/types/database'

interface Portfolio {
  id: string
  name: string
  type: string
  base_currency: string
}

interface AssetOption {
  id: string
  name: string
  currency: string
  asset_type: string
}

interface Props {
  portfolios: Portfolio[]
}

export function AddTransactionButton({ portfolios }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? '')
  const [type, setType] = useState<TransactionType>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('0')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  // Asset search
  const [assetQuery, setAssetQuery] = useState('')
  const [assetResults, setAssetResults] = useState<AssetOption[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (assetQuery.length < 2) { setAssetResults([]); return }

    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(assetQuery)}`)
        if (res.ok) {
          const json = await res.json()
          setAssetResults(json.assets ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [assetQuery, open])

  function openModal() {
    setPortfolioId(portfolios[0]?.id ?? '')
    setType('BUY')
    setQuantity('')
    setPrice('')
    setFees('0')
    setDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setAssetQuery('')
    setAssetResults([])
    setSelectedAsset(null)
    setError(null)
    setOpen(true)
  }

  function selectAsset(asset: AssetOption) {
    setSelectedAsset(asset)
    setAssetQuery(asset.name)
    setAssetResults([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAsset) { setError('Please select an asset'); return }
    setSaving(true)
    setError(null)

    const portfolio = portfolios.find((p) => p.id === portfolioId)

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          asset_id: selectedAsset.id,
          type,
          quantity: Number(quantity),
          price: Number(price),
          fees: Number(fees),
          currency: portfolio?.base_currency ?? 'EUR',
          date,
          notes: notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add transaction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
              <h2 className="text-sm font-semibold text-white">Add transaction</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Asset search */}
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1.5">Asset</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by name…"
                    value={assetQuery}
                    onChange={(e) => { setAssetQuery(e.target.value); setSelectedAsset(null) }}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {assetResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-[#1e1e2e] border border-[#2e2e3e] rounded-lg overflow-hidden shadow-xl">
                    {assetResults.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => selectAsset(a)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                        >
                          <span className="text-white">{a.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{a.asset_type} · {a.currency}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {searching && (
                  <p className="text-xs text-gray-500 mt-1">Searching…</p>
                )}
                {selectedAsset && (
                  <p className="text-xs text-emerald-400 mt-1">✓ {selectedAsset.name} ({selectedAsset.currency})</p>
                )}
              </div>

              {/* Portfolio + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Portfolio</label>
                  <select
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              {/* Quantity + Price + Fees */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Quantity</label>
                  <input
                    type="number" min="0" step="any" required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Price</label>
                  <input
                    type="number" min="0" step="any" required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Fees</label>
                  <input
                    type="number" min="0" step="any"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Date</label>
                  <input
                    type="date" required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Add transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
