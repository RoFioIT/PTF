'use client'

import { useState, useTransition } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { ScanSessionWithInstruments, ScanInstrument, ScanSignal } from '@/types/database'
import { deleteScanSessionAction } from '@/app/(app)/scans/actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SignalBadge({ signal }: { signal: ScanSignal }) {
  const styles: Record<ScanSignal, string> = {
    BUY:   'bg-emerald-500/15 text-gain ring-1 ring-emerald-500/30',
    WATCH: 'bg-amber-500/15 text-warn ring-1 ring-amber-500/30',
    AVOID: 'bg-red-500/15 text-loss ring-1 ring-red-500/30',
  }
  const dots: Record<ScanSignal, string> = {
    BUY: 'bg-emerald-400', WATCH: 'bg-amber-400', AVOID: 'bg-red-400',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums', styles[signal])}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', dots[signal])} />
      {signal}
    </span>
  )
}

function PeaChip({ eligible }: { eligible: boolean | null }) {
  if (eligible === null) return null
  return eligible
    ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/15 text-accent ring-1 ring-indigo-500/25">PEA</span>
    : <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-ink-3">CTO</span>
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-ink-4">—</span>
  const color = score >= 16 ? 'text-gain' : score >= 11 ? 'text-warn' : 'text-loss'
  return <span className={clsx('tabular-nums font-mono text-xs', color)}>{score}<span className="text-ink-4">/20</span></span>
}

function fmtPct(v: number | null) {
  if (v === null) return <span className="text-ink-4">—</span>
  const color = v > 0 ? 'text-gain' : v < 0 ? 'text-loss' : 'text-ink-3'
  return <span className={clsx('tabular-nums', color)}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
}

