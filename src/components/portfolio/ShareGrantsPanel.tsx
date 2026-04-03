'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ShareGrant } from '@/types/database'

interface Props {
  portfolioId: string
  assetId: string
  grants: ShareGrant[]
  priceGBP?: number | null
  gbpToEur?: number
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtGBP(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function fmtEUR(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function ShareTypeBadge({ type }: { type: 'AFSS' | 'DFSS' }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      type === 'AFSS' ? 'bg-indigo-400/15 text-indigo-400' : 'bg-amber-400/15 text-amber-400'
    )}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: ShareGrant['status'] }) {
  const styles: Record<string, string> = {
    unvested: 'bg-gray-400/15 text-gray-400',
    vested: 'bg-emerald-400/15 text-emerald-400',
    lapsed: 'bg-red-400/15 text-red-400',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function ShareGrantsPanel({ portfolioId, assetId, grants: initialGrants, priceGBP, gbpToEur = 1 }: Props) {
  const router = useRouter()
  const [grants, setGrants] = useState<ShareGrant[]>(initialGrants)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [vestModal, setVestModal] = useState<ShareGrant | null>(null)
  const [vestingPct, setVestingPct] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add grant form state
  const [shareType, setShareType] = useState<'AFSS' | 'DFSS'>('AFSS')
  const [grantDate, setGrantDate] = useState('')
  const [grantedQty, setGrantedQty] = useState('')
  const [grantNotes, setGrantNotes] = useState('')

  const unvested = grants.filter((g) => g.status === 'unvested')
  const historical = grants.filter((g) => g.status !== 'unvested')

  // Sort: AFSS first, then DFSS; within each type by grant_date ascending
  const sortedUnvested = [...unvested].sort((a, b) => {
    if (a.share_type !== b.share_type) return a.share_type === 'AFSS' ? -1 : 1
    return a.grant_date.localeCompare(b.grant_date)
  })

  // Group by type for subtotals
  const afssGrants = sortedUnvested.filter((g) => g.share_type === 'AFSS')
  const dfssGrants = sortedUnvested.filter((g) => g.share_type === 'DFSS')

  function subtotalQty(gs: ShareGrant[]) {
    return gs.reduce((s, g) => s + Number(g.granted_quantity), 0)
  }
  function potentialGBP(qty: number) {
    return priceGBP != null ? qty * 0.75 * priceGBP : null
  }
  function potentialEUR(qty: number) {
    const gbp = potentialGBP(qty)
    return gbp != null ? gbp * gbpToEur : null
  }

  async function handleAddGrant(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/share-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          asset_id: assetId,
          share_type: shareType,
          grant_date: grantDate,
          granted_quantity: Number(grantedQty),
          notes: grantNotes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setGrants((prev) => [...prev, json.grant].sort((a, b) => a.grant_date.localeCompare(b.grant_date)))
      setShowAddForm(false)
      setGrantDate('')
      setGrantedQty('')
      setGrantNotes('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleVest(e: React.FormEvent) {
    e.preventDefault()
    if (!vestModal) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/share-grants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vestModal.id, vesting_pct: Number(vestingPct) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setGrants((prev) => prev.map((g) => g.id === vestModal.id ? json.grant : g))
      setVestModal(null)
      setVestingPct('')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLapse(grant: ShareGrant) {
    if (!confirm(`Lapse ${grant.share_type} grant of ${grant.granted_quantity} shares (${fmtDate(grant.grant_date)})?`)) return
    try {
      const res = await fetch('/api/share-grants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: grant.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setGrants((prev) => prev.map((g) => g.id === grant.id ? json.grant : g))
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const vestedQtyPreview = vestModal && vestingPct !== ''
    ? (Number(vestModal.granted_quantity) * Number(vestingPct) / 100).toFixed(4)
    : null

  function renderGrantRow(g: ShareGrant) {
    const days = daysUntil(g.vesting_date)
    const qty = Number(g.granted_quantity)
    const gbp = potentialGBP(qty)
    const eur = potentialEUR(qty)
    return (
      <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
        <td className="px-6 py-3"><ShareTypeBadge type={g.share_type} /></td>
        <td className="px-6 py-3 text-sm text-gray-300 whitespace-nowrap">{fmtDate(g.grant_date)}</td>
        <td className="px-6 py-3 text-sm text-gray-300 whitespace-nowrap">{fmtDate(g.vesting_date)}</td>
        <td className="px-6 py-3 text-sm text-white tabular-nums">{qty.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td>
        <td className="px-6 py-3 text-sm tabular-nums">
          <span className={days <= 0 ? 'text-emerald-400 font-medium' : days <= 90 ? 'text-amber-400' : 'text-gray-400'}>
            {days <= 0 ? 'Ready to vest' : `${days} days`}
          </span>
        </td>
        <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">
          {gbp != null ? fmtGBP(gbp) : '—'}
        </td>
        <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">
          {eur != null ? fmtEUR(eur) : '—'}
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setVestModal(g); setVestingPct(''); setError(null) }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Vest
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => handleLapse(g)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Lapse
            </button>
          </div>
        </td>
      </tr>
    )
  }

  function renderSubtotalRow(label: string, gs: ShareGrant[]) {
    const qty = subtotalQty(gs)
    const gbp = potentialGBP(qty)
    const eur = potentialEUR(qty)
    return (
      <tr className="bg-white/[0.03] border-t border-[#1e1e2e]">
        <td colSpan={3} className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label} subtotal
        </td>
        <td className="px-6 py-2 text-sm font-semibold text-white tabular-nums">
          {qty.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
        </td>
        <td className="px-6 py-2" />
        <td className="px-6 py-2 text-sm font-semibold text-indigo-300 tabular-nums">
          {gbp != null ? fmtGBP(gbp) : '—'}
        </td>
        <td className="px-6 py-2 text-sm font-semibold text-indigo-300 tabular-nums">
          {eur != null ? fmtEUR(eur) : '—'}
        </td>
        <td className="px-6 py-2" />
      </tr>
    )
  }

  const totalQty = subtotalQty(sortedUnvested)
  const totalGBP = potentialGBP(totalQty)
  const totalEUR = potentialEUR(totalQty)

  return (
    <div className="mt-6 space-y-6">
      {/* ── Unvested grants ─────────────────────────────────── */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white text-sm">Unvested Grants</h2>
            {priceGBP != null && (
              <p className="text-xs text-gray-500 mt-0.5">Potential value at 75% vesting · ADM {fmtGBP(priceGBP)}/share</p>
            )}
          </div>
          <button
            onClick={() => { setShowAddForm((v) => !v); setError(null) }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add grant
          </button>
        </div>

        {/* Add grant form */}
        {showAddForm && (
          <form onSubmit={handleAddGrant} className="px-6 py-4 border-b border-[#1e1e2e] bg-[#0e0e1a] space-y-3">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={shareType}
                  onChange={(e) => setShareType(e.target.value as 'AFSS' | 'DFSS')}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="AFSS">AFSS</option>
                  <option value="DFSS">DFSS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Grant date</label>
                <input
                  type="date"
                  required
                  value={grantDate}
                  onChange={(e) => setGrantDate(e.target.value)}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Granted shares</label>
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="any"
                  placeholder="e.g. 500"
                  value={grantedQty}
                  onChange={(e) => setGrantedQty(e.target.value)}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={grantNotes}
                  onChange={(e) => setGrantNotes(e.target.value)}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddForm(false)} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Save grant'}
              </button>
            </div>
          </form>
        )}

        {sortedUnvested.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-600 text-sm">
            No unvested grants — click Add grant to record a new award.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Type', 'Grant Date', 'Vesting Date', 'Granted', 'Days to vest', 'Potential GBP (75%)', 'Potential EUR (75%)', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {/* AFSS group */}
                {afssGrants.length > 0 && (
                  <>
                    {afssGrants.map(renderGrantRow)}
                    {renderSubtotalRow('AFSS', afssGrants)}
                  </>
                )}
                {/* DFSS group */}
                {dfssGrants.length > 0 && (
                  <>
                    {dfssGrants.map(renderGrantRow)}
                    {renderSubtotalRow('DFSS', dfssGrants)}
                  </>
                )}
                {/* Grand total */}
                {afssGrants.length > 0 && dfssGrants.length > 0 && (
                  <tr className="bg-white/[0.05] border-t-2 border-[#2e2e3e]">
                    <td colSpan={3} className="px-6 py-2.5 text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Total
                    </td>
                    <td className="px-6 py-2.5 text-sm font-bold text-white tabular-nums">
                      {totalQty.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-6 py-2.5" />
                    <td className="px-6 py-2.5 text-sm font-bold text-indigo-300 tabular-nums">
                      {totalGBP != null ? fmtGBP(totalGBP) : '—'}
                    </td>
                    <td className="px-6 py-2.5 text-sm font-bold text-indigo-300 tabular-nums">
                      {totalEUR != null ? fmtEUR(totalEUR) : '—'}
                    </td>
                    <td className="px-6 py-2.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Historical log ───────────────────────────────────── */}
      {historical.length > 0 && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <h2 className="font-semibold text-white text-sm">Vested / Lapsed Grants</h2>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-xs">{historical.length} grants</span>
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showHistory && (
            <table className="w-full border-t border-[#1e1e2e]">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Type', 'Grant Date', 'Vesting Date', 'Granted', 'Vesting %', 'Shares received', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {[...historical].reverse().map((g) => {
                  const received = g.vesting_pct !== null
                    ? Number(g.granted_quantity) * Number(g.vesting_pct) / 100
                    : null
                  return (
                    <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3"><ShareTypeBadge type={g.share_type} /></td>
                      <td className="px-6 py-3 text-sm text-gray-300">{fmtDate(g.grant_date)}</td>
                      <td className="px-6 py-3 text-sm text-gray-300">{fmtDate(g.vesting_date)}</td>
                      <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">{Number(g.granted_quantity).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td>
                      <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">{g.vesting_pct !== null ? `${g.vesting_pct}%` : '—'}</td>
                      <td className="px-6 py-3 text-sm text-white tabular-nums">{received !== null ? received.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : '—'}</td>
                      <td className="px-6 py-3"><StatusBadge status={g.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vest modal ──────────────────────────────────────── */}
      {vestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVestModal(null)} />
          <div className="relative bg-[#1a1a2e] border border-[#1e1e2e] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Vest grant</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <ShareTypeBadge type={vestModal.share_type} />
                  <span className="ml-2">{Number(vestModal.granted_quantity).toLocaleString('fr-FR')} shares · granted {fmtDate(vestModal.grant_date)}</span>
                </p>
              </div>
              <button onClick={() => setVestModal(null)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-red-400 text-xs mb-4 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

            <form onSubmit={handleVest} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Vesting % (performance outcome)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 85"
                    value={vestingPct}
                    onChange={(e) => setVestingPct(e.target.value)}
                    className="flex-1 bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              </div>

              {vestedQtyPreview !== null && (
                <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500">Shares to receive</p>
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">{Number(vestedQtyPreview).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Will be added as a BUY transaction at £0 cost</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setVestModal(null)} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors">
                  {saving ? 'Vesting…' : 'Confirm vesting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
