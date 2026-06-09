import { lazy, memo, Suspense } from 'react'

// Lazy-loaded so the canvas logic never blocks initial page paint
const ParticlesBackground = lazy(() => import('../ParticlesBackground'))

/**
 * Site-wide particle canvas.
 * - position: fixed — covers the full viewport regardless of scroll or container
 * - z-index: 0 — sits below all page content (content must be relative z-10+)
 * - pointer-events: none — NEVER intercepts clicks or touch events
 * - Returns null when the user has requested reduced motion (a11y)
 * - Memo-wrapped: does NOT re-render on parent re-renders
 */
const ParticleBackground = memo(function ParticleBackground() {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      data-testid="particle-background-root"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Suspense fallback={null}>
        <ParticlesBackground variant="app" />
      </Suspense>
    </div>
  )
})

export default ParticleBackground
