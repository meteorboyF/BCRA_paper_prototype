import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ParticleBackground from '../components/ui/ParticleBackground'

// ParticlesBackground is lazy-loaded — Suspense resolves synchronously in test env
// because vitest's fake module system resolves dynamic imports immediately.

describe('ParticleBackground (ui/)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders without crashing', () => {
    expect(() => render(<ParticleBackground />)).not.toThrow()
  })

  it('root container is position: fixed', () => {
    const { getByTestId } = render(<ParticleBackground />)
    const root = getByTestId('particle-background-root')
    expect(root.style.position).toBe('fixed')
  })

  it('root container has z-index: 0', () => {
    const { getByTestId } = render(<ParticleBackground />)
    const root = getByTestId('particle-background-root')
    expect(root.style.zIndex).toBe('0')
  })

  it('root container has pointer-events: none', () => {
    const { getByTestId } = render(<ParticleBackground />)
    const root = getByTestId('particle-background-root')
    expect(root.style.pointerEvents).toBe('none')
  })

  it('root container covers full viewport (width and height 100%)', () => {
    const { getByTestId } = render(<ParticleBackground />)
    const root = getByTestId('particle-background-root')
    expect(root.style.width).toBe('100%')
    expect(root.style.height).toBe('100%')
  })

  it('returns null when prefers-reduced-motion is "reduce"', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { container } = render(<ParticleBackground />)
    expect(container.firstChild).toBeNull()
  })

  it('has aria-hidden to exclude from accessibility tree', () => {
    const { getByTestId } = render(<ParticleBackground />)
    const root = getByTestId('particle-background-root')
    expect(root.getAttribute('aria-hidden')).toBe('true')
  })
})
