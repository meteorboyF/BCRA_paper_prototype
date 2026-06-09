import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import ParticlesBackground from '../components/ParticlesBackground'

describe('ParticlesBackground', () => {
  beforeEach(() => {
    // Default: no reduced motion
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
    expect(() => render(<ParticlesBackground />)).not.toThrow()
  })

  it('renders a canvas element', () => {
    const { container } = render(<ParticlesBackground />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('canvas has pointer-events: none style', () => {
    const { container } = render(<ParticlesBackground />)
    const canvas = container.querySelector('canvas')
    // pointer-events-none is applied via Tailwind class
    expect(canvas?.className).toContain('pointer-events-none')
  })

  it('canvas has position: absolute or is fixed via parent', () => {
    const { container } = render(<ParticlesBackground />)
    const canvas = container.querySelector('canvas')
    // The component uses className="absolute inset-0 ..."
    expect(canvas?.className).toContain('absolute')
  })

  it('does NOT render canvas when prefers-reduced-motion is "reduce"', () => {
    // Override matchMedia to report reduced motion
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

    const { container } = render(<ParticlesBackground />)
    // Component returns null when reduced motion is enabled
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeNull()
  })
})
