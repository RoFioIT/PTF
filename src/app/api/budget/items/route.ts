import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBudgetItem, deleteBudgetItem } from '@/lib/db/budget'

export const dynamic = 'force-dynamic'

// POST /api/budget/items — create a new line item
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category_id, name, sort_order } = await request.json()
  if (!category_id || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const item = await createBudgetItem(supabase, { category_id, name, sort_order })
  return NextResponse.json({ item })
}

// DELETE /api/budget/items?id=
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await deleteBudgetItem(supabase, id)
  return NextResponse.json({ ok: true })
}
