'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  Plus, Pencil, Check, X, Trash2, PiggyBank, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Minus, Upload,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { CashAccount, CashAccountSnapshot } from '@/types/database'
import { ImportSnapshotModal } from './ImportSnapshotModal'

// ── Constants ─────────────────────────────────────────────────

const OWNERS = ['Roberto', 'Silvia', 'Studio'] as const
const CATEGORIES = ['Cash', 'Cash Risparmio', 'Investimenti - Assurance', 'Investimenti - Borsa'] as const

const CATEGORY_STYLE: Record<string, { dot: string; hex: string; light: string; border: string; text: string }> = {
  'Cash':                     { dot: 'bg-gray-400',   hex: '#9ca3af', light: 'bg-gray-500/10',   border: 'border-gray-500/30',   text: 'text-gray-300'   },
  'Cash Risparmio':           { dot: 'bg-sky-400',    hex: '#38bdf8', light: 'bg-sky-500/10',    border: 'border-sky-500/30',    text: 'text-sky-300'    },
  'Investimenti - Assurance': { dot: 'bg-violet-400', hex: '#a78bfa', light: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300' },
  'Investimenti - Borsa':     { dot: 'bg-indigo-400', hex: '#818cf8', light: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300' },
}

// ── Helpers ───────────────────────────────────────────────────

function getCurrentQuarter(): string {
  const now = new Date()
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
}

function prevQuarter(q: string): string {
  const year = parseInt(q.slice(0, 4))
  const num = parseInt(q[6])
  return num === 1 ? `${year - 1}-Q4` : `${year}-Q${num - 1}`
}

function quarterLabel(q: string) { return q.replace('-Q', ' Q') }

function fmt(v: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

function fmtCompact(v: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
    notation: 'compact',
  }).format(v)
}

function getBalance(snapshots: CashAccountSnapshot[], id: string, q: string): number | null {
  const s = snapshots.find((x) => x.account_id === id && x.quarter === q)
  return s != null ? Number(s.balance) : null
}

function categoryTotal(accounts: CashAccount[], snapshots: CashAccountSnapshot[], cat: string, q: string) {
  return accounts
    .filter((a) => a.category === cat && a.is_active)
    .reduce((s, a) => s + (getBalance(snapshots, a.id, q) ?? 0), 0)
}

// ── Delta badge ───────────────────────────────────────────────

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-xs text-gray-600">—</span>
  const delta = current - previous
  const pct = (delta / Math.abs(previous)) * 100
  const pos = delta > 0
  const zero = delta === 0
  return (
    <div className={clsx('flex items-center gap-0.5 text-xs font-medium tabular-nums',
      zero ? 'text-gray-500' : pos ? 'text-emerald-400' : 'text-red-400')}>
      {zero ? <Minus className="w-3 h-3" /> : pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {!zero && (pos ? '+' : '')}{fmtCompact(delta)}
      <span className="opacity-60 ml-0.5">({pos && !zero ? '+' : ''}{pct.toFixed(1)}%)</span>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label, visibleCats }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
  visibleCats: Set<string>
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-[#0e0e1a] border border-[#2e2e3e] rounded-xl px-4 py-3 shadow-2xl min-w-[200px]">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-xs text-gray-400 truncate max-w-[120px]">{p.dataKey}</span>
          </div>
          <span className="text-xs font-semibold text-white tabular-nums">{fmt(p.value ?? 0)}</span>
        </div>
      ))}
      {visibleCats.size > 1 && (
        <div className="border-t border-[#2e2e3e] mt-2 pt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">Total</span>
          <span className="text-xs font-bold text-white tabular-nums">{fmt(total)}</span>
        </div>
      )}
    </div>
  )
}

// ── Owner badge ───────────────────────────────────────────────

function OwnerBadge({ owner }: { owner: string }) {
  const cls = owner === 'Roberto'
    ? 'bg-indigo-500/15 text-indigo-300'
    : owner === 'Silvia'
      ? 'bg-pink-500/15 text-pink-300'
      : 'bg-amber-500/15 text-amber-300'
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cls)}>
      {owner}
    </span>
  )
}

// ── Add Account Modal ─────────────────────────────────────────

