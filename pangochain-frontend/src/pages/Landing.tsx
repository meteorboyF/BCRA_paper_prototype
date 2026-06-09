import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInView } from 'react-intersection-observer'
import { ChevronDown, ArrowRight, Shield, Activity, Award, CheckCircle2 } from 'lucide-react'
import {
  JusticeSvg, ScalesSvg, WaxSealSvg, ChainLinkSvg,
  ColumnDividerSvg, DocumentSealSvg, VaultSvg, ConstellationBg
} from '../components/ui/SvgAssets'
import { ThemeToggle } from '../components/ui/ThemeToggle'

// Self-counting stats component on mount or inView
function Counter({ value, suffix = '', duration = 1500 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const end = value
    if (start === end) return
    const stepTime = Math.abs(Math.floor(duration / end))
    const timer = setInterval(() => {
      start += Math.ceil(end / 40)
      if (start >= end) {
        clearInterval(timer)
        setCount(end)
      } else {
        setCount(start)
      }
    }, Math.max(stepTime, 20))
    return () => clearInterval(timer)
  }, [inView, value, duration])

  return (
    <span ref={ref} className="font-mono text-3xl md:text-4xl font-bold text-gold-300">
      {count.toLocaleString()}{suffix}
    </span>
  )
}

function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-navy-950/90 backdrop-blur-md border-b border-gold-500/10 shadow-gold-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 border border-gold-500/20 p-1.5 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain Logo" className="h-full w-auto filter-gold" />
          </div>
          <div>
            <p className="font-serif text-sm font-bold text-gold-300 tracking-wide">PangoChain</p>
            <p className="text-[9px] font-semibold text-text-secondary uppercase tracking-widest">Justice Platform</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Technology', 'How It Works', 'Security', 'Testimonials'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-gold-300 transition-colors duration-300">
              {l}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="text-xs font-bold uppercase tracking-wider text-text-primary hover:text-gold-300 transition-colors duration-300">
            Enter Platform
          </Link>
          <Link to="/register" className="btn-primary text-xs tracking-wider uppercase px-4 py-2">
            Get Started MATTERS
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center px-6 pt-20 overflow-hidden bg-navy-950">
      {/* Background Constellation stars */}
      <ConstellationBg density={50} />

      {/* Half-viewport geometric Lady Justice SVG on the right */}
      <div className="absolute right-0 bottom-0 top-16 w-full lg:w-1/2 opacity-45 lg:opacity-85 pointer-events-none flex items-center justify-end z-0">
        <JusticeSvg className="w-full h-full max-h-[85vh] text-gold-500/35 stroke-current animate-drift drop-shadow-[0_0_12px_rgba(201,168,76,0.3)]" />
      </div>

      {/* Radial shade */}
      <div className="absolute inset-0 bg-gradient-to-tr from-navy-950 via-navy-950/90 to-transparent pointer-events-none z-0" />

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-300 text-xs font-semibold mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse shadow-gold-sm" />
            THE COGNITIVE LEDGER MATTERS PLATFORM
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-8 text-text-primary">
            Justice, <br />
            <span className="relative inline-block text-gold-300">
              Engineered.
              <svg className="absolute left-0 bottom-[-8px] w-full h-2 text-gold-500" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0,5 Q50,0 100,5" stroke="currentColor" strokeWidth="2" fill="none" className="stroke-draw-line"
                  style={{ strokeDasharray: '1000', strokeDashoffset: '1000', animation: 'draw-line 2s ease-out forwards 0.5s' }} />
              </svg>
            </span>
          </h1>

          <p className="text-base md:text-lg text-text-secondary leading-relaxed mb-10 max-w-lg">
            A premium cognitive legal infrastructure connecting multi-firm vaults, immutable blockchain audit events, and defense-grade client portals.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link to="/register" className="btn-primary text-xs uppercase tracking-wider px-8 py-3.5 gap-2 shadow-gold-md hover:scale-[1.02]">
              Enter Platform <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="btn-secondary text-xs uppercase tracking-wider px-8 py-3.5 hover:scale-[1.02]">
              Request Demo
            </button>
          </div>
        </div>
      </div>

      {/* Bouncing scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-10 opacity-70 hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gold-400/80">Scroll to Explore</span>
        <ChevronDown className="w-4 h-4 text-gold-400 animate-bounce" />
      </div>
    </section>
  )
}

function Features() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  // 6 feature cards: scales, vault, blockchain node, document seal, handshake, shield
  const featuresList = [
    {
      icon: <ScalesSvg className="w-6 h-6 text-gold-400" />,
      title: 'Balanced Case Intelligence',
      desc: 'Deep AI-backed timeline and evidentiary analysis mapped directly onto active matters for complete legal foresight.'
    },
    {
      icon: <VaultSvg className="w-6 h-6 text-gold-400" />,
      title: 'Evidentiary Vaults',
      desc: 'Military-grade client and partner vault sharing. AES-256 encrypted payloads backed by decentralized IPFS pinning.'
    },
    {
      icon: <Activity className="w-6 h-6 text-gold-400" />,
      title: 'Hyperledger Blockchain Node',
      desc: 'Permissioned decentralized network logging metadata digests and cryptographic hashes into immutable state.'
    },
    {
      icon: <DocumentSealSvg className="w-6 h-6 text-gold-400" />,
      title: 'Embossed Digital Seals',
      desc: 'State-certified wax seal generators embedding verifiable proof of authorship and time directly into PDF structures.'
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-gold-400" />,
      title: 'Decentralized Handshakes',
      desc: 'Mutually validated legal workflows enabling opposing firms to agree on schedules, evidence checklists, and parameters.'
    },
    {
      icon: <Shield className="w-6 h-6 text-gold-400" />,
      title: 'Shield Gate ACL',
      desc: 'Zero-trust role constraints securing information down to specific case nodes, directories, and communication logs.'
    }
  ]

  return (
    <section id="technology" className="relative py-28 px-6 bg-navy-900 border-t border-gold-500/10">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-20 text-center mx-auto">
          <p className="text-[10px] font-bold text-gold-500 uppercase tracking-[0.25em] mb-4">Architecture</p>
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-gold-300 leading-tight">
            Designed for Authoritative Legal Governance
          </h2>
          <div className="w-16 h-px bg-gold-500/30 mx-auto mt-6" />
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((f, i) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-gold-500/10 bg-navy-950/40 p-8 shadow-card backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-gold-sm"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s, border-color 0.3s, shadow 0.3s`
              }}
            >
              {/* Glowing top border indicator */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center mb-6 group-hover:bg-gold-500/20 transition-all duration-300">
                {f.icon}
              </div>
              <h3 className="font-serif text-xl font-semibold text-gold-300 mb-3 group-hover:text-gold-100 transition-colors duration-300">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section id="how-it-works" className="relative py-28 px-6 bg-navy-950 border-t border-gold-500/10">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-20 text-center mx-auto">
          <p className="text-[10px] font-bold text-gold-500 uppercase tracking-[0.25em] mb-4">The Workflow</p>
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-gold-300 leading-tight">
            Three Epochs of Evidence Custody
          </h2>
          <div className="w-16 h-px bg-gold-500/30 mx-auto mt-6" />
        </div>

        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
          {/* Roman columns connect line */}
          <div className="hidden lg:block absolute top-1/2 left-20 right-20 h-0.5 bg-gradient-to-r from-gold-500/10 via-gold-500/30 to-gold-500/10 -translate-y-1/2 pointer-events-none" />

          {[
            {
              roman: 'I',
              title: 'Ingest & Encrypt',
              desc: 'Drag evidentiary documents into legal data rooms. Payloads are instantly encrypted client-side using unique AES-256 keys.'
            },
            {
              roman: 'II',
              title: 'Anchor on Ledger',
              desc: 'Cryptographic block hashes are generated. The metadata hash triggers smart contracts on Hyperledger Fabric for immutable provenance.'
            },
            {
              roman: 'III',
              title: 'Decrypt & Collaborate',
              desc: 'Share verified files securely. Authenticated lawyers, partners, and judges decrypt payloads locally via ECIES keys.'
            }
          ].map((step, idx) => (
            <div
              key={step.roman}
              className="relative rounded-2xl border border-gold-500/10 bg-navy-900/50 p-8 shadow-card backdrop-blur-md overflow-hidden group hover:border-gold-500/20 transition-all duration-300"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity 0.6s ease ${idx * 0.15}s, transform 0.6s ease ${idx * 0.15}s`
              }}
            >
              {/* Giant roman numeral behind card */}
              <div className="absolute bottom-4 right-6 font-serif font-bold text-7xl text-gold-500/[0.04] select-none pointer-events-none transition-all duration-300 group-hover:text-gold-500/[0.08]">
                {step.roman}
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-500/30 bg-gold-500/10 text-xs font-bold text-gold-300 mb-6">
                {idx + 1}
              </div>
              <h3 className="font-serif text-xl font-bold text-gold-300 mb-3">{step.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StatsBar() {
  return (
    <section className="relative py-16 bg-navy-900/80 border-y border-gold-500/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { value: 10000, suffix: '+', label: 'Cases Managed' },
            { value: 99.9, suffix: '%', label: 'Uptime SLA' },
            { value: 256, suffix: '-bit', label: 'AES Encryption' },
            { value: 2, suffix: ' Compliance', label: 'SOC 2 Compliant' },
          ].map((s) => (
            <div key={s.label} className="text-center px-4">
              <p className="mb-1">
                {typeof s.value === 'number' ? (
                  <Counter value={s.value} suffix={s.suffix} />
                ) : (
                  <span className="font-mono text-3xl md:text-4xl font-bold text-gold-300">{s.value}</span>
                )}
              </p>
              <p className="text-xs font-semibold tracking-wider text-text-secondary uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  const reviews = [
    {
      quote: "PangoChain has transformed our evidentiary file chain. In court, demonstrating blockchain-based file integrity eliminates defense claims of file tampering completely.",
      name: "Marcus Vance",
      firm: "Vance & Associates LLP",
      status: "verified" as const
    },
    {
      quote: "The combination of IPFS document custody and local ECIES key cryptography gives our partners maximum confidence in handling class-action litigation material.",
      name: "Sarah Sterling",
      firm: "Sterling Chambers Group",
      status: "verified" as const
    }
  ]

  return (
    <section id="testimonials" className="relative py-28 px-6 bg-navy-950 border-t border-gold-500/10">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-20 text-center mx-auto">
          <p className="text-[10px] font-bold text-gold-500 uppercase tracking-[0.25em] mb-4">Adoption</p>
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-gold-300 leading-tight">
            Endorsed by Managing Partners
          </h2>
          <div className="w-16 h-px bg-gold-500/30 mx-auto mt-6" />
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {reviews.map((r, i) => (
            <div
              key={r.name}
              className="card relative flex flex-col justify-between group hover:border-gold-500/20"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(35px)',
                transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`
              }}
            >
              {/* Decorative quotation marks SVG */}
              <div className="absolute top-4 right-6 text-gold-500/5 select-none pointer-events-none font-serif text-8xl">
                “
              </div>

              <div>
                <p className="text-text-primary text-base italic leading-relaxed mb-8 relative z-10">
                  "{r.quote}"
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-gold-500/10 pt-6 mt-auto">
                <div>
                  <h4 className="font-serif text-base font-bold text-gold-300">{r.name}</h4>
                  <p className="text-xs text-text-secondary">{r.firm}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-500 tracking-wider">SECURE ADOPTER</span>
                  <WaxSealSvg status={r.status} className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="relative bg-navy-950 border-t border-gold-500/20 py-16 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 border border-gold-500/20 p-1 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain Logo" className="h-full w-auto filter-gold" />
          </div>
          <div>
            <p className="font-serif text-xs font-bold text-gold-300 tracking-wide">PangoChain</p>
            <p className="text-[8px] font-semibold text-text-secondary uppercase">Secure Infrastructure</p>
          </div>
        </div>

        <p className="text-xs text-text-secondary font-mono">
          © {new Date().getFullYear()} PangoChain. Built for enterprise justice. Fabric 2.4 active nodes.
        </p>

        <div className="flex items-center gap-6 text-xs text-text-secondary font-semibold uppercase tracking-wider">
          <a href="#" className="hover:text-gold-300 transition-colors duration-300">Privacy Policy</a>
          <a href="#" className="hover:text-gold-300 transition-colors duration-300">Platform Terms</a>
          <a href="#" className="hover:text-gold-300 transition-colors duration-300">Security Disclosures</a>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-navy-950 text-text-primary selection:bg-gold-500/20 selection:text-gold-300 overflow-x-hidden">
      <LandingNav />
      <Hero />
      <Features />
      <HowItWorks />
      <StatsBar />
      <Testimonials />
      <Footer />
    </div>
  )
}
