import React, { useEffect, useRef } from 'react'

// 1. <JusticeSvg />: Stylized line-art Lady Justice (gold strokes, geometric/modern)
export const JusticeSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 400 600"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-full max-h-[500px] text-gold-500 stroke-current ${props.className || ''}`}
    {...props}
  >
    {/* Geometric border */}
    <rect x="10" y="10" width="380" height="580" rx="4" strokeWidth="1" strokeOpacity="0.2" />
    <rect x="15" y="15" width="370" height="570" rx="2" strokeWidth="0.5" strokeOpacity="0.1" />
    
    {/* Center pillar silhouette */}
    <path d="M190 590 V450" strokeWidth="2" strokeOpacity="0.15" />
    <path d="M160 590 H240" strokeWidth="2" strokeOpacity="0.2" />
    
    {/* Blind Lady Justice details */}
    {/* Head / Blindfold / Crown */}
    <circle cx="200" cy="90" r="22" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.4" />
    <circle cx="200" cy="90" r="15" strokeWidth="2" />
    {/* Crown spikes */}
    <path d="M190 73 L200 60 L210 73 M185 78 L200 60 L215 78" strokeWidth="1.5" strokeLinecap="round" />
    {/* Blindfold */}
    <path d="M185 90 H215" strokeWidth="4" strokeLinecap="square" />
    
    {/* Neck & Shoulders */}
    <path d="M185 105 L200 120 L215 105" strokeWidth="2" />
    <path d="M140 145 C160 135 180 130 200 130 C220 130 240 135 260 145" strokeWidth="2" strokeLinecap="round" />
    
    {/* Spine/Body line */}
    <path d="M200 120 V380" strokeWidth="1.5" strokeOpacity="0.5" />
    
    {/* Left Arm (raised, holding Scales) */}
    <path d="M150 140 L100 125 L60 115" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Scales hanger */}
    <path d="M60 115 V135" strokeWidth="1.5" />
    {/* Scales Beam */}
    <path d="M30 135 H90" strokeWidth="2.5" strokeLinecap="round" />
    {/* Scales left pan */}
    <path d="M30 135 L15 175 H45 Z" strokeWidth="1.5" strokeLinejoin="round" />
    {/* Scales right pan */}
    <path d="M90 135 L75 175 H105 Z" strokeWidth="1.5" strokeLinejoin="round" />
    
    {/* Right Arm (holding Sword) */}
    <path d="M250 140 L300 155 L340 170" strokeWidth="2" strokeLinecap="round" />
    {/* Gilt Guard */}
    <path d="M335 155 L345 185" strokeWidth="3" strokeLinecap="round" />
    {/* Sword Blade */}
    <path d="M340 170 L380 70" strokeWidth="2.5" strokeLinecap="round" />
    {/* Grip and Pommel */}
    <path d="M340 170 L328 175" strokeWidth="3" />
    <circle cx="325" cy="176" r="3" fill="currentColor" />
    
    {/* Gown lines / abstract drapes */}
    <path d="M160 170 C180 200 200 230 200 280 C200 330 180 370 170 450" strokeWidth="1.5" strokeOpacity="0.4" />
    <path d="M240 170 C220 200 200 230 200 280 C200 330 220 370 230 450" strokeWidth="1.5" strokeOpacity="0.4" />
    <path d="M200 170 C190 220 190 300 200 450" strokeWidth="1" strokeOpacity="0.2" />
    
    {/* Base Pedestal */}
    <path d="M140 450 H260 L240 500 H160 Z" strokeWidth="2" strokeLinejoin="round" />
    <path d="M120 500 H280 M110 525 H290" strokeWidth="1.5" strokeOpacity="0.5" />
    
    {/* Halo & Light rays (fine geometric lines) */}
    <circle cx="200" cy="90" r="50" strokeWidth="0.5" strokeOpacity="0.2" />
    <line x1="200" y1="30" x2="200" y2="10" strokeWidth="0.75" strokeOpacity="0.3" />
    <line x1="250" y1="90" x2="270" y2="90" strokeWidth="0.75" strokeOpacity="0.3" />
    <line x1="150" y1="90" x2="130" y2="90" strokeWidth="0.75" strokeOpacity="0.3" />
    <line x1="235" y1="55" x2="249" y2="41" strokeWidth="0.75" strokeOpacity="0.3" />
    <line x1="165" y1="55" x2="151" y2="41" strokeWidth="0.75" strokeOpacity="0.3" />
  </svg>
)

