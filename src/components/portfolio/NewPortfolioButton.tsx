'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

export function NewPortfolioButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<'PEA' | 'CTO' | 'ADM'>('PEA')
  const [currency, setCurrency] = useState('EUR')
  const [method, setMethod] = useState<'PRU' | 'FIFO'>('PRU')

  function openModal() {
    setName('')
    setType('PEA')
    setCurrency('EUR')
    setMethod('PRU')
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, base_currency: currency, accounting_method: method }),
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
        New portfolio
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
              <h2 className="text-sm font-semibold text-white">New portfolio</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PEA Fortuneo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const t = e.target.value as 'PEA' | 'CTO' | 'ADM'
                      setType(t)
                      if (t === 'ADM') setCurrency('GBP')
                      else if (currency === 'GBP') setCurrency('EUR')
                    }}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PEA">PEA</option>
                    <option value="CTO">CTO</option>
                    <option value="ADM">ADM Shares (Employee scheme)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Base currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {type !== 'ADM' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Accounting method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as 'PRU' | 'FIFO')}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PRU">PRU — Weighted average cost (French standard)</option>
                    <option value="FIFO">FIFO — First in, first out</option>
                  </select>
                </div>
              )}

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
                  {saving ? 'Creating…' : 'Create portfolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
