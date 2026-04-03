import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/transactions — create a new transaction
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { portfolio_id, asset_id, type, quantity, price, fees, currency, date, notes } = body

  if (!portfolio_id || !asset_id || !type || !quantity || !price || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      portfolio_id,
      asset_id,
      type,
      quantity: Number(quantity),
      price: Number(price),
      fees: Number(fees ?? 0),
      currency: currency ?? 'EUR',
      date,
      notes: notes || null,
    })
    .select('*, asset:assets(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}

// PUT /api/transactions — update a transaction
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, portfolio_id, type, quantity, price, fees, date, notes } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: existing, error: fetchErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (portfolio_id !== undefined) updates.portfolio_id = portfolio_id
  if (type !== undefined) updates.type = type
  if (quantity !== undefined) updates.quantity = Number(quantity)
  if (price !== undefined) updates.price = Number(price)
  if (fees !== undefined) updates.fees = Number(fees)
  if (date !== undefined) updates.date = date
  if (notes !== undefined) updates.notes = notes || null

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select('*, asset:assets(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}

// DELETE /api/transactions?id=<uuid>
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
