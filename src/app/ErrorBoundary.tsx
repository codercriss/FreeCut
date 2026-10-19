import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Render the fallback UI. `reset` clears the error and re-renders the children. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

/** Keeps one broken screen from blanking the whole app (the project is autosaved, so nothing is lost). */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FreeCut crashed while rendering:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  override render() {
    return this.state.error
      ? this.props.fallback(this.state.error, this.reset)
      : this.props.children;
  }
}

/** Plain, dependency-free crash screen. */
export function CrashScreen({
  error,
  onReset,
  resetLabel = "Try again",
  onHome,
}: {
  error: Error;
  onReset: () => void;
  resetLabel?: string;
  onHome?: () => void;
}) {
  return (
    <div className="fc-crash" role="alert">
      <h2>Something went wrong</h2>
      <p>Your project is saved automatically, so your edits are safe.</p>
      <div className="fc-crash-btns">
        <button onClick={onReset}>{resetLabel}</button>
        {onHome && <button onClick={onHome}>Back to home</button>}
        <button onClick={() => window.location.reload()}>Reload app</button>
      </div>
      <details>
        <summary>Technical details</summary>
        <pre>{error.message}</pre>
      </details>
    </div>
  );
}
