import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMortgage, updateMortgage, deleteMortgage, getMortgageByProperty } from '@/lib/db/mortgages'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params
  const body = await request.json()
  const { bank_name, start_date, initial_amount, notes } = body

  if (!bank_name || !start_date || initial_amount == null) {
    return NextResponse.json({ error: 'Missing required fields: bank_name, start_date, initial_amount' }, { status: 400 })
  }

  const mortgage = await createMortgage(supabase, {
    property_id: propertyId,
    bank_name,
    start_date,
    initial_amount: Number(initial_amount),
    notes: notes ?? null,
  })

  return NextResponse.json({ mortgage })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // validate route param exists
  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing mortgage id' }, { status: 400 })

  if (updates.initial_amount != null) updates.initial_amount = Number(updates.initial_amount)

  const mortgage = await updateMortgage(supabase, id, updates)
  return NextResponse.json({ mortgage })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params
  const mortgage = await getMortgageByProperty(supabase, propertyId)
  if (!mortgage) return NextResponse.json({ error: 'No mortgage found' }, { status: 404 })

  await deleteMortgage(supabase, mortgage.id)
  return NextResponse.json({ ok: true })
}
