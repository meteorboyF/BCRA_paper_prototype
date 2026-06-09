import { Shield } from 'lucide-react'

export function EncryptionBadge() {
  return (
    <span className="encryption-badge">
      <Shield className="w-3.5 h-3.5" />
      AES-256-GCM · Client-Side Only
    </span>
  )
}

export function BlockchainBadge({ txId }: { txId?: string }) {
  return (
    <span className="blockchain-badge">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
      {txId ? `Fabric: ${txId.slice(0, 8)}…` : 'On Blockchain'}
    </span>
  )
}
