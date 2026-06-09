function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`
    }
    return `rgb(var(${variableName}))`
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: withOpacity('--color-navy-950-rgb'),
          900: withOpacity('--color-navy-900-rgb'),
          800: withOpacity('--color-navy-800-rgb'),
        },
        gold: {
          300: withOpacity('--color-gold-300-rgb'),
          400: withOpacity('--color-gold-400-rgb'),
          500: withOpacity('--color-gold-500-rgb'),
          600: withOpacity('--color-gold-600-rgb'),
        },
        slate: {
          750: withOpacity('--color-slate-750-rgb'),
          800: withOpacity('--color-slate-800-rgb'),
        },
        // Preserve some core semantic aliases but map them beautifully
        primary: {
          DEFAULT: withOpacity('--color-primary-default-rgb'),
          50: withOpacity('--color-primary-50-rgb'),
          100: withOpacity('--color-primary-100-rgb'),
          500: withOpacity('--color-primary-500-rgb'),
          600: withOpacity('--color-primary-600-rgb'),
          900: withOpacity('--color-primary-900-rgb'),
        },
        accent: withOpacity('--color-accent-rgb'),
        surface: {
          DEFAULT: withOpacity('--color-surface-default-rgb'),
          card: withOpacity('--color-surface-card-rgb'),
          muted: withOpacity('--color-surface-muted-rgb'),
        },
        text: {
          primary: withOpacity('--color-text-primary-rgb'),
          secondary: withOpacity('--color-text-secondary-rgb'),
          muted: withOpacity('--color-text-muted-rgb'),
        },
        border: 'var(--color-border)',
        success: withOpacity('--color-success-rgb'),
        warning: withOpacity('--color-warning-rgb'),
        error: withOpacity('--color-error-rgb'),
        
        // Map emerald and rose utility color families to adjust nicely on light/dark mode
        emerald: {
          400: withOpacity('--color-emerald-400-rgb'),
          500: withOpacity('--color-emerald-500-rgb'),
          600: withOpacity('--color-emerald-600-rgb'),
        },
        rose: {
          300: withOpacity('--color-rose-300-rgb'),
          400: withOpacity('--color-rose-400-rgb'),
          500: withOpacity('--color-rose-500-rgb'),
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        heading: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', '"DM Sans"', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'drift': 'drift 20s ease-in-out infinite',
        'draw-line': 'draw-line 1.5s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(201,168,76,0.3)' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'gold-sm': 'var(--custom-shadow-sm)',
        'gold-md': 'var(--custom-shadow-md)',
        'gold-lg': 'var(--custom-shadow-lg)',
        'glass': 'var(--glass-glow)',
        'card': '0 4px 30px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
