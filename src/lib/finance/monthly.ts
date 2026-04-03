// ============================================================
// Finance Engine — Monthly Performance Aggregation
//
// Monthly % and YTD % use Time-Weighted Return (TWR):
//   - Monthly TWR: chain-links daily sub-period returns within
//     the month, adjusting for cash flows at each boundary.
//   - YTD TWR: chain-product of monthly TWRs since Jan 1,
//     anchored on the previous December's end value.
//     → January's YTD equals its own monthly TWR (not zero).
// ============================================================

import type { HistoricalDataPoint } from './types'
import { computeTWR } from './metrics'

export interface MonthlyPerf {
  month: string       // 'YYYY-MM'
  label: string       // 'Jan 2024'
  value: number       // portfolio value at month-end
  invested: number    // cumulative invested capital
  pnl: number         // unrealized P&L at month-end
  monthReturn: number // absolute Δ vs previous month-end
  monthPct: number    // TWR for the month (%)
  ytdPct: number      // chain-linked TWR from Jan 1 of same year (%)
}

/**
 * aggregateMonthly
 *
 * Collapses the full daily history into one row per calendar month.
 * Monthly TWR is computed from daily data points within each month;
 * YTD TWR is the chain-linked product of monthly TWRs.
 */
export function aggregateMonthly(history: HistoricalDataPoint[]): MonthlyPerf[] {
  if (history.length === 0) return []

  // Group daily points by YYYY-MM
  const byMonth = new Map<string, HistoricalDataPoint[]>()
  for (const point of history) {
    const month = point.date.slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(point)
  }

  const months = [...byMonth.keys()].sort()

  // YTD: cumulative (1 + monthTWR) factor, reset each new year
  const ytdFactors = new Map<string, number>()

  return months.map((month, i) => {
    const year = month.slice(0, 4)
    const points = byMonth.get(month)!.sort((a, b) => a.date.localeCompare(b.date))
    const endPoint = points[points.length - 1]

    // Previous month-end value — used as the TWR sub-period anchor
    let prevEndValue = 0
    if (i > 0) {
      const prevPoints = byMonth.get(months[i - 1])!
      prevEndValue = prevPoints[prevPoints.length - 1].value
    }

    // Monthly TWR: prepend a synthetic anchor point (prevEndValue, no cashFlow)
    // so computeTWR sees a clean sub-period boundary at the month start.
    let monthTWR = 0
    if (prevEndValue > 0) {
      const subHistory: HistoricalDataPoint[] = [
        { date: `${month}-00`, value: prevEndValue, invested: 0 },
        ...points,
      ]
      monthTWR = computeTWR(subHistory)
    }

    // Chain-link into YTD factor (resets at the first month of each year)
    if (!ytdFactors.has(year)) ytdFactors.set(year, 1)
    ytdFactors.set(year, ytdFactors.get(year)! * (1 + monthTWR))
    const ytdPct = (ytdFactors.get(year)! - 1) * 100

    return {
      month,
      label: new Date(`${month}-15`).toLocaleDateString('fr-FR', {
        month: 'short', year: 'numeric',
      }),
      value: endPoint.value,
      invested: endPoint.invested,
      pnl: endPoint.value - endPoint.invested,
      monthReturn: prevEndValue > 0 ? endPoint.value - prevEndValue : 0,
      monthPct: monthTWR * 100,
      ytdPct,
    }
  })
}
