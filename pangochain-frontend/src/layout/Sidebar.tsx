import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, FolderOpen, FileText, MessageSquare,
  ClipboardList, Settings, LogOut, Users,
  Activity, Key, Home, ChevronRight, Scale,
  Shield, ShieldCheck, Search, X, FileSignature,
  Bot, TrendingUp, DoorOpen, Video, MessagesSquare, Gavel
} from 'lucide-react'
import { useAuthStore, isClient, roleLabel, canViewGlobalAudit } from '../store/authStore'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import api from '../lib/api'
import { Tooltip } from '../components/ui/Tooltip'
import { WaxSealSvg } from '../components/ui/SvgAssets'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  description: string
  end?: boolean
  badge?: number
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')

  useEffect(() => {
    if (!user) return
    api.get('/dashboard/stats')
      .then((r) => setUnreadCount(r.data?.unreadMessages ?? 0))
      .catch(() => {})
  }, [user])

  if (!user) return null

  const showGlobalAudit = canViewGlobalAudit(user.role)

  const legalItems: NavItem[] = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard', description: 'Your daily command center: cases, hearings, alerts, audit activity.', end: true },
    { to: '/cases', icon: <FolderOpen className="w-4 h-4" />, label: 'Cases', description: 'Open, search, and manage legal matters and case files.' },
    { to: '/documents', icon: <FileText className="w-4 h-4" />, label: 'Documents', description: 'Encrypted document vault with IPFS storage and Fabric transaction IDs.' },
    { to: '/templates', icon: <FileSignature className="w-4 h-4" />, label: 'Templates', description: 'Create reusable legal document templates and drafting workflows.' },
    { to: '/messages', icon: <MessageSquare className="w-4 h-4" />, label: 'Messages', description: 'Secure collaboration thread for lawyers, clients, and staff.', badge: unreadCount },
    { to: '/hearings', icon: <Gavel className="w-4 h-4" />, label: 'Hearings', description: 'Track hearings, court dates, locations, and preparation tasks.' },
    ...(showGlobalAudit ? [{ to: '/audit', icon: <ClipboardList className="w-4 h-4" />, label: 'Audit Trail', description: 'Review immutable access, upload, signature, and permission events.' }] : []),
  ]

  const clientItems: NavItem[] = [
    { to: '/client/portal', icon: <Home className="w-4 h-4" />, label: 'My Portal', description: 'A simple overview of your case, documents, and next steps.', end: true },
    { to: '/client/documents', icon: <Shield className="w-4 h-4" />, label: 'Document Vault', description: 'Access encrypted documents shared by your legal team.' },
    { to: '/client/case', icon: <Scale className="w-4 h-4" />, label: 'My Case', description: 'Follow milestones, deadlines, and key case updates.' },
    { to: '/client/privacy', icon: <ShieldCheck className="w-4 h-4" />, label: 'Privacy & Data', description: 'Understand consent, data handling, and document privacy controls.' },
    { to: '/messages', icon: <MessageSquare className="w-4 h-4" />, label: 'Messages', description: 'Securely talk with your legal team.', badge: unreadCount },
  ]

  const plannedLegal: NavItem[] = [
    { to: '/assistant', icon: <Bot className="w-4 h-4" />, label: 'AI Assistant', description: 'Ask case-aware questions and get drafting or research support.' },
    { to: '/insights', icon: <TrendingUp className="w-4 h-4" />, label: 'Case Insights', description: 'See workload, risk, deadlines, and matter intelligence.' },
    { to: '/data-rooms', icon: <DoorOpen className="w-4 h-4" />, label: 'Data Rooms', description: 'Create secure collaboration spaces for opposing counsel or clients.' },
    { to: '/consultations', icon: <Video className="w-4 h-4" />, label: 'Video Consults', description: 'Schedule and join confidential legal consultations.' },
  ]
  const plannedClient: NavItem[] = [
    { to: '/client/assistant', icon: <MessagesSquare className="w-4 h-4" />, label: 'AI Assistant', description: 'Get guided answers about your documents and case steps.' },
    { to: '/consultations', icon: <Video className="w-4 h-4" />, label: 'Video Consults', description: 'Join secure video sessions with your legal team.' },
  ]

  const adminItems: NavItem[] = [
    { to: '/admin', icon: <Settings className="w-4 h-4" />, label: 'Admin Panel', description: 'Manage firm users, roles, security settings, and governance.' },
    { to: '/admin/users', icon: <Users className="w-4 h-4" />, label: 'Users', description: 'Invite, suspend, and review firm member access.' },
    { to: '/admin/keys', icon: <Key className="w-4 h-4" />, label: 'Key Rotation', description: 'Review and rotate cryptographic access material.' },
    { to: '/ledger', icon: <Activity className="w-4 h-4" />, label: 'Ledger Explorer', description: 'Inspect Fabric transaction references and ledger state.' },
  ]

  const showAdmin =
    user.role === 'MANAGING_PARTNER' ||
    user.role === 'IT_ADMIN' ||
    user.role === 'REGULATOR'

  const showRegulator = user.role === 'REGULATOR'
  const showMfa = user.role === 'MANAGING_PARTNER' || user.role === 'IT_ADMIN' || user.role === 'PARTNER_SENIOR' || user.role === 'PARTNER_JUNIOR'

  const navItems = isClient(user.role) ? clientItems : legalItems
  const plannedItems = isClient(user.role) ? plannedClient : plannedLegal
  const searchNeedle = navSearch.trim().toLowerCase()
  const matchesSearch = (item: NavItem) =>
    !searchNeedle ||
    item.label.toLowerCase().includes(searchNeedle) ||
    item.description.toLowerCase().includes(searchNeedle)
  
  const filteredNavItems = navItems.filter(matchesSearch)
  const filteredPlannedItems = plannedItems.filter(matchesSearch)
  const filteredAdminItems = adminItems.filter(matchesSearch)

  const renderNavItem = (item: NavItem, extra?: React.ReactNode) => (
    <Tooltip key={item.to} content={item.description} side="right" className="w-full">
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onClose}
        className={({ isActive }) => clsx(
          'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300',
          'text-text-secondary hover:bg-white/5 hover:text-text-primary hover:translate-x-1 group/item',
          isActive && 'bg-gold-500/10 text-gold-300 border-l-2 border-gold-500 shadow-gold-sm font-semibold'
        )}
      >
        <span className="shrink-0 text-text-secondary group-hover/item:text-gold-400 group-[.active]/item:text-gold-300 transition-colors duration-300">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {(item.badge ?? 0) > 0 && (
          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-950 shadow-gold-sm">
            {item.badge! > 99 ? '99+' : item.badge}
          </span>
        )}
        {extra}
      </NavLink>
    </Tooltip>
  )

  const handleLogout = () => {
    clearAuth()
    toast.success('Logged out')
    navigate('/login')
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="pt-5 pb-1.5 px-4">
      <p className="text-[10px] font-bold text-gold-500/40 uppercase tracking-[0.18em]">{children}</p>
    </div>
  )

  const sidebarContent = (
    <aside className="w-64 flex-shrink-0 border-r border-gold-500/20 bg-navy-950 flex flex-col h-screen sticky top-0 z-20 transition-all duration-300">
      {/* Brand Header */}
      <div className="relative h-[72px] px-5 flex items-center justify-between border-b border-gold-500/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 border border-gold-500/20 shadow-gold-sm p-1.5 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain" className="h-full w-auto filter-gold" />
          </div>
          <div>
            <p className="font-serif text-sm font-bold text-gold-300 tracking-wide">PangoChain</p>
            <p className="text-[9px] font-semibold text-text-secondary uppercase tracking-widest">Justice Platform</p>
          </div>
        </div>
      </div>

      {/* User profile details at top */}
      <div className="px-4 py-4 border-b border-gold-500/10 bg-navy-900/30">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-600 to-navy-950 flex items-center justify-center text-gold-300 font-bold text-sm shadow-gold-sm ring-1 ring-gold-500/30">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-navy-950" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">{user.fullName}</p>
              <WaxSealSvg status="verified" className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-text-secondary truncate mt-0.5">{roleLabel(user.role)}</p>
          </div>
        </div>
      </div>

      {/* Internal Navigation Search */}
      <div className="px-3 py-3 border-b border-gold-500/10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
          <input
            className="w-full h-9 rounded-lg border border-gold-500/15 bg-navy-900/50 pl-9 pr-3 text-xs text-text-primary placeholder-text-muted
                       focus:border-gold-500/40 focus:bg-navy-900 focus:outline-none transition-all duration-200"
            placeholder="Search commands..."
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
          {navSearch && (
            <button
              onClick={() => setNavSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Navigation Menu */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2 space-y-0.5">
        {isClient(user.role) ? (
          <SectionLabel>Client Workspace</SectionLabel>
        ) : (
          <SectionLabel>Case Management</SectionLabel>
        )}

        {filteredNavItems.map((item) => renderNavItem(item))}

        {filteredPlannedItems.length > 0 && (
          <>
            <SectionLabel>Intelligence</SectionLabel>
            {filteredPlannedItems.map((item) => renderNavItem(item,
              <span className="ml-auto rounded bg-gold-500/10 px-1 py-0.5 text-[8px] font-bold uppercase text-gold-400 border border-gold-500/20">AI</span>
            ))}
          </>
        )}

        {showRegulator && (
          <>
            <SectionLabel>Regulatory Watch</SectionLabel>
            <NavLink
              to="/regulator"
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 text-text-secondary hover:bg-white/5 hover:text-text-primary',
                isActive && 'bg-gold-500/10 text-gold-300 border-l-2 border-gold-500 shadow-gold-sm font-semibold'
              )}
            >
              <Search className="w-4 h-4 text-gold-500" />
              Cross-Firm Audit
            </NavLink>
            <NavLink
              to="/ledger"
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 text-text-secondary hover:bg-white/5 hover:text-text-primary',
                isActive && 'bg-gold-500/10 text-gold-300 border-l-2 border-gold-500 shadow-gold-sm font-semibold'
              )}
            >
              <Activity className="w-4 h-4 text-gold-500" />
              Ledger Explorer
            </NavLink>
          </>
        )}

        {showAdmin && !showRegulator && (
          <>
            <SectionLabel>Administration</SectionLabel>
            {filteredAdminItems.map((item) => renderNavItem(item))}
          </>
        )}

        {showMfa && (
          <>
            <SectionLabel>Admin Security</SectionLabel>
            <NavLink
              to="/profile/mfa"
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 text-text-secondary hover:bg-white/5 hover:text-text-primary',
                isActive && 'bg-gold-500/10 text-gold-300 border-l-2 border-gold-500 shadow-gold-sm font-semibold'
              )}
            >
              <Shield className="w-4 h-4 text-gold-500" />
              {user.mfaEnabled ? 'MFA Enabled ✓' : 'Setup MFA'}
            </NavLink>
          </>
        )}
      </nav>

      {/* Profile & Settings shortcuts */}
      <div className="p-2 border-t border-gold-500/10 space-y-0.5">
        {renderNavItem({ to: '/profile', icon: <Settings className="w-4 h-4" />, label: 'Profile & Keys', description: 'Manage your account, keys, and personal security settings.' })}
        <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-300 w-full text-left">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Tech stamp footer */}
      <div className="px-5 py-3 border-t border-gold-500/10 bg-navy-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 flex-shrink-0 animate-pulse" />
            <p className="text-[10px] text-text-secondary font-mono">Fabric 2.4 · E2E</p>
          </div>
          <span className="text-[9px] font-mono text-gold-500/60 uppercase">Secure</span>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">{sidebarContent}</div>

      {/* Mobile sidebar overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-40 lg:hidden flex">
            {sidebarContent}
            <button
              onClick={onClose}
              className="absolute top-4 right-[-44px] w-9 h-9 rounded-xl bg-navy-900 border border-gold-500/20 flex items-center justify-center text-gold-300 shadow-gold-sm"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </>
  )
}
