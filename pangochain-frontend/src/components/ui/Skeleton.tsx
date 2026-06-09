/**
 * Skeleton loaders. Prefer these over spinners on data-dense pages — they
 * communicate the shape of the content that is about to arrive, which reads as
 * faster and less "broken" than a spinning circle.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />
}

/** Matches the dashboard StatCard footprint. */
export function StatCardSkeleton() {
  return <Skeleton className="h-24 w-full rounded-xl" />
}

/** A single table row placeholder. */
export function TableRowSkeleton() {
  return <Skeleton className="h-10 w-full" />
}

/** Matches a case/list card footprint. */
export function CaseCardSkeleton() {
  return <Skeleton className="h-20 w-full rounded-lg" />
}

/** A responsive grid of card skeletons — matches the Cases page card grid. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  )
}

/** A stack of list-row skeletons — matches document/list pages. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * Generic page skeleton: a header line plus a grid of card placeholders.
 * Drop into `if (isLoading) return <PageSkeleton />` on list pages.
 */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: cards }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
