import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type UserRole =
  | 'MANAGING_PARTNER' | 'PARTNER_SENIOR' | 'PARTNER_JUNIOR'
  | 'ASSOCIATE_SENIOR' | 'ASSOCIATE_JUNIOR' | 'SECRETARY'
  | 'IT_ADMIN' | 'PARALEGAL' | 'REGULATOR'
  | 'CLIENT_PRIMARY' | 'CLIENT_SECONDARY' | 'CLIENT_CORP_ADMIN'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  firmId: string | null
  mfaEnabled: boolean
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  /** True once persisted state has been read back from storage. The router must
   *  not redirect to /login until this flips, or every reload flashes the login page. */
  hasHydrated: boolean
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void
  clearAuth: () => void
  updateUser: (updates: Partial<AuthUser>) => void
  setHasHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isAuthenticated: true }),

      clearAuth: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'pangochain-auth',
      // sessionStorage, not localStorage: JWTs should not survive a browser restart.
      // (PBKDF2-wrapped private keys remain in localStorage by design — they are
      //  encrypted at rest and must persist across sessions.)
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

// Role helper utilities
export const LEGAL_ROLES: UserRole[] = [
  'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR',
  'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR', 'SECRETARY', 'IT_ADMIN', 'PARALEGAL', 'REGULATOR',
]

export const CLIENT_ROLES: UserRole[] = [
  'CLIENT_PRIMARY', 'CLIENT_SECONDARY', 'CLIENT_CORP_ADMIN',
]

export const PARTNER_ROLES: UserRole[] = [
  'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR',
]

export function isLegalProfessional(role: UserRole) {
  return LEGAL_ROLES.includes(role)
}

export function isClient(role: UserRole) {
  return CLIENT_ROLES.includes(role)
}

export function isPartnerOrAbove(role: UserRole) {
  return PARTNER_ROLES.includes(role)
}

export function canViewGlobalAudit(role: UserRole) {
  return role === 'MANAGING_PARTNER' || role === 'IT_ADMIN' || role === 'REGULATOR'
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    MANAGING_PARTNER: 'Managing Partner',
    PARTNER_SENIOR: 'Senior Partner',
    PARTNER_JUNIOR: 'Junior Partner',
    ASSOCIATE_SENIOR: 'Senior Associate',
    ASSOCIATE_JUNIOR: 'Junior Associate',
    SECRETARY: 'Secretary',
    IT_ADMIN: 'IT Specialist',
    PARALEGAL: 'Paralegal',
    REGULATOR: 'Regulator',
    CLIENT_PRIMARY: 'Primary Client',
    CLIENT_SECONDARY: 'Secondary Client',
    CLIENT_CORP_ADMIN: 'Corporate Client Admin',
  }
  return labels[role] ?? role
}
