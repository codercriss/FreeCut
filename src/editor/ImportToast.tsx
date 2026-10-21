import { useEffect } from "react";
import { dismissImport, importStore } from "../media/importStore";
import { useStore } from "../store/createStore";

/** Progress and result of an import, shown over either layout. Successes fade away; problems stay until dismissed. */
export function ImportToast() {
  const s = useStore(importStore, (x) => x);
  const clean = !!s.summary && s.summary.failed.length === 0;
  useEffect(() => {
    if (!clean) return undefined;
    const t = setTimeout(dismissImport, 4000);
    return () => clearTimeout(t);
  }, [clean]);

  if (!s.running && !s.summary) return null;
  const total = s.items.length;
  const done = s.items.filter((i) => i.state === "done" || i.state === "error").length;
  const current = s.items.find((i) => i.state === "working");

  return (
    <div className="ve-toast" role="status" aria-live="polite">
      {s.running ? (
        <div className="ve-toast-row">
          <span className="ve-spinner" aria-hidden="true" />
          <span>
            Importing {Math.min(done + 1, Math.max(total, 1))} of {Math.max(total, 1)}
            {current ? ` — ${current.name}` : "…"}
          </span>
        </div>
      ) : (
        s.summary && (
          <>
            <div className="ve-toast-row">
              <span>
                {s.summary.added > 0
                  ? `Added ${s.summary.added} file${s.summary.added === 1 ? "" : "s"} to the library.`
                  : "Nothing was imported."}
              </span>
              <button onClick={dismissImport}>{clean ? "OK" : "Dismiss"}</button>
            </div>
            {s.summary.failed.map((f, i) => (
              <div key={i} className="ve-toast-err">
                <b>{f.name}</b> — {f.message}
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
}
