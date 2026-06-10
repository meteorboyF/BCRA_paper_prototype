import React from 'react'

/**
 * Gold engraving artwork suite — fine-line, etching-style legal iconography.
 * Every stroke uses currentColor so the palette follows the theme (gold on navy
 * in dark mode, bronze on parchment in light mode). Density is achieved with
 * programmatic hatching, radial rays, and layered contour lines, echoing
 * banknote / intaglio engraving.
 */

const rad = (deg: number) => (deg * Math.PI) / 180

/** Shared <defs> with intaglio hatch patterns. Include once per <svg>. */
function EngraveDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      <pattern id={`${idPrefix}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.5" opacity="0.35" />
      </pattern>
      <pattern id={`${idPrefix}-crosshatch`} width="7" height="7" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="7" y2="7" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
        <line x1="7" y1="0" x2="0" y2="7" stroke="currentColor" strokeWidth="0.4" opacity="0.22" />
      </pattern>
      <pattern id={`${idPrefix}-stipple`} width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.6" fill="currentColor" opacity="0.3" />
        <circle cx="7" cy="8" r="0.5" fill="currentColor" opacity="0.22" />
        <circle cx="8" cy="2" r="0.4" fill="currentColor" opacity="0.18" />
      </pattern>
      <radialGradient id={`${idPrefix}-fade`} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="72%" stopColor="white" stopOpacity="0.55" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <mask id={`${idPrefix}-vignette`}>
        <rect width="100%" height="100%" fill={`url(#${idPrefix}-fade)`} />
      </mask>
    </defs>
  )
}

/** Radiating engraved sunburst — fine rays of alternating length, like a seal's glory. */
function Sunburst({ cx, cy, inner, outer, rays = 60, opacity = 0.5 }: {
  cx: number; cy: number; inner: number; outer: number; rays?: number; opacity?: number
}) {
  return (
    <g opacity={opacity}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * 360
        const long = i % 2 === 0
        const r2 = long ? outer : inner + (outer - inner) * 0.55
        const x1 = cx + inner * Math.cos(rad(a))
        const y1 = cy + inner * Math.sin(rad(a))
        const x2 = cx + r2 * Math.cos(rad(a))
        const y2 = cy + r2 * Math.sin(rad(a))
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={long ? 0.7 : 0.4} opacity={long ? 0.8 : 0.5} />
      })}
    </g>
  )
}

/** Engraved laurel branch sweeping along an arc. mirror=true flips it. */
function LaurelBranch({ cx, cy, radius, startDeg, endDeg, leaves = 13, mirror = false, opacity = 0.7 }: {
  cx: number; cy: number; radius: number; startDeg: number; endDeg: number; leaves?: number; mirror?: boolean; opacity?: number
}) {
  const pts = Array.from({ length: leaves + 1 }, (_, i) => {
    const a = startDeg + ((endDeg - startDeg) * i) / leaves
    return { a, x: cx + radius * Math.cos(rad(a)), y: cy + radius * Math.sin(rad(a)) }
  })
  const stemPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <g opacity={opacity} transform={mirror ? `translate(${2 * cx},0) scale(-1,1)` : undefined}>
      <path d={stemPath} fill="none" stroke="currentColor" strokeWidth="1.1" />
      {pts.slice(0, -1).map((p, i) => {
        const tangent = p.a + 90
        const len = 14 - i * 0.45
        const lx = p.x + len * Math.cos(rad(tangent - 28))
        const ly = p.y + len * Math.sin(rad(tangent - 28))
        const rx = p.x + len * Math.cos(rad(tangent + 28))
        const ry = p.y + len * Math.sin(rad(tangent + 28))
        return (
          <g key={i}>
            <path d={`M${p.x},${p.y} Q${(p.x + lx) / 2 - 3},${(p.y + ly) / 2} ${lx},${ly}`} fill="none" stroke="currentColor" strokeWidth="0.7" />
            <path d={`M${p.x},${p.y} Q${(p.x + rx) / 2 + 3},${(p.y + ry) / 2} ${rx},${ry}`} fill="none" stroke="currentColor" strokeWidth="0.7" />
            <circle cx={p.x} cy={p.y} r="1" fill="currentColor" opacity="0.6" />
          </g>
        )
      })}
    </g>
  )
}

