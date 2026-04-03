import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/lib/db/portfolios'
import { getTransactionsByPortfolio, toFinTransaction } from '@/lib/db/transactions'
import { getDividendsByPortfolio, toFinDividend } from '@/lib/db/dividends'
import { buildAllPositions, buildPortfolioSnapshot } from '@/lib/finance/portfolio'
import {
  computeMaxDrawdown,
  computeVolatility,
  computeCurrentDrawdown,
} from '@/lib/finance/metrics'
import { sumDividends, projectAnnualDividend, dividendsByYear } from '@/lib/finance/dividends'
import { MetricCard } from '@/components/ui/MetricCard'
import { AlertTriangle, BarChart3, TrendingUp } from 'lucide-react'

function fmtPct(value: number, decimals = 2) {
  return `${(value * 100).toFixed(decimals)}%`
}

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const portfolios = await getPortfolios(supabase)

  let allFinTxs: ReturnType<typeof toFinTransaction>[] = []
  let allFinDivs: ReturnType<typeof toFinDividend>[] = []

  for (const portfolio of portfolios) {
    const [txs, divs] = await Promise.all([
      getTransactionsByPortfolio(supabase, portfolio.id),
      getDividendsByPortfolio(supabase, portfolio.id),
    ])
    allFinTxs = allFinTxs.concat(txs.map(toFinTransaction))
    allFinDivs = allFinDivs.concat(divs.map(toFinDividend))
  }

  const priceMap = new Map<string, number>()
  const positions = buildAllPositions(allFinTxs, priceMap)
  const snapshot = buildPortfolioSnapshot(positions, [])

  // Historical metrics require historical data — these are stubs until
  // market data is wired in and asset_prices table is populated.
  const historicalDataPoints: never[] = []

  const maxDrawdown = computeMaxDrawdown(historicalDataPoints)
  const currentDrawdown = computeCurrentDrawdown(historicalDataPoints)
  const volatility = computeVolatility(historicalDataPoints)

  const projectedAnnualDiv = projectAnnualDividend(allFinDivs)
  const totalDividends = sumDividends(allFinDivs)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">
          Advanced risk metrics and performance analysis
        </p>
      </div>

      {/* Risk Metrics */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Risk Metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Max Drawdown"
            value={fmtPct(maxDrawdown)}
            subvalue={historicalDataPoints.length === 0 ? 'Requires price history' : undefined}
            trend={maxDrawdown > 0.2 ? 'down' : 'neutral'}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <MetricCard
            label="Current Drawdown"
            value={fmtPct(currentDrawdown)}
            trend={currentDrawdown > 0.1 ? 'down' : 'neutral'}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Volatility (ann.)"
            value={fmtPct(volatility)}
            subvalue={historicalDataPoints.length === 0 ? 'Requires price history' : undefined}
            trend="neutral"
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <MetricCard
            label="Positions"
            value={snapshot.positions.filter((p) => p.totalShares > 0).length.toString()}
            subvalue={`${snapshot.allocations.length} asset${snapshot.allocations.length !== 1 ? 's' : ''}`}
          />
        </div>
      </div>

      {/* Dividend Analytics */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Dividend Analytics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Total Dividends (net)"
            value={fmt(totalDividends)}
          />
          <MetricCard
            label="Projected Annual"
            value={fmt(projectedAnnualDiv)}
            subvalue="Based on historical run rate"
            trend="neutral"
          />
          <MetricCard
            label="Projected Monthly"
            value={fmt(projectedAnnualDiv / 12)}
            subvalue="Average monthly income"
            trend="neutral"
          />
        </div>
      </div>

      {/* Allocation breakdown */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e]">
          <h2 className="font-semibold text-white text-sm">Allocation Breakdown</h2>
        </div>

        {snapshot.allocations.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            No positions to display. Add transactions to see allocation.
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {snapshot.allocations.map((alloc) => (
              <div key={alloc.assetId} className="flex items-center gap-4">
                <div className="w-32 text-xs text-gray-400 truncate">
                  {alloc.assetId.slice(0, 8)}…
                </div>
                <div className="flex-1 bg-[#1e1e2e] rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${alloc.allocationPct}%` }}
                  />
                </div>
                <div className="text-sm text-gray-300 tabular-nums w-16 text-right">
                  {alloc.allocationPct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market data notice */}
      {historicalDataPoints.length === 0 && (
        <div className="mt-6 bg-amber-400/5 border border-amber-400/20 rounded-xl px-6 py-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-300 font-medium">Historical price data required</p>
            <p className="text-xs text-amber-400/70 mt-1">
              TWR, drawdown, and volatility metrics are computed from historical price data.
              Wire in a market data provider and populate the{' '}
              <code className="bg-amber-400/10 px-1 rounded">asset_prices</code> table to enable
              these metrics.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
