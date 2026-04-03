import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortfolioById } from '@/lib/db/portfolios'
import { getTransactionsByPortfolio, toFinTransaction } from '@/lib/db/transactions'
import { getDividendsByPortfolio, toFinDividend } from '@/lib/db/dividends'
import { getCashMovementsByPortfolio, toFinCashMovement } from '@/lib/db/cash_movements'
import { getLatestPrice } from '@/lib/db/prices'
import { fetchFxRate } from '@/lib/market-data/yahoo-finance'
import { buildAllPositions, buildPortfolioSnapshot, computeAvailableCash } from '@/lib/finance/portfolio'
import { sumDividends } from '@/lib/finance/dividends'
import { getShareGrants } from '@/lib/db/share_grants'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge } from '@/components/ui/Badge'
import { CashMovementPanel } from '@/components/portfolio/CashMovementPanel'
import { ShareGrantsPanel } from '@/components/portfolio/ShareGrantsPanel'
import { TrendingUp, TrendingDown, Wallet, DollarSign, Banknote } from 'lucide-react'

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

function fmtPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const portfolio = await getPortfolioById(supabase, id)
  if (!portfolio) notFound()

  const [txRows, divRows, cashRows] = await Promise.all([
    getTransactionsByPortfolio(supabase, id),
    getDividendsByPortfolio(supabase, id),
    getCashMovementsByPortfolio(supabase, id),
  ])

  const finTxs  = txRows.map(toFinTransaction)
  const finDivs = divRows.map(toFinDividend)
  const finCash = cashRows.map(toFinCashMovement)

  const assetIds = [...new Set(finTxs.map(t => t.assetId))]

  // Build currency map from the already-joined asset data in txRows
  const assetCurrencies = new Map<string, string>()
  for (const tx of txRows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = (tx as any).asset as { id: string; currency: string } | null
    if (asset) assetCurrencies.set(tx.asset_id, asset.currency)
  }

  // Fetch FX rates for non-EUR assets
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

  const priceMap = new Map<string, number>()
  await Promise.all(
    assetIds.map(async (assetId) => {
      const ccy = assetCurrencies.get(assetId) ?? 'EUR'
      const p = await getLatestPrice(supabase, assetId)
      if (p) {
        // Convert pence (GBp/GBX) to pounds before applying FX rate
        const rawPrice = Number(p.price)
        const priceInAssetCcy = (p.currency === 'GBp' || p.currency === 'GBX' || p.currency === 'GBx')
          ? rawPrice / 100
          : rawPrice
        const rate = fxRates.get(ccy) ?? 1
        priceMap.set(assetId, priceInAssetCcy * rate)
      }
    })
  )

  const positions = buildAllPositions(finTxs, priceMap, portfolio.accounting_method)
  const snapshot = buildPortfolioSnapshot(positions, finCash)
  const totalDividends = sumDividends(finDivs)
  const availableCash = computeAvailableCash(finCash, finTxs, finDivs)

  // ADM: fetch share grants and the seeded asset id
  const isADM = portfolio.type === 'ADM'
  const shareGrants = isADM ? await getShareGrants(supabase, id) : []
  // Resolve ADM asset by ISIN (works even before any grants/transactions exist)
  let admAssetId = shareGrants[0]?.asset_id ?? assetIds[0] ?? ''
  if (isADM && !admAssetId) {
    const { data: isinRow } = await supabase
      .from('asset_identifiers')
      .select('asset_id')
      .eq('type', 'ISIN')
      .eq('value', 'GB00B02J6398')
      .single()
    admAssetId = isinRow?.asset_id ?? ''
  }

  // ADM: raw GBP price, GBP→EUR rate, vested shares by type
  let admPriceGBP: number | null = null
  let admGbpToEur = fxRates.get('GBP') ?? 1
  let admAfssShares = 0
  let admDfssShares = 0
  if (isADM && admAssetId) {
    // Fetch without currency filter — Yahoo Finance stores LSE prices in GBp (pence)
    const rawPrice = await getLatestPrice(supabase, admAssetId)
    if (rawPrice) {
      const p = Number(rawPrice.price)
      admPriceGBP = (rawPrice.currency === 'GBp' || rawPrice.currency === 'GBX' || rawPrice.currency === 'GBx')
        ? p / 100
        : p
    }

    // Ensure GBP→EUR rate is available even when there are no transactions yet
    if (!fxRates.has('GBP')) {
      admGbpToEur = await fetchFxRate('GBP', 'EUR')
    }

    for (const g of shareGrants) {
      if (g.status === 'vested' && g.vesting_pct !== null) {
        const qty = Number(g.granted_quantity) * Number(g.vesting_pct) / 100
        if (g.share_type === 'AFSS') admAfssShares += qty
        else admDfssShares += qty
      }
    }
  }

  // Asset names are already joined in txRows via select('*, asset:assets(*)')
  const assetNames = new Map<string, string>()
  for (const tx of txRows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = (tx as any).asset as { id: string; name: string } | null
    if (asset) assetNames.set(tx.asset_id, asset.name)
  }

  const pnlPositive = snapshot.totalPnL >= 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{portfolio.name}</h1>
            <Badge variant={portfolio.type === 'PEA' ? 'purple' : 'info'}>
              {portfolio.type}
            </Badge>
          </div>
          <p className="text-gray-400 text-sm">
            {portfolio.base_currency} · {portfolio.accounting_method} method ·{' '}
            {snapshot.positions.filter((p) => p.totalShares > 0).length} positions
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Value"
          value={fmt(snapshot.currentValue, portfolio.base_currency)}
          subvalue={`Invested: ${fmt(snapshot.totalInvested, portfolio.base_currency)}`}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Total P&L"
          value={fmt(snapshot.totalPnL, portfolio.base_currency)}
          subvalue={fmtPct(snapshot.performancePct)}
          trend={pnlPositive ? 'up' : 'down'}
          icon={pnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        />
        {!isADM && (
          <MetricCard
            label="Realized P&L"
            value={fmt(
              positions.reduce((s, p) => s + p.realizedPnL, 0),
              portfolio.base_currency
            )}
            trend="neutral"
          />
        )}
        {!isADM && (
          <MetricCard
            label="Dividends"
            value={fmt(totalDividends, portfolio.base_currency)}
            icon={<DollarSign className="w-4 h-4" />}
          />
        )}
        {!isADM && (
          <MetricCard
            label="Available Cash"
            value={fmt(availableCash, portfolio.base_currency)}
            subvalue="deposits + sells + dividends − buys"
            trend={availableCash >= 0 ? 'up' : 'down'}
            icon={<Banknote className="w-4 h-4" />}
          />
        )}
      </div>

      {/* Positions — hidden for ADM portfolios (vested shares shown in ShareGrantsPanel) */}
      {!isADM && <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Positions</h2>
          <a
            href={`/transactions?portfolio=${id}`}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Add transaction →
          </a>
        </div>

        {snapshot.positions.filter((p) => p.totalShares > 0).length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            No positions yet. Add a BUY transaction to start tracking.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Asset', 'Shares', 'Avg Cost', 'Invested', 'Value', 'Unreal. P&L', 'Real. P&L', 'Alloc %'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {snapshot.positions
                .filter((p) => p.totalShares > 0)
                .sort((a, b) => b.totalInvested - a.totalInvested)
                .map((pos) => (
                  <tr key={pos.assetId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <a
                        href={`/assets/${pos.assetId}`}
                        className="text-sm font-medium text-white hover:text-indigo-400 transition-colors"
                      >
                        {assetNames.get(pos.assetId) ?? pos.assetId.slice(0, 8)}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                      {pos.totalShares.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                      {fmt(pos.avgCostBasis, portfolio.base_currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                      {fmt(pos.totalInvested, portfolio.base_currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                      {pos.currentPrice > 0 ? fmt(pos.currentValue, portfolio.base_currency) : '—'}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm tabular-nums font-medium ${
                        pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {pos.currentPrice > 0
                        ? fmt(pos.unrealizedPnL, portfolio.base_currency)
                        : '—'}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm tabular-nums font-medium ${
                        pos.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmt(pos.realizedPnL, portfolio.base_currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 tabular-nums">
                      {pos.allocationPct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>}
      {/* Cash movements — not shown for ADM portfolios */}
      {!isADM && (
        <CashMovementPanel
          portfolioId={id}
          currency={portfolio.base_currency}
          initialMovements={cashRows}
          availableCash={availableCash}
        />
      )}

      {/* ADM: vested holdings summary */}
      {isADM && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Vested Holdings</h2>
            {admPriceGBP !== null && (
              <span className="text-xs text-gray-500">
                Current price: <span className="text-white font-medium">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(admPriceGBP)}
                </span>
              </span>
            )}
          </div>

          {admAfssShares === 0 && admDfssShares === 0 ? (
            <div className="px-6 py-10 text-center text-gray-600 text-sm">
              No vested shares yet — use the Vest button on a grant below.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Type', 'Shares held', 'Price (GBP)', 'Value (GBP)', 'Value (EUR)'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {([['AFSS', admAfssShares], ['DFSS', admDfssShares]] as [string, number][])
                  .filter(([, qty]) => qty > 0)
                  .map(([type, qty]) => {
                    const value = admPriceGBP !== null ? qty * admPriceGBP : null
                    const fmtGBP = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v)
                    const fmtEUR = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)
                    const valueEur = value !== null ? value * admGbpToEur : null
                    return (
                      <tr key={type} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            type === 'AFSS' ? 'bg-indigo-400/15 text-indigo-400' : 'bg-amber-400/15 text-amber-400'
                          }`}>{type}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-white tabular-nums font-medium">
                          {qty.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                          {admPriceGBP !== null ? fmtGBP(admPriceGBP) : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-400 tabular-nums font-medium">
                          {value !== null ? fmtGBP(value) : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-400 tabular-nums font-medium">
                          {valueEur !== null ? fmtEUR(valueEur) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                {/* Total row */}
                {admAfssShares + admDfssShares > 0 && (
                  <tr className="border-t border-[#2e2e3e] bg-white/[0.01]">
                    <td className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Total</td>
                    <td className="px-6 py-3 text-sm text-white tabular-nums font-semibold">
                      {(admAfssShares + admDfssShares).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3 text-sm text-emerald-400 tabular-nums font-semibold">
                      {admPriceGBP !== null
                        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format((admAfssShares + admDfssShares) * admPriceGBP)
                        : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ADM share grants panel */}
      {isADM && admAssetId && (
        <ShareGrantsPanel
          portfolioId={id}
          assetId={admAssetId}
          grants={shareGrants}
          priceGBP={admPriceGBP}
          gbpToEur={admGbpToEur}
        />
      )}
    </div>
  )
}