/** Ornate corner filigree — engraved scrollwork for framing a page or hero. */
export function FiligreeCornerSvg({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 220 220" fill="none" className={`text-gold-500 ${className}`} {...props}>
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        {/* Outer rule pair */}
        <path d="M4 216 V40 Q4 4 40 4 H216" strokeWidth="1.4" opacity="0.8" />
        <path d="M12 216 V46 Q12 12 46 12 H216" strokeWidth="0.6" opacity="0.5" />
        {/* Primary volute */}
        <path d="M40 40 C95 28 118 52 110 84 C104 110 76 116 62 100 C50 86 58 66 76 66 C88 66 94 76 88 86" strokeWidth="1.2" opacity="0.9" />
        {/* Counter-scroll */}
        <path d="M40 40 C28 95 52 118 84 110 C110 104 116 76 100 62 C86 50 66 58 66 76 C66 88 76 94 86 88" strokeWidth="1.2" opacity="0.9" />
        {/* Sprays of engraved fronds */}
        <path d="M112 86 C150 70 178 72 206 92" strokeWidth="0.9" opacity="0.7" />
        <path d="M112 86 C146 84 172 94 192 116" strokeWidth="0.7" opacity="0.55" />
        <path d="M86 112 C70 150 72 178 92 206" strokeWidth="0.9" opacity="0.7" />
        <path d="M86 112 C84 146 94 172 116 192" strokeWidth="0.7" opacity="0.55" />
        {/* Leaf ticks along the fronds */}
        {Array.from({ length: 7 }, (_, i) => {
          const t = 0.18 + i * 0.115
          const x = 112 + (206 - 112) * t
          const y = 86 + (92 - 86) * t - Math.sin(t * Math.PI) * 16
          return <path key={`h${i}`} d={`M${x},${y} q6,-9 14,-10`} strokeWidth="0.6" opacity="0.6" />
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const t = 0.18 + i * 0.115
          const y = 112 + (206 - 112) * t
          const x = 86 + (92 - 86) * t - Math.sin(t * Math.PI) * 16
          return <path key={`v${i}`} d={`M${x},${y} q-9,6 -10,14`} strokeWidth="0.6" opacity="0.6" />
        })}
        {/* Seed pearls */}
        <circle cx="76" cy="76" r="2.2" fill="currentColor" opacity="0.8" />
        <circle cx="40" cy="40" r="1.4" fill="currentColor" opacity="0.6" />
        <circle cx="206" cy="92" r="1.2" fill="currentColor" opacity="0.5" />
        <circle cx="92" cy="206" r="1.2" fill="currentColor" opacity="0.5" />
      </g>
    </svg>
  )
}

