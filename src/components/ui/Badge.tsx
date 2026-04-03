import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-800 text-gray-300',
  success: 'bg-emerald-400/10 text-emerald-400',
  danger: 'bg-red-400/10 text-red-400',
  warning: 'bg-amber-400/10 text-amber-400',
  info: 'bg-blue-400/10 text-blue-400',
  purple: 'bg-indigo-400/10 text-indigo-400',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
