import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, CheckCircle, Ban, Loader2, AlertCircle, Shield } from 'lucide-react'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import toast from 'react-hot-toast'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SecurityAlertsPanel } from '../components/SecurityAlertsPanel'
import { DeletionRequestsAdminPanel } from '../components/DeletionRequestsAdminPanel'
import { ComplianceReportsPanel } from '../components/ComplianceReportsPanel'

interface UserSummary {
  id: string
  email: string
  fullName: string
  role: string
  status: string
  firmName: string | null
  mfaEnabled: boolean
}

interface Page<T> { content: T[]; totalElements: number }

export default function AdminPanel() {
  const queryClient = useQueryClient()

  const { data: page, isLoading: loading, isError } = useQuery({
    queryKey: queryKeys.adminUsers(0),
    queryFn: async () => (await api.get<Page<UserSummary>>('/admin/users')).data,
  })
  const error = isError ? 'Failed to load users' : ''

  const actMutation = useMutation({
    mutationFn: (vars: { id: string; action: 'activate' | 'suspend'; email: string }) =>
      api.post(`/admin/users/${vars.id}/${vars.action}`),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers(0) })
      toast.success(`${vars.email} ${vars.action}d`)
    },
    onError: (_e, vars) => toast.error(`Failed to ${vars.action} user`),
  })
  const acting = actMutation.isPending ? actMutation.variables?.id : null
  const activate = (id: string, email: string) => actMutation.mutate({ id, action: 'activate', email })
  const suspend = (id: string, email: string) => actMutation.mutate({ id, action: 'suspend', email })

  const users = page?.content ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Admin Panel</h1>
          {!loading && <p className="text-text-muted text-sm mt-0.5">{page?.totalElements ?? 0} users</p>}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1d6464]/10 text-[#1d6464] text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" /> Managing Partner / IT Admin only
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityAlertsPanel />
        <DeletionRequestsAdminPanel />
        <ComplianceReportsPanel />
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#1d6464]" /></div>}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-error">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wide hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wide hidden lg:table-cell">Firm</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wide hidden md:table-cell">MFA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-muted transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-text-primary text-sm">{u.fullName}</p>
                    <p className="text-text-muted text-xs">{u.email}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-text-secondary text-xs">{u.role.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-text-secondary text-xs">{u.firmName ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className={`text-xs font-medium ${u.mfaEnabled ? 'text-success' : 'text-text-muted'}`}>
                      {u.mfaEnabled ? '✓ On' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      {u.status !== 'ACTIVE' && (
                        <button
                          onClick={() => activate(u.id, u.email)}
                          disabled={acting === u.id}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-text-muted hover:text-success transition-colors"
                          title="Activate"
                        >
                          {acting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {u.status === 'ACTIVE' && (
                        <button
                          onClick={() => suspend(u.id, u.email)}
                          disabled={acting === u.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-error transition-colors"
                          title="Suspend"
                        >
                          {acting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
