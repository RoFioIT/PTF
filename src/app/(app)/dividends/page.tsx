import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/lib/db/portfolios'
import { getDividendsByPortfolio, toFinDividend } from '@/lib/db/dividends'
import { sumDividends, dividendsByYear, trailingTwelveMonthDividends } from '@/lib/finance/dividends'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge } from '@/components/ui/Badge'
import { DollarSign, Plus } from 'lucide-react'

function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function DividendsPage() {
  const supabase = await createClient()
  const portfolios = await getPortfolios(supabase)

  const allDivRows = []
  for (const portfolio of portfolios) {
    const divs = await getDividendsByPortfolio(supabase, portfolio.id)
    for (const d of divs) {
      allDivRows.push({
        ...d,
        portfolio_name: portfolio.name,
        portfolio_type: portfolio.type,
      })
    }
  }

  allDivRows.sort((a, b) => b.date.localeCompare(a.date))

  const finDivs = allDivRows.map(toFinDividend)
  const totalNet = sumDividends(finDivs)
  const ttm = trailingTwelveMonthDividends(finDivs)
  const byYear = dividendsByYear(finDivs)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dividends</h1>
          <p className="text-gray-400 text-sm mt-1">{allDivRows.length} payments recorded</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Record dividend
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Total Received (net)"
          value={fmt(totalNet)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          label="Trailing 12 Months"
          value={fmt(ttm)}
          subvalue="net of withholding tax"
          trend="neutral"
        />
        <MetricCard
          label="Payments"
          value={allDivRows.length.toString()}
          subvalue={`${Object.keys(byYear).length} year(s) of history`}
        />
      </div>

      {/* Year summary */}
      {Object.keys(byYear).length > 0 && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1e2e]">
            <h2 className="font-semibold text-white text-sm">By Year</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Year', 'Gross', 'Tax', 'Net'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {Object.entries(byYear)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([year, { gross, tax, net }]) => (
                  <tr key={year} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3 text-sm font-medium text-white">{year}</td>
                    <td className="px-6 py-3 text-sm text-gray-300 tabular-nums">{fmt(gross)}</td>
                    <td className="px-6 py-3 text-sm text-red-400 tabular-nums">-{fmt(tax)}</td>
                    <td className="px-6 py-3 text-sm text-emerald-400 font-medium tabular-nums">
                      {fmt(net)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction log */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e2e]">
          <h2 className="font-semibold text-white text-sm">Payment History</h2>
        </div>

        {allDivRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            No dividends recorded yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Date', 'Asset', 'Portfolio', 'Gross', 'Tax', 'Net'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {allDivRows.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-400">{fmtDate(d.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {(d.asset as { name: string })?.name ?? d.asset_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{d.portfolio_name}</span>
                      <Badge variant={d.portfolio_type === 'PEA' ? 'purple' : 'info'}>
                        {d.portfolio_type}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 tabular-nums">
                    {fmt(Number(d.amount), d.currency)}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-400 tabular-nums">
                    -{fmt(Number(d.tax), d.currency)}
                  </td>
                  <td className="px-6 py-4 text-sm text-emerald-400 font-medium tabular-nums">
                    {fmt(Number(d.amount) - Number(d.tax), d.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
