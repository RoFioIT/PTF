import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''

  const { data, error } = await supabase
    .from('assets')
    .select('id, name, currency, asset_type')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(15)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: data ?? [] })
}
