'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  TrendingUp,
  BarChart3,
  DollarSign,
  Landmark,
  PiggyBank,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolios', label: 'Portfolios', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/dividends', label: 'Dividends', icon: DollarSign },
  { href: '/cash-accounts', label: 'Cash Accounts', icon: Landmark },
  { href: '/budget', label: 'Budget', icon: PiggyBank },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-screen bg-[#0d0d14] border-r border-[#1e1e2e]">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">PTF</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Portfolio Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-[#1e1e2e]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
