import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '../components/ui/ThemeToggle'

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('renders theme toggle button', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('defaults to dark mode when no preference is saved', () => {
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(localStorage.getItem('pangochain-theme')).toBe('dark')
  })

  it('restores light theme from localStorage if saved', () => {
    localStorage.setItem('pangochain-theme', 'light')
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('toggles theme on click and updates localStorage and HTML class', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    // First click: switch to light mode
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(localStorage.getItem('pangochain-theme')).toBe('light')

    // Second click: switch back to dark mode
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(localStorage.getItem('pangochain-theme')).toBe('dark')
  })
})
