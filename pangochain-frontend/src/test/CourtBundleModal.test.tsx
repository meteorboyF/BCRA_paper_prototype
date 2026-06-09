import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CourtBundleModal } from '../components/CourtBundleModal'
import api from '../lib/api'
import { loadWrappedPrivateKey, unwrapPrivateKey } from '../lib/crypto'
import { decryptDocumentToBytes } from '../lib/decryptDoc'
import { useAuthStore } from '../store/authStore'

vi.mock('../lib/api', () => ({ default: { post: vi.fn() } }))
vi.mock('../lib/crypto', () => ({
  loadWrappedPrivateKey: vi.fn(),
  unwrapPrivateKey: vi.fn(),
  bytesToBase64: vi.fn(),
}))
vi.mock('../lib/decryptDoc', () => ({
  decryptDocumentToBytes: vi.fn(),
  bytesToTextIfPrintable: vi.fn(),
}))
vi.mock('react-hot-toast', () => {
  const toast = vi.fn()
  return { default: Object.assign(toast, { success: vi.fn() }) }
})

describe('CourtBundleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'lawyer@pangolawfirm.com',
        fullName: 'James Harrington',
        role: 'ASSOCIATE_SENIOR',
        firmId: 'firm-1',
        mfaEnabled: false,
      },
      isAuthenticated: true,
    })
    URL.createObjectURL = vi.fn(() => 'blob:bundle')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('renders case documents instead of blanking the page', () => {
    render(
      <CourtBundleModal
        caseId="case-1"
        documents={[
          { id: 'doc-1', fileName: 'Lease Agreement.md', ipfsCid: 'QmDemoLease' },
          { id: 'doc-2', fileName: 'Settlement Memo.pdf', documentHash: 'hash' },
        ]}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Court-Ready Bundle')).toBeInTheDocument()
    expect(screen.getByText('Lease Agreement.md')).toBeInTheDocument()
    expect(screen.getByText('Settlement Memo.pdf')).toBeInTheDocument()
  })

  it('includes a selected document by reference when ciphertext fetch returns 503', async () => {
    vi.mocked(loadWrappedPrivateKey).mockReturnValue({ saltB64: 'salt', ivB64: 'iv', encryptedB64: 'key' })
    vi.mocked(unwrapPrivateKey).mockResolvedValue({} as CryptoKey)
    vi.mocked(decryptDocumentToBytes).mockRejectedValue({ response: { status: 503 }, message: 'Request failed with status code 503' })
    vi.mocked(api.post).mockResolvedValue({
      data: new Blob(['pdf'], { type: 'application/pdf' }),
      headers: { 'content-disposition': 'attachment; filename="bundle.pdf"' },
    })

    render(
      <CourtBundleModal
        caseId="case-1"
        documents={[{ id: 'doc-1', fileName: 'Lease Agreement.md', documentHash: 'hash' }]}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /Lease Agreement.md/i }))
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'Lawyer123!' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate Bundle/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/bundles',
        {
          caseId: 'case-1',
          bundleType: 'Evidence Bundle',
          items: [{ documentId: 'doc-1', plaintextBase64: null }],
        },
        { responseType: 'blob' },
      )
    })
  })
})
