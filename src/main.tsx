import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { CrashScreen, ErrorBoundary } from "./app/ErrorBoundary";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary fallback={(error, reset) => <CrashScreen error={error} onReset={reset} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
