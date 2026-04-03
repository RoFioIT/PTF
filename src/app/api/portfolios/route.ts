import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type, base_currency, accounting_method } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      user_id: user.id,
      name,
      type,
      base_currency: base_currency ?? 'EUR',
      accounting_method: accounting_method ?? 'PRU',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ portfolio: data })
}
