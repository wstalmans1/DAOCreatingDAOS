import React from 'react'

type State = { hasError: boolean; error?: any }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    console.error('App error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 text-red-800 p-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-semibold mb-2">Something went wrong.</h1>
            <pre className="text-xs whitespace-pre-wrap bg-white border border-red-200 rounded p-2 overflow-auto">
              {String(this.state.error?.message || this.state.error || 'Unknown error')}
            </pre>
            <div className="text-xs mt-2">Check the browser console for details.</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
