import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPropertyById } from '@/lib/db/properties'
import { getPaymentsByMortgage, getRemainingBalance } from '@/lib/db/mortgages'
import { PropertyDetailView } from '@/components/properties/PropertyDetailView'

export const dynamic = 'force-dynamic'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const property = await getPropertyById(supabase, id)
  if (!property) notFound()

  const today = new Date().toISOString().slice(0, 10)

  const payments = property.mortgage
    ? await getPaymentsByMortgage(supabase, property.mortgage.id)
    : []

  const remainingBalance = property.mortgage
    ? (await getRemainingBalance(supabase, property.mortgage.id, today)) ?? property.mortgage.initial_amount
    : 0

  const netEquity = property.current_value - remainingBalance

  return (
    <PropertyDetailView
      property={property}
      payments={payments}
      remainingBalance={remainingBalance}
      netEquity={netEquity}
      today={today}
    />
  )
}
