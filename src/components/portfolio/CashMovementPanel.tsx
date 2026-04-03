'use client'

import { useState } from 'react'
import type { CashMovement, CashMovementType } from '@/types/database'
import { Trash2, PlusCircle } from 'lucide-react'

interface Props {
  portfolioId: string
  currency: string
  initialMovements: CashMovement[]
  availableCash: number
}

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const TYPE_LABELS: Record<CashMovementType, string> = {
  DEPOSIT:      'Deposit',
  WITHDRAWAL:   'Withdrawal',
  TRANSFER_IN:  'Transfer in',
  TRANSFER_OUT: 'Transfer out',
}

const TYPE_SIGN: Record<CashMovementType, '+' | '−'> = {
  DEPOSIT:      '+',
  WITHDRAWAL:   '−',
  TRANSFER_IN:  '+',
  TRANSFER_OUT: '−',
}

export function CashMovementPanel({ portfolioId, currency, initialMovements, availableCash: initialCash }: Props) {
  const [movements, setMovements]   = useState<CashMovement[]>(initialMovements)
  const [availableCash, setAvailable] = useState(initialCash)
  const [showForm, setShowForm]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Form state
  const [type, setType]   = useState<CashMovementType>('DEPOSIT')
  const [amount, setAmount] = useState('')
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolioId, type, amount: Number(amount), currency, date, notes: notes || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      const mv: CashMovement = json.movement
      const newMovements = [...movements, mv].sort((a, b) => a.date.localeCompare(b.date))
      setMovements(newMovements)
      // Recompute available cash: simple delta
      const delta = (type === 'DEPOSIT' || type === 'TRANSFER_IN') ? Number(amount) : -Number(amount)
      setAvailable(prev => prev + delta)
      // Reset form
      setAmount('')
      setNotes('')
      setShowForm(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, mv: CashMovement) {
    if (!confirm('Delete this cash movement?')) return
    try {
      const res = await fetch(`/api/cash-movements?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setMovements(prev => prev.filter(m => m.id !== id))
      const delta = (mv.type === 'DEPOSIT' || mv.type === 'TRANSFER_IN') ? -Number(mv.amount) : Number(mv.amount)
      setAvailable(prev => prev + delta)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white text-sm">Cash</h2>
          <p className={`text-lg font-bold mt-0.5 ${availableCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(availableCash, currency)}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add movement
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-[#1e1e2e] bg-[#0f0f17] space-y-3">
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as CashMovementType)}
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {(Object.keys(TYPE_LABELS) as CashMovementType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ({currency})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Movements list */}
      {movements.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-600 text-sm">
          No cash movements yet. Add a deposit to start tracking.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              {['Date', 'Type', 'Amount', 'Notes', ''].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {[...movements].reverse().map(mv => (
              <tr key={mv.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-3 text-sm text-gray-400 tabular-nums">{mv.date}</td>
                <td className="px-6 py-3 text-sm text-white">{TYPE_LABELS[mv.type]}</td>
                <td className={`px-6 py-3 text-sm font-medium tabular-nums ${
                  TYPE_SIGN[mv.type] === '+' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {TYPE_SIGN[mv.type]}{fmt(Number(mv.amount), mv.currency)}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">{mv.notes ?? '—'}</td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => handleDelete(mv.id, mv)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