function fmtPrice(price: number | null, currency: string) {
  if (price === null) return <span className="text-ink-4">—</span>
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  return <span className="tabular-nums text-ink-2">{sym}{price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
}

function fmtEntryZone(low: number | null, high: number | null, currency: string) {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (low === null && high === null) return <span className="text-ink-4">—</span>
  if (low === null)  return <span className="tabular-nums text-ink-2">≤{sym}{fmt(high!)}</span>
  if (high === null) return <span className="tabular-nums text-ink-2">≥{sym}{fmt(low)}</span>
  return <span className="tabular-nums text-ink-2">{sym}{fmt(low)}–{fmt(high)}</span>
}

// ── Sub-tables ────────────────────────────────────────────────────────────────

function StocksTable({ instruments }: { instruments: ScanInstrument[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-3 mb-2 px-1">Stocks</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line">
              {['Ticker', 'Name', 'Mkt', 'P/E Fwd', '3M Perf', 'Score', 'PEA', 'Signal', 'Entry', 'Note'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-ink-3 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {instruments.map(inst => (
              <tr key={inst.id} className="hover:bg-ink/[0.015] transition-colors">
                <td className="px-3 py-2.5 font-mono font-semibold text-accent whitespace-nowrap">{inst.ticker}</td>
                <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{inst.name}</td>
                <td className="px-3 py-2.5 text-ink-3 whitespace-nowrap">{inst.market ?? '—'}</td>
                <td className="px-3 py-2.5 text-ink-2 tabular-nums whitespace-nowrap">
                  {inst.pe_forward !== null ? `${inst.pe_forward}x` : <span className="text-ink-4">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fmtPct(inst.perf_3m)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><ScoreChip score={inst.score} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><PeaChip eligible={inst.pea_eligible} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><SignalBadge signal={inst.signal} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtEntryZone(inst.entry_price_low, inst.entry_price_high, inst.price_currency)}</td>
                <td className="px-3 py-2.5 text-ink-3 max-w-xs truncate" title={inst.note ?? undefined}>{inst.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EtfsTable({ instruments }: { instruments: ScanInstrument[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-3 mb-2 px-1">ETFs</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line">
              {['Ticker', 'Name', 'TER', '3M Perf', 'AUM M€', 'Score', 'PEA', 'Signal', 'Entry', 'Note'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-ink-3 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {instruments.map(inst => (
              <tr key={inst.id} className="hover:bg-ink/[0.015] transition-colors">
                <td className="px-3 py-2.5 font-mono font-semibold text-accent whitespace-nowrap">{inst.ticker}</td>
                <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{inst.name}</td>
                <td className="px-3 py-2.5 text-ink-2 tabular-nums whitespace-nowrap">
                  {inst.ter !== null ? `${inst.ter.toFixed(2)}%` : <span className="text-ink-4">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fmtPct(inst.perf_3m)}</td>
                <td className="px-3 py-2.5 text-ink-2 tabular-nums whitespace-nowrap">
                  {inst.aum_eur_m !== null ? `€${inst.aum_eur_m.toLocaleString('fr-FR')}M` : <span className="text-ink-4">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap"><ScoreChip score={inst.score} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><PeaChip eligible={inst.pea_eligible} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><SignalBadge signal={inst.signal} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs">{fmtEntryZone(inst.entry_price_low, inst.entry_price_high, inst.price_currency)}</td>
                <td className="px-3 py-2.5 text-ink-3 max-w-xs truncate" title={inst.note ?? undefined}>{inst.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ScanSessionCard({ session }: { session: ScanSessionWithInstruments }) {
  const [expanded, setExpanded] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  const stocks = session.instruments.filter(i => i.instrument_type === 'stock')
  const etfs   = session.instruments.filter(i => i.instrument_type === 'etf')

  const buys   = session.instruments.filter(i => i.signal === 'BUY').length
  const watches = session.instruments.filter(i => i.signal === 'WATCH').length
  const avoids = session.instruments.filter(i => i.signal === 'AVOID').length

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      await deleteScanSessionAction(session.id)
    })
  }

  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-line">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Date + sector */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-semibold text-ink">{fmtDate(session.scanned_at)}</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-600/20 text-accent uppercase tracking-wide">
                {session.sector_focus}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {session.market_regime && (
                <span className="text-xs text-ink-3 font-mono">{session.market_regime}</span>
              )}
              {session.vix_level !== null && (
                <span className="text-xs text-ink-3">VIX <span className="text-ink-2 tabular-nums">{session.vix_level}</span></span>
              )}
            </div>
          </div>

          {/* Signal summary */}
          <div className="flex items-center gap-2 flex-wrap">
            {buys > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gain">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {buys} BUY
              </span>
            )}
            {watches > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-warn">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {watches} WATCH
              </span>
            )}
            {avoids > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-loss">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {avoids} AVOID
              </span>
            )}
            <span className="text-xs text-ink-4">· {session.instruments.length} instruments</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-loss">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs px-2.5 py-1 rounded bg-red-500/20 text-loss hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {isPending ? '…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs px-2.5 py-1 rounded bg-surface text-ink-3 hover:bg-line-strong transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 rounded-md text-ink-4 hover:text-loss hover:bg-red-500/10 transition-colors"
              title="Delete scan"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-md text-ink-4 hover:text-ink-2 hover:bg-ink/5 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Notes */}
      {expanded && session.notes && (
        <div className="px-5 py-3 border-b border-line bg-field">
          <p className="text-xs text-ink-3 leading-relaxed">{session.notes}</p>
        </div>
      )}

      {/* Instruments */}
      {expanded && session.instruments.length > 0 && (
        <div className="p-5 space-y-5">
          {stocks.length > 0 && <StocksTable instruments={stocks} />}
          {etfs.length > 0   && <EtfsTable instruments={etfs} />}
        </div>
      )}

      {expanded && session.instruments.length === 0 && (
        <div className="px-5 py-8 text-center text-ink-4 text-sm">No instruments recorded.</div>
      )}
    </div>
  )
}