/** Finely engraved Lady Justice — hatched gown, chained scales, sword, glory of rays. */
export function EngravedJusticeSvg({ className = '', idPrefix = 'ej', ...props }: React.SVGProps<SVGSVGElement> & { idPrefix?: string }) {
  return (
    <svg viewBox="0 0 480 720" fill="none" className={`text-gold-500 ${className}`} {...props}>
      <EngraveDefs idPrefix={idPrefix} />

      {/* Glory of rays behind the head */}
      <Sunburst cx={240} cy={120} inner={56} outer={150} rays={72} opacity={0.4} />
      <circle cx="240" cy="120" r="54" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <circle cx="240" cy="120" r="48" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 3" opacity="0.5" />

      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* ── Head ─────────────────────────────────────── */}
        <path d="M222 108 C222 88 258 88 258 108 C258 124 252 136 240 138 C228 136 222 124 222 108 Z" strokeWidth="1.6" />
        {/* Hair waves */}
        <path d="M222 104 C226 92 254 92 258 104" strokeWidth="0.8" opacity="0.7" />
        <path d="M220 112 C214 124 216 136 224 146" strokeWidth="0.8" opacity="0.6" />
        <path d="M260 112 C266 124 264 136 256 146" strokeWidth="0.8" opacity="0.6" />
        {/* Blindfold — double band with hatch shading */}
        <path d="M219 112 L261 112 L261 121 L219 121 Z" strokeWidth="1.3" fill={`url(#${idPrefix}-hatch)`} />
        <path d="M261 113 C272 110 278 104 281 96" strokeWidth="0.9" opacity="0.8" />
        <path d="M261 119 C273 118 280 112 284 104" strokeWidth="0.7" opacity="0.6" />
        {/* Diadem */}
        <path d="M224 96 L232 82 L240 92 L248 80 L256 96" strokeWidth="1.1" />
        <circle cx="240" cy="76" r="2" fill="currentColor" opacity="0.9" />

        {/* ── Neck and shoulders ───────────────────────── */}
        <path d="M232 138 L230 156 M248 138 L250 156" strokeWidth="1.2" />
        <path d="M196 178 C210 162 226 156 240 156 C254 156 270 162 284 178" strokeWidth="1.6" />

        {/* ── Raised left arm holding the scales ───────── */}
        <path d="M204 172 C176 160 142 150 112 142" strokeWidth="1.7" />
        <path d="M208 180 C182 170 150 160 122 152" strokeWidth="0.8" opacity="0.5" />
        {/* Hand */}
        <path d="M112 142 C106 140 102 142 100 146" strokeWidth="1.2" />
        {/* Scales: hanger, beam with finials */}
        <path d="M104 146 L104 170" strokeWidth="1.3" />
        <path d="M44 170 L164 170" strokeWidth="2" />
        <circle cx="104" cy="170" r="3.4" fill="currentColor" opacity="0.9" />
        <path d="M40 170 q-4 0 -5 -5 M168 170 q4 0 5 -5" strokeWidth="1" opacity="0.8" />
        {/* Chains — fine dashed verticals */}
        <path d="M46 172 L34 216 M46 172 L58 216" strokeWidth="0.7" strokeDasharray="3 2.5" />
        <path d="M162 172 L150 216 M162 172 L174 216" strokeWidth="0.7" strokeDasharray="3 2.5" />
        {/* Pans with hatch shading + contour */}
        <path d="M26 216 H66 C66 230 58 238 46 238 C34 238 26 230 26 216 Z" strokeWidth="1.3" fill={`url(#${idPrefix}-hatch)`} />
        <path d="M142 216 H182 C182 230 174 238 162 238 C150 238 142 230 142 216 Z" strokeWidth="1.3" fill={`url(#${idPrefix}-hatch)`} />
        <path d="M30 222 H62 M146 222 H178" strokeWidth="0.5" opacity="0.6" />

        {/* ── Right arm with sword ─────────────────────── */}
        <path d="M276 172 C304 164 330 160 352 162" strokeWidth="1.7" />
        <path d="M272 180 C300 172 326 168 348 170" strokeWidth="0.8" opacity="0.5" />
        {/* Crossguard */}
        <path d="M340 148 L368 184" strokeWidth="2.4" />
        <path d="M340 148 q-6 -4 -6 -10 M368 184 q6 4 10 4" strokeWidth="1" opacity="0.8" />
        {/* Blade — twin edge lines with center fuller */}
        <path d="M356 164 L444 56" strokeWidth="1.8" />
        <path d="M350 158 L438 50 M362 170 L450 62" strokeWidth="0.6" opacity="0.55" />
        <path d="M444 56 L452 44 L450 58 Z" strokeWidth="1" fill="currentColor" opacity="0.7" />
        {/* Grip and pommel */}
        <path d="M352 168 L336 186" strokeWidth="2.6" />
        <path d="M338 172 l6 6 M344 166 l6 6" strokeWidth="0.7" opacity="0.7" />
        <circle cx="332" cy="190" r="4.5" strokeWidth="1.3" />
        <circle cx="332" cy="190" r="1.6" fill="currentColor" />

        {/* ── Gown: layered contour folds + hatch shade ── */}
        <path d="M196 178 C186 240 178 320 168 400 C160 470 150 540 142 600 L338 600 C330 540 320 470 312 400 C302 320 294 240 284 178"
          strokeWidth="1.7" fill={`url(#${idPrefix}-stipple)`} />
        {/* Fold lines — long graceful sweeps */}
        <path d="M214 190 C206 280 200 380 192 470 C188 516 184 558 180 596" strokeWidth="0.8" opacity="0.65" />
        <path d="M240 196 C238 300 238 420 238 596" strokeWidth="0.8" opacity="0.6" />
        <path d="M266 190 C274 280 280 380 288 470 C292 516 296 558 300 596" strokeWidth="0.8" opacity="0.65" />
        <path d="M226 220 C222 320 218 440 212 560" strokeWidth="0.5" opacity="0.45" />
        <path d="M254 220 C258 320 262 440 268 560" strokeWidth="0.5" opacity="0.45" />
        {/* Sash with crosshatch */}
        <path d="M204 250 C228 262 252 262 278 250 L282 274 C254 288 226 288 200 274 Z" strokeWidth="1.1" fill={`url(#${idPrefix}-crosshatch)`} />
        {/* Hem shading */}
        <path d="M150 568 C200 584 280 584 330 568" strokeWidth="0.7" opacity="0.6" />
        <path d="M146 582 C200 598 280 598 334 582" strokeWidth="0.55" opacity="0.5" />

        {/* ── Pedestal ─────────────────────────────────── */}
        <path d="M128 600 H352 L342 632 H138 Z" strokeWidth="1.6" fill={`url(#${idPrefix}-hatch)`} />
        <path d="M112 632 H368 M100 650 H380" strokeWidth="1.2" opacity="0.85" />
        <path d="M104 660 H376" strokeWidth="0.6" opacity="0.5" />
        {/* Pedestal dentil ticks */}
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} x1={140 + i * 13.4} y1={636} x2={140 + i * 13.4} y2={646} strokeWidth="0.6" opacity="0.5" />
        ))}
        {/* Engraved motto plaque */}
        <rect x="196" y="610" width="88" height="16" rx="2" strokeWidth="0.9" opacity="0.9" />
        <path d="M202 618 h76" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.7" />
      </g>
    </svg>
  )
}