// 2. <ScalesSvg />: Minimalist balanced gold scales of justice
export const ScalesSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-6 h-6 text-gold-500 ${props.className || ''}`}
    {...props}
  >
    {/* Center pillar */}
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="9" y1="21" x2="15" y2="21" strokeWidth="2" />
    
    {/* Main horizontal beam */}
    <line x1="5" y1="7" x2="19" y2="7" strokeWidth="2" />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" />
    
    {/* Left scale plate */}
    <line x1="5" y1="7" x2="2" y2="15" />
    <line x1="5" y1="7" x2="8" y2="15" />
    <path d="M1.5 15 C1.5 17 8.5 17 8.5 15 Z" fill="currentColor" fillOpacity="0.1" />
    
    {/* Right scale plate */}
    <line x1="19" y1="7" x2="16" y2="15" />
    <line x1="19" y1="7" x2="22" y2="15" />
    <path d="M15.5 15 C15.5 17 22.5 17 22.5 15 Z" fill="currentColor" fillOpacity="0.1" />
  </svg>
)

// 3. <WaxSealSvg />: Circular wax seal with custom state badge
interface WaxSealProps extends React.SVGProps<SVGSVGElement> {
  status?: 'verified' | 'pending' | 'rejected'
}
export const WaxSealSvg: React.FC<WaxSealProps> = ({ status = 'verified', className = '', ...props }) => {
  const getColors = () => {
    switch (status) {
      case 'verified':
        return {
          seal: 'text-[#1A5C4A]',
          fill: 'rgba(26,92,74,0.06)',
          border: 'border-emerald-500/20',
          accent: '#34D399',
          label: 'VERIFIED'
        }
      case 'rejected':
        return {
          seal: 'text-[#8B1A1A]',
          fill: 'rgba(139,26,26,0.06)',
          border: 'border-rose-500/20',
          accent: '#F87171',
          label: 'REJECTED'
        }
      case 'pending':
      default:
        return {
          seal: 'text-[#A8893C]',
          fill: 'rgba(201,168,76,0.06)',
          border: 'border-gold-500/20',
          accent: '#E8D5A3',
          label: 'PENDING'
        }
    }
  }

  const info = getColors()

  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-12 h-12 inline-block shrink-0 ${info.seal} ${className}`}
      {...props}
    >
      {/* Intricate background pattern of the seal */}
      <path
        d="M 50,5 A 45,45 0 1,0 95,50 A 45,45 0 0,0 50,5 Z 
           M 50,11 A 39,39 0 1,1 89,50 A 39,39 0 0,1 50,11 Z"
        fill="currentColor"
        opacity="0.15"
      />
      {/* Wax melted border ring */}
      <path
        d="M50 8C26.8 8 8 26.8 8 50C8 53.2 8.3 56.4 9 59.5C9.8 63 11 66.5 13.5 69C16 71.5 19 72.8 22.5 73.5C25.5 74.2 28.5 74 31.5 74.8C34.8 75.5 37.8 77.8 41 79.5C44 81 47 82 50.5 82C54 82 57 81 60 79.5C63.2 77.8 66.2 75.5 69.5 74.8C72.5 74 75.5 74.2 78.5 73.5C82 72.8 85 71.5 87.5 69C90 66.5 91.2 63 92 59.5C92.7 56.4 93 53.2 93 50C93 26.8 74.2 8 50 8Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Inner design line */}
      <circle cx="50" cy="50" r="30" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
      
      {/* Status Icons */}
      {status === 'verified' && (
        <>
          <path d="M38 52L46 60L63 41" stroke={info.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M30 50 A20 20 0 1 1 70 50 A20 20 0 1 1 30 50" stroke={info.accent} strokeWidth="1" strokeOpacity="0.4" fill="none" />
        </>
      )}
      {status === 'rejected' && (
        <>
          <path d="M38 38L62 62M62 38L38 62" stroke={info.accent} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M30 50 A20 20 0 1 1 70 50 A20 20 0 1 1 30 50" stroke={info.accent} strokeWidth="1" strokeOpacity="0.4" fill="none" />
        </>
      )}
      {status === 'pending' && (
        <>
          {/* Hourglass */}
          <path d="M38 35H62 M38 65H62 M42 35L50 50 L42 65 M58 35L50 50 L58 65" stroke={info.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="50" cy="40" r="2" fill={info.accent} />
          <circle cx="50" cy="60" r="1" fill={info.accent} />
          <circle cx="49" cy="61" r="1.5" fill={info.accent} />
          <circle cx="51" cy="62" r="1" fill={info.accent} />
        </>
      )}
    </svg>
  )
}

// 4. <ChainLinkSvg />: Single chain link for audit logs
export const ChainLinkSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-5 h-5 text-gold-500 ${props.className || ''}`}
    {...props}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

// 5. <ColumnDividerSvg />: Roman column silhouette divider
export const ColumnDividerSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 60 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-12 h-24 text-gold-500/25 stroke-current ${props.className || ''}`}
    {...props}
  >
    {/* Capital */}
    <path d="M5 10H55 M10 17H50 M12 24H48" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 10C10 14 14 17 20 17 C26 17 34 17 40 17 C46 17 50 14 50 10" strokeWidth="1.5" />
    
    {/* Shaft fluting lines */}
    <line x1="18" y1="24" x2="18" y2="96" strokeWidth="1.5" />
    <line x1="24" y1="24" x2="24" y2="96" strokeWidth="1" />
    <line x1="30" y1="24" x2="30" y2="96" strokeWidth="2" strokeOpacity="0.8" />
    <line x1="36" y1="24" x2="36" y2="96" strokeWidth="1" />
    <line x1="42" y1="24" x2="42" y2="96" strokeWidth="1.5" />
    
    {/* Base */}
    <path d="M12 96H48 M10 103H50 M5 110H55" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 96C12 100 10 103 10 103 H50 C50 103 48 100 48 96" strokeWidth="1.5" />
  </svg>
)

