import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const CASE_TYPES = [
  'Corporate M&A', 'Commercial Litigation', 'Intellectual Property',
  'Real Estate', 'Regulatory', 'Employment Law', 'Contract Dispute',
  'Corporate', 'Fintech Regulatory', 'Criminal Defense', 'Family Law', 'Other',
]

interface ConflictMatch {
  caseId: string
  caseTitle: string
  caseStatus: string
  matchedField: string
  matchedValue: string
  queryTerm: string
  score: number
}

export default function NewCase() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [caseType, setCaseType] = useState('')
  const [clientName, setClientName] = useState('')
  const [opposingParty, setOpposingParty] = useState('')
  const [relatedParties, setRelatedParties] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  // Conflict-of-interest gate: null = not yet checked; [] would mean checked-clear (we proceed instead).
  const [conflicts, setConflicts] = useState<ConflictMatch[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const createCase = async (conflictCheckAcknowledged: boolean) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/cases', {
        title,
        description,
        caseType: caseType || null,
        clientName: clientName || null,
        opposingParty: opposingParty || null,
        relatedParties: relatedParties || null,
        conflictCheckAcknowledged,
      })
      toast.success('Case created and registered on blockchain')
      navigate(`/cases/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // If a conflict warning is already showing, the lawyer must acknowledge to proceed.
    if (conflicts !== null) {
      if (acknowledged) await createCase(true)
      return
    }

    // First submit: run the conflict-of-interest scan when any party name is provided.
    const hasParties = clientName.trim() || opposingParty.trim() || relatedParties.trim()
    if (hasParties) {
      setChecking(true)
      try {
        const { data } = await api.post('/cases/conflict-check', {
          clientName, opposingParty, relatedParties, acknowledged: false,
        })
        if (data.hasConflicts) {
          setConflicts(data.matches as ConflictMatch[])
          return
        }
      } catch {
        // Conflict check is advisory — never block case creation if it fails.
      } finally {
        setChecking(false)
      }
    }
    await createCase(false)
  }

  return (
    <div className="max-w-xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/cases" className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">New Case</h1>
          <p className="text-text-muted text-sm">Registered on Hyperledger Fabric</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-[#1d6464]/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-[#1d6464]" />
          </div>
          <div>
            <p className="font-medium text-text-primary text-sm">Case Registration</p>
            <p className="text-text-muted text-xs">Parties are screened for conflicts of interest before creation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Case Title *</label>
            <input
              className="input"
              placeholder="e.g. Meridian Capital Partners — Series C Acquisition"
              value={title}
              onChange={(e) => { setTitle(e.target.value) }}
              required
              maxLength={500}
            />
          </div>

          <div>
            <label className="label">Case Type</label>
            <select className="input" value={caseType} onChange={(e) => setCaseType(e.target.value)}>
              <option value="">— Select type —</option>
              {CASE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Client Name</label>
              <input className="input" placeholder="e.g. Acme Corporation"
                value={clientName} onChange={(e) => { setClientName(e.target.value); setConflicts(null); setAcknowledged(false) }} />
            </div>
            <div>
              <label className="label">Opposing Party</label>
              <input className="input" placeholder="e.g. Globex LLC"
                value={opposingParty} onChange={(e) => { setOpposingParty(e.target.value); setConflicts(null); setAcknowledged(false) }} />
            </div>
          </div>

          <div>
            <label className="label">Related Parties</label>
            <input className="input" placeholder="Comma-separated — e.g. subsidiaries, co-defendants, witnesses"
              value={relatedParties} onChange={(e) => { setRelatedParties(e.target.value); setConflicts(null); setAcknowledged(false) }} />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px] resize-y"
              placeholder="Brief description of the matter…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          {/* Conflict-of-interest warning */}
          {conflicts !== null && conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <ShieldAlert className="w-5 h-5" />
                <p className="font-semibold text-sm">Potential conflict of interest — {conflicts.length} match{conflicts.length !== 1 ? 'es' : ''}</p>
              </div>
              <ul className="space-y-1.5">
                {conflicts.map((c, i) => (
                  <li key={i} className="text-xs text-amber-900 bg-white/60 rounded-lg px-2.5 py-1.5">
                    <Link to={`/cases/${c.caseId}`} target="_blank" className="font-medium hover:underline">{c.caseTitle}</Link>
                    <span className="text-amber-700"> ({c.caseStatus.toLowerCase()})</span>
                    <span className="block text-amber-700 mt-0.5">
                      “{c.queryTerm}” ≈ {c.matchedField}: <strong>{c.matchedValue}</strong> · {c.score}% match
                    </span>
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-600"
                  checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                <span>I have reviewed these matches and confirm there is no disqualifying conflict. Proceed with creation (recorded on the audit trail).</span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Link to="/cases" className="flex-1 btn border border-border text-text-secondary hover:bg-surface-muted py-2.5 justify-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || checking || !title.trim() || (conflicts !== null && conflicts.length > 0 && !acknowledged)}
              className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50"
            >
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking conflicts…</>
                : loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                : conflicts !== null && conflicts.length > 0 ? <><AlertTriangle className="w-4 h-4" /> Acknowledge & Create</>
                : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
