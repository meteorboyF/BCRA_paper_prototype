import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-6">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">Something went wrong</h1>
            <p className="text-text-muted text-sm mb-6">
              An unexpected error occurred. Your data is safe — please return to the dashboard.
            </p>
            <a
              href="/dashboard"
              className="btn-primary inline-flex items-center justify-center"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
