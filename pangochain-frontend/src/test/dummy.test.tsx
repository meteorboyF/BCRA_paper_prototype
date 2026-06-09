import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '../pages/Dashboard'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'

const MOCK_USER: AuthUser = {
  id: 'u1',
  email: 'partner@firm.com',
  fullName: 'Sarah Partner',
  role: 'PARTNER_SENIOR',
  firmId: 'firm-1',
  mfaEnabled: true,
}

const MOCK_STATS = { activeCases: 5, totalDocuments: 42, unreadMessages: 3, auditEvents: 128 }
const MOCK_CASES = {
  content: [
    { id: 'c1', title: 'Smith v. Jones', caseType: 'CIVIL', status: 'ACTIVE', documentCount: 7, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'c2', title: 'Corp Merger Deal', caseType: 'CONTRACT', status: 'ACTIVE', documentCount: 3, createdAt: '2026-02-01T10:00:00Z' },
  ],
}
const MOCK_AUDIT = {
  content: [
    { id: 1, eventType: 'DOC_REGISTERED', resourceType: 'DOCUMENT', resourceId: 'doc-abc-123', fabricTxId: 'fab1234567890abcdef', timestamp: '2026-05-29T12:00:00Z' },
  ],
}
const MOCK_NEXT_HEARING = {
  nextHearing: {
    id: 'h1',
    title: 'Motion to Dismiss',
    hearingDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Room 302',
    courtName: 'Superior Court of California',
    hearingType: 'MOTION_HEARING',
    caseTitle: 'Acme Corp v. State',
  },
}

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/dashboard/stats') return Promise.resolve({ data: MOCK_STATS })
      if (url === '/cases') return Promise.resolve({ data: MOCK_CASES })
      if (url === '/audit') return Promise.resolve({ data: MOCK_AUDIT })
      if (url === '/dashboard/lawyer') return Promise.resolve({ data: MOCK_NEXT_HEARING })
      return Promise.resolve({ data: {} })
    }),
  },
}))

function renderDashboard() {
  useAuthStore.setState({ user: MOCK_USER, isAuthenticated: true, accessToken: 'tok', refreshToken: 'ref' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><Dashboard /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Dummy Dashboard Tests', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    renderDashboard()
    const pulseEls = document.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })
})
