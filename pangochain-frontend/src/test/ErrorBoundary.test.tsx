import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error')
  return <div data-testid="ok">All good</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Silence the expected React error boundary console.error calls
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('ok')).toBeTruthy()
  })

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('fallback shows "Go to Dashboard" link', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    const link = screen.getByText('Go to Dashboard')
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('does not show error page when no error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  it('catches multiple different errors', () => {
    function AnotherBoom(): never { throw new Error('Another error') }
    render(
      <ErrorBoundary>
        <AnotherBoom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })
})
