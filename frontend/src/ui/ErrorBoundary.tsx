import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (error: unknown) => void;
  /** What to show instead; retry renders the children again. Without it the part simply disappears. */
  readonly fallback?: (retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

/** Keeps a crash in one part of the page from taking down the app; the parent decides what to show. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.warn('[junksnap:boundary]', info.componentStack);
    this.props.onError(error);
  }

  readonly retry = (): void => {
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ? this.props.fallback(this.retry) : null;
  }
}
