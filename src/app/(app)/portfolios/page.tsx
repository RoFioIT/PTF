import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/lib/db/portfolios'
import { getTransactionsByPortfolio, toFinTransaction } from '@/lib/db/transactions'
import { getDividendsByPortfolio, toFinDividend } from '@/lib/db/dividends'
import { getCashMovementsByPortfolio, toFinCashMovement } from '@/lib/db/cash_movements'
import { getPriceHistory, getLatestPrice } from '@/lib/db/prices'
import {
  buildAllPositions,
  buildPortfolioSnapshot,
  reconstructHistory,
  computeAvailableCash,
} from '@/lib/finance/portfolio'
import { aggregateMonthly } from '@/lib/finance/monthly'
import { fetchFxRate } from '@/lib/market-data/yahoo-finance'
import { NewPortfolioButton } from '@/components/portfolio/NewPortfolioButton'
import { PortfolioCard } from '@/components/portfolio/PortfolioCard'
import type { PortfolioMetrics } from '@/components/portfolio/PortfolioCard'
import type { FinTransaction, FinCashMovement, FinPricePoint } from '@/lib/finance/types'
import type { Portfolio } from '@/types/database'
import { Briefcase } from 'lucide-react'

export const dynamic = 'force-dynamic'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function computePortfolioMetrics(
  supabase: SupabaseClient,
  portfolio: Portfolio,
): Promise<PortfolioMetrics> {
  const [txRows, divRows, cashRows] = await Promise.all([
    getTransactionsByPortfolio(supabase, portfolio.id),
    getDividendsByPortfolio(supabase, portfolio.id),
    getCashMovementsByPortfolio(supabase, portfolio.id),
  ])

  const finTxs: FinTransaction[] = txRows.map(toFinTransaction)
  const finDivs = divRows.map(toFinDividend)
  const finCash: FinCashMovement[] = cashRows.map(toFinCashMovement)

  const cashEUR = computeAvailableCash(finCash, finTxs, finDivs)

  if (finTxs.length === 0) {
    return {
      portfolio,
      valueEUR: 0,
      pnlEUR: 0,
      pnlPct: 0,
      ytdPct: null,
      cashEUR,
      openPositions: 0,
      sparkline: [],
    }
  }

  const assetIds = [...new Set(finTxs.map((t) => t.assetId))]

  // Asset currencies
  const { data: assetRows } = await supabase
    .from('assets')
    .select('id, currency')
    .in('id', assetIds)
  const assetCurrencies = new Map<string, string>()
  for (const a of (assetRows ?? []) as { id: string; currency: string }[]) {
    assetCurrencies.set(a.id, a.currency)
  }

  // FX rates for non-EUR currencies
  const fxRates = new Map<string, number>([['EUR', 1]])
  const foreignCcys = [...new Set([...assetCurrencies.values()].filter((c) => c !== 'EUR'))]
  await Promise.all(
    foreignCcys.map(async (ccy) => {
      const rate = await fetchFxRate(ccy, 'EUR')
      fxRates.set(ccy, rate)
    })
  )

  // Latest prices → priceMap (in EUR)
  const priceMap = new Map<string, number>()
  await Promise.all(
    assetIds.map(async (id) => {
      const ccy = assetCurrencies.get(id) ?? 'EUR'
      const p = await getLatestPrice(supabase, id) // no currency filter — handles GBp
      if (p) {
        const raw = Number(p.price)
        const priceInCcy =
          p.currency === 'GBp' || p.currency === 'GBX' || p.currency === 'GBx'
            ? raw / 100
            : raw
        priceMap.set(id, priceInCcy * (fxRates.get(ccy) ?? 1))
      }
    })
  )

  // Positions + snapshot
  const method = (portfolio.accounting_method ?? 'PRU') as 'PRU' | 'FIFO'
  const positions = buildAllPositions(finTxs, priceMap, method)
  const snapshot = buildPortfolioSnapshot(positions, finCash)

  // Price history (full, for TWR + sparkline)
  const firstTxDate = finTxs.map((t) => t.date).sort()[0]
  const today = new Date().toISOString().slice(0, 10)

  const priceHistory = new Map<string, FinPricePoint[]>()
  await Promise.all(
    assetIds.map(async (id) => {
      const ccy = assetCurrencies.get(id) ?? 'EUR'
      const rows = await getPriceHistory(supabase, id, firstTxDate, today)
      if (rows.length > 0) {
        const rate = fxRates.get(ccy) ?? 1
        priceHistory.set(
          id,
          rows.map((p) => {
            const raw = Number(p.price)
            const priceInCcy =
              p.currency === 'GBp' || p.currency === 'GBX' || p.currency === 'GBx'
                ? raw / 100
                : raw
            return { date: p.date, price: priceInCcy * rate }
          }),
        )
      }
    })
  )

  const history = reconstructHistory(finTxs, priceHistory, finCash, finDivs, method)
  const monthly = aggregateMonthly(history, finCash)

  // YTD: last available month of the current year
  const currentYear = new Date().getFullYear().toString()
  const thisYearMonths = monthly.filter((m) => m.month.startsWith(currentYear))
  const ytdPct = thisYearMonths.length > 0
    ? thisYearMonths[thisYearMonths.length - 1].ytdTWRPct
    : null

  // Sparkline: this year's monthly portfolio values (in EUR)
  const sparkline = thisYearMonths.map((m) => ({ date: m.month, value: m.value }))

  return {
    portfolio,
    valueEUR: snapshot.currentValue + Math.max(0, cashEUR),
    pnlEUR: snapshot.totalPnL,
    pnlPct: snapshot.performancePct,
    ytdPct,
    cashEUR,
    openPositions: positions.filter((p) => p.totalShares > 0).length,
    sparkline,
  }
}

export default async function PortfoliosPage() {
  const supabase = await createClient()
  const portfolios = await getPortfolios(supabase)

  const metricsArr = await Promise.all(
    portfolios.map((p) => computePortfolioMetrics(supabase, p))
  )

  // Aggregates for the header bar (investment portfolios only)
  const investment = metricsArr.filter((m) => m.portfolio.type !== 'ADM')
  const totalValue = investment.reduce((s, m) => s + m.valueEUR, 0)
  const totalPnL   = investment.reduce((s, m) => s + m.pnlEUR, 0)

  function fmt(v: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(v)
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Portfolios</h1>
          <p className="text-gray-400 text-sm mt-1">
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} · All values in EUR
          </p>
        </div>
        <NewPortfolioButton />
      </div>

      {/* Aggregate strip (only when multiple investment portfolios) */}
      {investment.length > 1 && (
        <div className="flex items-center gap-6 mb-6 px-5 py-3 bg-[#0e0e1a] border border-[#1e1e2e] rounded-xl">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Total invested value</p>
            <p className="text-sm font-bold text-white tabular-nums">{fmt(totalValue)}</p>
          </div>
          <div className="w-px h-6 bg-[#1e1e2e]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Total P&L</p>
            <p className={`text-sm font-bold tabular-nums ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(totalPnL)}
            </p>
          </div>
          <div className="w-px h-6 bg-[#1e1e2e]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Portfolios</p>
            <p className="text-sm font-bold text-white">{investment.length}</p>
          </div>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="bg-[#12121a] border border-[#1e1e2e] border-dashed rounded-xl p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No portfolios</h2>
          <p className="text-gray-500 text-sm">Create a PEA or CTO portfolio to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metricsArr.map((m) => (
            <PortfolioCard key={m.portfolio.id} metrics={m} />
          ))}
        </div>
      )}
    </div>
  )
}
