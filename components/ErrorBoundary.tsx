import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full text-center border border-red-100">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-3">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-4">
              This can happen if the browser runs out of memory while processing a large analysis.
            </p>
            <div className="bg-slate-50 p-3 rounded-lg text-left overflow-auto max-h-32 mb-5 text-xs text-slate-600 font-mono border border-slate-200">
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
