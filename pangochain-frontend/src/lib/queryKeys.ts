/**
 * Centralised React Query key taxonomy. Using one source of truth keeps cache
 * invalidation consistent — a mutation can invalidate `queryKeys.documents(caseId)`
 * and every component reading that key refetches.
 */
export const queryKeys = {
  cases: (params?: unknown) => (params ? (['cases', params] as const) : (['cases'] as const)),
  case: (caseId: string) => ['cases', caseId] as const,
  caseMembers: (caseId: string) => ['cases', caseId, 'members'] as const,
  documents: (caseId: string, category?: string) =>
    category ? (['documents', caseId, category] as const) : (['documents', caseId] as const),
  myDocuments: () => ['documents', 'mine'] as const,
  hearings: (caseId: string) => ['hearings', caseId] as const,
  hearingsUpcoming: () => ['hearings', 'upcoming'] as const,
  audit: (filters?: unknown) => (filters ? (['audit', filters] as const) : (['audit'] as const)),
  dashboardStats: () => ['dashboard', 'stats'] as const,
  dashboardLawyer: () => ['dashboard', 'lawyer'] as const,
  dashboardClient: () => ['dashboard', 'client'] as const,
  adminUsers: (page: number) => ['admin', 'users', page] as const,
  ledger: () => ['ledger'] as const,
  reminders: () => ['reminders'] as const,
  templates: () => ['templates'] as const,
} as const
