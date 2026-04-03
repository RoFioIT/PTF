// ============================================================
// Finance Engine — Dividend Metrics
// ============================================================

import type { FinDividend } from './types'

/**
 * sumDividends — total net dividends received (gross - withholding tax).
 */
export function sumDividends(dividends: FinDividend[]): number {
  return dividends.reduce((sum, d) => sum + (d.amount - d.tax), 0)
}

/**
 * sumGrossDividends — total gross dividends before tax.
 */
export function sumGrossDividends(dividends: FinDividend[]): number {
  return dividends.reduce((sum, d) => sum + d.amount, 0)
}

/**
 * dividendYieldOnCost
 *
 * Trailing 12-month dividend yield relative to cost basis.
 * Formula: (annualDividend / totalInvested) * 100
 *
 * @param dividends     All dividend records
 * @param totalInvested Total cost basis of the position
 */
export function dividendYieldOnCost(
  dividends: FinDividend[],
  totalInvested: number
): number {
  if (totalInvested <= 0) return 0

  const annualNet = trailingTwelveMonthDividends(dividends)
  return (annualNet / totalInvested) * 100
}

/**
 * dividendYieldOnValue
 *
 * Current market dividend yield.
 * Formula: (annualDividend / currentValue) * 100
 *
 * @param dividends    All dividend records
 * @param currentValue Current market value of the position
 */
export function dividendYieldOnValue(
  dividends: FinDividend[],
  currentValue: number
): number {
  if (currentValue <= 0) return 0

  const annualNet = trailingTwelveMonthDividends(dividends)
  return (annualNet / currentValue) * 100
}

/**
 * trailingTwelveMonthDividends — net dividends received in the last 12 months.
 */
export function trailingTwelveMonthDividends(dividends: FinDividend[]): number {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  return dividends
    .filter((d) => d.date >= cutoffStr)
    .reduce((sum, d) => sum + (d.amount - d.tax), 0)
}

/**
 * projectAnnualDividend
 *
 * Simple forward projection: annualizes the trailing 12-month dividends.
 * If fewer than 12 months of history exist, scales the known period up.
 *
 * This is a basic projection — no growth rate modelling.
 */
export function projectAnnualDividend(dividends: FinDividend[]): number {
  if (dividends.length === 0) return 0

  const now = new Date()
  const sorted = [...dividends].sort((a, b) => a.date.localeCompare(b.date))
  const oldest = new Date(sorted[0].date)

  const daysCovered = (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
  if (daysCovered <= 0) return 0

  const totalNet = sumDividends(dividends)

  // Scale to 365 days
  return (totalNet / daysCovered) * 365
}

/**
 * dividendsByYear — groups dividends by calendar year for the history table.
 */
export function dividendsByYear(
  dividends: FinDividend[]
): Record<string, { gross: number; tax: number; net: number }> {
  const result: Record<string, { gross: number; tax: number; net: number }> = {}

  for (const d of dividends) {
    const year = d.date.slice(0, 4)
    if (!result[year]) result[year] = { gross: 0, tax: 0, net: 0 }
    result[year].gross += d.amount
    result[year].tax += d.tax
    result[year].net += d.amount - d.tax
  }

  return result
}

/**
 * dividendCalendar — generates a 12-month forward calendar of
 * estimated dividend payments based on trailing history.
 *
 * Groups past dividends by asset + month, then projects them
 * into the same months next year.
 *
 * Returns: array of { month: 'YYYY-MM', assetId, estimatedAmount }
 */
export function dividendCalendar(
  dividends: FinDividend[]
): Array<{ month: string; assetId: string; estimatedAmount: number }> {
  if (dividends.length === 0) return []

  // Group by assetId + month-of-year
  const byAssetMonth = new Map<string, number[]>()

  for (const d of dividends) {
    const month = d.date.slice(5, 7)  // 'MM'
    const key = `${d.assetId}:${month}`
    const existing = byAssetMonth.get(key) ?? []
    existing.push(d.amount - d.tax)
    byAssetMonth.set(key, existing)
  }

  const result: Array<{ month: string; assetId: string; estimatedAmount: number }> = []
  const nextYear = new Date().getFullYear() + 1

  for (const [key, amounts] of byAssetMonth) {
    const [assetId, month] = key.split(':')
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    result.push({
      month: `${nextYear}-${month}`,
      assetId,
      estimatedAmount: avgAmount,
    })
  }

  return result.sort((a, b) => a.month.localeCompare(b.month))
}
