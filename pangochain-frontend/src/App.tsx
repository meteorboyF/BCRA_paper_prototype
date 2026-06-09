import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, isClient } from './store/authStore'
import { MainLayout } from './layout/MainLayout'
import { Suspense } from 'react'
import ParticleBackground from './components/ui/ParticleBackground'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import NewCase from './pages/NewCase'
import DistributeAccess from './pages/DistributeAccess'
import CaseJourney from './pages/CaseJourney'
import Documents from './pages/Documents'
import TemplateEngine from './pages/TemplateEngine'
import AiAssistant from './pages/AiAssistant'
import CaseInsights from './pages/CaseInsights'
import DataRooms from './pages/DataRooms'
import VideoConsultations from './pages/VideoConsultations'
import ClientAssistant from './pages/client/ClientAssistant'
import AuditTrail from './pages/AuditTrail'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import AdminPanel from './pages/AdminPanel'
import NotFound from './pages/NotFound'
import HearingManager from './pages/HearingManager'
import LedgerExplorer from './pages/LedgerExplorer'
import MfaSetup from './pages/MfaSetup'
import RegulatorView from './pages/RegulatorView'
import ClientPortal from './pages/client/ClientPortal'
import ClientDocuments from './pages/client/ClientDocuments'
import ClientCase from './pages/client/ClientCase'
import ClientPrivacy from './pages/client/ClientPrivacy'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  // Specific selectors — re-render only when these slices change, not on any store write.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  // Don't decide redirect until persisted auth has been read back, or a reload
  // briefly flashes the login page before the session is restored.
  if (!hasHydrated) return <PageLoader />
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  if (!hasHydrated) return <PageLoader />
  if (!isAuthenticated) return <>{children}</>
  return <Navigate to={user && isClient(user.role) ? '/client/portal' : '/dashboard'} replace />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-[#1d6464] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Global particle canvas — fixed, z-0, pointer-events none. Mounted once outside Routes. */}
      <ParticleBackground />

      {/* All page content sits at z-10+ so it renders above the particle layer */}
      <div className="relative z-10 min-h-screen">
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/mfa/setup" element={<MfaSetup />} />

        {/* Protected — all inside MainLayout */}
        <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>

          {/* ── Legal Professional ──────────────────────────────────────────── */}
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/new" element={<NewCase />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/cases/:id/distribute" element={<DistributeAccess />} />
          <Route path="/cases/:id/journey" element={<CaseJourney />} />

          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:id" element={<Documents />} />

          <Route path="/templates" element={<TemplateEngine />} />

          {/* Planned (Backlog) features — scaffolding pages, routes reserved */}
          <Route path="/assistant" element={<AiAssistant />} />
          <Route path="/insights" element={<CaseInsights />} />
          <Route path="/data-rooms" element={<DataRooms />} />
          <Route path="/consultations" element={<VideoConsultations />} />
          <Route path="/client/assistant" element={<ClientAssistant />} />

          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/audit/ledger" element={<AuditTrail />} />

          <Route path="/messages" element={<Chat />} />

          <Route path="/hearings" element={<HearingManager />} />

          <Route path="/ledger" element={<LedgerExplorer />} />

          {/* ── Admin ──────────────────────────────────────────────────────── */}
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/users" element={<AdminPanel />} />
          <Route path="/admin/keys" element={<AdminPanel />} />

          {/* ── Profile / MFA ──────────────────────────────────────────────── */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/mfa" element={<MfaSetup />} />

          {/* ── Regulator ──────────────────────────────────────────────────── */}
          <Route path="/regulator" element={<RegulatorView />} />

          {/* ── Client Portal ──────────────────────────────────────────────── */}
          <Route path="/client/portal" element={<ClientPortal />} />
          <Route path="/client/documents" element={<ClientDocuments />} />
          <Route path="/client/case" element={<ClientCase />} />
          <Route path="/client/privacy" element={<ClientPrivacy />} />
          <Route path="/client/portal/sign/:docId" element={
            <div className="card">
              <p className="text-text-muted text-sm">E-Signature — Phase 7</p>
            </div>
          } />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </div>
    </ErrorBoundary>
  )
}