// 6. <GavelSvg />: Stylized gavel for lawyer role
export const GavelSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-12 h-12 text-gold-500 ${props.className || ''}`}
    {...props}
  >
    <path d="m14 13-7.5 7.5c-.8.8-2 .8-2.8 0s-.8-2 0-2.8L11 10" />
    <path d="m16 16 3.5-3.5" />
    <path d="m8 8 3.5-3.5" />
    <path d="m11 5 6 6" />
    <path d="M5 21h14" strokeOpacity="0.4" />
    <path d="M12 18h4" strokeOpacity="0.4" />
    <path d="m14 2-3.5 3.5" strokeWidth="2" />
    <path d="m22 10-3.5 3.5" strokeWidth="2" />
    <rect x="11.2" y="3.3" width="7" height="11" transform="rotate(45 14.7 8.8)" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" />
  </svg>
)

// 7. <ConstellationBg />: Interactive constellation star network
export const ConstellationBg: React.FC<{ density?: number }> = ({ density = 45 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth || window.innerWidth
      canvas.height = canvas.offsetHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      r: number
      alpha: number
      alphaDir: number
    }> = Array.from({ length: density }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      r: 1 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.6,
      alphaDir: Math.random() > 0.5 ? 0.003 : -0.003
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const maxDist = 160

      // Update positions
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        // Bound collision
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        // Pulsing stars
        p.alpha += p.alphaDir
        if (p.alpha > 0.7 || p.alpha < 0.15) p.alphaDir *= -1

        // Draw star nodes
        ctx.fillStyle = `rgba(201, 168, 76, ${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw faint connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)

          if (d < maxDist) {
            const lineAlpha = (1 - d / maxDist) * 0.15 * Math.min(a.alpha, b.alpha)
            ctx.strokeStyle = `rgba(201, 168, 76, ${lineAlpha})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

// 8. <DocumentSealSvg />: Embossed legal seal decoration
export const DocumentSealSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    className={`w-10 h-10 text-gold-500/30 ${props.className || ''}`}
    {...props}
  >
    {/* Intricate circle weaves */}
    <circle cx="50" cy="50" r="45" strokeDasharray="4 2" />
    <circle cx="50" cy="50" r="41" />
    <circle cx="50" cy="50" r="37" strokeWidth="0.5" />
    <circle cx="50" cy="50" r="28" strokeDasharray="1 1" />
    
    {/* Stars on perimeter */}
    <path d="M 50 14 L 50 20 M 50 80 L 50 86 M 14 50 L 20 50 M 80 50 L 86 50" strokeWidth="1.5" />
    <path d="M 25 25 L 30 30 M 75 75 L 70 70 M 25 75 L 30 70 M 75 25 L 70 30" strokeWidth="1" />
    
    {/* Ribbon hanging down */}
    <path d="M43 70 L35 95 L50 88 L65 95 L57 70" strokeWidth="1" fill="currentColor" fillOpacity="0.05" />
  </svg>
)

// 9. <VaultSvg />: Stylized vault door
export const VaultSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-12 h-12 text-gold-500 ${props.className || ''}`}
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="2" strokeOpacity="0.3" />
    <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.04" />
    <circle cx="12" cy="12" r="5" />
    
    {/* Locking hinges spokes */}
    <path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" strokeWidth="0.75" strokeOpacity="0.4" />
    
    {/* Turn Wheel */}
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 9v1" />
    <path d="M12 14v1" />
    <path d="M9 12h1" />
    <path d="M14 12h1" />
  </svg>
)

// 10. <MonogramSvg />: Monogram monogram logo "PC"
export const MonogramSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-8 h-8 text-gold-500 fill-none ${props.className || ''}`}
    {...props}
  >
    {/* Background shield/circle outline */}
    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" />
    <circle cx="50" cy="50" r="41" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.1" />
    
    {/* Custom Serif "P" */}
    <path
      d="M32 72 V28 H46 C56 28 58 36 46 44 H32"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Custom Serif "C" overlay */}
    <path
      d="M68 36 C64 30 54 28 48 36 C42 44 42 56 48 64 C54 72 64 70 68 64"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Small gold details */}
    <circle cx="50" cy="17" r="2" fill="currentColor" />
    <circle cx="50" cy="83" r="2" fill="currentColor" />
  </svg>
)
