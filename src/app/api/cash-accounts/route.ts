import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCashAccount, updateCashAccount, deleteCashAccount } from '@/lib/db/cash_accounts'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { owner, category, name, currency = 'EUR', notes } = body
  if (!owner || !category || !name) {
    return NextResponse.json({ error: 'Missing required fields: owner, category, name' }, { status: 400 })
  }

  const account = await createCashAccount(supabase, {
    user_id: user.id,
    owner,
    category,
    name,
    currency,
    notes,
  })
  return NextResponse.json({ account })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const account = await updateCashAccount(supabase, id, updates)
  return NextResponse.json({ account })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await deleteCashAccount(supabase, id)
  return NextResponse.json({ ok: true })
}
