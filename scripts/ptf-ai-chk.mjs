/**
 * PtfAIChk data fetcher
 * Queries Supabase with the service role key and outputs a structured JSON
 * snapshot of all investment portfolios (PEA / CTO / ADM).
 *
 * Run: node /Users/roberto/Documents/LocalProjet/PTF/scripts/ptf-ai-chk.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ── Env ──────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(__filename), '..')

function parseEnvFile(filePath) {
  const env = {}
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = parseEnvFile(resolve(projectRoot, '.env.local'))
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const n = (v) => (v == null ? 0 : Number(v))

function daysBetween(dateStr, now = new Date()) {
  const d = new Date(dateStr)
  return Math.floor((now - d) / 86_400_000)
}

// ── PRU position engine ───────────────────────────────────────────────────────

/**
 * Computes per-portfolio, per-asset PRU positions from a flat transaction list.
 * Returns a Map keyed by `${portfolioId}:${assetId}`.
 */
function computePositions(transactions) {
  const map = new Map()

  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  )

  for (const tx of sorted) {
    const key = `${tx.portfolio_id}:${tx.asset_id}`
    if (!map.has(key)) {
      map.set(key, { portfolioId: tx.portfolio_id, assetId: tx.asset_id, shares: 0, pru: 0 })
    }
    const pos = map.get(key)
    const qty = n(tx.quantity)
    const price = n(tx.price)
    const fees = n(tx.fees)

    if (tx.type === 'BUY') {
      const costBefore = pos.shares * pos.pru
      const newCost = qty * price + fees
      pos.shares += qty
      pos.pru = pos.shares > 0 ? (costBefore + newCost) / pos.shares : 0
    } else if (tx.type === 'SELL') {
      pos.shares = Math.max(0, pos.shares - qty)
      // PRU is unchanged on SELL — French PRU accounting standard
    }
  }

  return map
}

// ── Cash available ────────────────────────────────────────────────────────────

function computeCash(portfolioId, transactions, cashMovements, dividends) {
  let cash = 0
  for (const mv of cashMovements.filter((m) => m.portfolio_id === portfolioId)) {
    const amt = n(mv.amount)
    cash += mv.type === 'DEPOSIT' || mv.type === 'TRANSFER_IN' ? amt : -amt
  }
  for (const tx of transactions.filter((t) => t.portfolio_id === portfolioId)) {
    const qty = n(tx.quantity)
    const price = n(tx.price)
    const fees = n(tx.fees)
    cash += tx.type === 'SELL' ? qty * price - fees : -(qty * price + fees)
  }
  for (const div of dividends.filter((d) => d.portfolio_id === portfolioId)) {
    cash += n(div.amount) - n(div.tax)
  }
  return cash
}

// ── Trailing-12M dividends ───────────────────────────────────────────────────

