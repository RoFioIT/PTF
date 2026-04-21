import { createClient } from '@/lib/supabase/server'
import { getProperties } from '@/lib/db/properties'
import { getRemainingBalance } from '@/lib/db/mortgages'
import { PropertiesView } from '@/components/properties/PropertiesView'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage() {
  const supabase = await createClient()
  const properties = await getProperties(supabase)
  const today = new Date().toISOString().slice(0, 10)

  const enriched = await Promise.all(
    properties.map(async (p) => {
      const remaining = p.mortgage
        ? (await getRemainingBalance(supabase, p.mortgage.id, today)) ?? p.mortgage.initial_amount
        : 0
      return {
        ...p,
        remainingBalance: remaining,
        netEquity: p.current_value - remaining,
      }
    })
  )

  const totalValue   = enriched.reduce((s, p) => s + p.current_value, 0)
  const totalDebt    = enriched.reduce((s, p) => s + p.remainingBalance, 0)
  const totalEquity  = totalValue - totalDebt

  return (
    <PropertiesView
      properties={enriched}
      summary={{ totalValue, totalDebt, totalEquity }}
    />
  )
}
