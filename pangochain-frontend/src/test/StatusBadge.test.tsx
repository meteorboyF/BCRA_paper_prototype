import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../components/ui/StatusBadge'

describe('StatusBadge', () => {
  it('renders ACTIVE badge with green classes', () => {
    render(<StatusBadge status="ACTIVE" />)
    const el = screen.getByText('Active')
    expect(el.className).toContain('bg-green-100')
    expect(el.className).toContain('text-green-800')
    expect(el.className).toContain('border-green-200')
  })

  it('renders CONFIDENTIAL badge with red classes', () => {
    render(<StatusBadge status="CONFIDENTIAL" />)
    const el = screen.getByText('Confidential')
    expect(el.className).toContain('bg-red-100')
    expect(el.className).toContain('text-red-700')
    expect(el.className).toContain('border-red-200')
  })

  it('renders VERIFIED badge with teal classes', () => {
    render(<StatusBadge status="VERIFIED" />)
    const el = screen.getByText('Verified')
    expect(el.className).toContain('bg-teal-100')
    expect(el.className).toContain('text-teal-700')
    expect(el.className).toContain('border-teal-200')
  })

  it('normalizes ACL_FALLBACK / "ACL FALLBACK" to amber', () => {
    render(<StatusBadge status="ACL FALLBACK" />)
    const el = screen.getByText('ACL Fallback')
    expect(el.className).toContain('bg-amber-100')
  })

  it('falls back to neutral with the raw label for unknown statuses', () => {
    render(<StatusBadge status="WHATEVER" />)
    const el = screen.getByText('WHATEVER')
    expect(el.className).toContain('bg-slate-100')
  })

  it('honours a children label override', () => {
    render(<StatusBadge status="ACTIVE">Live</StatusBadge>)
    expect(screen.getByText('Live')).toBeTruthy()
  })
})
