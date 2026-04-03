import { createClient } from '@/lib/supabase/server'
import { getBudgetCategories, getBudgetItems, getBudgetEntries, getAvailableYears } from '@/lib/db/budget'
import { BudgetView } from '@/components/budget/BudgetView'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [categories, items, entries, years] = await Promise.all([
    getBudgetCategories(supabase),
    getBudgetItems(supabase),
    getBudgetEntries(supabase, currentYear),
    getAvailableYears(supabase),
  ])

  const availableYears = years.includes(currentYear) ? years : [currentYear, ...years]

  return (
    <BudgetView
      initialCategories={categories}
      initialItems={items}
      initialEntries={entries}
      availableYears={availableYears}
      defaultYear={currentYear}
    />
  )
}
