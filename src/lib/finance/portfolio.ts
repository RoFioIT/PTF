// ============================================================
// Finance Engine — Portfolio-level Aggregation
// ============================================================

import type {
  Position,
  PortfolioSnapshot,
  FinCashMovement,
  FinTransaction,
  FinDividend,
  FinPricePoint,
  HistoricalDataPoint,
  Allocation,
} from './types'
import { buildPosition, groupTransactionsByAsset } from './positions'

/**
 * buildPortfolioSnapshot
 *
 * Aggregates individual asset positions into a portfolio-level view.
 * Computes total invested, current value, P&L, and allocation weights.
 *
 * @param positions   Pre-computed per-asset positions
 * @param cashMovements Cash deposits/withdrawals (for net cash flow)
 */
export function buildPortfolioSnapshot(
  positions: Position[],
  cashMovements: FinCashMovement[]
): PortfolioSnapshot {
  const openPositions = positions.filter((p) => p.totalShares > 0)

  const totalInvested = openPositions.reduce((sum, p) => sum + p.totalInvested, 0)
  const currentValue = openPositions.reduce((sum, p) => sum + p.currentValue, 0)
  const totalPnL =
    positions.reduce((sum, p) => sum + p.realizedPnL, 0) +  // all realized (including closed)
    openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0)

  const performancePct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  // Net cash flow: deposits + transfer_in - withdrawals - transfer_out
  const netCashFlow = cashMovements.reduce((sum, mv) => {
    if (mv.type === 'DEPOSIT' || mv.type === 'TRANSFER_IN') return sum + mv.amount
    return sum - mv.amount
  }, 0)

  // Allocation weights — based on current value of open positions
  const allocations: Allocation[] = openPositions.map((p) => ({
    assetId: p.assetId,
    currentValue: p.currentValue,
    allocationPct: currentValue > 0 ? (p.currentValue / currentValue) * 100 : 0,
  }))

  // Inject allocation % back into position objects
  const allocationMap = new Map(allocations.map((a) => [a.assetId, a.allocationPct]))
  const enrichedPositions = positions.map((p) => ({
    ...p,
    allocationPct: allocationMap.get(p.assetId) ?? 0,
  }))

  return {
    totalInvested,
    currentValue,
    totalPnL,
    performancePct,
    netCashFlow,
    positions: enrichedPositions,
    allocations,
  }
}

/**
 * buildAllPositions
 *
 * Convenience function: takes a flat list of transactions,
 * groups them by asset, and builds each position using the given price map.
 *
 * @param transactions  All transactions in the portfolio
 * @param priceMap      Map of assetId → current price
 * @param method        Accounting method ('PRU' | 'FIFO')
 */
export function buildAllPositions(
  transactions: FinTransaction[],
  priceMap: Map<string, number>,
  method: 'PRU' | 'FIFO' = 'PRU'
): Position[] {
  const grouped = groupTransactionsByAsset(transactions)
  const positions: Position[] = []

  for (const [assetId, txs] of grouped) {
    const currentPrice = priceMap.get(assetId) ?? 0
    positions.push(buildPosition(assetId, txs, currentPrice, method))
  }

  return positions
}

/**
 * reconstructHistory
 *
 * Rebuilds the portfolio's historical value curve day by day.
 * For each day that has price data, we compute what the portfolio
 * was worth based on holdings at that point (from all past transactions).
 *
 * Algorithm:
 *   1. Collect all unique dates from price history and transactions.
 *   2. Walk forward through time.
 *   3. At each date, recompute holdings (all txs up to that date) and
 *      multiply by that day's price.
 *
 * @param transactions  All portfolio transactions sorted ascending
 * @param priceHistory  Map of assetId → sorted daily price points
 * @param cashMovements Cash flows (for invested capital tracking)
 */
