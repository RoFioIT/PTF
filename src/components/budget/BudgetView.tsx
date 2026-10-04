'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { BudgetCategory, BudgetItem, BudgetEntry } from '@/types/database'
import { clsx } from 'clsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import {
  Pencil, Save, X, Copy, ChevronDown, Plus, Trash2,
  TrendingUp, TrendingDown, Minus, Wallet,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CAT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  income:   { bg: 'bg-emerald-500/10', text: 'text-gain', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  savings:  { bg: 'bg-sky-500/10',     text: 'text-sky-600',     border: 'border-sky-500/30',     dot: 'bg-sky-400'     },
  expense:  { bg: 'bg-slate-500/10',   text: 'text-slate-300',   border: 'border-slate-500/20',   dot: 'bg-slate-400'   },
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'budget' | 'actual' | 'both'
type EntriesMap = Map<string, BudgetEntry>   // key: `${itemId}::${month}`

interface Props {
  initialCategories: BudgetCategory[]
  initialItems: BudgetItem[]
  initialEntries: BudgetEntry[]
  availableYears: number[]
  defaultYear: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildEntriesMap(entries: BudgetEntry[]): EntriesMap {
  const m = new Map<string, BudgetEntry>()
  entries.forEach(e => m.set(`${e.item_id}::${e.month}`, e))
  return m
}

function fmt(v: number | null | undefined, compact = false): string {
  if (v == null) return '—'
  if (compact && Math.abs(v) >= 1000) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
  }
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function pct(a: number, b: number): string {
  if (b === 0) return '—'
  return `${((a / b) * 100).toFixed(1)}%`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BudgetView({ initialCategories, initialItems, initialEntries, availableYears, defaultYear }: Props) {
  const [year, setYear] = useState(defaultYear)
  const [mode, setMode] = useState<ViewMode>('budget')
  const [editMode, setEditMode] = useState(false)
  const [entriesMap, setEntriesMap] = useState<EntriesMap>(() => buildEntriesMap(initialEntries))
  const [pending, setPending] = useState<Record<string, { budget?: number; actual?: number | null }>>({})
  const [years, setYears] = useState(availableYears)
  const [isSaving, startSaving] = useTransition()
  const [showCopy, setShowCopy] = useState(false)
  const [copyFrom, setCopyFrom] = useState(defaultYear - 1)
  const [copyWhat, setCopyWhat] = useState<'budget' | 'actual' | 'both'>('budget')
  const [showAddItem, setShowAddItem] = useState<string | null>(null) // category id
  const [newItemName, setNewItemName] = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  const categories = initialCategories
  const items = initialItems

  // ── Data accessors ───────────────────────────────────────────
  const getVal = useCallback((itemId: string, month: number, field: 'budget' | 'actual'): number => {
    const editKey = `${itemId}::${month}`
    if (pending[editKey]?.[field] !== undefined) return pending[editKey][field] as number ?? 0
    const e = entriesMap.get(editKey)
    if (field === 'actual') return e?.actual ?? 0
    return e?.budget ?? 0
  }, [entriesMap, pending])

  const getItems = useCallback((catId: string) => items.filter(i => i.category_id === catId), [items])

  const catTotal = useCallback((catId: string, month: number, field: 'budget' | 'actual') =>
    getItems(catId).reduce((s, i) => s + getVal(i.id, month, field), 0),
  [getItems, getVal])

  const itemAnnual = useCallback((itemId: string, field: 'budget' | 'actual') =>
    MONTHS.reduce((s, _, i) => s + getVal(itemId, i + 1, field), 0),
  [getVal])

  const catAnnual = useCallback((catId: string, field: 'budget' | 'actual') =>
    getItems(catId).reduce((s, item) => s + itemAnnual(item.id, field), 0),
  [getItems, itemAnnual])

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories])
  const savingsCategories = useMemo(() => categories.filter(c => c.type === 'savings'), [categories])
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories])

  const monthIncome = useCallback((month: number, field: 'budget' | 'actual') =>
    incomeCategories.reduce((s, c) => s + catTotal(c.id, month, field), 0), [incomeCategories, catTotal])

  const monthExpenses = useCallback((month: number, field: 'budget' | 'actual') =>
    [...savingsCategories, ...expenseCategories].reduce((s, c) => s + catTotal(c.id, month, field), 0),
  [savingsCategories, expenseCategories, catTotal])

  const annualIncome = useMemo(() => {
    const f = mode === 'actual' ? 'actual' : 'budget'
    return incomeCategories.reduce((s, c) => s + catAnnual(c.id, f), 0)
  }, [incomeCategories, catAnnual, mode])

  const annualExpenses = useMemo(() => {
    const f = mode === 'actual' ? 'actual' : 'budget'
    return [...savingsCategories, ...expenseCategories].reduce((s, c) => s + catAnnual(c.id, f), 0)
  }, [savingsCategories, expenseCategories, catAnnual, mode])

  const annualNet = annualIncome - annualExpenses
  const savingsRate = annualIncome > 0 ? (annualNet / annualIncome) * 100 : 0

  // ── Chart data ───────────────────────────────────────────────
  const primaryField = mode === 'actual' ? 'actual' : 'budget'
  const chartData = useMemo(() => MONTHS.map((month, i) => ({
    month,
    Income: monthIncome(i + 1, primaryField),
    Expenses: monthExpenses(i + 1, primaryField),
    Net: monthIncome(i + 1, primaryField) - monthExpenses(i + 1, primaryField),
  })), [monthIncome, monthExpenses, primaryField])

  // ── Edit handlers ────────────────────────────────────────────
  function handleCellChange(itemId: string, month: number, field: 'budget' | 'actual', raw: string) {
    const val = raw === '' ? 0 : parseFloat(raw.replace(/[^\d.-]/g, '')) || 0
    setPending(prev => ({
      ...prev,
      [`${itemId}::${month}`]: { ...prev[`${itemId}::${month}`], [field]: val },
    }))
  }

  function cancelEdit() {
    setPending({})
    setEditMode(false)
  }

  async function saveAll() {
    const toSave = Object.entries(pending).map(([key, vals]) => {
      const [itemId, monthStr] = key.split('::')
      return { item_id: itemId, year, month: parseInt(monthStr), ...vals }
    })
    if (toSave.length === 0) { setEditMode(false); return }

    startSaving(async () => {
      const res = await fetch('/api/budget/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      })
      if (res.ok) {
        const { entries: updated } = await res.json()
        setEntriesMap(prev => {
          const next = new Map(prev)
          ;(updated as BudgetEntry[]).forEach(e => next.set(`${e.item_id}::${e.month}`, e))
          return next
        })
        setPending({})
        setEditMode(false)
      }
    })
  }

  // ── Year change ──────────────────────────────────────────────
  async function changeYear(y: number) {
    setYear(y)
    setPending({})
    setEditMode(false)
    const res = await fetch(`/api/budget/entries?year=${y}`)
    if (res.ok) {
      const { entries, years: updatedYears } = await res.json()
      setEntriesMap(buildEntriesMap(entries))
      setYears(updatedYears.includes(y) ? updatedYears : [y, ...updatedYears])
    }
  }

  // ── Copy year ────────────────────────────────────────────────
  async function handleCopy() {
    const res = await fetch('/api/budget/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'copy',
        from_year: copyFrom,
        to_year: year,
        copy_budget: copyWhat !== 'actual',
        copy_actual: copyWhat !== 'budget',
      }),
    })
    if (res.ok) {
      const { entries, years: updatedYears } = await res.json()
      setEntriesMap(buildEntriesMap(entries))
      setYears(updatedYears)
      setShowCopy(false)
    }
  }

  // ── Add item ─────────────────────────────────────────────────
  async function handleAddItem(categoryId: string) {
    if (!newItemName.trim()) return
    const res = await fetch('/api/budget/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, name: newItemName.trim() }),
    })
    if (res.ok) {
      // Reload page to pick up new item
      window.location.reload()
    }
  }

  // ── Toggle category collapse ─────────────────────────────────
  function toggleCat(id: string) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Render helpers ───────────────────────────────────────────
  function renderCell(itemId: string, month: number, field: 'budget' | 'actual', rowType: 'budget' | 'actual' | 'subtotal') {
    const val = getVal(itemId, month, field)
    const hasPending = pending[`${itemId}::${month}`]?.[field] !== undefined

    if (editMode && rowType !== 'subtotal') {
      return (
        <td key={month} className="px-1 py-0.5">
          <input
            type="number"
            step="0.01"
            className={clsx(
              'w-full text-right px-2 py-1 rounded text-sm bg-panel border',
              hasPending ? 'border-indigo-500 text-ink' : 'border-line-strong text-ink',
              'focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30'
            )}
            defaultValue={val === 0 ? '' : val}
            onChange={e => handleCellChange(itemId, month, field, e.target.value)}
          />
        </td>
      )
    }

    const colored = val < 0 ? 'text-loss' : val > 0 ? 'text-ink' : 'text-ink-4'
    return (
      <td key={month} className={clsx('px-3 py-2 text-right text-sm tabular-nums', colored)}>
        {val === 0 ? <span className="text-ink-4">—</span> : fmt(val)}
      </td>
    )
  }

  function renderMonthCells(itemId: string, field: 'budget' | 'actual', type: 'budget' | 'actual' | 'subtotal') {
    return MONTHS.map((_, i) => renderCell(itemId, i + 1, field, type))
  }

  function renderCatHeader(cat: BudgetCategory) {
    const style = CAT_COLORS[cat.type]
    const isCollapsed = collapsedCats.has(cat.id)
    return (
      <tr key={`cat-${cat.id}`} className={clsx('border-t border-b', style.border, style.bg)}>
        <td
          className={clsx(
            'sticky left-0 z-10 px-3 py-2 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none',
            style.text, style.bg,
          )}
          colSpan={1}
          onClick={() => toggleCat(cat.id)}
        >
          <div className="flex items-center gap-2">
            <ChevronDown className={clsx('w-3 h-3 transition-transform', isCollapsed && '-rotate-90')} />
            <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
            {cat.name}
          </div>
        </td>
        {/* Subtotal row right side */}
        {MONTHS.map((_, i) => {
          const f = mode === 'actual' ? 'actual' : 'budget'
          const total = catTotal(cat.id, i + 1, f)
          return (
            <td key={i} className={clsx('px-3 py-2 text-right text-xs tabular-nums font-medium', style.text, style.bg)}>
              {total === 0 ? '' : fmt(total)}
            </td>
          )
        })}
        {/* Annual total & avg */}
        {(() => {
          const f = mode === 'actual' ? 'actual' : 'budget'
          const annual = catAnnual(cat.id, f)
          return (
            <>
              <td className={clsx('px-3 py-2 text-right text-xs tabular-nums font-semibold', style.text, style.bg)}>
                {annual === 0 ? '' : fmt(annual)}
              </td>
              <td className={clsx('px-3 py-2 text-right text-xs tabular-nums', style.text, style.bg)}>
                {annual === 0 ? '' : fmt(annual / 12)}
              </td>
            </>
          )
        })()}
      </tr>
    )
  }

  function renderItemRow(item: BudgetItem, field: 'budget' | 'actual', label?: string, bgClass?: string) {
    const annual = itemAnnual(item.id, field)
    return (
      <tr
        key={`item-${item.id}-${field}`}
        className={clsx('border-b border-line hover:bg-ink/[0.02] group', bgClass)}
      >
        <td className={clsx('sticky left-0 z-10 px-3 py-2 text-sm bg-panel group-hover:bg-field', bgClass)}>
          <div className="flex items-center gap-2">
            <span className="w-4" />
            <span className={clsx('text-ink-2', label && 'text-ink-3 text-xs')}>{label ?? item.name}</span>
          </div>
        </td>
        {renderMonthCells(item.id, field, field)}
        {/* Annual total */}
        <td className="px-3 py-2 text-right text-sm tabular-nums font-medium text-ink border-l border-line">
          {annual === 0 ? <span className="text-ink-4">—</span> : fmt(annual)}
        </td>
        {/* Avg */}
        <td className="px-3 py-2 text-right text-sm tabular-nums text-ink-3">
          {annual === 0 ? '' : fmt(annual / 12)}
        </td>
      </tr>
    )
  }

  function renderBothRow(item: BudgetItem) {
    const budgetAnnual = itemAnnual(item.id, 'budget')
    const actualAnnual = itemAnnual(item.id, 'actual')
    return (
      <tr key={`item-${item.id}-both`} className="border-b border-line hover:bg-ink/[0.02] group">
        <td className="sticky left-0 z-10 px-3 py-2 text-sm bg-panel group-hover:bg-field">
          <div className="pl-6">
            <div className="text-ink-2">{item.name}</div>
          </div>
        </td>
        {MONTHS.map((_, i) => {
          const b = getVal(item.id, i + 1, 'budget')
          const a = getVal(item.id, i + 1, 'actual')
          const diff = a - b
          return (
            <td key={i} className="px-2 py-1.5 text-right align-top">
              <div className="text-sm tabular-nums text-ink">{b === 0 ? <span className="text-ink-4">—</span> : fmt(b)}</div>
              <div className={clsx('text-xs tabular-nums', a === 0 ? 'text-ink-4' : diff > 0 ? 'text-gain' : diff < 0 ? 'text-loss' : 'text-ink-3')}>
                {a === 0 ? '—' : fmt(a)}
              </div>
            </td>
          )
        })}
        <td className="px-3 py-1.5 text-right border-l border-line">
          <div className="text-sm tabular-nums text-ink font-medium">{budgetAnnual === 0 ? '—' : fmt(budgetAnnual)}</div>
          <div className={clsx('text-xs tabular-nums', actualAnnual === 0 ? 'text-ink-4' : 'text-gain')}>
            {actualAnnual === 0 ? '—' : fmt(actualAnnual)}
          </div>
        </td>
        <td className="px-3 py-1.5 text-right">
          <div className="text-xs tabular-nums text-ink-3">{budgetAnnual === 0 ? '' : fmt(budgetAnnual / 12)}</div>
          <div className="text-xs tabular-nums text-ink-4">{actualAnnual === 0 ? '' : fmt(actualAnnual / 12)}</div>
        </td>
      </tr>
    )
  }

  function renderNetRow() {
    const f = mode === 'actual' ? 'actual' : 'budget'
    return (
      <tr className="border-t-2 border-indigo-500/40 bg-indigo-500/5">
        <td className="sticky left-0 z-10 px-3 py-3 font-bold text-sm bg-indigo-500/5 text-accent">
          <div className="pl-6">NET (Income − Expenses)</div>
        </td>
        {MONTHS.map((_, i) => {
          const net = monthIncome(i + 1, f) - monthExpenses(i + 1, f)
          return (
            <td key={i} className={clsx('px-3 py-3 text-right text-sm tabular-nums font-semibold',
              net >= 0 ? 'text-gain' : 'text-loss')}>
              {fmt(net)}
            </td>
          )
        })}
        <td className={clsx('px-3 py-3 text-right text-sm tabular-nums font-bold border-l border-line',
          annualNet >= 0 ? 'text-gain' : 'text-loss')}>
          {fmt(annualNet)}
        </td>
        <td className={clsx('px-3 py-3 text-right text-sm tabular-nums',
          annualNet >= 0 ? 'text-gain' : 'text-loss')}>
          {fmt(annualNet / 12)}
        </td>
      </tr>
    )
  }

  // ── Main render ───────────────────────────────────────────────
  const field = mode === 'actual' ? 'actual' : 'budget'

  return (
    <div className="min-h-screen bg-field text-ink flex flex-col">
      {/* ── Page header ── */}
      <div className="px-6 py-5 border-b border-line flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Budget Tracker</h1>
          <p className="text-sm text-ink-3 mt-0.5">Monthly income & expense planning</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode tabs */}
          <div className="flex bg-field rounded-lg p-0.5 border border-line">
            {(['budget', 'actual', 'both'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                  mode === m ? 'bg-indigo-600 text-white' : 'text-ink-3 hover:text-ink'
                )}
              >{m}</button>
            ))}
          </div>

          {/* Year selector */}
          <div className="relative">
            <select
              value={year}
              onChange={e => changeYear(Number(e.target.value))}
              className="appearance-none bg-field border border-line text-ink text-sm px-4 py-2 pr-8 rounded-lg cursor-pointer focus:outline-none focus:border-indigo-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          </div>

          {/* Copy year */}
          <button
            onClick={() => setShowCopy(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-field text-ink-3 hover:text-ink text-sm transition-all"
          >
            <Copy className="w-4 h-4" /> Copy Year
          </button>

          {/* Edit / Save / Cancel */}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
            >
              <Pencil className="w-4 h-4" /> Edit {year}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-ink-3 hover:text-ink text-sm transition-all"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={saveAll}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving…' : `Save (${Object.keys(pending).length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* ── KPI cards ── */}
        <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Annual Income', value: annualIncome,
              icon: TrendingUp, color: 'text-gain', bg: 'bg-emerald-500/10',
              sub: `${fmt(annualIncome / 12)}/mo`,
            },
            {
              label: 'Annual Expenses', value: annualExpenses,
              icon: TrendingDown, color: 'text-loss', bg: 'bg-red-500/10',
              sub: `${fmt(annualExpenses / 12)}/mo`,
            },
            {
              label: 'Net Savings', value: annualNet,
              icon: Wallet, color: annualNet >= 0 ? 'text-accent' : 'text-orange-600',
              bg: annualNet >= 0 ? 'bg-indigo-500/10' : 'bg-orange-500/10',
              sub: `${fmt(annualNet / 12)}/mo`,
            },
            {
              label: 'Savings Rate', value: null,
              icon: Minus, color: savingsRate >= 20 ? 'text-gain' : savingsRate >= 10 ? 'text-warn' : 'text-loss',
              bg: 'bg-slate-500/10',
              display: `${savingsRate.toFixed(1)}%`,
              sub: pct(annualNet, annualIncome),
            },
          ].map(({ label, value, icon: Icon, color, bg, sub, display }) => (
            <div key={label} className="bg-panel border border-line rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-ink-3 uppercase tracking-wider">{label}</p>
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
                  <Icon className={clsx('w-4 h-4', color)} />
                </div>
              </div>
              <p className={clsx('text-2xl font-bold mt-2 tabular-nums', color)}>
                {display ?? (value != null ? `€${fmt(value)}` : '—')}
              </p>
              <p className="text-xs text-ink-4 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Monthly chart ── */}
        <div className="mx-6 mb-4 bg-panel border border-line rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-ink-2">Monthly Overview — {year}</h2>
            <span className="text-xs text-ink-3 capitalize">{mode} view</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={40} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e3e8f0', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#0f1b33', fontWeight: 600 }}
                formatter={(val: unknown) => `€${fmt(Number(val ?? 0))}`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
              <Bar dataKey="Income" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
              <Bar dataKey="Net" radius={[3,3,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.Net >= 0 ? '#6366f1' : '#f97316'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Spreadsheet table ── */}
        <div className="mx-6 mb-6 bg-panel border border-line rounded-xl overflow-hidden">
          {/* Mode legend for "both" */}
          {mode === 'both' && (
            <div className="px-4 py-2 border-b border-line flex items-center gap-4 text-xs text-ink-3">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />Budget (top)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Actual (bottom — green = on track)</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '1200px' }}>
              {/* Column headers */}
              <thead>
                <tr className="bg-panel border-b border-line sticky top-0 z-20">
                  <th className="sticky left-0 z-30 bg-panel px-3 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider min-w-[220px]">
                    Category / Item
                  </th>
                  {MONTHS.map(m => (
                    <th key={m} className="px-3 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider min-w-[85px]">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider min-w-[100px] border-l border-line">
                    Total
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider min-w-[80px]">
                    Avg/mo
                  </th>
                </tr>
              </thead>

              <tbody>
                {categories.map(cat => {
                  const catItems = getItems(cat.id)
                  const isCollapsed = collapsedCats.has(cat.id)
                  return (
                    <>
                      {/* Category header row */}
                      {renderCatHeader(cat)}

                      {/* Item rows */}
                      {!isCollapsed && catItems.map(item => {
                        if (mode === 'both') return renderBothRow(item)
                        return renderItemRow(item, field)
                      })}

                      {/* Add item row */}
                      {!isCollapsed && (
                        showAddItem === cat.id ? (
                          <tr className="border-b border-line bg-indigo-500/5">
                            <td className="sticky left-0 z-10 px-3 py-2 bg-indigo-500/5" colSpan={15}>
                              <div className="flex items-center gap-2 pl-6">
                                <input
                                  autoFocus
                                  type="text"
                                  value={newItemName}
                                  onChange={e => setNewItemName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddItem(cat.id)
                                    if (e.key === 'Escape') setShowAddItem(null)
                                  }}
                                  placeholder="New item name…"
                                  className="bg-panel border border-indigo-500/50 rounded px-2 py-1 text-sm text-ink focus:outline-none focus:border-indigo-400 w-48"
                                />
                                <button onClick={() => handleAddItem(cat.id)} className="text-xs text-gain hover:text-gain">Add</button>
                                <button onClick={() => { setShowAddItem(null); setNewItemName('') }} className="text-xs text-ink-3 hover:text-ink-2">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={`add-${cat.id}`}
                            className="border-b border-line"
                          >
                            <td
                              className="sticky left-0 z-10 px-3 py-1.5 bg-panel cursor-pointer text-xs text-ink-4 hover:text-accent transition-colors"
                              colSpan={15}
                              onClick={() => { setShowAddItem(cat.id); setNewItemName('') }}
                            >
                              <div className="flex items-center gap-1.5 pl-6">
                                <Plus className="w-3 h-3" /> Add item
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </>
                  )
                })}

                {/* NET row */}
                {renderNetRow()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Copy Year Modal ── */}
      {showCopy && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-field border border-line rounded-2xl p-6 w-full max-w-md shadow-xl shadow-ink/10">
            <h2 className="text-lg font-bold text-ink mb-4">Copy Year Data</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ink-3 mb-1.5">Copy FROM year</label>
                <select
                  value={copyFrom}
                  onChange={e => setCopyFrom(Number(e.target.value))}
                  className="w-full bg-panel border border-line text-ink text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                >
                  {years.filter(y => y !== year).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-3 mb-1.5">Copy TO year</label>
                <div className="bg-panel border border-line text-ink-2 text-sm px-3 py-2 rounded-lg">
                  {year}
                </div>
              </div>
              <div>
                <label className="block text-xs text-ink-3 mb-1.5">What to copy</label>
                <div className="flex gap-2">
                  {(['budget', 'actual', 'both'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => setCopyWhat(w)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all border',
                        copyWhat === w
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-panel border-line text-ink-3 hover:text-ink'
                      )}
                    >{w}</button>
                  ))}
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-warn">
                This will overwrite existing {copyWhat} data for {year}. This cannot be undone.
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCopy(false)}
                className="flex-1 py-2.5 rounded-lg border border-line text-ink-3 hover:text-ink text-sm transition-all"
              >Cancel</button>
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
              >Copy Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
