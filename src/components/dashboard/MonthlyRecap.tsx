import type { MonthlyPerf } from '@/lib/finance/monthly'

interface MonthlyRecapProps {
  data: MonthlyPerf[]
  currency?: string
}

function fmtCcy(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function fmtPct(value: number, showSign = true) {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function pctColor(value: number) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

export function MonthlyRecap({ data, currency = 'EUR' }: MonthlyRecapProps) {
  if (data.length === 0) {
    return (
      <p className="text-gray-600 text-sm py-4 text-center">
        No history available yet — refresh prices first.
      </p>
    )
  }

  // Show most recent first
  const rows = [...data].reverse()

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-[#1e1e2e]">
        {rows.map((row) => {
          const noData = row.monthReturn === 0 && row.invested === 0
          return (
            <div key={row.month} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white whitespace-nowrap">{row.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 tabular-nums">{fmtCcy(row.value, currency)}</div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <div className={`text-xs font-medium tabular-nums ${pctColor(row.monthPct)}`}>
                    {noData ? '—' : fmtPct(row.monthPct)}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">Month</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium tabular-nums ${pctColor(row.ytdPct)}`}>
                    {fmtPct(row.ytdPct)}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">YTD</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium tabular-nums ${pctColor(row.pnl)}`}>
                    {fmtCcy(row.pnl, currency)}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">P&L</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              {['Month', 'Value', 'Invested', 'P&L', 'Month Δ', 'Month %', 'YTD %'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {rows.map((row) => (
              <tr key={row.month} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3 font-medium text-white whitespace-nowrap">{row.label}</td>
                <td className="px-5 py-3 tabular-nums text-gray-300">{fmtCcy(row.value, currency)}</td>
                <td className="px-5 py-3 tabular-nums text-gray-300">{fmtCcy(row.invested, currency)}</td>
                <td className={`px-5 py-3 tabular-nums font-medium ${pctColor(row.pnl)}`}>
                  {fmtCcy(row.pnl, currency)}
                </td>
                <td className={`px-5 py-3 tabular-nums ${pctColor(row.monthReturn)}`}>
                  {row.monthReturn === 0 && row.invested === 0 ? '—' : fmtCcy(row.monthReturn, currency)}
                </td>
                <td className={`px-5 py-3 tabular-nums font-medium ${pctColor(row.monthPct)}`}>
                  {row.monthReturn === 0 && row.invested === 0 ? '—' : fmtPct(row.monthPct)}
                </td>
                <td className={`px-5 py-3 tabular-nums font-medium ${pctColor(row.ytdPct)}`}>
                  {fmtPct(row.ytdPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
