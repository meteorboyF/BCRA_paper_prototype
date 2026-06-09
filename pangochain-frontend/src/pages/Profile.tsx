import { useAuthStore, roleLabel } from '../store/authStore'
import { Shield, Key, User, Mail, Building2, Lock, CheckCircle } from 'lucide-react'
import { loadWrappedPrivateKey } from '../lib/crypto'

export default function Profile() {
  const { user } = useAuthStore()
  const hasLocalKey = user ? loadWrappedPrivateKey(user.id) !== null : false

  if (!user) return null

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Profile</h1>

      {/* Identity */}
      <div className="card space-y-4">
        <h2 className="font-heading font-semibold text-text-primary">Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: <User className="w-4 h-4" />, label: 'Full Name', value: user.fullName },
            { icon: <Mail className="w-4 h-4" />, label: 'Email', value: user.email },
            { icon: <Building2 className="w-4 h-4" />, label: 'Firm', value: user.firmId ?? 'Not assigned' },
            { icon: <Shield className="w-4 h-4" />, label: 'Role', value: roleLabel(user.role) },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-surface-muted rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">{icon} {label}</div>
              <p className="font-medium text-text-primary text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="card space-y-4">
        <h2 className="font-heading font-semibold text-text-primary">Security</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1d6464]/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#1d6464]" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Two-Factor Authentication</p>
                <p className="text-xs text-text-muted">TOTP authenticator app</p>
              </div>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.mfaEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {user.mfaEnabled ? 'Enabled' : 'Not set up'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1d6464]/10 rounded-lg flex items-center justify-center">
                <Key className="w-4 h-4 text-[#1d6464]" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">ECIES P-256 Private Key</p>
                <p className="text-xs text-text-muted">PBKDF2-wrapped, stored in localStorage</p>
              </div>
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${hasLocalKey ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {hasLocalKey ? <><CheckCircle className="w-3 h-3" /> Present</> : 'Missing'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1d6464]/10 rounded-lg flex items-center justify-center">
                <Lock className="w-4 h-4 text-[#1d6464]" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Document Encryption</p>
                <p className="text-xs text-text-muted">AES-256-GCM in browser · plaintext never leaves device</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Key warning */}
      {!hasLocalKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
          <p className="font-semibold text-amber-800 text-sm mb-1">Private key not found in this browser</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            Your ECIES private key is stored locally and cannot be recovered from the server.
            If you registered on another device or cleared browser storage, you will not be able to
            decrypt documents previously shared with you. Contact your IT administrator.
          </p>
        </div>
      )}
    </div>
  )
}
