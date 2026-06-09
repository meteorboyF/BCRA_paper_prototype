import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h1 className="font-heading text-4xl font-bold text-text-primary mb-2">404</h1>
        <p className="text-text-muted mb-6">Page not found</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    </div>
  )
}
