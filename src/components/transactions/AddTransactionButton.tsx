'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, ArrowLeft, Loader2 } from 'lucide-react'
import type { AssetType, TransactionType } from '@/types/database'

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

interface LookupData {
  ticker?: string
  name?: string
  currency?: string
  asset_type?: AssetType
  isin?: string
}

type CreateStep = 'idle' | 'isin-entry' | 'confirming'

const ASSET_TYPES: AssetType[] = ['stock', 'etf', 'crypto', 'bond', 'other']

interface Props {
  portfolios: Portfolio[]
}

export function AddTransactionButton({ portfolios }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transaction form fields
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

  // Create-asset flow
  const [createStep, setCreateStep] = useState<CreateStep>('idle')
  const [isinInput, setIsinInput] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [createType, setCreateType] = useState<AssetType>('stock')
  const [createCurrency, setCreateCurrency] = useState('EUR')
  const [createSector, setCreateSector] = useState('')
  const [createCountry, setCreateCountry] = useState('')
  const [createTicker, setCreateTicker] = useState('')
  const [createIsin, setCreateIsin] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || createStep !== 'idle') return
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
  }, [assetQuery, open, createStep])

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
    resetCreateFlow()
    setOpen(true)
  }

  function resetCreateFlow() {
    setCreateStep('idle')
    setIsinInput('')
    setLookingUp(false)
    setLookupError(null)
    setCreateName('')
    setCreateType('stock')
    setCreateCurrency('EUR')
    setCreateSector('')
    setCreateCountry('')
    setCreateTicker('')
    setCreateIsin('')
    setCreating(false)
    setCreateError(null)
  }

  function selectAsset(asset: AssetOption) {
    setSelectedAsset(asset)
    setAssetQuery(asset.name)
    setAssetResults([])
  }

  function enterCreateFlow() {
    setAssetResults([])
    setCreateStep('isin-entry')
    setLookupError(null)
    setIsinInput('')
  }

  async function handleLookup() {
    const isin = isinInput.trim().toUpperCase()
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) {
      setLookupError('ISIN must be 12 characters (e.g. FR0000131104)')
      return
    }
    setLookingUp(true)
    setLookupError(null)
    try {
      const res = await fetch(`/api/assets/lookup?isin=${encodeURIComponent(isin)}`)
      const json = await res.json()

      if (!res.ok) {
        if (json.error === 'not_found') {
          // Not found on Yahoo — let user fill in manually
          setCreateIsin(isin)
          setCreateStep('confirming')
          return
        }
        setLookupError(json.error === 'lookup_failed' ? 'Yahoo Finance lookup failed. You can fill in the details manually.' : (json.error ?? 'Lookup failed'))
        return
      }

      if (json.existing) {
        // Asset already in DB — just select it
        const a = json.asset
        selectAsset({ id: a.id, name: a.name, currency: a.currency, asset_type: a.asset_type })
        resetCreateFlow()
        return
      }

      // Pre-fill confirmation form
      const data: LookupData = json
      setCreateIsin(data.isin ?? isin)
      setCreateTicker(data.ticker ?? '')
      setCreateName(data.name ?? '')
      setCreateType((data.asset_type as AssetType) ?? 'stock')
      setCreateCurrency(data.currency ?? 'EUR')
      setCreateStep('confirming')
    } catch {
      setLookupError('Network error — try again or fill in details manually.')
    } finally {
      setLookingUp(false)
    }
  }

  function skipLookup() {
    setCreateStep('confirming')
    setLookupError(null)
  }

  async function handleCreate() {
    if (!createName.trim()) { setCreateError('Name is required'); return }
    if (!createCurrency.trim()) { setCreateError('Currency is required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          asset_type: createType,
          currency: createCurrency.trim().toUpperCase(),
          sector: createSector.trim() || undefined,
          country: createCountry.trim() || undefined,
          isin: createIsin.trim() || undefined,
          ticker: createTicker.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Creation failed')
      const a = json.asset
      selectAsset({ id: a.id, name: a.name, currency: a.currency, asset_type: a.asset_type })
      resetCreateFlow()
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
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

  const inputCls = 'w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500'
  const selectCls = inputCls

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
              {createStep !== 'idle' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={createStep === 'isin-entry' ? resetCreateFlow : () => setCreateStep('isin-entry')}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-sm font-semibold text-white">
                    {createStep === 'isin-entry' ? 'Add new asset' : 'Confirm asset details'}
                  </h2>
                </div>
              ) : (
                <h2 className="text-sm font-semibold text-white">Add transaction</h2>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Create asset: ISIN entry ── */}
            {createStep === 'isin-entry' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-gray-400">
                  Enter the ISIN code to auto-fill asset details from Yahoo Finance.
                </p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">ISIN code</label>
                  <input
                    type="text"
                    placeholder="e.g. FR0000131104"
                    value={isinInput}
                    onChange={(e) => setIsinInput(e.target.value.toUpperCase())}
                    maxLength={12}
                    className={inputCls + ' font-mono tracking-widest'}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    autoFocus
                  />
                  {lookupError && (
                    <p className="text-amber-400 text-xs mt-1.5">{lookupError}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookingUp || isinInput.length < 12}
                    className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {lookingUp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {lookingUp ? 'Looking up…' : 'Look up'}
                  </button>
                  <button
                    type="button"
                    onClick={skipLookup}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Enter manually
                  </button>
                </div>
              </div>
            )}

            {/* ── Create asset: confirmation form ── */}
            {createStep === 'confirming' && (
              <div className="px-6 py-5 space-y-4">
                {createError && (
                  <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{createError}</p>
                )}
                {createTicker && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#1e1e2e] px-3 py-2 rounded-lg">
                    <span>Resolved ticker:</span>
                    <span className="font-mono text-indigo-400">{createTicker}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Name <span className="text-red-400">*</span></label>
                  <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} className={inputCls} placeholder="e.g. LVMH Moët Hennessy" autoFocus={!createName} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                    <select value={createType} onChange={(e) => setCreateType(e.target.value as AssetType)} className={selectCls}>
                      {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Currency <span className="text-red-400">*</span></label>
                    <input type="text" value={createCurrency} onChange={(e) => setCreateCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls + ' font-mono'} placeholder="EUR" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Sector</label>
                    <input type="text" value={createSector} onChange={(e) => setCreateSector(e.target.value)} className={inputCls} placeholder="e.g. Consumer Goods" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Country</label>
                    <input type="text" value={createCountry} onChange={(e) => setCreateCountry(e.target.value)} className={inputCls} placeholder="e.g. France" />
                  </div>
                </div>
                {createIsin && (
                  <p className="text-xs text-gray-500">ISIN: <span className="font-mono text-gray-400">{createIsin}</span></p>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={resetCreateFlow} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {creating ? 'Creating…' : 'Create & select'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Main transaction form ── */}
            {createStep === 'idle' && (
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
                  {(assetResults.length > 0 || (assetQuery.length >= 2 && !searching)) && (
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
                      <li>
                        <button
                          type="button"
                          onClick={enterCreateFlow}
                          className="w-full text-left px-4 py-2.5 text-sm text-indigo-400 hover:bg-white/5 transition-colors border-t border-[#2e2e3e] flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create new asset
                        </button>
                      </li>
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
                      className={selectCls}
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
                      className={selectCls}
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
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Price</label>
                    <input
                      type="number" min="0" step="any" required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Fees</label>
                    <input
                      type="number" min="0" step="any"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
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
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Notes</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional"
                      className={inputCls}
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
