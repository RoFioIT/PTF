import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPropertyById } from '@/lib/db/properties'
import { PropertyFormPage } from '@/components/properties/PropertyFormPage'

export const dynamic = 'force-dynamic'

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const property = await getPropertyById(supabase, id)
  if (!property) notFound()

  return <PropertyFormPage mode="edit" property={property} />
}
