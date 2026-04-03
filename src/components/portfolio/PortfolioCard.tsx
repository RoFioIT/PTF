'use client'

import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowUpRight, Wallet, TrendingUp, TrendingDown, Banknote, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import type { Portfolio } from '@/types/database'

export interface PortfolioMetrics {
  portfolio: Portfolio
  valueEUR: number
  pnlEUR: number
  pnlPct: number
  ytdPct: number | null
  cashEUR: number
  openPositions: number
  sparkline: { date: string; value: number }[]
}

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
  }).format(value)
}

function fmtPct(value: number, showSign = true) {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

const TYPE_CONFIG: Record<string, { accent: string; badge: string; label: string }> = {
  PEA:  { accent: 'from-violet-500 to-indigo-500',  badge: 'bg-violet-500/15 text-violet-300',  label: 'PEA'  },
  CTO:  { accent: 'from-cyan-500 to-blue-500',      badge: 'bg-cyan-500/15 text-cyan-300',      label: 'CTO'  },
  ADM:  { accent: 'from-amber-500 to-orange-500',   badge: 'bg-amber-500/15 text-amber-300',    label: 'ADM'  },
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { badge: 'bg-gray-500/15 text-gray-300' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${cfg.badge}`}>
      {type}
    </span>
  )
}

function Metric({
  label,
  value,
  sub,
  positive,
  icon,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  icon: React.ReactNode
}) {
  const valueColor =
    positive === undefined
      ? 'text-white'
      : positive
        ? 'text-emerald-400'
        : 'text-red-400'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-gray-500">
        <span className="w-3.5 h-3.5">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-base font-bold tabular-nums leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 tabular-nums">{sub}</p>}
    </div>
  )
}

function SparklineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0e0e1a] border border-[#2e2e3e] rounded-lg px-2.5 py-1.5 text-xs text-white tabular-nums shadow-xl">
      {fmt(payload[0].value)}
    </div>
  )
}

export function PortfolioCard({ metrics }: { metrics: PortfolioMetrics }) {
  const { portfolio, valueEUR, pnlEUR, pnlPct, ytdPct, cashEUR, openPositions, sparkline } = metrics

  const cfg = TYPE_CONFIG[portfolio.type] ?? TYPE_CONFIG.CTO
  const pnlPositive = pnlEUR >= 0
  const ytdPositive = (ytdPct ?? 0) >= 0
  const sparkColor = ytdPositive ? '#10b981' : '#ef4444'

  return (
    <Link
      href={`/portfolios/${portfolio.id}`}
      className="group relative bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden flex flex-col hover:border-[#2e2e4e] transition-all duration-200 hover:shadow-lg hover:shadow-indigo-950/30"
    >
      {/* Gradient accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${cfg.accent}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cfg.accent} opacity-20 flex-shrink-0`} />
            <div className="flex flex-col">
              <h3 className="font-semibold text-white text-sm leading-tight group-hover:text-indigo-300 transition-colors">
                {portfolio.name}
              </h3>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {openPositions} position{openPositions !== 1 ? 's' : ''}
                {portfolio.type !== 'ADM' && ` · ${portfolio.accounting_method}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={portfolio.type} />
            <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Metrics 2×2 grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Metric
            label="Value"
            value={fmt(valueEUR)}
            icon={<Wallet className="w-3.5 h-3.5" />}
          />
          <Metric
            label="P&L"
            value={fmt(pnlEUR)}
            sub={fmtPct(pnlPct)}
            positive={pnlPositive}
            icon={pnlPositive
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
          />
          <Metric
            label="YTD TWR"
            value={ytdPct !== null ? fmtPct(ytdPct) : '—'}
            positive={ytdPct !== null ? ytdPositive : undefined}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
          />
          {portfolio.type !== 'ADM' ? (
            <Metric
              label="Cash"
              value={fmt(cashEUR)}
              positive={cashEUR >= 0}
              icon={<Banknote className="w-3.5 h-3.5" />}
            />
          ) : (
            <Metric
              label="Scheme"
              value={portfolio.type}
              icon={<Banknote className="w-3.5 h-3.5" />}
            />
          )}
        </div>

        {/* Sparkline */}
        {sparkline.length >= 2 && (
          <div className="h-14 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={`spark-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sparkColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={<SparklineTooltip />}
                  cursor={{ stroke: sparkColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#spark-${portfolio.id})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {sparkline.length < 2 && (
          <div className="h-14 flex items-center justify-center">
            <p className="text-xs text-gray-700">No performance data yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-[#1a1a2a] bg-[#0e0e1a]/40 flex items-center justify-between">
        <span className="text-[10px] text-gray-700 uppercase tracking-wider">
          {portfolio.base_currency}
        </span>
        <span className="text-[10px] text-gray-700">
          {sparkline.length > 0
            ? `${sparkline.length} month${sparkline.length !== 1 ? 's' : ''} YTD`
            : 'No data'}
        </span>
      </div>
    </Link>
  )
}
