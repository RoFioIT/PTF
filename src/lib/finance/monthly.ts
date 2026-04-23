// ============================================================
// Finance Engine — Monthly Performance Aggregation
//
// Monthly TWR: chain-links sub-period returns within the month,
//   adjusting for external cash flows at each boundary.
// Monthly MWR: Modified Dietz approximation — weights each
//   external cash flow by how early in the month it occurred.
// YTD figures: chain-linked product of monthly returns, reset
//   each calendar year on January 1.
// ============================================================

import type { HistoricalDataPoint, FinCashMovement } from './types'
import { computeTWR, computeModifiedDietz } from './metrics'

export interface MonthlyPerf {
  month: string        // 'YYYY-MM'
  label: string        // 'Jan 2024'
  value: number        // total portfolio value at month-end (securities + cash)
  invested: number     // cumulative cost basis at month-end
  pnl: number          // value − invested
  monthReturn: number  // absolute Δ vs previous month-end
  monthTWRPct: number  // Time-Weighted Return for the month (%)
  ytdTWRPct: number    // chain-linked TWR from Jan 1 of same year (%)
  monthMWRPct: number  // Modified Dietz MWR for the month (%)
  ytdMWRPct: number    // chain-linked MWR from Jan 1 of same year (%)
}

/**
 * aggregateMonthly
 *
 * Collapses the full history into one row per calendar month.
 * Requires the history to have been built with cash included in `value`
 * (i.e. reconstructHistory must receive real cashMovements and dividends).
 *
 * @param history       Daily/monthly HistoricalDataPoint[] sorted ascending
 * @param cashMovements External cash flows (DEPOSIT/WITHDRAWAL/TRANSFER) for MWR
 */
export function aggregateMonthly(
  history: HistoricalDataPoint[],
  cashMovements: FinCashMovement[] = [],
): MonthlyPerf[] {
  if (history.length === 0) return []

  // Group points by YYYY-MM
  const byMonth = new Map<string, HistoricalDataPoint[]>()
  for (const point of history) {
    const month = point.date.slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(point)
  }

  const months = [...byMonth.keys()].sort()

  // YTD accumulators — reset each new calendar year
  const ytdTWRFactors = new Map<string, number>()
  const ytdMWRFactors = new Map<string, number>()

  // Track the previous month-end date for Modified Dietz period boundaries
  let prevEndDate: string | null = null

  return months.map((month, i) => {
    const year = month.slice(0, 4)
    const points = byMonth.get(month)!.sort((a, b) => a.date.localeCompare(b.date))
    const endPoint = points[points.length - 1]

    // Previous month-end value (anchor for TWR sub-period + MWR start value)
    let prevEndValue = 0
    if (i > 0) {
      const prevPoints = byMonth.get(months[i - 1])!
      prevEndValue = prevPoints[prevPoints.length - 1].value
    }

    // ── TWR ──────────────────────────────────────────────────
    let monthTWR = 0
    if (prevEndValue > 0) {
      const subHistory: HistoricalDataPoint[] = [
        { date: `${month}-00`, value: prevEndValue, invested: 0 },
        ...points,
      ]
      monthTWR = computeTWR(subHistory)
    }

    // ── MWR (Modified Dietz) ──────────────────────────────────
    let monthMWR = 0
    if (prevEndValue > 0 && prevEndDate !== null) {
      // External cash flows that occurred within this month, signed
      const monthCFs = cashMovements
        .filter((m) => m.date.slice(0, 7) === month)
        .map((m) => ({
          amount:
            m.type === 'DEPOSIT' || m.type === 'TRANSFER_IN' ? m.amount : -m.amount,
          date: m.date,
        }))
      monthMWR = computeModifiedDietz(
        prevEndValue,
        endPoint.value,
        monthCFs,
        prevEndDate,
        endPoint.date,
      )
    }

    // ── YTD chain-link ────────────────────────────────────────
    if (!ytdTWRFactors.has(year)) ytdTWRFactors.set(year, 1)
    ytdTWRFactors.set(year, ytdTWRFactors.get(year)! * (1 + monthTWR))
    const ytdTWRPct = (ytdTWRFactors.get(year)! - 1) * 100

    if (!ytdMWRFactors.has(year)) ytdMWRFactors.set(year, 1)
    ytdMWRFactors.set(year, ytdMWRFactors.get(year)! * (1 + monthMWR))
    const ytdMWRPct = (ytdMWRFactors.get(year)! - 1) * 100

    prevEndDate = endPoint.date

    return {
      month,
      label: new Date(`${month}-15`).toLocaleDateString('fr-FR', {
        month: 'short', year: 'numeric',
      }),
      value: endPoint.value,
      invested: endPoint.invested,
      pnl: endPoint.value - endPoint.invested,
      monthReturn: prevEndValue > 0 ? endPoint.value - prevEndValue : 0,
      monthTWRPct: monthTWR * 100,
      ytdTWRPct,
      monthMWRPct: monthMWR * 100,
      ytdMWRPct,
    }
  })
}