function AddAccountModal({ onSave, onClose }: { onSave: (a: CashAccount) => void; onClose: () => void }) {
  const [owner, setOwner] = useState('Roberto')
  const [category, setCategory] = useState('Cash')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      const res = await fetch('/api/cash-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, category, name: name.trim(), currency, notes: notes || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      onSave(json.account)
    } catch (err) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#13131f] border border-[#2a2a3e] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-white">Add account</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mb-4 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Owner</label>
              <select value={owner} onChange={(e) => setOwner(e.target.value)}
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                {OWNERS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Currency</label>
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Account name</label>
            <input type="text" required placeholder="e.g. Livret A Roberto" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors font-medium">
              {saving ? 'Saving…' : 'Add account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────

export function CashAccountsView({ initialAccounts, initialSnapshots }: {
  initialAccounts: CashAccount[]
  initialSnapshots: CashAccountSnapshot[]
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [snapshots, setSnapshots] = useState(initialSnapshots)

  const availableQuarters = useMemo(() => {
    const fromData = [...new Set(snapshots.map((s) => s.quarter))].sort()
    const cur = getCurrentQuarter()
    if (!fromData.includes(cur)) fromData.push(cur)
    return fromData
  }, [snapshots])

  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const fromData = [...new Set(initialSnapshots.map((s) => s.quarter))].sort()
    return fromData.length > 0 ? fromData[fromData.length - 1] : getCurrentQuarter()
  })

  const prevQ = prevQuarter(selectedQuarter)

  const [editMode, setEditMode] = useState(false)
  const [pending, setPending] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [summaryMode, setSummaryMode] = useState<'year' | 'quarter'>('year')

  // Toggleable chart lines
  const [visibleCats, setVisibleCats] = useState<Set<string>>(new Set(CATEGORIES))
  function toggleCat(cat: string) {
    setVisibleCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat) && next.size === 1) return prev // keep at least one
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const activeAccounts = accounts.filter((a) => a.is_active)

  const grandTotal = useMemo(() =>
    activeAccounts.reduce((s, a) => s + (getBalance(snapshots, a.id, selectedQuarter) ?? 0), 0),
    [activeAccounts, snapshots, selectedQuarter])

  const prevGrandTotal = useMemo(() =>
    activeAccounts.reduce((s, a) => s + (getBalance(snapshots, a.id, prevQ) ?? 0), 0),
    [activeAccounts, snapshots, prevQ])

  // Stacked area chart data — ALL quarters with at least one non-zero value
  const chartData = useMemo(() =>
    availableQuarters
      .map((q) => {
        const row: Record<string, string | number> = { quarter: quarterLabel(q) }
        for (const cat of CATEGORIES) row[cat] = categoryTotal(accounts, snapshots, cat, q)
        return row
      })
      .filter((row) => CATEGORIES.some((c) => (row[c] as number) > 0)),
    [accounts, snapshots, availableQuarters])

  const hasChartData = chartData.some((d) => CATEGORIES.some((c) => (d[c] as number) > 0))

  function enterEditMode() {
    const m = new Map<string, string>()
    for (const acc of activeAccounts) {
      const bal = getBalance(snapshots, acc.id, selectedQuarter)
      m.set(acc.id, bal !== null ? String(bal) : '')
    }
    setPending(m); setEditMode(true)
  }

  function cancelEdit() { setPending(new Map()); setEditMode(false) }

  async function saveAll() {
    setSaving(true)
    try {
      const items = [...pending.entries()]
        .filter(([, v]) => v !== '' && !isNaN(Number(v)))
        .map(([account_id, balance]) => ({ account_id, quarter: selectedQuarter, balance: Number(balance) }))
      if (items.length === 0) { setEditMode(false); return }

      const res = await fetch('/api/cash-accounts/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')

      setSnapshots((prev) => {
        const map = new Map(prev.map((s) => [`${s.account_id}|${s.quarter}`, s]))
        for (const snap of json.snapshots as CashAccountSnapshot[]) map.set(`${snap.account_id}|${snap.quarter}`, snap)
        return [...map.values()]
      })
      setPending(new Map()); setEditMode(false)
    } catch (err) { alert((err as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account and all its history?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/cash-accounts?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setSnapshots((prev) => prev.filter((s) => s.account_id !== id))
    } catch (err) { alert((err as Error).message) }
    finally { setDeletingId(null) }
  }

  function renderCategoryRows(category: string) {
    const catAccts = activeAccounts.filter((a) => a.category === category)
    if (catAccts.length === 0) return null
    const style = CATEGORY_STYLE[category]

    const subtotal = catAccts.reduce((s, a) => {
      const val = editMode
        ? (pending.get(a.id) !== '' ? Number(pending.get(a.id) ?? 0) : 0)
        : (getBalance(snapshots, a.id, selectedQuarter) ?? 0)
      return s + val
    }, 0)
    const prevSubtotal = catAccts.reduce((s, a) => s + (getBalance(snapshots, a.id, prevQ) ?? 0), 0)

    return (
      <>
        <tr>
          <td colSpan={5} className="px-5 pt-4 pb-1.5">
            <div className="flex items-center gap-2">
              <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', style.dot)} />
              <span className={clsx('text-[11px] font-bold uppercase tracking-widest', style.text)}>{category}</span>
              <span className="text-[11px] text-gray-600 ml-1">· {catAccts.length} account{catAccts.length !== 1 ? 's' : ''}</span>
            </div>
          </td>
        </tr>

        {catAccts.map((acc) => {
          const current = editMode
            ? (pending.get(acc.id) !== '' ? Number(pending.get(acc.id)) : null)
            : getBalance(snapshots, acc.id, selectedQuarter)
          const previous = getBalance(snapshots, acc.id, prevQ)

          return (
            <tr key={acc.id} className="border-t border-[#1a1a28] hover:bg-white/[0.018] transition-colors group/row">
              <td className="px-5 py-2.5 pl-8 text-sm text-gray-200">{acc.name}</td>
              <td className="px-5 py-2.5"><OwnerBadge owner={acc.owner} /></td>
              <td className="px-5 py-2.5 text-sm tabular-nums">
                {editMode ? (
                  <input
                    type="number" step="0.01" placeholder="0"
                    value={pending.get(acc.id) ?? ''}
                    onChange={(e) => setPending((p) => new Map(p).set(acc.id, e.target.value))}
                    className="w-36 bg-[#1e1e30] border border-indigo-500/40 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 tabular-nums"
                  />
                ) : (
                  <span className={current !== null ? 'text-white font-medium' : 'text-gray-700'}>
                    {current !== null ? fmt(current) : '—'}
                  </span>
                )}
              </td>
              <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">
                {previous !== null ? fmt(previous) : '—'}
              </td>
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-3">
                  {!editMode && current !== null && previous !== null && (
                    <Delta current={current} previous={previous} />
                  )}
                  <button onClick={() => handleDelete(acc.id)} disabled={deletingId === acc.id}
                    className="opacity-0 group-hover/row:opacity-100 text-gray-700 hover:text-red-400 transition-all ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}

        {/* Category subtotal */}
        <tr className={clsx('border-t', style.border)}>
          <td colSpan={2} className="px-5 pl-8 py-2.5">
            <span className={clsx('text-xs font-semibold', style.text)}>{category} total</span>
          </td>
          <td className="px-5 py-2.5 text-sm font-bold text-white tabular-nums">{fmt(subtotal)}</td>
          <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">{prevSubtotal > 0 ? fmt(prevSubtotal) : '—'}</td>
          <td className="px-5 py-2.5">
            {!editMode && prevSubtotal > 0 && <Delta current={subtotal} previous={prevSubtotal} />}
          </td>
        </tr>
      </>
    )
  }

  const selectedQuarterLabel = quarterLabel(selectedQuarter)

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Cash Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">{activeAccounts.length} accounts · Quarterly snapshot tracker</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={cancelEdit}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={saveAll} disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : `Save ${selectedQuarterLabel}`}
              </button>
            </>
          ) : (
            <>
              <button onClick={enterEditMode}
                className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 px-4 py-2 rounded-lg transition-all">
                <Pencil className="w-3.5 h-3.5" /> Edit {selectedQuarterLabel}
              </button>
              <button onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 px-4 py-2 rounded-lg transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                <Plus className="w-4 h-4" /> Add account
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Hero total + category cards ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Grand total — spans 1 col, prominent */}
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600/20 to-indigo-950/10 border border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-indigo-400/70 mb-2">Total Patrimoine</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-none">{fmtCompact(grandTotal)}</p>
          </div>
          <div className="mt-4">
            <Delta current={grandTotal} previous={prevGrandTotal} />
            <p className="text-[10px] text-gray-600 mt-0.5">vs {quarterLabel(prevQ)}</p>
          </div>
        </div>

        {/* Category cards — 4 cols */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const total = categoryTotal(accounts, snapshots, cat, selectedQuarter)
            const prev  = categoryTotal(accounts, snapshots, cat, prevQ)
            const style = CATEGORY_STYLE[cat]
            const count = activeAccounts.filter((a) => a.category === cat).length
            return (
              <div key={cat} className={clsx('bg-[#12121a] border rounded-2xl p-4 flex flex-col justify-between', style.border)}>
                <div className="flex items-start justify-between mb-3">
                  <span className={clsx('w-2 h-2 rounded-full mt-1 flex-shrink-0', style.dot)} />
                  <span className="text-[10px] text-gray-600">{count} acct{count !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  <p className={clsx('text-[10px] uppercase tracking-wider font-medium mb-1', style.text)}>{cat}</p>
                  <p className="text-lg font-bold text-white tabular-nums">{fmtCompact(total)}</p>
                </div>
                <div className="mt-2">
                  <Delta current={total} previous={prev} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Stacked area chart ─────────────────────────────────── */}
      {hasChartData && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Historical Evolution — Cumulated</h2>
              <p className="text-xs text-gray-600 mt-0.5">{availableQuarters.length} quarter{availableQuarters.length !== 1 ? 's' : ''} · stacked by category</p>
            </div>
            {/* Category toggles */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const style = CATEGORY_STYLE[cat]
                const active = visibleCats.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                      active
                        ? clsx(style.text, style.border, style.light)
                        : 'text-gray-600 border-transparent hover:border-gray-700 hover:text-gray-400',
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', active ? style.dot : 'bg-gray-700')} />
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {CATEGORIES.map((cat) => (
                  <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={CATEGORY_STYLE[cat].hex} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CATEGORY_STYLE[cat].hex} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" vertical={false} />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                interval={availableQuarters.length > 12 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                tickFormatter={(v) => fmtCompact(v)}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
                width={72}
              />
              <Tooltip
                content={<ChartTooltip visibleCats={visibleCats} />}
                cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <ReferenceLine
                x={selectedQuarterLabel}
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="5 3"
              />
              {/* Render bottom layers first so top layers appear on top */}
              {CATEGORIES.filter((c) => visibleCats.has(c)).map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="stack"
                  stroke={CATEGORY_STYLE[cat].hex}
                  strokeWidth={1.5}
                  fill={`url(#grad-${cat})`}
                  dot={false}
                  activeDot={{ r: 4, fill: CATEGORY_STYLE[cat].hex, strokeWidth: 2, stroke: '#12121a' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-700 mt-2 text-center">
            Dashed line = {selectedQuarterLabel} (selected quarter) · Y-axis shows cumulated total
          </p>
        </div>
      )}

      {/* ── Summary table: Annual or Quarterly ────────────────── */}
      {(() => {
        // All quarters with data, sorted
        const dataQuarters = [...new Set(
          snapshots.map((s) => s.quarter)
        )].sort().filter((q) =>
          activeAccounts.reduce((s, a) => s + (getBalance(snapshots, a.id, q) ?? 0), 0) > 0
        )

        if (dataQuarters.length === 0) return null

        const qTotal = (q: string) =>
          activeAccounts.reduce((s, a) => s + (getBalance(snapshots, a.id, q) ?? 0), 0)

        // Annual rows: for every year with any data, pick the last available quarter
        const lastQByYear = dataQuarters.reduce<Record<string, string>>((acc, q) => {
          const year = q.slice(0, 4)
          if (!acc[year] || q > acc[year]) acc[year] = q
          return acc
        }, {})
        const years = Object.keys(lastQByYear).sort()

        // Quarterly rows: all data quarters with their previous quarter
        const allQRows = dataQuarters.map((q, i) => ({
          q,
          label: quarterLabel(q),
          year: q.slice(0, 4),
          total: qTotal(q),
          prevTotal: i > 0 ? qTotal(dataQuarters[i - 1]) : null,
          isPrevSameYear: i > 0 && dataQuarters[i - 1].startsWith(q.slice(0, 4)),
        }))

        const deltaCell = (current: number, prev: number | null) => {
          if (prev === null) return { deltaStr: '—', pctStr: '—', color: 'text-gray-600' }
          const d = current - prev
          const p = prev !== 0 ? (d / Math.abs(prev)) * 100 : 0
          const pos = d >= 0
          const color = d === 0 ? 'text-gray-500' : pos ? 'text-emerald-400' : 'text-red-400'
          return {
            deltaStr: `${pos && d !== 0 ? '+' : ''}${fmt(d)}`,
            pctStr: `${pos && d !== 0 ? '+' : ''}${p.toFixed(1)}%`,
            color,
          }
        }

        return (
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
            {/* Header + toggle */}
            <div className="px-5 py-3.5 border-b border-[#1a1a28] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Performance Summary</h2>
              <div className="flex items-center bg-[#0e0e1a] border border-[#2a2a3a] rounded-lg p-0.5">
                {(['year', 'quarter'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSummaryMode(mode)}
                    className={clsx(
                      'px-3 py-1 rounded-md text-xs font-medium transition-all',
                      summaryMode === mode
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-300',
                    )}
                  >
                    {mode === 'year' ? 'Annual' : 'Quarterly'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto"><table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a28]">
                  {[
                    summaryMode === 'year' ? 'Year' : 'Quarter',
                    summaryMode === 'year' ? 'Last quarter total' : 'Total',
                    summaryMode === 'year' ? 'Δ vs prev year' : 'Δ vs prev quarter',
                    '% Change',
                  ].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryMode === 'year' ? (
                  // ── Annual view: one row per year, last available quarter ──
                  years.map((year, i) => {
                    const lastQ    = lastQByYear[year]
                    const total    = qTotal(lastQ)
                    const prevLastQ = i > 0 ? lastQByYear[years[i - 1]] : null
                    const prev     = prevLastQ ? qTotal(prevLastQ) : null
                    const { deltaStr, pctStr, color } = deltaCell(total, prev)
                    const isPartial = !lastQ.endsWith('-Q4')
                    return (
                      <tr key={year} className="border-t border-[#1a1a28] hover:bg-white/[0.018] transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-sm font-bold text-white">{year}</span>
                          {isPartial && (
                            <span className="ml-2 text-[9px] text-gray-600 uppercase tracking-wider">
                              last: {quarterLabel(lastQ)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-white tabular-nums">{fmt(total)}</td>
                        <td className={clsx('px-5 py-3 text-sm tabular-nums font-medium', color)}>{deltaStr}</td>
                        <td className={clsx('px-5 py-3 text-sm tabular-nums font-medium', color)}>{pctStr}</td>
                      </tr>
                    )
                  })
                ) : (
                  // ── Quarterly view: grouped by year ───────────────
                  (() => {
                    const groupedByYear = allQRows.reduce<Record<string, typeof allQRows>>((acc, row) => {
                      if (!acc[row.year]) acc[row.year] = []
                      acc[row.year].push(row)
                      return acc
                    }, {})

                    return Object.entries(groupedByYear).sort(([a], [b]) => a.localeCompare(b)).flatMap(([year, rows]) => [
                      // Year header row
                      <tr key={`year-${year}`} className="bg-[#0e0e1a] border-t border-[#2a2a3a]">
                        <td colSpan={4} className="px-5 py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{year}</span>
                        </td>
                      </tr>,
                      // Quarter rows
                      ...rows.map(({ q, label, total, prevTotal }) => {
                        const { deltaStr, pctStr, color } = deltaCell(total, prevTotal)
                        return (
                          <tr
                            key={q}
                            onClick={() => { setSelectedQuarter(q); setEditMode(false); setPending(new Map()) }}
                            className={clsx(
                              'border-t border-[#1a1a28] cursor-pointer transition-colors',
                              q === selectedQuarter
                                ? 'bg-indigo-600/10 hover:bg-indigo-600/15'
                                : 'hover:bg-white/[0.018]',
                            )}
                          >
                            <td className="px-5 pl-8 py-2.5">
                              <span className={clsx('text-sm font-medium', q === selectedQuarter ? 'text-indigo-300' : 'text-white')}>
                                {label}
                              </span>
                              {q === selectedQuarter && (
                                <span className="ml-2 text-[9px] text-indigo-400 uppercase tracking-wider">selected</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-sm text-white tabular-nums font-medium">{fmt(total)}</td>
                            <td className={clsx('px-5 py-2.5 text-sm tabular-nums font-medium', color)}>{deltaStr}</td>
                            <td className={clsx('px-5 py-2.5 text-sm tabular-nums font-medium', color)}>{pctStr}</td>
                          </tr>
                        )
                      }),
                    ])
                  })()
                )}
              </tbody>
            </table></div>
          </div>
        )
      })()}

      {/* ── Quarter selector + Table ───────────────────────────── */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
        {/* Quarter tabs */}
        <div className="px-5 py-3 border-b border-[#1a1a28] flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] uppercase tracking-widest text-gray-600 mr-2 flex-shrink-0">Quarter</span>
          {availableQuarters.map((q) => (
            <button
              key={q}
              onClick={() => { setSelectedQuarter(q); setEditMode(false); setPending(new Map()) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                q === selectedQuarter
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
              )}
            >
              {quarterLabel(q)}
              {q === getCurrentQuarter() && (
                <span className="ml-1.5 w-1 h-1 rounded-full bg-indigo-400 inline-block align-middle" />
              )}
            </button>
          ))}
          {editMode && (
            <span className="ml-auto text-xs text-indigo-400/80 italic flex-shrink-0 pl-4">
              Fill balances then save ↑
            </span>
          )}
        </div>

        {activeAccounts.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <PiggyBank className="w-10 h-10 text-gray-800 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">No accounts yet — click Add account to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead>
              <tr className="border-b border-[#1a1a28]">
                {[
                  'Account',
                  'Owner',
                  editMode ? `Balance (${selectedQuarterLabel})` : selectedQuarterLabel,
                  quarterLabel(prevQ),
                  'Change',
                ].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => renderCategoryRows(cat))}

              {/* Grand total row */}
              {!editMode && (
                <tr className="border-t-2 border-[#2a2a3e] bg-[#0e0e1a]">
                  <td colSpan={2} className="px-5 py-3.5 text-xs font-bold text-gray-300 uppercase tracking-widest">
                    Grand total
                  </td>
                  <td className="px-5 py-3.5 text-base font-bold text-white tabular-nums">{fmt(grandTotal)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 tabular-nums">
                    {prevGrandTotal > 0 ? fmt(prevGrandTotal) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {prevGrandTotal > 0 && <Delta current={grandTotal} previous={prevGrandTotal} />}
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {showAddModal && (
        <AddAccountModal
          onSave={(account) => {
            setAccounts((prev) => [...prev, account].sort((a, b) =>
              a.category.localeCompare(b.category) || a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name)
            ))
            setShowAddModal(false)
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showImportModal && (
        <ImportSnapshotModal
          accounts={accounts}
          onDone={(newSnapshots, newAccounts) => {
            // Merge new snapshots
            setSnapshots((prev) => {
              const map = new Map(prev.map((s) => [`${s.account_id}|${s.quarter}`, s]))
              for (const snap of newSnapshots) map.set(`${snap.account_id}|${snap.quarter}`, snap)
              return [...map.values()]
            })
            // Merge any newly created accounts
            if (newAccounts.length > 0) {
              setAccounts((prev) =>
                [...prev, ...newAccounts].sort((a, b) =>
                  a.category.localeCompare(b.category) || a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name)
                )
              )
            }
            setShowImportModal(false)
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
