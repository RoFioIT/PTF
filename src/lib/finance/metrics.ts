// ============================================================
// Finance Engine — Advanced Portfolio Metrics
//
// TWR, Max Drawdown, Volatility, Allocations.
// All functions are pure — no side effects, easy to unit-test.
// ============================================================

import type { HistoricalDataPoint, Position, Allocation } from './types'

/**
 * computeTWR — Time-Weighted Return (chain-link method)
 *
 * TWR eliminates the distorting effect of external cash flows
 * by measuring performance between each cash-flow event.
 *
 * Formula: TWR = Π (1 + sub-period return) - 1
 *
 * Sub-period boundaries are determined by external cash flows.
 * If no cash flows, a single sub-period covers the full history.
 *
 * @param dataPoints  Historical portfolio values, sorted ascending by date
 * @returns TWR as a decimal (e.g. 0.12 = +12%)
 */
export function computeTWR(dataPoints: HistoricalDataPoint[]): number {
  if (dataPoints.length < 2) return 0

  let cumulativeFactor = 1

  for (let i = 1; i < dataPoints.length; i++) {
    const prev = dataPoints[i - 1]
    const curr = dataPoints[i]

    // Start-of-period value is end-of-previous-day value + any cash flow today
    // (cash flow at start of period, per standard TWR methodology)
    const startValue = prev.value + (curr.cashFlow ?? 0)

    if (startValue <= 0) continue  // avoid division by zero in degenerate cases

    const subPeriodReturn = (curr.value - startValue) / startValue
    cumulativeFactor *= 1 + subPeriodReturn
  }

  return cumulativeFactor - 1
}

/**
 * computeMaxDrawdown
 *
 * The largest peak-to-trough decline in portfolio value.
 * Expressed as a positive percentage (e.g. 0.25 = 25% drawdown).
 *
 * @param dataPoints  Historical portfolio values sorted ascending
 * @returns Max drawdown as a positive decimal
 */
export function computeMaxDrawdown(dataPoints: HistoricalDataPoint[]): number {
  if (dataPoints.length < 2) return 0

  let peak = dataPoints[0].value
  let maxDrawdown = 0

  for (const point of dataPoints) {
    if (point.value > peak) {
      peak = point.value
    }

    if (peak > 0) {
      const drawdown = (peak - point.value) / peak
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
  }

  return maxDrawdown  // e.g. 0.25 for 25%
}

/**
 * computeCurrentDrawdown
 *
 * Drawdown from the most recent all-time high to current value.
 */
export function computeCurrentDrawdown(dataPoints: HistoricalDataPoint[]): number {
  if (dataPoints.length === 0) return 0

  const currentValue = dataPoints[dataPoints.length - 1].value
  const peakValue = Math.max(...dataPoints.map((d) => d.value))

  if (peakValue <= 0) return 0
  return (peakValue - currentValue) / peakValue
}

/**
 * computeVolatility — Annualized Volatility (approximation)
 *
 * Based on the standard deviation of daily returns, annualized
 * by multiplying by √252 (trading days per year).
 *
 * This is a simple approximation — not suitable for derivatives pricing,
 * but appropriate for portfolio monitoring dashboards.
 *
 * @param dataPoints  Historical portfolio values sorted ascending
 * @returns Annualized volatility as a decimal (e.g. 0.15 = 15%)
 */
export function computeVolatility(dataPoints: HistoricalDataPoint[]): number {
  if (dataPoints.length < 3) return 0

  const dailyReturns: number[] = []
  for (let i = 1; i < dataPoints.length; i++) {
    const prev = dataPoints[i - 1].value
    const curr = dataPoints[i].value
    if (prev > 0) dailyReturns.push((curr - prev) / prev)
  }

  if (dailyReturns.length < 2) return 0

  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  const variance =
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    (dailyReturns.length - 1)  // sample variance (Bessel's correction)

  const dailyStdDev = Math.sqrt(variance)
  const TRADING_DAYS_PER_YEAR = 252

  return dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

/**
 * computeAllocations — derives allocation % from a list of positions.
 *
 * @param positions  List of positions with currentValue set
 */
export function computeAllocations(positions: Position[]): Allocation[] {
  const openPositions = positions.filter((p) => p.totalShares > 0)
  const totalValue = openPositions.reduce((sum, p) => sum + p.currentValue, 0)

  if (totalValue === 0) return []

  return openPositions
    .map((p) => ({
      assetId: p.assetId,
      currentValue: p.currentValue,
      allocationPct: (p.currentValue / totalValue) * 100,
    }))
    .sort((a, b) => b.allocationPct - a.allocationPct)
}

/**
 * computeSharpeRatio (simplified)
 *
 * Annualized Sharpe = (TWR - riskFreeRate) / volatility
 * Using 3% annual risk-free rate as default.
 *
 * NOTE: This requires at least ~30 data points for meaningful results.
 *
 * @param dataPoints      Historical portfolio values
 * @param riskFreeRate    Annual risk-free rate (default 0.03 = 3%)
 */
export function computeSharpeRatio(
  dataPoints: HistoricalDataPoint[],
  riskFreeRate = 0.03
): number | null {
  if (dataPoints.length < 30) return null

  const twr = computeTWR(dataPoints)
  const volatility = computeVolatility(dataPoints)

  if (volatility === 0) return null
  return (twr - riskFreeRate) / volatility
}

/**
 * computeCAGR — Compound Annual Growth Rate
 *
 * @param startValue   Portfolio value at the start
 * @param endValue     Portfolio value at the end
 * @param years        Number of years (can be fractional)
 */
export function computeCAGR(
  startValue: number,
  endValue: number,
  years: number
): number | null {
  if (startValue <= 0 || years <= 0) return null
  return Math.pow(endValue / startValue, 1 / years) - 1
}

/**
 * computeYTD — Year-to-date return from January 1st of the current year.
 */
export function computeYTD(dataPoints: HistoricalDataPoint[]): number | null {
  if (dataPoints.length === 0) return null

  const currentYear = new Date().getFullYear().toString()
  const ytdStart = dataPoints.find((d) => d.date.startsWith(currentYear))

  if (!ytdStart) return null

  const current = dataPoints[dataPoints.length - 1]
  if (ytdStart.value <= 0) return null

  return (current.value - ytdStart.value) / ytdStart.value
}
