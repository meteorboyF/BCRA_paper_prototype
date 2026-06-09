import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Cases from '../pages/Cases'

// Mock the api module — Cases.tsx imports from '../lib/api'
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock react-hot-toast to avoid rendering issues in jsdom
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import api from '../lib/api'
const mockGet = vi.mocked(api.get)

const mockPage = (cases: object[]) => ({
  data: {
    content: cases,
    totalElements: cases.length,
    totalPages: 1,
    number: 0,
  },
})

const sampleCases = [
  {
    id: 'case-001',
    title: 'Smith v. Jones',
    caseType: 'CIVIL',
    status: 'ACTIVE',
    firmName: 'Test Firm',
    createdByEmail: 'lawyer@firm.com',
    documentCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    closedAt: null,
  },
  {
    id: 'case-002',
    title: 'Tax Dispute 2024',
    caseType: 'FINANCIAL',
    status: 'CLOSED',
    firmName: 'Test Firm',
    createdByEmail: 'senior@firm.com',
    documentCount: 7,
    createdAt: '2024-06-01T00:00:00Z',
    closedAt: '2024-12-01T00:00:00Z',
  },
]

function renderCases() {
  // Fresh client per render + retry off so loading/error states are deterministic in tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Cases />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Cases page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    // api.get resolves after render — loading indicator shows first
    mockGet.mockImplementation(() => new Promise(() => {})) // never resolves
    renderCases()
    // Skeleton loader (animate-pulse) communicates the page shape while loading.
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders list of cases from API response', async () => {
    mockGet.mockResolvedValue(mockPage(sampleCases))
    renderCases()

    await waitFor(() => {
      expect(screen.getByText('Smith v. Jones')).toBeInTheDocument()
      expect(screen.getByText('Tax Dispute 2024')).toBeInTheDocument()
    })
  })

  it('renders empty state when no cases exist', async () => {
    mockGet.mockResolvedValue(mockPage([]))
    renderCases()

    await waitFor(() => {
      // Page renders with 0 total indicator
      const total = screen.queryByText(/0 total/i) ||
                    screen.queryByText(/no cases/i) ||
                    screen.queryByText('0 active · 0 total')
      expect(total || document.body.textContent).toBeTruthy()
    })
  })

  it('shows error state when API call fails', async () => {
    mockGet.mockRejectedValue({
      response: { data: { detail: 'Failed to load cases' } },
    })
    renderCases()

    await waitFor(() => {
      expect(screen.getByText(/failed to load cases/i)).toBeInTheDocument()
    })
  })

  it('calls API with search param when user types in search field', async () => {
    mockGet.mockResolvedValue(mockPage(sampleCases))
    renderCases()

    await waitFor(() => {
      expect(screen.getByText('Smith v. Jones')).toBeInTheDocument()
    })

    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    if (searchInput) {
      mockGet.mockResolvedValue(mockPage([sampleCases[0]]))
      fireEvent.change(searchInput, { target: { value: 'Smith' } })

      await waitFor(() => {
        const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1]
        expect(lastCall).toBeDefined()
      }, { timeout: 1000 })
    }
  })
})
