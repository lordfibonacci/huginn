import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[Huginn] Uncaught render error:', error, info.componentStack)
    this.setState({ error, info: info.componentStack ?? null })
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-huginn-surface text-huginn-text-primary flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-huginn-card border border-huginn-border rounded-xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-huginn-danger mb-2">Something broke</h1>
          <p className="text-sm text-huginn-text-secondary mb-4">
            The app hit an unexpected error. The details below help diagnose it.
          </p>
          <pre className="text-xs bg-huginn-surface border border-huginn-border rounded-lg p-3 mb-3 overflow-auto max-h-40 whitespace-pre-wrap text-huginn-danger">
            {this.state.error.message}
          </pre>
          {this.state.info && (
            <pre className="text-[10px] bg-huginn-surface border border-huginn-border rounded-lg p-3 mb-4 overflow-auto max-h-60 whitespace-pre-wrap text-huginn-text-muted">
              {this.state.info.trim()}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-md px-4 py-2"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-huginn-surface hover:bg-huginn-hover text-huginn-text-primary text-sm rounded-md px-4 py-2 border border-huginn-border"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
