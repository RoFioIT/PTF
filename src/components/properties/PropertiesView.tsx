'use client'

import Link from 'next/link'
import { Building2, Plus, AlertTriangle, Pencil, ExternalLink } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge } from '@/components/ui/Badge'
import type { PropertyWithMortgage } from '@/types/database'

interface EnrichedProperty extends PropertyWithMortgage {
  remainingBalance: number
  netEquity: number
}

interface SummaryMetrics {
  totalValue: number
  totalDebt: number
  totalEquity: number
}

interface Props {
  properties: EnrichedProperty[]
  summary: SummaryMetrics
}

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M €`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k €`
  return fmt.format(n)
}

const COUNTRY_LABEL: Record<string, string> = { france: '🇫🇷 France', italy: '🇮🇹 Italy' }
const TYPE_LABEL: Record<string, string>    = { home: 'Résidence principale', investment: 'Investissement locatif' }

function PropertyCard({ p }: { p: EnrichedProperty }) {
  const hasPayments = p.mortgage && p.remainingBalance < p.mortgage.initial_amount
  const repaidPct = p.mortgage
    ? Math.round(((p.mortgage.initial_amount - p.remainingBalance) / p.mortgage.initial_amount) * 100)
    : 0

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-semibold leading-tight">{p.name}</p>
          {p.address && <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]">{p.address}</p>}
        </div>
        <Badge variant={p.type === 'home' ? 'purple' : 'info'}>
          {p.type === 'home' ? 'Home' : 'Investment'}
        </Badge>
      </div>

      {/* Value & equity */}
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{fmtShort(p.current_value)}</p>
        <p className={`text-sm font-medium tabular-nums mt-0.5 ${p.netEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {p.netEquity >= 0 ? '+' : ''}{fmtShort(p.netEquity)} equity
        </p>
      </div>

      {/* Mortgage block */}
      {p.mortgage ? (
        <div className="bg-[#0d0d14] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{p.mortgage.bank_name}</span>
            <span className="text-xs text-gray-400 tabular-nums">{fmtShort(p.remainingBalance)} left</span>
          </div>
          {hasPayments ? (
            <>
              {/* Progress bar */}
              <div className="bg-[#1e1e2e] rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${repaidPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{repaidPct}% repaid</p>
            </>
          ) : (
            <Link
              href={`/properties/${p.id}`}
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <AlertTriangle className="w-3 h-3" />
              Import amortization schedule
            </Link>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No mortgage</p>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#1e1e2e]">
        <Link
          href={`/properties/${p.id}/edit`}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </Link>
        <span className="text-gray-700">·</span>
        <Link
          href={`/properties/${p.id}`}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Details
        </Link>
      </div>
    </div>
  )
}

export function PropertiesView({ properties, summary }: Props) {
  const countries: Array<'france' | 'italy'> = ['france', 'italy']
  const types: Array<'home' | 'investment'> = ['home', 'investment']

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Properties</h1>
          <p className="text-gray-400 text-sm mt-1">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            {properties.filter((p) => p.mortgage).length > 0 &&
              ` · ${properties.filter((p) => p.mortgage).length} with mortgage`}
          </p>
        </div>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add property
        </Link>
      </div>

      {/* Summary metrics */}
      {properties.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Total value"
            value={fmtShort(summary.totalValue)}
            subvalue={`${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`}
            trend="neutral"
          />
          <MetricCard
            label="Net equity"
            value={fmtShort(summary.totalEquity)}
            subvalue={summary.totalDebt > 0 ? `${Math.round((summary.totalEquity / summary.totalValue) * 100)}% of total value` : 'No debt'}
            trend={summary.totalEquity >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Total debt"
            value={fmtShort(summary.totalDebt)}
            subvalue={summary.totalDebt > 0 ? 'Remaining mortgage balance' : 'Debt-free'}
            trend={summary.totalDebt > 0 ? 'down' : 'neutral'}
          />
        </div>
      )}

      {/* Empty state */}
      {properties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="w-14 h-14 text-gray-700 mb-4" />
          <p className="text-white font-semibold text-lg">No properties yet</p>
          <p className="text-gray-500 text-sm mt-2 mb-6 max-w-xs">
            Track your real estate assets, mortgages, and net equity in one place.
          </p>
          <Link
            href="/properties/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Add your first property
          </Link>
        </div>
      )}

      {/* Grouped sections */}
      {countries.map((c) =>
        types.map((t) => {
          const group = properties.filter((p) => p.country === c && p.type === t)
          if (group.length === 0) return null
          return (
            <div key={`${c}-${t}`} className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                {COUNTRY_LABEL[c]} — {TYPE_LABEL[t]}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.map((p) => <PropertyCard key={p.id} p={p} />)}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
