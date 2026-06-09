import { useEffect, useRef } from 'react'

type Variant = 'vivid' | 'auth' | 'app'

interface Config {
  count: number
  speed: number
  linkDist: number
  repulseDist: number
  repulseForce: number
  dotOpacity: number
  linkOpacity: number
  dotSizeMax: number
  colors: string[]
}

const CONFIGS: Record<Variant, Config> = {
  vivid: {
    count: 90,
    speed: 0.55,
    linkDist: 155,
    repulseDist: 130,
    repulseForce: 4.5,
    dotOpacity: 0.55,
    linkOpacity: 0.22,
    dotSizeMax: 3.5,
    colors: ['#1d6464', '#2a8f8f', '#1E3A5F', '#2563EB', '#3ab5b5'],
  },
  auth: {
    count: 60,
    speed: 0.35,
    linkDist: 140,
    repulseDist: 100,
    repulseForce: 3,
    dotOpacity: 0.35,
    linkOpacity: 0.14,
    dotSizeMax: 2.8,
    colors: ['#1d6464', '#2a8f8f', '#1E3A5F'],
  },
  app: {
    // Site-wide app background — shows through the transparent layout gutters.
    // Visible but calm so it never competes with content sitting in opaque cards.
    count: 70,
    speed: 0.6,
    linkDist: 140,
    repulseDist: 110,
    repulseForce: 2.5,
    dotOpacity: 0.45,
    linkOpacity: 0.2,
    dotSizeMax: 2.6,
    colors: ['#1d6464', '#2a8f8f', '#0E7490', '#1E3A5F', '#3ab5b5'],
  },
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  opacity: number
  opacityDir: number
  // square (true) or circle (false) — echoes pangolin tiles
  square: boolean
}

interface ParticlesBackgroundProps {
  variant?: Variant
  className?: string
}

export function ParticlesBackground({ variant = 'vivid', className = '' }: ParticlesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cfg = CONFIGS[variant]

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Listen on the parent element so the canvas can be pointer-events: none
    // while still tracking mouse position for the repulse effect.
    const container = canvas.parentElement ?? document.body
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 } }
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)

    // Build particles
    const particles: Particle[] = Array.from({ length: cfg.count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * cfg.speed * 2,
      vy: (Math.random() - 0.5) * cfg.speed * 2,
      r: 1 + Math.random() * (cfg.dotSizeMax - 1),
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      opacity: 0.1 + Math.random() * cfg.dotOpacity,
      opacityDir: Math.random() > 0.5 ? 1 : -1,
      square: Math.random() > 0.65,
    }))

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const mx = mouse.current.x
      const my = mouse.current.y

      // Update + draw particles
      for (const p of particles) {
        // Repulse from mouse
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < cfg.repulseDist && dist > 0) {
          const force = ((cfg.repulseDist - dist) / cfg.repulseDist) * cfg.repulseForce
          p.vx += (dx / dist) * force * 0.05
          p.vy += (dy / dist) * force * 0.05
        }

        // Speed cap
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > cfg.speed * 2.5) {
          p.vx = (p.vx / speed) * cfg.speed * 2.5
          p.vy = (p.vy / speed) * cfg.speed * 2.5
        }

        // Move
        p.x += p.vx
        p.y += p.vy

        // Bounce
        if (p.x < 0) { p.x = 0; p.vx *= -1 }
        if (p.x > W) { p.x = W; p.vx *= -1 }
        if (p.y < 0) { p.y = 0; p.vy *= -1 }
        if (p.y > H) { p.y = H; p.vy *= -1 }

        // Opacity pulse
        p.opacity += p.opacityDir * 0.003
        if (p.opacity > cfg.dotOpacity) { p.opacity = cfg.dotOpacity; p.opacityDir = -1 }
        if (p.opacity < 0.05) { p.opacity = 0.05; p.opacityDir = 1 }

        // Draw dot
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        if (p.square) {
          const s = p.r * 1.4
          ctx.beginPath()
          ctx.roundRect(p.x - s / 2, p.y - s / 2, s, s, 1)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Draw links
      ctx.globalAlpha = 1
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < cfg.linkDist) {
            const alpha = cfg.linkOpacity * (1 - d / cfg.linkDist)
            ctx.globalAlpha = alpha
            ctx.strokeStyle = a.color
            ctx.lineWidth = 0.7
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
    }
  }, [variant])

  // prefers-reduced-motion: render nothing if user has motion sensitivity enabled
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  )
}

export default ParticlesBackground
