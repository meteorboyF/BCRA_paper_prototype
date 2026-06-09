import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../layout/Sidebar'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'

vi.mock('../lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { unreadMessages: 0 } }) },
}))

const LEGAL_USER: AuthUser = {
  id: 'u1',
  email: 'partner@firm.com',
  fullName: 'Sarah Partner',
  role: 'PARTNER_SENIOR',
  firmId: 'firm-1',
  mfaEnabled: true,
}

const CLIENT_USER: AuthUser = {
  id: 'u2',
  email: 'client@corp.com',
  fullName: 'Bob Client',
  role: 'CLIENT_PRIMARY',
  firmId: null,
  mfaEnabled: false,
}

function renderSidebar(user: AuthUser, props = {}) {
  useAuthStore.setState({ user, isAuthenticated: true, accessToken: 'tok', refreshToken: 'ref' })
  return render(
    <MemoryRouter>
      <Sidebar {...props} />
    </MemoryRouter>
  )
}

describe('Sidebar navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
  })

  it('renders nothing when no user', () => {
    const { container } = render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('shows legal nav items for legal professional', () => {
    renderSidebar(LEGAL_USER)
    expect(screen.getByText('Cases')).toBeTruthy()
    expect(screen.getByText('Documents')).toBeTruthy()
    expect(screen.getByText('Hearings')).toBeTruthy()
  })

  it('shows client nav items for client role', () => {
    renderSidebar(CLIENT_USER)
    expect(screen.getByText('My Portal')).toBeTruthy()
    expect(screen.getByText('Document Vault')).toBeTruthy()
    expect(screen.getByText('My Case')).toBeTruthy()
  })

  it('does not show admin panel link for non-admin legal user', () => {
    renderSidebar(LEGAL_USER)
    expect(screen.queryByText('Admin Panel')).toBeNull()
  })

  it('shows admin section for managing partner', () => {
    renderSidebar({ ...LEGAL_USER, role: 'MANAGING_PARTNER' })
    expect(screen.getByText('Admin Panel')).toBeTruthy()
    expect(screen.getByText('Audit Trail')).toBeTruthy()
  })

  it('displays user full name in sidebar', () => {
    renderSidebar(LEGAL_USER)
    expect(screen.getByText('Sarah Partner')).toBeTruthy()
  })

  it('calls onClose when a nav link is clicked (mobile)', async () => {
    const onClose = vi.fn()
    renderSidebar(LEGAL_USER, { mobileOpen: true, onClose })
    // Sidebar renders twice (desktop hidden + mobile overlay) — click the first visible one
    await userEvent.click(screen.getAllByText('Cases')[0])
    expect(onClose).toHaveBeenCalled()
  })
})
