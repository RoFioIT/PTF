// ============================================================
// Finance Engine — Position Calculations
// Implements both PRU (weighted average cost) and FIFO methods.
// All calculations include fees in the cost basis.
// ============================================================

import type {
  FinTransaction,
  PRUState,
  FIFOState,
  FIFOLot,
  Position,
} from './types'

/**
 * PRU — Prix de Revient Unitaire (Weighted Average Cost)
 *
 * On each BUY: the new average = (oldAvg * oldQty + newCost) / (oldQty + newQty)
 * where newCost = (price * qty) + fees.
 *
 * On SELL: realized P&L = (sellPrice - avgCost) * qty - fees.
 * The average cost is NOT updated on sell (standard French PRU method).
 */
export function computePRU(transactions: FinTransaction[]): PRUState {
  let totalShares = 0
  let avgCostBasis = 0
  let realizedPnL = 0
  let totalFeesPaid = 0

  // Transactions must be sorted ascending by date before calling this function.
  for (const tx of transactions) {
    const grossCost = tx.price * tx.quantity
    totalFeesPaid += tx.fees

    if (tx.type === 'BUY') {
      const totalCostIncFees = grossCost + tx.fees
      // Update weighted average: new avg = (existing total cost + new cost) / new total shares
      const existingTotalCost = avgCostBasis * totalShares
      totalShares += tx.quantity
      avgCostBasis = (existingTotalCost + totalCostIncFees) / totalShares
    } else {
      // SELL: realize P&L against current average cost
      if (totalShares < tx.quantity) {
        // Guard: should not happen in a clean ledger, but cap at available shares
        throw new Error(
          `Cannot sell ${tx.quantity} shares of asset ${tx.assetId} — only ${totalShares} held`
        )
      }
      // Realized P&L per share = sell price - avg cost basis; minus sell fees
      realizedPnL +=
        (tx.price - avgCostBasis) * tx.quantity - tx.fees
      totalShares -= tx.quantity
      // avgCostBasis does NOT change on sell (PRU method)
    }
  }

  return { totalShares, avgCostBasis, realizedPnL, totalFeesPaid }
}

/**
 * FIFO — First In, First Out
 *
 * Sells consume the oldest lots first.
 * Each lot tracks its per-unit cost basis (including pro-rated fees).
 */
export function computeFIFO(transactions: FinTransaction[]): FIFOState {
  const lots: FIFOLot[] = []
  let realizedPnL = 0
  let totalFeesPaid = 0

  for (const tx of transactions) {
    totalFeesPaid += tx.fees

    if (tx.type === 'BUY') {
      const costBasisPerShare = (tx.price * tx.quantity + tx.fees) / tx.quantity
      lots.push({ quantity: tx.quantity, costBasis: costBasisPerShare, date: tx.date })
    } else {
      // SELL: consume oldest lots first
      let remainingToSell = tx.quantity
      const sellPricePerShare = tx.price
      const sellFeesPerShare = tx.fees / tx.quantity  // amortize fees over sold shares

      while (remainingToSell > 0 && lots.length > 0) {
        const lot = lots[0]

        if (lot.quantity <= remainingToSell) {
          // Consume the entire lot
          realizedPnL +=
            (sellPricePerShare - lot.costBasis - sellFeesPerShare) * lot.quantity
          remainingToSell -= lot.quantity
          lots.shift()
        } else {
          // Partially consume the lot
          realizedPnL +=
            (sellPricePerShare - lot.costBasis - sellFeesPerShare) * remainingToSell
          lot.quantity -= remainingToSell
          remainingToSell = 0
        }
      }

      if (remainingToSell > 0) {
        throw new Error(
          `FIFO: Cannot sell ${tx.quantity} shares of ${tx.assetId} — insufficient lots`
        )
      }
    }
  }

  const totalShares = lots.reduce((sum, lot) => sum + lot.quantity, 0)

  return { lots, totalShares, realizedPnL, totalFeesPaid }
}

/**
 * buildPosition — master function.
 *
 * Computes the full position state for a given asset given:
 * - its sorted transaction history
 * - the current market price
 * - the accounting method (PRU or FIFO)
 *
 * Returns a rich Position object used for both UI display and
 * portfolio-level aggregation.
 */
export function buildPosition(
  assetId: string,
  transactions: FinTransaction[],
  currentPrice: number,
  method: 'PRU' | 'FIFO' = 'PRU'
): Position {
  // Sort ascending by date (safety net — callers should pre-sort)
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let totalShares: number
  let avgCostBasis: number
  let realizedPnL: number

  if (method === 'FIFO') {
    const state = computeFIFO(sorted)
    totalShares = state.totalShares
    realizedPnL = state.realizedPnL
    // For FIFO, avgCostBasis is the weighted average of remaining lots
    avgCostBasis =
      state.totalShares > 0
        ? state.lots.reduce(
            (sum, lot) => sum + lot.costBasis * lot.quantity,
            0
          ) / state.totalShares
        : 0
  } else {
    const state = computePRU(sorted)
    totalShares = state.totalShares
    avgCostBasis = state.avgCostBasis
    realizedPnL = state.realizedPnL
  }

  const totalInvested = avgCostBasis * totalShares
  const currentValue = currentPrice * totalShares
  const unrealizedPnL = currentValue - totalInvested
  const totalPnL = realizedPnL + unrealizedPnL
  const performancePct =
    totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  return {
    assetId,
    totalShares,
    avgCostBasis,
    totalInvested,
    currentValue,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    performancePct,
    currentPrice,
  }
}

/**
 * groupTransactionsByAsset — helper to split a flat transaction list
 * into per-asset arrays, preserving date order.
 */
export function groupTransactionsByAsset(
  transactions: FinTransaction[]
): Map<string, FinTransaction[]> {
  const map = new Map<string, FinTransaction[]>()

  for (const tx of transactions) {
    const existing = map.get(tx.assetId) ?? []
    existing.push(tx)
    map.set(tx.assetId, existing)
  }

  return map
}
