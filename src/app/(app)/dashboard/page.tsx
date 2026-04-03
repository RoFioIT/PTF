import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/lib/db/portfolios'
import { getTransactionsByPortfolio, toFinTransaction } from '@/lib/db/transactions'
import { getDividendsByPortfolio, toFinDividend } from '@/lib/db/dividends'
import { getCashMovementsByPortfolio, toFinCashMovement } from '@/lib/db/cash_movements'
import type { FinCashMovement } from '@/lib/finance/types'
import { getPriceHistory, getLatestPrice, toFinPricePoint } from '@/lib/db/prices'
import { buildAllPositions, buildPortfolioSnapshot, reconstructHistory, computeAvailableCash } from '@/lib/finance/portfolio'
import { trailingTwelveMonthDividends, sumDividends } from '@/lib/finance/dividends'
import { computeMaxDrawdown, computeTWR } from '@/lib/finance/metrics'
import { toFinTransaction as toFin } from '@/lib/db/transactions'
import { fetchFxRate } from '@/lib/market-data/yahoo-finance'
import { aggregateMonthly } from '@/lib/finance/monthly'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge } from '@/components/ui/Badge'
import { PortfolioChart } from '@/components/charts/PortfolioChart'
import { AllocationChart } from '@/components/charts/AllocationChart'
import { RefreshButton } from '@/components/dashboard/RefreshButton'
import { DividendImportButton } from '@/components/dashboard/DividendImportButton'
import { MonthlyRecap } from '@/components/dashboard/MonthlyRecap'
import {
  TrendingUp, TrendingDown, Wallet, DollarSign, BarChart3, Banknote,
} from 'lucide-react'
import type { FinPricePoint, FinTransaction } from '@/lib/finance/types'

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function fmtPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const portfolios = await getPortfolios(supabase)

  if (portfolios.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <div className="bg-[#12121a] border border-[#1e1e2e] border-dashed rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-lg font-semibold text-white mb-2">No portfolios yet</h2>
          <a href="/portfolios" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors mt-4">
            Create portfolio
          </a>
        </div>
      </div>
    )
  }

  // ── Exclude ADM portfolios from the main dashboard ───────────
  const investmentPortfolios = portfolios.filter((p) => p.type !== 'ADM')

  // ── Collect all transactions + dividends + cash movements ────
  let allFinTxs: FinTransaction[] = []
  let allFinDivs: ReturnType<typeof toFinDividend>[] = []
  let allFinCash: FinCashMovement[] = []

  for (const portfolio of investmentPortfolios) {
    const [txs, divs, cashMvs] = await Promise.all([
      getTransactionsByPortfolio(supabase, portfolio.id),
      getDividendsByPortfolio(supabase, portfolio.id),
      getCashMovementsByPortfolio(supabase, portfolio.id),
    ])
    allFinTxs  = allFinTxs.concat(txs.map(toFinTransaction))
    allFinDivs = allFinDivs.concat(divs.map(toFinDividend))
    allFinCash = allFinCash.concat(cashMvs.map(toFinCashMovement))
  }

  // ── Get unique asset IDs ──────────────────────────────────────
  const assetIds = [...new Set(allFinTxs.map((t) => t.assetId))]

  // ── Fetch asset metadata (name + currency) ────────────────────
  const { data: assetRows } = await supabase
    .from('assets')
    .select('id, name, currency')
    .in('id', assetIds)
  const assetNames = new Map<string, string>()
  const assetCurrencies = new Map<string, string>()
  for (const a of assetRows ?? []) {
    const row = a as { id: string; name: string; currency: string }
    assetNames.set(row.id, row.name)
    assetCurrencies.set(row.id, row.currency)
  }

  // ── Fetch FX rates for non-EUR assets (to convert current prices) ──
  const foreignCurrencies = [...new Set(
    [...assetCurrencies.values()].filter((c) => c !== 'EUR')
  )]
  const fxRates = new Map<string, number>([['EUR', 1]])
  await Promise.all(
    foreignCurrencies.map(async (ccy) => {
      const rate = await fetchFxRate(ccy, 'EUR')
      fxRates.set(ccy, rate)
    })
  )

  // ── Fetch latest prices for current valuation (converted to EUR) ──
  const priceMap = new Map<string, number>()
  await Promise.all(
    assetIds.map(async (id) => {
      const ccy = assetCurrencies.get(id) ?? 'EUR'
      const p = await getLatestPrice(supabase, id)
      if (p) {
        // GBp/GBX = pence → convert to pounds before applying FX
        const rawPrice = Number(p.price)
        const priceInAssetCcy = (p.currency === 'GBp' || p.currency === 'GBX' || p.currency === 'GBx')
          ? rawPrice / 100
          : rawPrice
        const rate = fxRates.get(ccy) ?? 1
        priceMap.set(id, priceInAssetCcy * rate)
      }
    })
  )

  // ── Fetch price history for chart (from first transaction) ────
  const firstTxDate = allFinTxs
    .map((t) => t.date)
    .sort()[0] ?? '2024-01-01'

  const today = new Date().toISOString().slice(0, 10)

  const priceHistory = new Map<string, FinPricePoint[]>()
  await Promise.all(
    assetIds.map(async (id) => {
      const rows = await getPriceHistory(supabase, id, firstTxDate, today, assetCurrencies.get(id))
      if (rows.length > 0) {
        priceHistory.set(id, rows.map(toFinPricePoint))
      }
    })
  )

  // ── Build positions + snapshot ────────────────────────────────
  const positions = buildAllPositions(allFinTxs, priceMap, 'PRU')
  const snapshot = buildPortfolioSnapshot(positions, [])

  // ── Reconstruct historical performance ───────────────────────
  const history = reconstructHistory(allFinTxs, priceHistory, [], 'PRU')

  // ── Monthly aggregation ───────────────────────────────────────
  const monthly = aggregateMonthly(history)

  // ── Risk metrics ─────────────────────────────────────────────
  const twr = computeTWR(history)
  const maxDrawdown = computeMaxDrawdown(history)

  // ── Dividend metrics ──────────────────────────────────────────
  const ttmDividends = trailingTwelveMonthDividends(allFinDivs)
  const totalDividends = sumDividends(allFinDivs)

  // ── Available cash across all portfolios ──────────────────────
  const totalAvailableCash = computeAvailableCash(allFinCash, allFinTxs, allFinDivs)

  const pnlPositive = snapshot.totalPnL >= 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {investmentPortfolios.length} portfolio{investmentPortfolios.length > 1 ? 's' : ''} ·{' '}
            {snapshot.positions.filter((p) => p.totalShares > 0).length} open positions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {investmentPortfolios.map((p) => (
              <Badge key={p.id} variant={p.type === 'PEA' ? 'purple' : 'info'}>{p.type}</Badge>
            ))}
          </div>
          <DividendImportButton />
          <RefreshButton />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard
          label="Portfolio Value"
          value={fmt(snapshot.currentValue)}
          subvalue={`Invested: ${fmt(snapshot.totalInvested)}`}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Total P&L"
          value={fmt(snapshot.totalPnL)}
          subvalue={fmtPct(snapshot.performancePct)}
          trend={pnlPositive ? 'up' : 'down'}
          icon={pnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        />
        <MetricCard
          label="TWR"
          value={fmtPct(twr * 100)}
          subvalue={`Max drawdown: ${fmtPct(maxDrawdown * 100)}`}
          trend={twr >= 0 ? 'up' : 'down'}
          icon={<BarChart3 className="w-4 h-4" />}
        />
        <MetricCard
          label="Dividends (TTM)"
          value={fmt(ttmDividends)}
          subvalue={`Total: ${fmt(totalDividends)}`}
          trend="neutral"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          label="Available Cash"
          value={fmt(totalAvailableCash)}
          subvalue="across all portfolios"
          trend={totalAvailableCash >= 0 ? 'up' : 'down'}
          icon={<Banknote className="w-4 h-4" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Performance chart — 2/3 width */}
        <div className="lg:col-span-2 bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white text-sm">Portfolio Performance</h2>
            <span className="text-xs text-gray-500">{history.length} data points</span>
          </div>
          <PortfolioChart data={history} currency="EUR" />
        </div>

        {/* Allocation pie — 1/3 width */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
          <h2 className="font-semibold text-white text-sm mb-4">Allocation</h2>
          <AllocationChart
            allocations={snapshot.allocations}
            assetNames={assetNames}
            currency="EUR"
          />
        </div>
      </div>

      {/* Monthly Performance Recap */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Monthly Performance</h2>
          <span className="text-xs text-gray-500">{monthly.length} months</span>
        </div>
        <MonthlyRecap data={monthly} currency="EUR" />
      </div>

      {/* Positions Table */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Open Positions</h2>
          <a href="/portfolios" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</a>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              {['Asset', 'Shares', 'PRU', 'Price', 'Invested', 'Value', 'P&L', '%', 'Alloc'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {snapshot.positions
              .filter((p) => p.totalShares > 0)
              .sort((a, b) => b.currentValue - a.currentValue)
              .map((pos) => {
                const name = assetNames.get(pos.assetId) ?? pos.assetId.slice(0, 8)
                const pnlPos = pos.totalPnL >= 0
                const hasPrice = pos.currentPrice > 0
                return (
                  <tr key={pos.assetId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <a href={`/assets/${pos.assetId}`} className="text-sm font-medium text-white hover:text-indigo-400 transition-colors truncate max-w-[180px] block">
                        {name}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300 tabular-nums">{pos.totalShares.toFixed(3)}</td>
                    <td className="px-5 py-3 text-sm text-gray-300 tabular-nums">{fmt(pos.avgCostBasis)}</td>
                    <td className="px-5 py-3 text-sm text-gray-300 tabular-nums">{hasPrice ? fmt(pos.currentPrice) : '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-300 tabular-nums">{fmt(pos.totalInvested)}</td>
                    <td className="px-5 py-3 text-sm text-gray-300 tabular-nums">{hasPrice ? fmt(pos.currentValue) : '—'}</td>
                    <td className={`px-5 py-3 text-sm tabular-nums font-medium ${pnlPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {hasPrice ? fmt(pos.totalPnL) : '—'}
                    </td>
                    <td className={`px-5 py-3 text-sm tabular-nums font-medium ${pnlPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {hasPrice ? fmtPct(pos.performancePct) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 tabular-nums">
                      {pos.allocationPct?.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
