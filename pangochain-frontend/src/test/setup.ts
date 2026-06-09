import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'
import { vi } from 'vitest'

// jsdom 26 exposes window.crypto but not window.crypto.subtle.
// Polyfill with Node 18's built-in Web Crypto so SubtleCrypto calls work in tests.
if (!window.crypto.subtle) {
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  })
}

// Mock framer-motion to bypass layout/raf timers in tests
vi.mock('framer-motion', () => {
  const React = require('react')
  const Dummy = React.forwardRef(({ children, ...props }: any, ref: any) => {
    const {
      variants, initial, animate, exit, transition, whileHover, whileTap,
      layoutId, drag, onDragStart, onDragEnd, onDrag, dragConstraints,
      dragElastic, dragMomentum, ...rest
    } = props;
    return React.createElement('div', { ...rest, ref }, children)
  })
  
  return {
    motion: {
      div: Dummy,
      span: Dummy,
      button: Dummy,
      p: Dummy,
      h1: Dummy,
      h2: Dummy,
      h3: Dummy,
      h4: Dummy,
      section: Dummy,
      aside: Dummy,
      header: Dummy,
      nav: Dummy,
      ul: Dummy,
      li: Dummy,
    },
    AnimatePresence: ({ children }: any) => children,
  }
})