export function reconstructHistory(
  transactions: FinTransaction[],
  priceHistory: Map<string, FinPricePoint[]>,
  cashMovements: FinCashMovement[],
  method: 'PRU' | 'FIFO' = 'PRU'
): HistoricalDataPoint[] {
  if (transactions.length === 0) return []

  // Collect all dates with price data
  const allDates = new Set<string>()
  for (const prices of priceHistory.values()) {
    for (const p of prices) allDates.add(p.date)
  }

  // Build sorted date array starting from the first transaction
  const firstTxDate = transactions[0].date
  const sortedDates = Array.from(allDates)
    .filter((d) => d >= firstTxDate)
    .sort()

  if (sortedDates.length === 0) return []

  // Build fast lookup: assetId → date → price
  const priceLookup = new Map<string, Map<string, number>>()
  for (const [assetId, prices] of priceHistory) {
    const dateMap = new Map(prices.map((p) => [p.date, p.price]))
    priceLookup.set(assetId, dateMap)
  }

  // Cash movement lookup: date → net cash flow
  const cashFlowByDate = new Map<string, number>()
  for (const mv of cashMovements) {
    const delta =
      mv.type === 'DEPOSIT' || mv.type === 'TRANSFER_IN' ? mv.amount : -mv.amount
    cashFlowByDate.set(mv.date, (cashFlowByDate.get(mv.date) ?? 0) + delta)
  }

  const result: HistoricalDataPoint[] = []
  let cumulativeInvested = 0

  for (const date of sortedDates) {
    // Holdings as of end-of-day on `date`
    const txsUpToDate = transactions.filter((tx) => tx.date <= date)
    if (txsUpToDate.length === 0) continue

    const grouped = groupTransactionsByAsset(txsUpToDate)
    let portfolioValue = 0
    let invested = 0

    for (const [assetId, txs] of grouped) {
      const priceOnDate = findPriceOnOrBefore(priceLookup.get(assetId), date)
      if (priceOnDate === null) continue

      const pos = buildPosition(assetId, txs, priceOnDate, method)
      portfolioValue += pos.currentValue
      invested += pos.totalInvested
    }

    cumulativeInvested = Math.max(cumulativeInvested, invested)

    result.push({
      date,
      value: portfolioValue,
      invested: cumulativeInvested,
      cashFlow: cashFlowByDate.get(date),
    })
  }

  return result
}

/**
 * computeAvailableCash
 *
 * Available cash in a portfolio at any point in time:
 *
 *   + Deposits / transfers in   (cash_movements)
 *   − Withdrawals / transfers out
 *   − BUY costs  (quantity × price + fees)
 *   + SELL proceeds (quantity × price − fees)
 *   + Dividends received net (amount − tax)
 */
export function computeAvailableCash(
  cashMovements: FinCashMovement[],
  transactions: FinTransaction[],
  dividends: FinDividend[]
): number {
  const netDeposits = cashMovements.reduce((sum, mv) => {
    if (mv.type === 'DEPOSIT' || mv.type === 'TRANSFER_IN') return sum + mv.amount
    return sum - mv.amount
  }, 0)

  const netTrading = transactions.reduce((sum, tx) => {
    if (tx.type === 'BUY') return sum - (tx.quantity * tx.price + tx.fees)
    return sum + (tx.quantity * tx.price - tx.fees)
  }, 0)

  const netDividends = dividends.reduce((sum, div) => sum + (div.amount - div.tax), 0)

  return netDeposits + netTrading + netDividends
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * findPriceOnOrBefore — returns the most recent available price
 * for a given asset on or before the target date.
 * Returns null if no price data exists before the date.
 */
function findPriceOnOrBefore(
  dateMap: Map<string, number> | undefined,
  targetDate: string
): number | null {
  if (!dateMap) return null

  let latest: number | null = null
  for (const [date, price] of dateMap) {
    if (date <= targetDate) {
      if (latest === null) {
        latest = price
      } else {
        // Keep the most recent (closest to targetDate)
        const [bestDate] = [...dateMap.entries()]
          .filter(([d]) => d <= targetDate)
          .sort((a, b) => (a[0] > b[0] ? -1 : 1))[0]
        latest = dateMap.get(bestDate) ?? latest
        break
      }
    }
  }

  // Simpler O(n) approach — find max date <= targetDate
  let bestDate: string | null = null
  for (const date of dateMap.keys()) {
    if (date <= targetDate) {
      if (bestDate === null || date > bestDate) bestDate = date
    }
  }

  return bestDate !== null ? (dateMap.get(bestDate) ?? null) : null
}
