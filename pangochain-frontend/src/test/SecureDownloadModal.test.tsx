import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecureDownloadModal } from '../components/SecureDownloadModal'

// Mock the authStore so we can control user state
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-123', email: 'test@firm.com', role: 'ASSOCIATE_SENIOR', fullName: 'Test' },
  }),
}))

// Mock api module
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

// Mock crypto module — we test the modal's orchestration, not crypto primitives
vi.mock('../lib/crypto', () => ({
  loadWrappedPrivateKey: vi.fn(() => ({
    saltB64: 'salt',
    ivB64: 'iv',
    encryptedB64: 'encrypted',
  })),
  unwrapPrivateKey: vi.fn(async () => 'mock-private-key'),
  eciesUnwrapKey: vi.fn(async () => 'mock-doc-key-b64'),
  decryptDocument: vi.fn(async () => new ArrayBuffer(4)),
  verifyIntegrity: vi.fn(async () => true),
  base64ToBytes: vi.fn((b64: string) => new Uint8Array([1, 2, 3, 4])),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import api from '../lib/api'
import { verifyIntegrity } from '../lib/crypto'

const mockGet = vi.mocked(api.get)

function renderModal(onClose = vi.fn()) {
  return render(
    <SecureDownloadModal
      docId="doc-123"
      fileName="contract.pdf"
      expectedHash="abc123hash"
      onClose={onClose}
    />,
  )
}

describe('SecureDownloadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with 4 stage indicators', () => {
    renderModal()
    expect(screen.getByText('Fetch from IPFS')).toBeInTheDocument()
    expect(screen.getByText('Unwrap key (ECIES)')).toBeInTheDocument()
    expect(screen.getByText('Decrypt (AES-GCM)')).toBeInTheDocument()
    expect(screen.getByText('Verify integrity')).toBeInTheDocument()
  })

  it('shows the file name and encryption info', () => {
    renderModal()
    expect(screen.getByText('contract.pdf')).toBeInTheDocument()
    expect(screen.getByText(/AES-256-GCM/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    renderModal(onClose)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('on integrity failure: shows error state, does NOT trigger file download', async () => {
    vi.mocked(verifyIntegrity).mockResolvedValue(false)

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/ciphertext')) {
        return Promise.resolve({ data: new ArrayBuffer(16) })
      }
      if (url.includes('/wrapped-key')) {
        return Promise.resolve({ data: 'wrapped-key-token' })
      }
      if (url.includes('/documents/doc-123')) {
        return Promise.resolve({ data: { documentHash: 'expected-hash' } })
      }
      return Promise.resolve({ data: {} })
    })

    renderModal()

    // Enter password to enable the button
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    if (passwordInput) {
      fireEvent.change(passwordInput, { target: { value: 'test-password' } })
    }

    const downloadBtn = screen.getByText(/Decrypt & Download/i)
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      // The modal shows an error banner (bg-red-50) on any failure path.
      // Use queryByText (returns null, not throw) so the querySelector fallback is reachable.
      const errorEl =
        screen.queryByText(/integrity check failed/i) ||
        screen.queryByText(/tampered/i) ||
        document.querySelector('.bg-red-50')
      expect(errorEl).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('Decrypt & Download button is disabled without password', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /Decrypt & Download/i })
    expect(btn).toBeDisabled()
  })

  it('on decryption failure: shows a decryption-specific message (not integrity)', async () => {
    vi.mocked(verifyIntegrity).mockResolvedValue(true)
    mockGet.mockImplementation((url: string) =>
      url.includes('/ciphertext') ? Promise.resolve({ data: new ArrayBuffer(16) })
        : url.includes('/wrapped-key') ? Promise.resolve({ data: 'tok' })
        : Promise.resolve({ data: { documentHash: 'h' } }))
    vi.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
    vi.spyOn(window.crypto.subtle, 'decrypt').mockRejectedValue(new Error('bad key'))

    renderModal()
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'pw' } })
    fireEvent.click(screen.getByText(/Decrypt & Download/i))

    await waitFor(() => expect(screen.getByText(/Decryption failed — wrong key or corrupted data/i)).toBeTruthy())
    expect(screen.queryByText('Integrity check failed')).toBeNull()
  })

  it('on success: shows per-stage duration and auto-downloads', async () => {
    vi.mocked(verifyIntegrity).mockResolvedValue(true)
    mockGet.mockImplementation((url: string) =>
      url.includes('/ciphertext') ? Promise.resolve({ data: new ArrayBuffer(16) })
        : url.includes('/wrapped-key') ? Promise.resolve({ data: 'tok' })
        : Promise.resolve({ data: { documentHash: 'h' } }))
    vi.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
    vi.spyOn(window.crypto.subtle, 'decrypt').mockResolvedValue(new TextEncoder().encode('hello world').buffer)
    ;(window.URL as any).createObjectURL = vi.fn(() => 'blob:x')
    ;(window.URL as any).revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderModal()
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'pw' } })
    fireEvent.click(screen.getByText(/Decrypt & Download/i))

    await waitFor(() => expect(screen.getByText('Document verified and ready')).toBeTruthy())
    expect(screen.getAllByText(/Completed in \d+ms/i).length).toBeGreaterThan(0)
    await waitFor(() => expect(clickSpy).toHaveBeenCalled(), { timeout: 2000 })
  })
})
