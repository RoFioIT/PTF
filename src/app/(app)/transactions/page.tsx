import { createClient } from '@/lib/supabase/server'
import { getPortfolios } from '@/lib/db/portfolios'
import type { TransactionType } from '@/types/database'
import { TransactionsTable } from '@/components/transactions/TransactionsTable'
import type { TxRow } from '@/components/transactions/TransactionsTable'
import { AddTransactionButton } from '@/components/transactions/AddTransactionButton'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const portfolios = await getPortfolios(supabase)

  const allTransactions: TxRow[] = []

  for (const portfolio of portfolios) {
    const { data } = await supabase
      .from('transactions')
      .select('*, asset:assets(name)')
      .eq('portfolio_id', portfolio.id)
      .order('date', { ascending: false })

    if (data) {
      for (const tx of data as Array<Record<string, unknown> & { asset: { name: string } | null }>) {
        allTransactions.push({
          id: tx.id as string,
          portfolio_id: tx.portfolio_id as string,
          asset_id: tx.asset_id as string,
          type: tx.type as TransactionType,
          quantity: tx.quantity as number,
          price: tx.price as number,
          fees: tx.fees as number,
          currency: tx.currency as string,
          date: tx.date as string,
          portfolio_name: portfolio.name,
          portfolio_type: portfolio.type,
          asset_name: tx.asset?.name ?? (tx.asset_id as string),
        })
      }
    }
  }

  allTransactions.sort((a, b) => b.date.localeCompare(a.date))

  const portfolioOptions = portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    base_currency: p.base_currency,
  }))

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Transactions</h1>
          <p className="text-gray-400 text-sm mt-1">{allTransactions.length} total</p>
        </div>
        <AddTransactionButton portfolios={portfolioOptions} />
      </div>

      <TransactionsTable
        transactions={allTransactions}
        portfolios={portfolioOptions}
      />
    </div>
  )
}
