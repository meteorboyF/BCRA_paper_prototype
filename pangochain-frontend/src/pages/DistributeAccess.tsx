import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Share2, FileText, Loader2, Key, ShieldCheck, AlertCircle, CheckCircle, ArrowLeft, Lock,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import {
  loadWrappedPrivateKey, unwrapPrivateKey, eciesUnwrapKey, eciesWrapKey, bytesToBase64,
} from '../lib/crypto'
import toast from 'react-hot-toast'

interface Member {
  userId: string
  fullName: string
  email: string
  role: string
  roleInCase: string
  hasPublicKey: boolean
}
interface Doc { id: string; fileName: string; ipfsCid?: string; category?: string; confidential?: boolean }
interface BatchItemResult { docId: string; granteeId: string; ok: boolean; error: string | null }

const cellKey = (docId: string, memberId: string) => `${docId}|${memberId}`
const isDemoDoc = (doc?: Doc) => !!doc?.ipfsCid?.startsWith('QmDemo')

async function demoDocumentKeyB64(docId: string) {
  const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pangochain-demo-doc-key:${docId}`))
  return bytesToBase64(new Uint8Array(hash))
}

export default function DistributeAccess() {
  const { id: caseId } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)

  const [members, setMembers] = useState<Member[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [capability, setCapability] = useState<'read' | 'write'>('read')
  const [expiryDays, setExpiryDays] = useState<string>('')

  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [results, setResults] = useState<BatchItemResult[] | null>(null)

  useEffect(() => {
    if (!caseId) return
    Promise.all([
      api.get<Member[]>(`/cases/${caseId}/members`),
      api.get<Doc[]>(`/documents/by-case/${caseId}`),
    ])
      .then(([m, d]) => { setMembers(m.data); setDocs(d.data) })
      .catch((e) => setError(e.response?.data?.detail ?? 'Failed to load case data'))
      .finally(() => setLoading(false))
  }, [caseId])

  // Grantees = case members other than me who have a public key (can receive a wrapped key).
  const grantees = useMemo(
    () => members.filter((m) => m.userId !== user?.id && m.hasPublicKey),
    [members, user],
  )
  const noKeyMembers = members.filter((m) => m.userId !== user?.id && !m.hasPublicKey)

  const selectedCount = Object.values(selected).filter(Boolean).length
  const selectedRealDocCount = useMemo(() => {
    const byId = new Map(docs.map((d) => [d.id, d]))
    return Object.entries(selected).filter(([key, on]) => {
      if (!on) return false
      const [docId] = key.split('|')
      return !isDemoDoc(byId.get(docId))
    }).length
  }, [docs, selected])

  const toggle = (docId: string, memberId: string) =>
    setSelected((s) => ({ ...s, [cellKey(docId, memberId)]: !s[cellKey(docId, memberId)] }))

  const toggleColumn = (memberId: string, on: boolean) =>
    setSelected((s) => {
      const next = { ...s }
      for (const d of docs) next[cellKey(d.id, memberId)] = on
      return next
    })

  const toggleRow = (docId: string, on: boolean) =>
    setSelected((s) => {
      const next = { ...s }
      for (const g of grantees) next[cellKey(docId, g.userId)] = on
      return next
    })

  const handleUnlock = async () => {
    if (!password || !user) return
    setUnlocking(true)
    try {
      const stored = loadWrappedPrivateKey(user.id)
      if (!stored) throw new Error('No private key on this device — log in again to provision keys')
      setPrivateKey(await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64))
      toast.success('Key unlocked')
    } catch {
      toast.error('Wrong password or key unavailable')
    } finally {
      setUnlocking(false)
    }
  }

  const handleDistribute = async () => {
    const pairs: Array<{ docId: string; memberId: string }> = []
    for (const d of docs) for (const g of grantees) {
      if (selected[cellKey(d.id, g.userId)]) pairs.push({ docId: d.id, memberId: g.userId })
    }
    if (pairs.length === 0) { toast.error('Select at least one document/member'); return }
    if (selectedRealDocCount > 0 && !privateKey) { toast.error('Unlock your key first'); return }

    setDistributing(true)
    setResults(null)
    try {
      const docKeyCache = new Map<string, string>()   // docId -> AES key (b64)
      const pubKeyCache = new Map<string, JsonWebKey>() // memberId -> public JWK
      const expiresAtEpochMs = expiryDays ? Date.now() + Number(expiryDays) * 86_400_000 : undefined

      const grants = []
      for (const { docId, memberId } of pairs) {
        const doc = docs.find((d) => d.id === docId)
        // Unwrap the document key once per doc, using MY wrapped token + private key.
        if (!docKeyCache.has(docId)) {
          if (isDemoDoc(doc)) {
            docKeyCache.set(docId, await demoDocumentKeyB64(docId))
          } else {
            const { data: token } = await api.get(`/documents/${docId}/wrapped-key`)
            docKeyCache.set(docId, await eciesUnwrapKey(privateKey!, token))
          }
        }
        // Fetch each grantee's public key once.
        if (!pubKeyCache.has(memberId)) {
          const { data } = await api.get(`/users/${memberId}/public-key`)
          pubKeyCache.set(memberId, JSON.parse(data.publicKeyJwk))
        }
        const wrappedKeyToken = await eciesWrapKey(pubKeyCache.get(memberId)!, docKeyCache.get(docId)!)
        grants.push({ docId, granteeId: memberId, capability, wrappedKeyToken, expiresAtEpochMs })
      }

      const { data } = await api.post<BatchItemResult[]>('/access/grant-batch', { grants })
      setResults(data)
      const ok = data.filter((r) => r.ok).length
      const failed = data.length - ok
      if (failed === 0) toast.success(`Distributed ${ok} access grant${ok !== 1 ? 's' : ''}`)
      else toast.error(`${ok} granted, ${failed} failed — see details`)
      if (ok > 0) setSelected({})
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? e.message ?? 'Distribution failed')
    } finally {
      setDistributing(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#1d6464]" /></div>
  if (error) return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-error">
      <AlertCircle className="w-4 h-4" /> {error}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link to={`/cases/${caseId}`} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[#1d6464] mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to case
        </Link>
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-[#1d6464]" />
          <h1 className="font-heading text-2xl font-bold text-text-primary">Distribute Document Access</h1>
        </div>
        <p className="text-text-muted text-sm mt-0.5">
          Tick which team members get which documents, then distribute. Each grant re-wraps the
          document key for the recipient (ECIES P-256) in your browser and is recorded on the audit trail.
        </p>
      </div>

      {/* Key unlock */}
      {!privateKey ? (
        <div className="card border border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-amber-600" />
            <p className="font-medium text-amber-800 text-sm">Unlock your private key to re-wrap document keys</p>
          </div>
          <div className="flex gap-2">
            <input type="password" className="input flex-1" placeholder="Your account password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
            <button onClick={handleUnlock} disabled={unlocking || !password} className="btn-primary px-4 disabled:opacity-50">
              {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock'}
            </button>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-2">
            Demo-seeded documents can be distributed without unlocking because they are reference records. Uploaded encrypted documents still require your private key.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium w-fit">
          <ShieldCheck className="w-3.5 h-3.5" /> Key unlocked — ready to distribute
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 card">
        <div>
          <label className="label">Capability</label>
          <select className="input" value={capability} onChange={(e) => setCapability(e.target.value as 'read' | 'write')}>
            <option value="read">Read</option>
            <option value="write">Write</option>
          </select>
        </div>
        <div>
          <label className="label">Expires in (days, optional)</label>
          <input className="input w-40" type="number" min={1} placeholder="never"
            value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-text-muted">{selectedCount} selected</span>
          <button onClick={handleDistribute} disabled={distributing || selectedCount === 0 || (selectedRealDocCount > 0 && !privateKey)}
            className="btn-primary px-5 py-2.5 disabled:opacity-50">
            {distributing ? <><Loader2 className="w-4 h-4 animate-spin" /> Distributing…</> : <><Share2 className="w-4 h-4" /> Distribute</>}
          </button>
        </div>
      </div>

      {noKeyMembers.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Not shown (no security key yet — they must log in once): {noKeyMembers.map((m) => m.fullName).join(', ')}
        </div>
      )}

      {/* Matrix */}
      {docs.length === 0 || grantees.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {docs.length === 0 ? 'No documents in this case yet.' : 'No team members with security keys to distribute to.'}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary py-2 pr-4 min-w-[16rem]">Document</th>
                {grantees.map((g) => (
                  <th key={g.userId} className="px-3 py-2 text-center">
                    <div className="font-medium text-text-primary text-xs truncate max-w-[8rem] mx-auto" title={g.email}>{g.fullName}</div>
                    <button onClick={() => toggleColumn(g.userId, true)} className="text-[10px] text-[#1d6464] hover:underline mt-0.5">all</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-border/60 hover:bg-surface-muted/40">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {d.confidential ? <Lock className="w-4 h-4 text-red-500 shrink-0" /> : <FileText className="w-4 h-4 text-[#1d6464] shrink-0" />}
                      <span className="truncate max-w-[14rem]" title={d.fileName}>{d.fileName}</span>
                      {isDemoDoc(d) && <span className="text-[9px] text-gold-300 border border-gold-500/20 rounded px-1">demo</span>}
                      <button onClick={() => toggleRow(d.id, true)} className="text-[10px] text-[#1d6464] hover:underline ml-1">all</button>
                    </div>
                  </td>
                  {grantees.map((g) => (
                    <td key={g.userId} className="px-3 py-2 text-center">
                      <input type="checkbox" className="w-4 h-4 accent-[#1d6464] cursor-pointer"
                        checked={!!selected[cellKey(d.id, g.userId)]}
                        onChange={() => toggle(d.id, g.userId)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="card space-y-1.5">
          <p className="font-medium text-text-primary text-sm mb-2">Distribution results</p>
          {results.map((r, i) => {
            const member = members.find((m) => m.userId === r.granteeId)
            const doc = docs.find((d) => d.id === r.docId)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="text-text-secondary truncate">{doc?.fileName ?? r.docId} → {member?.fullName ?? r.granteeId}</span>
                {!r.ok && <span className="text-red-600">— {r.error}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
