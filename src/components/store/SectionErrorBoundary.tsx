"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface SectionErrorBoundaryProps {
  /** Name of the section, displayed in the fallback UI (e.g. "Featured Bundle") */
  sectionName: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * SectionErrorBoundary — isolates render errors per store section.
 *
 * Wraps each <Suspense> streaming section in the store page so that
 * a failure in one section (e.g. Bundle fetch error) does not take
 * down the Daily Shop or Night Market sections.
 *
 * Uses a class component because React's error boundary API
 * (getDerivedStateFromError, componentDidCatch) is only available
 * on class components.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[SectionErrorBoundary: ${this.props.sectionName}]`,
      error,
      errorInfo,
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-12 px-6 space-y-4">
          {/* Error icon */}
          <div className="w-12 h-12 flex items-center justify-center border border-red-500/30 angular-card-sm">
            <span className="text-2xl text-red-500 font-bold">!</span>
          </div>

          <h3 className="text-zinc-300 text-lg font-display uppercase tracking-wider">
            {this.props.sectionName} Unavailable
          </h3>

          <p className="text-zinc-500 text-sm text-center max-w-sm leading-relaxed">
            This section encountered an error. Other sections are unaffected.
          </p>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="text-left text-xs text-red-400/80 bg-void-deep p-3 overflow-auto max-h-20 max-w-lg w-full angular-card-sm">
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleRetry}
            className="angular-btn px-5 py-2.5 bg-valorant-red text-white font-display uppercase tracking-wider text-sm hover:bg-red-600 transition-colors"
          >
            Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
