import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Plus, Search, Clock, FileText, Filter, AlertCircle, LayoutGrid, List, ChevronRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { WaxSealSvg } from '../components/ui/SvgAssets'
import { CardGridSkeleton } from '../components/ui/Skeleton'
import { PageHero, QuickActionGrid } from '../components/ui/PageChrome'
import { Tooltip } from '../components/ui/Tooltip'

interface CaseDto {
  id: string
  title: string
  caseType: string
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  firmName: string
  createdByEmail: string
  documentCount: number
  createdAt: string
  closedAt: string | null
}

interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
}

// Courthouse Line-Art SVG
function CourthouseSvg() {
  return (
    <svg className="w-24 h-24 text-gold-500/25 stroke-current mx-auto mb-6" viewBox="0 0 100 80" fill="none" strokeWidth="1.5">
      <path d="M10 25 L50 5 L90 25 Z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="25" x2="90" y2="25" strokeWidth="2.5" />
      <rect x="15" y="25" width="70" height="45" strokeLinejoin="round" />
      {/* Pillars */}
      <line x1="25" y1="25" x2="25" y2="70" strokeWidth="2" />
      <line x1="38" y1="25" x2="38" y2="70" strokeWidth="2" />
      <line x1="50" y1="25" x2="50" y2="70" strokeWidth="2" />
      <line x1="62" y1="25" x2="62" y2="70" strokeWidth="2" />
      <line x1="75" y1="25" x2="75" y2="70" strokeWidth="2" />
      {/* Door */}
      <path d="M43 70 V50 C43 46 57 46 57 50 V70 Z" strokeLinecap="round" strokeLinejoin="round" />
      {/* Pedestal */}
      <line x1="5" y1="70" x2="95" y2="70" strokeWidth="3.5" />
    </svg>
  )
}

