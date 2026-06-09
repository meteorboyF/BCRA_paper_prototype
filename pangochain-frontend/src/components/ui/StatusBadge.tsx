import type { ReactNode } from 'react'

/**
 * Canonical status badge for the whole app. Replaces the per-page inline badge
 * implementations so ACTIVE / CONFIDENTIAL / VERIFIED etc. look identical
 * everywhere. Pass a known `status` (case-insensitive) or override the visible
 * text with `children`.
 */

type Variant = {
  classes: string
  label: string
}

const VARIANTS: Record<string, Variant> = {
  ACTIVE:       { classes: 'bg-green-100 text-green-800 border-green-200', label: 'Active' },
  OPEN:         { classes: 'bg-green-100 text-green-800 border-green-200', label: 'Open' },
  SUSPENDED:    { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Suspended' },
  CLOSED:       { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Closed' },
  ARCHIVED:     { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Archived' },
  CONFIDENTIAL: { classes: 'bg-red-100 text-red-700 border-red-200', label: 'Confidential' },
  HIGH:         { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'High Priority' },
  ACL_FALLBACK: { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'ACL Fallback' },
  PENDING:      { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Pending' },
  PENDING_APPROVAL: { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Pending Approval' },
  DEACTIVATED:  { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Deactivated' },
  VERIFIED:     { classes: 'bg-teal-100 text-teal-700 border-teal-200', label: 'Verified' },
}

const NEUTRAL: Variant = { classes: 'bg-slate-100 text-slate-600 border-slate-200', label: '' }

interface Props {
  status: string
  children?: ReactNode
  className?: string
}

export function StatusBadge({ status, children, className = '' }: Props) {
  const key = status.toUpperCase().replace(/[\s-]+/g, '_')
  const variant = VARIANTS[key] ?? { ...NEUTRAL, label: status }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${variant.classes} ${className}`}
    >
      {children ?? variant.label}
    </span>
  )
}