/** Fluted Roman column, engraved, designed to bleed off a page edge. */
export function EngravedColumnSvg({ className = '', idPrefix = 'ec', ...props }: React.SVGProps<SVGSVGElement> & { idPrefix?: string }) {
  return (
    <svg viewBox="0 0 160 720" fill="none" className={`text-gold-500 ${className}`} {...props}>
      <EngraveDefs idPrefix={idPrefix} />
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        {/* Capital — volutes and abacus */}
        <path d="M8 44 H152 M14 56 H146" strokeWidth="1.6" />
        <path d="M18 56 C18 78 32 88 50 88 L110 88 C128 88 142 78 142 56" strokeWidth="1.3" />
        <path d="M30 62 C26 74 34 82 44 82 C52 82 56 74 50 68 C46 64 40 66 40 72" strokeWidth="0.9" opacity="0.8" />
        <path d="M130 62 C134 74 126 82 116 82 C108 82 104 74 110 68 C114 64 120 66 120 72" strokeWidth="0.9" opacity="0.8" />
        <path d="M58 78 q22 10 44 0" strokeWidth="0.8" opacity="0.7" />
        {/* Shaft flutes */}
        {[36, 52, 68, 84, 100, 116].map((x, i) => (
          <line key={x} x1={x} y1={92} x2={x} y2={612} strokeWidth={i === 2 || i === 3 ? 1.2 : 0.7} opacity={i === 2 || i === 3 ? 0.85 : 0.6} />
        ))}
        <path d="M28 92 L26 612 M132 92 L134 612" strokeWidth="1.5" />
        {/* Entasis shading on the right side */}
        <rect x="112" y="96" width="20" height="512" fill={`url(#${idPrefix}-hatch)`} stroke="none" />
        {/* Base rings */}
        <path d="M22 616 H138 M16 632 H144 M8 652 H152" strokeWidth="1.5" />
        <path d="M22 616 C22 624 18 630 16 632 M138 616 C138 624 142 630 144 632" strokeWidth="1" opacity="0.8" />
        <rect x="8" y="652" width="144" height="20" strokeWidth="1.4" fill={`url(#${idPrefix}-hatch)`} />
      </g>
    </svg>
  )
}