export default function Cases() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const { data: page, isLoading, isError } = useQuery({
    queryKey: queryKeys.cases({ status: statusFilter, q: debouncedSearch }),
    queryFn: async () => {
      const params: Record<string, string> = { page: '0', size: '30' }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (debouncedSearch) params.q = debouncedSearch
      const { data } = await api.get<Page<CaseDto>>('/cases', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })

  const loading = isLoading
  const error = isError ? 'Failed to load cases' : ''
  const cases = page?.content ?? []
  const total = page?.totalElements ?? 0
  const active = cases.filter((c) => c.status === 'ACTIVE').length
  const closed = cases.filter((c) => c.status === 'CLOSED').length

  const getWaxSealStatus = (s: CaseDto['status']) => {
    if (s === 'ACTIVE') return 'verified'
    if (s === 'CLOSED') return 'rejected'
    return 'pending'
  }

  return (
    <div className="space-y-6 animate-fade-in text-text-primary">
      <PageHero
        eyebrow="Case Matter Ledgers"
        title="Matters"
        description="Search active court dockets, manage files access matrices, and inspect decentralized audit footprints."
        icon={FolderOpen}
        actions={(
          <Link to="/cases/new" className="btn-primary text-xs uppercase tracking-wider font-bold">
            <Plus className="w-4 h-4" /> New Case File
          </Link>
        )}
      >
        <QuickActionGrid
          actions={[
            { label: 'New matter intake', description: 'Start a case with title, parties, type, and initial ownership.', to: '/cases/new', icon: Plus, tone: 'amber' },
            { label: 'Document vault', description: 'Open encrypted case documents and evidence files.', to: '/documents', icon: FileText, tone: 'emerald' },
            { label: 'Audit review', description: 'Check who accessed or changed case resources.', to: '/audit', icon: AlertCircle, tone: 'cyan' },
            { label: 'Hearings', description: 'Review court dates and upcoming case appearances.', to: '/hearings', icon: Clock, tone: 'amber' },
          ]}
        />
      </PageHero>

      {/* Stats row */}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Active Matched', value: active, help: 'Cases currently in active litigation.' },
            { label: 'Closed Matched', value: closed, help: 'Cases marked completed or archived.' },
            { label: 'Total Index', value: total, help: 'All cases returned by the active node filters.' },
          ].map((item) => (
            <Tooltip key={item.label} content={item.help} side="bottom" className="w-full">
              <div className="card w-full px-5 py-4 hover:border-gold-500/20 transition-all duration-300">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{item.label}</p>
                <p className="mt-2 font-serif text-3xl font-bold text-gold-300">{item.value}</p>
              </div>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Filter Bar with Table/Grid toggle, Pill Chips, expanding search input */}
      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pill filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['ALL', 'ACTIVE', 'CLOSED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  statusFilter === s
                    ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-gold-sm'
                    : 'bg-navy-900 border-gold-500/10 text-text-secondary hover:border-gold-500/30 hover:text-text-primary'
                }`}
              >
                {s === 'ALL' ? <><Filter className="w-3.5 h-3.5" /> All</> : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Animated Expandable Search */}
          <div className="relative flex items-center">
            <div
              className={`flex items-center rounded-xl border border-gold-500/15 bg-navy-950/60 transition-all duration-300 ${
                searchExpanded || search ? 'w-56 sm:w-64 px-3 py-2' : 'w-10 h-10 justify-center cursor-pointer hover:bg-white/5'
              }`}
              onClick={() => !searchExpanded && setSearchExpanded(true)}
            >
              <Search className="h-4 w-4 text-gold-400 shrink-0" />
              {(searchExpanded || search) && (
                <>
                  <input
                    type="text"
                    className="ml-2 w-full bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none"
                    placeholder="Search by title or type..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {search && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSearch('')
                        setSearchExpanded(false)
                      }}
                      className="text-text-muted hover:text-text-primary ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Grid/Table Toggle */}
          <div className="flex border border-gold-500/10 rounded-xl p-0.5 bg-navy-950/60">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gold-500/10 text-gold-300' : 'text-text-secondary hover:text-text-primary'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-gold-500/10 text-gold-300' : 'text-text-secondary hover:text-text-primary'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or Table layout */}
      {loading && <CardGridSkeleton />}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && cases.length === 0 && (
        <div className="card text-center py-16 max-w-xl mx-auto">
          <CourthouseSvg />
          <h3 className="font-serif text-2xl text-gold-300 mb-2 font-semibold">No cases yet</h3>
          <p className="text-text-secondary text-sm max-w-md mx-auto mb-8">
            Create your first legal case docket. Encrypt evidence, invite stakeholders, and record actions on the immutable Fabric ledger.
          </p>
          <Link to="/cases/new" className="btn-primary text-xs uppercase tracking-wider font-bold">
            <Plus className="w-4 h-4" /> Initialize Case
          </Link>
        </div>
      )}

      {/* Results View */}
      {!loading && !error && cases.length > 0 && (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="card group relative overflow-hidden bg-navy-900/60 p-6 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-gold-sm flex flex-col justify-between min-h-[200px]"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/5 border border-gold-500/10 flex items-center justify-center shadow-inner group-hover:bg-gold-500/15 transition-all duration-300">
                    <FolderOpen className="w-5 h-5 text-gold-400" />
                  </div>
                  <WaxSealSvg status={getWaxSealStatus(c.status)} className="w-9 h-9" />
                </div>

                <div className="space-y-2 flex-1">
                  <h3 className="font-serif font-bold text-lg text-gold-300 line-clamp-2 group-hover:text-gold-100 transition-colors">
                    {c.title}
                  </h3>
                  {c.caseType && (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded border border-gold-500/20 bg-gold-500/10 text-gold-300 uppercase tracking-widest">
                      {c.caseType}
                    </span>
                  )}
                  <p className="text-xs text-text-secondary truncate pt-2">
                    <span className="font-semibold text-text-muted">CLIENT:</span> {c.firmName}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-6 border-t border-gold-500/5 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-gold-500/50" /> {c.documentCount >= 0 ? `${c.documentCount} documents` : 'Open for documents'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Clock className="w-3.5 h-3.5 text-gold-500/50" />
                    {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gold-500/20 bg-navy-950 text-gold-500/80 font-bold uppercase tracking-wider font-mono">
                    <th className="py-4 px-6">Case Docket</th>
                    <th className="py-4 px-6">Client / Firm</th>
                    <th className="py-4 px-6">Classification</th>
                    <th className="py-4 px-6">Evidentiary Docs</th>
                    <th className="py-4 px-6">Date Lodged</th>
                    <th className="py-4 px-6 text-center">Ledger Seal</th>
                    <th className="py-4 px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-500/5">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-gold-500/5 transition-colors group">
                      <td className="py-4 px-6 font-serif font-bold text-sm text-gold-300">
                        <Link to={`/cases/${c.id}`} className="hover:text-gold-100 block truncate max-w-xs">
                          {c.title}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-text-secondary font-semibold">{c.firmName}</td>
                      <td className="py-4 px-6">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-gold-500/20 bg-gold-500/10 text-gold-300 uppercase tracking-widest">
                          {c.caseType}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-text-secondary">{c.documentCount} files</td>
                      <td className="py-4 px-6 text-text-secondary font-mono">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <WaxSealSvg status={getWaxSealStatus(c.status)} className="w-7 h-7 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link to={`/cases/${c.id}`} className="inline-flex p-1.5 rounded-lg border border-gold-500/10 hover:border-gold-500/30 text-gold-400">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
