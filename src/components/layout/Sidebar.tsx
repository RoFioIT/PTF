'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
  MoreHorizontal,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

const primaryNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolios', label: 'Portfolios', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

const secondaryNavItems = [
  { href: '/dividends', label: 'Dividends', icon: DollarSign },
  { href: '/cash-accounts', label: 'Cash Accounts', icon: Landmark },
  { href: '/budget', label: 'Budget', icon: PiggyBank },
]

const allNavItems = [...primaryNavItems, ...secondaryNavItems]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col h-screen bg-[#0d0d14] border-r border-[#1e1e2e]">
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
          {allNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
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

      {/* ── Mobile Top Bar ───────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-[#0d0d14]/95 backdrop-blur border-b border-[#1e1e2e] flex items-center px-4 gap-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">PTF</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Portfolio Tracker</p>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d14]/95 backdrop-blur border-t border-[#1e1e2e] safe-area-inset-bottom">
        <div className="flex items-stretch">
          {primaryNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  active ? 'text-indigo-400' : 'text-gray-500 active:text-gray-300'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
              secondaryNavItems.some((item) => isActive(item.href))
                ? 'text-indigo-400'
                : 'text-gray-500 active:text-gray-300'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" Drawer ─────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-[#0d0d14] border-t border-[#1e1e2e] rounded-t-2xl pb-8 pt-3 px-4">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#2e2e3e] rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-semibold text-white">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              {secondaryNavItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all',
                      active
                        ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                        : 'text-gray-300 hover:bg-white/5 active:bg-white/10'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                )
              })}

              <div className="border-t border-[#1e1e2e] mt-2 pt-2">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3.5 w-full rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