/**
 * Full-bleed engraved scene for the global backdrop: glory rays, Lady Justice
 * on the right, column on the left, laurel arc and ornaments at the base.
 * Masked by a radial vignette so edges melt into the page.
 */
export function EngravedLawScene({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={`text-gold-500 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <EngraveDefs idPrefix="scene" />
      <g mask="url(#scene-vignette)">
        {/* Architectural glory at top center */}
        <Sunburst cx={800} cy={-80} inner={180} outer={460} rays={96} opacity={0.32} />
        <circle cx="800" cy="-80" r="300" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        <circle cx="800" cy="-80" r="340" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 5" opacity="0.25" />
        <circle cx="800" cy="-80" r="390" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />

        {/* Left column bleeding off-screen */}
        <g opacity="0.5" transform="translate(-30, 150) scale(1.05)">
          <EngravedColumnInline />
        </g>

        {/* Lady Justice on the right */}
        <g opacity="0.6" transform="translate(1130, 90) scale(0.96)">
          <EngravedJusticeInline />
        </g>

        {/* Laurel arc cradling the lower center */}
        <LaurelBranch cx={800} cy={520} radius={420} startDeg={118} endDeg={170} leaves={14} opacity={0.4} />
        <LaurelBranch cx={800} cy={520} radius={420} startDeg={62} endDeg={10} leaves={14} opacity={0.4} />

        {/* Scattered engraved stars */}
        {[[210, 120, 1], [420, 70, 0.8], [630, 190, 1.1], [1010, 90, 0.9], [1240, 60, 0.7], [340, 320, 0.8], [1450, 280, 1], [560, 60, 0.6], [900, 250, 0.7], [120, 460, 0.9]].map(([x, y, s], i) => (
          <g key={i} opacity={0.45} transform={`translate(${x},${y}) scale(${s})`}>
            <path d="M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z" stroke="currentColor" strokeWidth="0.6" fill="none" />
          </g>
        ))}

        {/* Base rules — double engraved frame line along the bottom */}
        <path d="M120 860 H1480" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        <path d="M180 872 H1420" stroke="currentColor" strokeWidth="0.4" opacity="0.2" />
      </g>
    </svg>
  )
}

/* Inline (defs-free) variants reused inside the composed scene — they rely on
   the scene's own EngraveDefs via the shared "scene" id prefix. */
function EngravedJusticeInline() {
  return (
    <g>
      <Sunburst cx={240} cy={120} inner={56} outer={150} rays={72} opacity={0.4} />
      <circle cx="240" cy="120" r="54" stroke="currentColor" strokeWidth="0.7" opacity="0.5" fill="none" />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M222 108 C222 88 258 88 258 108 C258 124 252 136 240 138 C228 136 222 124 222 108 Z" strokeWidth="1.6" />
        <path d="M219 112 L261 112 L261 121 L219 121 Z" strokeWidth="1.3" fill="url(#scene-hatch)" />
        <path d="M224 96 L232 82 L240 92 L248 80 L256 96" strokeWidth="1.1" />
        <path d="M232 138 L230 156 M248 138 L250 156" strokeWidth="1.2" />
        <path d="M196 178 C210 162 226 156 240 156 C254 156 270 162 284 178" strokeWidth="1.6" />
        <path d="M204 172 C176 160 142 150 112 142" strokeWidth="1.7" />
        <path d="M104 146 L104 170" strokeWidth="1.3" />
        <path d="M44 170 L164 170" strokeWidth="2" />
        <circle cx="104" cy="170" r="3.4" fill="currentColor" opacity="0.9" />
        <path d="M46 172 L34 216 M46 172 L58 216" strokeWidth="0.7" strokeDasharray="3 2.5" />
        <path d="M162 172 L150 216 M162 172 L174 216" strokeWidth="0.7" strokeDasharray="3 2.5" />
        <path d="M26 216 H66 C66 230 58 238 46 238 C34 238 26 230 26 216 Z" strokeWidth="1.3" fill="url(#scene-hatch)" />
        <path d="M142 216 H182 C182 230 174 238 162 238 C150 238 142 230 142 216 Z" strokeWidth="1.3" fill="url(#scene-hatch)" />
        <path d="M276 172 C304 164 330 160 352 162" strokeWidth="1.7" />
        <path d="M340 148 L368 184" strokeWidth="2.4" />
        <path d="M356 164 L444 56" strokeWidth="1.8" />
        <path d="M350 158 L438 50 M362 170 L450 62" strokeWidth="0.6" opacity="0.55" />
        <path d="M352 168 L336 186" strokeWidth="2.6" />
        <circle cx="332" cy="190" r="4.5" strokeWidth="1.3" />
        <path d="M196 178 C186 240 178 320 168 400 C160 470 150 540 142 600 L338 600 C330 540 320 470 312 400 C302 320 294 240 284 178" strokeWidth="1.7" fill="url(#scene-stipple)" />
        <path d="M214 190 C206 280 200 380 192 470 C188 516 184 558 180 596" strokeWidth="0.8" opacity="0.65" />
        <path d="M240 196 C238 300 238 420 238 596" strokeWidth="0.8" opacity="0.6" />
        <path d="M266 190 C274 280 280 380 288 470 C292 516 296 558 300 596" strokeWidth="0.8" opacity="0.65" />
        <path d="M204 250 C228 262 252 262 278 250 L282 274 C254 288 226 288 200 274 Z" strokeWidth="1.1" fill="url(#scene-crosshatch)" />
        <path d="M128 600 H352 L342 632 H138 Z" strokeWidth="1.6" fill="url(#scene-hatch)" />
        <path d="M112 632 H368 M100 650 H380" strokeWidth="1.2" opacity="0.85" />
      </g>
    </g>
  )
}

function EngravedColumnInline() {
  return (
    <g stroke="currentColor" strokeLinecap="round" fill="none">
      <path d="M8 44 H152 M14 56 H146" strokeWidth="1.6" />
      <path d="M18 56 C18 78 32 88 50 88 L110 88 C128 88 142 78 142 56" strokeWidth="1.3" />
      {[36, 52, 68, 84, 100, 116].map((x, i) => (
        <line key={x} x1={x} y1={92} x2={x} y2={612} strokeWidth={i === 2 || i === 3 ? 1.2 : 0.7} opacity={i === 2 || i === 3 ? 0.85 : 0.6} />
      ))}
      <path d="M28 92 L26 612 M132 92 L134 612" strokeWidth="1.5" />
      <rect x="112" y="96" width="20" height="512" fill="url(#scene-hatch)" stroke="none" />
      <path d="M22 616 H138 M16 632 H144 M8 652 H152" strokeWidth="1.5" />
      <rect x="8" y="652" width="144" height="20" strokeWidth="1.4" fill="url(#scene-hatch)" />
    </g>
  )
}

/**
 * Fixed, full-viewport engraved backdrop. Sits at z-0 under all content,
 * never intercepts pointer events, and breathes with a slow glow.
 */
export function GoldEngravingBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="gold-engraving-backdrop"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <EngravedLawScene className="engraving-backdrop h-full w-full" />
      {/* Filigree frame corners */}
      <FiligreeCornerSvg className="engraving-corner absolute left-3 top-3 h-36 w-36" />
      <FiligreeCornerSvg className="engraving-corner absolute right-3 top-3 h-36 w-36 -scale-x-100" />
      <FiligreeCornerSvg className="engraving-corner absolute bottom-3 left-3 h-36 w-36 -scale-y-100" />
      <FiligreeCornerSvg className="engraving-corner absolute bottom-3 right-3 h-36 w-36 -scale-x-100 -scale-y-100" />
    </div>
  )
}
