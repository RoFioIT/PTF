import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCashMovementsByPortfolio,
  createCashMovement,
  deleteCashMovement,
} from '@/lib/db/cash_movements'
import type { CashMovementType } from '@/types/database'

const VALID_TYPES: CashMovementType[] = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const portfolioId = request.nextUrl.searchParams.get('portfolio_id')

  if (!portfolioId) {
    return NextResponse.json({ error: 'portfolio_id is required' }, { status: 400 })
  }

  try {
    const movements = await getCashMovementsByPortfolio(supabase, portfolioId)
    return NextResponse.json({ movements })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { portfolio_id, type, amount, currency, date, notes } = body as Record<string, unknown>

  if (!portfolio_id || typeof portfolio_id !== 'string') {
    return NextResponse.json({ error: 'portfolio_id is required' }, { status: 400 })
  }
  if (!type || !VALID_TYPES.includes(type as CashMovementType)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  const numAmount = Number(amount)
  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!date || typeof date !== 'string') {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const movement = await createCashMovement(supabase, {
      portfolio_id,
      type:     type as CashMovementType,
      amount:   numAmount,
      currency: typeof currency === 'string' ? currency : 'EUR',
      date,
      notes:    typeof notes === 'string' ? notes : undefined,
    })
    return NextResponse.json({ movement }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    await deleteCashMovement(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
