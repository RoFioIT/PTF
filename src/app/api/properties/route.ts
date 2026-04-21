import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProperty, updateProperty, deleteProperty } from '@/lib/db/properties'
import { createMortgage } from '@/lib/db/mortgages'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    name, type, country, address, current_value,
    purchase_price, purchase_date, notes,
    // optional mortgage fields
    bank_name, start_date, initial_amount, mortgage_notes,
  } = body

  if (!name || !type || !country || current_value == null) {
    return NextResponse.json({ error: 'Missing required fields: name, type, country, current_value' }, { status: 400 })
  }

  const property = await createProperty(supabase, {
    user_id: user.id,
    name,
    type,
    country,
    address: address ?? null,
    current_value: Number(current_value),
    purchase_price: purchase_price != null ? Number(purchase_price) : null,
    purchase_date: purchase_date || null,
    notes: notes ?? null,
  })

  let mortgage = null
  if (bank_name && start_date && initial_amount) {
    mortgage = await createMortgage(supabase, {
      property_id: property.id,
      bank_name,
      start_date,
      initial_amount: Number(initial_amount),
      notes: mortgage_notes ?? null,
    })
  }

  return NextResponse.json({ property, mortgage })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (updates.current_value != null) updates.current_value = Number(updates.current_value)
  if (updates.purchase_price != null) updates.purchase_price = Number(updates.purchase_price)

  const property = await updateProperty(supabase, id, updates)
  return NextResponse.json({ property })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await deleteProperty(supabase, id)
  return NextResponse.json({ ok: true })
}
