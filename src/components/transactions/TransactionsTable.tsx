'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { TransactionType } from '@/types/database'

export interface TxRow {
  id: string
  portfolio_id: string
  portfolio_name: string
  portfolio_type: string
  asset_id: string
  asset_name: string
  type: TransactionType
  quantity: number
  price: number
  fees: number
  currency: string
  date: string
}

export interface PortfolioOption {
  id: string
  name: string
  type: string
}

interface Props {
  transactions: TxRow[]
  portfolios: PortfolioOption[]
}

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function TransactionsTable({ transactions: initial, portfolios }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<TxRow[]>(initial)
  const [editing, setEditing] = useState<TxRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state (mirrors editing row)
  const [form, setForm] = useState({
    portfolio_id: '',
    type: 'BUY' as TransactionType,
    quantity: '',
    price: '',
    fees: '',
    date: '',
  })

  function openEdit(tx: TxRow) {
    setEditing(tx)
    setError(null)
    setForm({
      portfolio_id: tx.portfolio_id,
      type: tx.type,
      quantity: String(tx.quantity),
      price: String(tx.price),
      fees: String(tx.fees),
      date: tx.date,
    })
  }

  function closeEdit() {
    setEditing(null)
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          portfolio_id: form.portfolio_id,
          type: form.type,
          quantity: Number(form.quantity),
          price: Number(form.price),
          fees: Number(form.fees),
          date: form.date,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')

      // Update local rows
      const updatedPortfolio = portfolios.find((p) => p.id === form.portfolio_id)
      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? {
                ...r,
                portfolio_id: form.portfolio_id,
                portfolio_name: updatedPortfolio?.name ?? r.portfolio_name,
                portfolio_type: updatedPortfolio?.type ?? r.portfolio_type,
                type: form.type,
                quantity: Number(form.quantity),
                price: Number(form.price),
                fees: Number(form.fees),
                date: form.date,
              }
            : r
        )
      )
      closeEdit()
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tx: TxRow) {
    if (!confirm(`Delete ${tx.type} of ${tx.asset_name}?`)) return
    try {
      const res = await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setRows((prev) => prev.filter((r) => r.id !== tx.id))
      router.refresh()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <>
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            No transactions yet.
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-[#1e1e2e]">
              {rows.map((tx) => {
                const isBuy = tx.type === 'BUY'
                const total = Number(tx.quantity) * Number(tx.price)
                return (
                  <div key={tx.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                            {isBuy ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                            {tx.type}
                          </span>
                          <span className="text-xs text-gray-500">{fmtDate(tx.date)}</span>
                        </div>
                        <div className="text-sm font-medium text-white truncate">{tx.asset_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {tx.portfolio_name} · {Number(tx.quantity).toFixed(4)} @ {fmt(Number(tx.price), tx.currency)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white tabular-nums">{fmt(total, tx.currency)}</div>
                          {Number(tx.fees) > 0 && (
                            <div className="text-xs text-gray-600 tabular-nums mt-0.5">fees {fmt(Number(tx.fees), tx.currency)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(tx)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {['Date', 'Type', 'Asset', 'Portfolio', 'Quantity', 'Price', 'Fees', 'Total', ''].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {rows.map((tx) => {
                    const isBuy = tx.type === 'BUY'
                    const total = Number(tx.quantity) * Number(tx.price)
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 text-sm text-gray-400">{fmtDate(tx.date)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${isBuy ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                            {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-white">{tx.asset_name}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{tx.portfolio_name}</span>
                            <Badge variant={tx.portfolio_type === 'PEA' ? 'purple' : 'info'}>{tx.portfolio_type}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">{Number(tx.quantity).toFixed(4)}</td>
                        <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">{fmt(Number(tx.price), tx.currency)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 tabular-nums">{fmt(Number(tx.fees), tx.currency)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-white tabular-nums">{fmt(total, tx.currency)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(tx)} className="text-gray-500 hover:text-indigo-400 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(tx)} className="text-gray-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
              <div>
                <h2 className="text-sm font-semibold text-white">Edit transaction</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editing.asset_name}</p>
              </div>
              <button onClick={closeEdit} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {error && <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

              {/* Portfolio */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Portfolio</label>
                <select
                  value={form.portfolio_id}
                  onChange={(e) => setForm((f) => ({ ...f, portfolio_id: e.target.value }))}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>

              {/* Type + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TransactionType }))}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Quantity + Price + Fees */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Price ({editing.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Fees ({editing.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.fees}
                    onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
                    className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
