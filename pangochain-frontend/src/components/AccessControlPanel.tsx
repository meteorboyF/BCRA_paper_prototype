import { useState } from 'react'
import { Shield, UserPlus, Trash2, Clock, Crown, Eye, Edit, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

interface AccessEntry {
  id: string
  userEmail: string
  capability: 'owner' | 'write' | 'read'
  grantedByEmail?: string
  grantedAt?: string
  expiresAt?: string
}

interface Props {
  docId: string
  fileName: string
  onClose: () => void
}

const CAP_ICON: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-gold-500" />,
  write: <Edit className="w-3.5 h-3.5 text-gold-400" />,
  read:  <Eye className="w-3.5 h-3.5 text-emerald-400" />,
}

const CAP_LABEL: Record<string, string> = {
  owner: 'Owner', write: 'Write', read: 'Read',
}

const MOCK_ACL: AccessEntry[] = [
  { id: 'a1', userEmail: 'sarah.chen@firma.com',   capability: 'owner', grantedByEmail: 'system',             grantedAt: '2026-04-20T10:02:11Z' },
  { id: 'a2', userEmail: 'michael.torres@firma.com', capability: 'read', grantedByEmail: 'sarah.chen@firma.com', grantedAt: '2026-04-21T09:00:00Z' },
]

export function AccessControlPanel({ docId, fileName, onClose }: Props) {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<AccessEntry[]>(MOCK_ACL)
  const [grantEmail, setGrantEmail] = useState('')
  const [capability, setCapability] = useState<'read' | 'write'>('read')
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const handleGrant = async () => {
    if (!grantEmail.trim()) return
    setGranting(true)
    try {
      await new Promise((r) => setTimeout(r, 800)) // demo delay
      const newEntry: AccessEntry = {
        id: `a-${Date.now()}`,
        userEmail: grantEmail,
        capability,
        grantedByEmail: user?.email ?? 'you',
        grantedAt: new Date().toISOString(),
      }
      setEntries((prev) => [...prev, newEntry])
      setGrantEmail('')
      toast.success(`Access granted to ${grantEmail}`)
    } catch {
      toast.error('Failed to grant access')
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async (entryId: string, email: string) => {
    setRevoking(entryId)
    try {
      await new Promise((r) => setTimeout(r, 600))
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      toast.success(`Access revoked for ${email}`)
    } catch {
      toast.error('Failed to revoke access')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-0 border border-gold-500/20 shadow-gold-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="w-4 h-4 text-gold-500" />
              <h2 className="font-serif font-semibold text-lg text-gold-300">Access Control</h2>
            </div>
            <p className="text-text-secondary text-xs truncate max-w-[300px]">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Current ACL */}
          <div>
            <p className="text-xs font-bold text-gold-500/60 uppercase tracking-widest mb-3">Who has access</p>
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between bg-navy-950/60 border border-gold-500/10 rounded-xl px-3.5 py-2.5 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-300 text-xs font-bold shrink-0">
                      {entry.userEmail[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{entry.userEmail}</p>
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        {CAP_ICON[entry.capability]}
                        <span>{CAP_LABEL[entry.capability]}</span>
                        {entry.expiresAt && (
                          <span className="flex items-center gap-0.5 text-gold-400">
                            <Clock className="w-3.5 h-3.5" />
                            Expires {new Date(entry.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {entry.capability !== 'owner' && (
                    <button
                      onClick={() => handleRevoke(entry.id, entry.userEmail)}
                      disabled={revoking === entry.id}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Revoke access"
                    >
                      {revoking === entry.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grant new access */}
          <div className="border-t border-gold-500/10 pt-4">
            <p className="text-xs font-bold text-gold-500/60 uppercase tracking-widest mb-3">Grant access</p>
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              The document key is re-encrypted with the recipient's public key (ECIES P-256) — they can decrypt without your password.
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="colleague@firm.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGrant()}
              />
              <select
                className="input w-28 text-sm py-2 bg-navy-950 text-text-primary"
                value={capability}
                onChange={(e) => setCapability(e.target.value as 'read' | 'write')}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
            </div>
            <button
              onClick={handleGrant}
              disabled={!grantEmail.trim() || granting}
              className="btn-primary w-full justify-center mt-3 py-2.5 disabled:opacity-50"
            >
              {granting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Wrapping key…</>
                : <><UserPlus className="w-4 h-4" /> Grant Access</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
