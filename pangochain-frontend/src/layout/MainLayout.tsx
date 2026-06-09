import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from '../components/NotificationBell'
import { ThemeToggle } from '../components/ui/ThemeToggle'

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()

  // Generate simple breadcrumbs from location path
  const pathnames = location.pathname.split('/').filter((x) => x)
  
  return (
    <div className="flex h-screen overflow-hidden bg-navy-950 text-text-primary noise-overlay">
      {/* Background radial gradient layers */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(201,168,76,0.08),transparent_32rem),radial-gradient(circle_at_80%_0%,rgba(26,92,74,0.05),transparent_28rem)]" />
      </div>

      {/* Sidebar navigation */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main viewport */}
      <main className="flex-1 overflow-y-auto scrollbar-thin relative z-10 flex flex-col h-full bg-transparent">
        {/* Top Header bar */}
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-gold-500/10 bg-navy-950/80 px-6 backdrop-blur-md">
          {/* Left: Hamburger menu + Breadcrumbs */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center space-x-2 text-xs font-medium font-mono">
              <Link to="/dashboard" className="text-text-secondary hover:text-gold-300 transition-colors">
                PANGO
              </Link>
              {pathnames.map((value, index) => {
                const to = `/${pathnames.slice(0, index + 1).join('/')}`
                const isLast = index === pathnames.length - 1
                const label = value.toUpperCase().replace(/-/g, ' ')

                return (
                  <span key={to} className="flex items-center space-x-2">
                     <span className="text-gold-500/40">/</span>
                    {isLast ? (
                      <span className="text-gold-300 font-semibold">{label}</span>
                    ) : (
                      <Link to={to} className="text-text-secondary hover:text-gold-300 transition-colors">
                        {label}
                      </Link>
                    )}
                  </span>
                )
              })}
            </nav>
          </div>

          {/* Right: Expandable Search + Notification Bell + Theme Toggle */}
          <div className="flex items-center gap-4">
            {/* Expandable Search Input */}
            <div className="relative flex items-center">
              <div
                className={`flex items-center rounded-xl border border-gold-500/15 bg-navy-900/60 transition-all duration-300 ${
                  searchExpanded ? 'w-56 sm:w-72 px-3 py-1.5' : 'w-10 h-10 justify-center cursor-pointer hover:bg-white/5'
                }`}
                onClick={() => !searchExpanded && setSearchExpanded(true)}
              >
                <Search className={`h-4 w-4 text-gold-400 shrink-0 ${!searchExpanded ? 'pointer-events-none' : ''}`} />
                {searchExpanded && (
                  <>
                    <input
                      type="text"
                      className="ml-2 w-full bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none"
                      placeholder="Search cases, assets, blocks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSearchQuery('')
                        setSearchExpanded(false)
                      }}
                      className="text-text-muted hover:text-text-primary ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notification Bell */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/15 bg-navy-900/60 hover:bg-white/5 transition-colors duration-200">
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Content body with noise overlay */}
        <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
