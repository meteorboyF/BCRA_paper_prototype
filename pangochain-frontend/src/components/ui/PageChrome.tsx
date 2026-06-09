import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { Tooltip } from './Tooltip'

interface PageHeroProps {
  eyebrow?: string
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  children?: ReactNode
}

export function PageHero({ eyebrow, title, description, icon: Icon, actions, children }: PageHeroProps) {
  return (
    <section className="relative isolate rounded-2xl border border-gold-500/10 bg-navy-900/50 p-5 shadow-card backdrop-blur-md sm:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-gold-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-16 h-28 w-28 rounded-full bg-gold-500/3 blur-3xl opacity-10" />
      </div>
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          {Icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-950 border border-gold-500/20 text-gold-400 shadow-gold-sm">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-500">{eyebrow}</p>}
            <h1 className="font-serif text-2xl font-bold tracking-tight text-gold-300 sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </section>
  )
}

interface QuickAction {
  label: string
  description: string
  to?: string
  onClick?: () => void
  icon: LucideIcon
  tone?: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'
}

const toneClasses = {
  cyan: 'from-gold-500 to-gold-600 text-navy-950 border border-gold-300/30',
  emerald: 'from-emerald-950/40 to-teal-900/40 border border-success/30 text-emerald-400',
  amber: 'from-gold-500/10 to-gold-600/10 border border-gold-500/25 text-gold-300',
  violet: 'from-indigo-950/40 to-indigo-900/40 border border-indigo-500/20 text-indigo-400',
  rose: 'from-rose-950/40 to-red-950/40 border border-error/30 text-rose-400',
}

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        const content = (
          <>
            <div className={clsx('mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-gold-sm', toneClasses[action.tone ?? 'cyan'])}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-sm font-bold text-text-primary group-hover:text-gold-300 transition-colors duration-200">{action.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{action.description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-muted transition-all duration-300 group-hover:translate-x-1 group-hover:text-gold-400" />
            </div>
          </>
        )

        if (action.to) {
          return (
            <Tooltip key={action.label} content={action.description} side="top" className="w-full">
              <Link to={action.to} className="feature-tile group block h-full w-full">
                {content}
              </Link>
            </Tooltip>
          )
        }

        return (
          <Tooltip key={action.label} content={action.description} side="top" className="w-full">
            <button type="button" onClick={action.onClick} className="feature-tile group h-full w-full text-left">
              {content}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gold-500/20 bg-navy-900/40 px-6 py-12 text-center shadow-gold-sm backdrop-blur-md">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 border border-gold-500/20 text-gold-400">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-serif text-lg font-bold text-gold-300">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-secondary">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
