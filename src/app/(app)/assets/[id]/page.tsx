import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAssetById } from '@/lib/db/assets'
import { getPriceHistory } from '@/lib/db/prices'
import { Badge } from '@/components/ui/Badge'
import { PriceChart } from '@/components/charts/PriceChart'
import type { IdentifierType, TransactionType } from '@/types/database'

export const dynamic = 'force-dynamic'

const identifierBadgeVariant: Record<IdentifierType, 'default' | 'info' | 'purple' | 'warning'> =
  {
    ISIN: 'default',
    TICKER: 'info',
    GOOGLE_SYMBOL: 'purple',
    BOURSORAMA: 'warning',
    OTHER: 'warning',
  }

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const asset = await getAssetById(supabase, id)
  if (!asset) notFound()

  // Fetch up to 3 years of price history in the asset's own currency
  const threeYearsAgo = new Date()
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
  const from = threeYearsAgo.toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)

  const priceRows = await getPriceHistory(supabase, id, from, to, asset.currency)

  // Fetch all transactions for this asset across all portfolios
  const { data: txRows } = await supabase
    .from('transactions')
    .select('*, portfolio:portfolios(name, type)')
    .eq('asset_id', id)
    .order('date', { ascending: false })

  interface TxWithPortfolio {
    id: string
    type: TransactionType
    quantity: number
    price: number
    fees: number
    currency: string
    date: string
    notes: string | null
    portfolio: { name: string; type: string } | null
  }
  const transactions = (txRows ?? []) as TxWithPortfolio[]
  const priceData = priceRows.map((p) => ({ date: p.date, price: Number(p.price) }))

  // ── Month-end aggregation ────────────────────────────────────
  // Keep the last price point of each YYYY-MM
  const byMonth = new Map<string, { date: string; price: number; source: string | null }>()
  for (const p of priceRows) {
    const month = p.date.slice(0, 7)
    byMonth.set(month, { date: p.date, price: Number(p.price), source: p.source ?? null })
  }
  const monthEntries = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))

  // YTD anchors: end-of-December of the PREVIOUS year.
  // e.g. for 2025 → anchor = price stored under month '2024-12'
  const ytdAnchors = new Map<string, number>()
  for (const [month, { price }] of monthEntries) {
    if (month.slice(5) === '12') {
      // December of year Y becomes the anchor for year Y+1
      ytdAnchors.set(String(Number(month.slice(0, 4)) + 1), price)
    }
  }

  interface MonthRow {
    month: string
    label: string
    date: string
    price: number
    source: string | null
    monthPct: number | null
    ytdPct: number | null
  }

  const monthRows: MonthRow[] = monthEntries.map(([month, entry], i) => {
    const year = month.slice(0, 4)
    const prev = i > 0 ? monthEntries[i - 1][1] : null
    const monthPct = prev && prev.price > 0
      ? ((entry.price - prev.price) / prev.price) * 100
      : null
    const ytdAnchor = ytdAnchors.get(year)
    const ytdPct = ytdAnchor !== undefined && ytdAnchor > 0
      ? ((entry.price - ytdAnchor) / ytdAnchor) * 100
      : null   // no December prior-year data → show '—'

    return {
      month,
      label: new Date(`${month}-15`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      date: entry.date,
      price: entry.price,
      source: entry.source,
      monthPct,
      ytdPct,
    }
  })

  // Latest price stats
  const latestPrice = priceData.length > 0 ? priceData[priceData.length - 1].price : null
  const oldestPrice = priceData.length > 0 ? priceData[0].price : null
  const changePct = latestPrice && oldestPrice && oldestPrice > 0
    ? ((latestPrice - oldestPrice) / oldestPrice) * 100
    : null

  const currency = asset.currency
  function fmtPrice(v: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
          <Badge variant="default">{asset.asset_type.toUpperCase()}</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          {asset.currency}
          {asset.sector && ` · ${asset.sector}`}
          {asset.country && ` · ${asset.country}`}
        </p>
      </div>

      {/* Price chart */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Price History</h2>
          {latestPrice !== null && (
            <div className="text-right">
              <p className="text-lg font-bold text-white">{fmtPrice(latestPrice)}</p>
              {changePct !== null && (
                <p className={`text-xs font-medium ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% ({priceData.length} months)
                </p>
              )}
            </div>
          )}
        </div>
        <PriceChart data={priceData} currency={asset.currency} />
      </div>

      {/* Identifiers */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Identifiers</h2>
        {asset.asset_identifiers.length === 0 ? (
          <p className="text-gray-600 text-sm">No identifiers registered.</p>
        ) : (
          <div className="space-y-2">
            {asset.asset_identifiers.map((ident) => (
              <div key={ident.id} className="flex items-center gap-3">
                <Badge variant={identifierBadgeVariant[ident.type]}>{ident.type}</Badge>
                <code className="text-sm text-gray-300 font-mono">{ident.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Transaction History</h2>
          <span className="text-xs text-gray-500">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            No transactions recorded for this asset.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Date', 'Portfolio', 'Type', 'Quantity', 'Price', 'Fees', 'Total'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {transactions.map((tx) => {
                const total = tx.type === 'BUY'
                  ? tx.quantity * tx.price + tx.fees
                  : tx.quantity * tx.price - tx.fees
                return (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-300 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-300">
                      {tx.portfolio?.name ?? '—'}
                      {tx.portfolio?.type && (
                        <span className="ml-1.5 text-xs text-gray-500">({tx.portfolio.type})</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        tx.type === 'BUY' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-white tabular-nums">{Number(tx.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td>
                    <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">{fmtPrice(Number(tx.price))}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 tabular-nums">
                      {tx.fees > 0 ? fmtPrice(Number(tx.fees)) : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-white tabular-nums font-medium">{fmtPrice(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Month-end price history */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Monthly Prices</h2>
          <span className="text-xs text-gray-500">{monthRows.length} months · {asset.currency}</span>
        </div>

        {monthRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-600 text-sm">
            No prices imported yet — click Refresh prices on the dashboard.
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#12121a] z-10">
                <tr className="border-b border-[#1e1e2e]">
                  {['Month', 'Close price', 'Month %', 'YTD %', 'Source'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {[...monthRows].reverse().map((row) => (
                  <tr key={row.month} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-white whitespace-nowrap">{row.label}</td>
                    <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">{fmtPrice(row.price)}</td>
                    <td className={`px-6 py-3 text-sm tabular-nums font-medium ${
                      row.monthPct === null ? 'text-gray-600' :
                      row.monthPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {row.monthPct === null ? '—' : `${row.monthPct >= 0 ? '+' : ''}${row.monthPct.toFixed(2)}%`}
                    </td>
                    <td className={`px-6 py-3 text-sm tabular-nums font-medium ${
                      row.ytdPct === null ? 'text-gray-600' :
                      row.ytdPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {row.ytdPct === null ? '—' : `${row.ytdPct >= 0 ? '+' : ''}${row.ytdPct.toFixed(2)}%`}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">{row.source ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