function trailingDividends(dividends, assets) {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  const byAsset = new Map()
  let total = 0

  for (const div of dividends) {
    if (new Date(div.date) < cutoff) continue
    const net = n(div.amount) - n(div.tax)
    total += net
    const asset = assets.find((a) => a.id === div.asset_id)
    const name = asset?.name ?? div.asset_id
    const entry = byAsset.get(div.asset_id) ?? { name, ticker: null, net: 0 }
    entry.net += net
    byAsset.set(div.asset_id, entry)
  }

  return { trailing12M: total, byAsset }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const warnings = []
  const now = new Date()

  // Parallel fetches
  const [
    { data: portfolios, error: pErr },
    { data: transactions, error: txErr },
    { data: assets, error: aErr },
    { data: identifiers, error: idErr },
    { data: dividends, error: divErr },
    { data: cashMovements, error: cmErr },
    { data: shareGrants, error: sgErr },
  ] = await Promise.all([
    supabase.from('portfolios').select('*').order('name'),
    supabase.from('transactions').select('*').order('date'),
    supabase.from('assets').select('*'),
    supabase.from('asset_identifiers').select('*'),
    supabase.from('dividends').select('*').order('date'),
    supabase.from('cash_movements').select('*').order('date'),
    supabase.from('share_grants').select('*').order('grant_date'),
  ])

  for (const [label, err] of [
    ['portfolios', pErr],
    ['transactions', txErr],
    ['assets', aErr],
    ['asset_identifiers', idErr],
    ['dividends', divErr],
    ['cash_movements', cmErr],
    ['share_grants', sgErr],
  ]) {
    if (err) {
      console.error(`ERROR fetching ${label}: ${err.message}`)
      process.exit(1)
    }
  }

  // Latest price per asset
  const { data: priceRows, error: prErr } = await supabase
    .from('asset_prices')
    .select('asset_id, price, currency, date')
    .order('date', { ascending: false })

  if (prErr) {
    console.error(`ERROR fetching asset_prices: ${prErr.message}`)
    process.exit(1)
  }

  const latestPrices = new Map()
  for (const row of priceRows ?? []) {
    if (!latestPrices.has(row.asset_id)) {
      latestPrices.set(row.asset_id, row)
    }
  }

  // Helper: get identifier value for an asset
  function getIdentifier(assetId, type) {
    return identifiers.find((i) => i.asset_id === assetId && i.type === type)?.value ?? null
  }

  // Compute positions across all transactions
  const positionMap = computePositions(transactions ?? [])

  // Build portfolio output
  const portfolioOutput = (portfolios ?? []).map((portfolio) => {
    const portfolioPositions = [...positionMap.values()].filter(
      (p) => p.portfolioId === portfolio.id && p.shares > 0.000001
    )

    let totalInvested = 0
    let totalValue = 0

    const positions = portfolioPositions.map((pos) => {
      const asset = (assets ?? []).find((a) => a.id === pos.assetId)
      const ticker =
        getIdentifier(pos.assetId, 'TICKER') ??
        getIdentifier(pos.assetId, 'GOOGLE_SYMBOL') ??
        null
      const isin = getIdentifier(pos.assetId, 'ISIN') ?? null

      const priceRow = latestPrices.get(pos.assetId)
      const currentPrice = priceRow ? n(priceRow.price) : null
      const priceAsOf = priceRow?.date ?? null
      const daysOld = priceAsOf ? daysBetween(priceAsOf, now) : null
      const priceStale = daysOld != null && daysOld > 7

      if (priceStale && ticker) {
        warnings.push(`Price for ${ticker ?? asset?.name ?? pos.assetId} is ${daysOld} days old — may be stale`)
      }

      const currentValue = currentPrice != null ? pos.shares * currentPrice : null
      const invested = pos.shares * pos.pru
      const unrealisedPnL = currentValue != null ? currentValue - invested : null
      const pnlPct =
        invested > 0 && unrealisedPnL != null
          ? (unrealisedPnL / invested) * 100
          : null

      totalInvested += invested
      if (currentValue != null) totalValue += currentValue

      return {
        assetId: pos.assetId,
        name: asset?.name ?? pos.assetId,
        ticker,
        isin,
        sector: asset?.sector ?? null,
        country: asset?.country ?? null,
        assetType: asset?.asset_type ?? null,
        shares: Math.round(pos.shares * 1e6) / 1e6,
        pru: Math.round(pos.pru * 100) / 100,
        currentPrice: currentPrice != null ? Math.round(currentPrice * 100) / 100 : null,
        currentValue: currentValue != null ? Math.round(currentValue * 100) / 100 : null,
        invested: Math.round(invested * 100) / 100,
        unrealisedPnL: unrealisedPnL != null ? Math.round(unrealisedPnL * 100) / 100 : null,
        pnlPct: pnlPct != null ? Math.round(pnlPct * 100) / 100 : null,
        priceAsOf,
        priceStale,
      }
    })

    // Sort by current value descending
    positions.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))

    const cashAvailable = computeCash(
      portfolio.id,
      transactions ?? [],
      cashMovements ?? [],
      dividends ?? []
    )
    const totalPnL = totalValue - totalInvested
    const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

    return {
      id: portfolio.id,
      name: portfolio.name,
      type: portfolio.type,
      accountingMethod: portfolio.accounting_method,
      currency: portfolio.base_currency,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      totalPnL: Math.round(totalPnL * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
      cashAvailable: Math.round(cashAvailable * 100) / 100,
      positionCount: positions.length,
      positions,
    }
  })

  // Share grants
  const grantOutput = (shareGrants ?? [])
    .filter((g) => g.status === 'unvested')
    .map((g) => {
      const asset = (assets ?? []).find((a) => a.id === g.asset_id)
      const ticker = getIdentifier(g.asset_id, 'TICKER') ?? null
      const isin = getIdentifier(g.asset_id, 'ISIN') ?? null
      const daysToVesting = daysBetween(now, new Date(g.vesting_date)) * -1
      const priceRow = latestPrices.get(g.asset_id)
      const currentPrice = priceRow ? n(priceRow.price) : null

      return {
        assetName: asset?.name ?? g.asset_id,
        ticker,
        isin,
        shareType: g.share_type,
        grantDate: g.grant_date,
        vestingDate: g.vesting_date,
        grantedQty: n(g.granted_quantity),
        status: g.status,
        daysToVesting,
        estimatedValue:
          currentPrice != null ? Math.round(n(g.granted_quantity) * currentPrice * 100) / 100 : null,
      }
    })

  // Dividends
  const { trailing12M, byAsset: divByAsset } = trailingDividends(dividends ?? [], assets ?? [])

  // Attach tickers to dividend map
  const divByAssetOutput = [...divByAsset.entries()]
    .map(([assetId, entry]) => ({
      name: entry.name,
      ticker: getIdentifier(assetId, 'TICKER') ?? getIdentifier(assetId, 'GOOGLE_SYMBOL'),
      net: Math.round(entry.net * 100) / 100,
    }))
    .sort((a, b) => b.net - a.net)

  // Grand totals across all portfolios
  const grandTotalInvested = portfolioOutput.reduce((s, p) => s + p.totalInvested, 0)
  const grandTotalValue = portfolioOutput.reduce((s, p) => s + p.totalValue, 0)
  const grandTotalPnL = grandTotalValue - grandTotalInvested
  const grandPnlPct = grandTotalInvested > 0 ? (grandTotalPnL / grandTotalInvested) * 100 : 0

  const output = {
    asOf: now.toISOString(),
    summary: {
      totalInvested: Math.round(grandTotalInvested * 100) / 100,
      totalValue: Math.round(grandTotalValue * 100) / 100,
      totalPnL: Math.round(grandTotalPnL * 100) / 100,
      pnlPct: Math.round(grandPnlPct * 100) / 100,
      portfolioCount: portfolioOutput.length,
    },
    portfolios: portfolioOutput,
    shareGrants: grantOutput,
    dividends: {
      trailing12M: Math.round(trailing12M * 100) / 100,
      byAsset: divByAssetOutput,
    },
    warnings,
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
