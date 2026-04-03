import { createClient } from '@/lib/supabase/server'
import { getCashAccounts, getCashAccountSnapshots } from '@/lib/db/cash_accounts'
import { CashAccountsView } from '@/components/cash-accounts/CashAccountsView'

export const dynamic = 'force-dynamic'

export default async function CashAccountsPage() {
  const supabase = await createClient()
  const [accounts, snapshots] = await Promise.all([
    getCashAccounts(supabase),
    getCashAccountSnapshots(supabase),
  ])

  return <CashAccountsView initialAccounts={accounts} initialSnapshots={snapshots} />
}
