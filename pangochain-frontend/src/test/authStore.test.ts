import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, type AuthUser } from '../store/authStore'

const testUser: AuthUser = {
  id: 'user-123',
  email: 'mp@firm.com',
  fullName: 'Managing Partner',
  role: 'MANAGING_PARTNER',
  firmId: 'firm-abc',
  mfaEnabled: true,
}

describe('authStore', () => {
  beforeEach(() => {
    // Reset to clean state before each test
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    })
  })

  it('initial state is unauthenticated', () => {
    const { isAuthenticated, accessToken, user } = useAuthStore.getState()
    expect(isAuthenticated).toBe(false)
    expect(accessToken).toBeNull()
    expect(user).toBeNull()
  })

  it('setAuth stores token and user, sets isAuthenticated true', () => {
    useAuthStore.getState().setAuth('access-token-xyz', 'refresh-token-xyz', testUser)

    const { accessToken, refreshToken, user, isAuthenticated } = useAuthStore.getState()
    expect(accessToken).toBe('access-token-xyz')
    expect(refreshToken).toBe('refresh-token-xyz')
    expect(user).toEqual(testUser)
    expect(isAuthenticated).toBe(true)
  })

  it('clearAuth resets all state', () => {
    useAuthStore.getState().setAuth('access', 'refresh', testUser)
    useAuthStore.getState().clearAuth()

    const { accessToken, refreshToken, user, isAuthenticated } = useAuthStore.getState()
    expect(accessToken).toBeNull()
    expect(refreshToken).toBeNull()
    expect(user).toBeNull()
    expect(isAuthenticated).toBe(false)
  })

  it('isAuthenticated reflects accessToken presence', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    useAuthStore.getState().setAuth('tok', 'ref', testUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('user.role is correctly typed as UserRole', () => {
    useAuthStore.getState().setAuth('tok', 'ref', testUser)
    const { user } = useAuthStore.getState()
    // Type guard — ensure the value is one of the valid UserRole strings
    const validRoles = [
      'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR',
      'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR', 'SECRETARY',
      'IT_ADMIN', 'PARALEGAL', 'REGULATOR',
      'CLIENT_PRIMARY', 'CLIENT_SECONDARY', 'CLIENT_CORP_ADMIN',
    ]
    expect(validRoles).toContain(user?.role)
    expect(user?.role).toBe('MANAGING_PARTNER')
  })

  it('updateUser merges partial updates', () => {
    useAuthStore.getState().setAuth('tok', 'ref', testUser)
    useAuthStore.getState().updateUser({ mfaEnabled: false })

    const { user } = useAuthStore.getState()
    expect(user?.mfaEnabled).toBe(false)
    expect(user?.email).toBe('mp@firm.com') // unchanged
  })
})
