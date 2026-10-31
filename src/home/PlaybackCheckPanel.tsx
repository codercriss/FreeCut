import { useState } from "react";
import {
  formatReport,
  runPlaybackCheck,
  runToneTest,
  statusSymbol,
  type CheckRow,
  type ToneKind,
} from "../diagnostics/playbackCheck";
import { createPlaybackEnv } from "../diagnostics/playbackCheckEnv";
import { useProject } from "../store/ProjectContext";

const INTRO = `Finds out what this phone can do before playback is built. It takes about 30 seconds and uses your own imported video for the speed tests — you will see it flash in the top-left corner for a few seconds. For the tone tests, switch the silent switch on.`;

/** Replace a row with the same id (a re-run, a repeated tone) or append a new one. */
function upsert(rows: CheckRow[], row: CheckRow): CheckRow[] {
  const at = rows.findIndex((r) => r.id === row.id);
  if (at < 0) return [...rows, row];
  const next = rows.slice();
  next[at] = row;
  return next;
}

/**
 * Phase 1b.0 "Playback check" (Me tab). The buttons call straight into the check from the tap handler on purpose:
 * iOS only unlocks audio from inside the tap itself, so nothing here may `await` before `runPlaybackCheck` /
 * `runToneTest` start. See `diagnostics/playbackCheck.ts`.
 */
export default function PlaybackCheckPanel() {
  const assets = useProject((p) => p.assets);
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const add = (row: CheckRow) => setRows((prev) => upsert(prev, row));

  const onRun = () => {
    if (running) return;
    setRunning(true);
    setNote("");
    setRows([]);
    const env = createPlaybackEnv(() => assets);
    const done = runPlaybackCheck(env, add).catch(() => undefined);
    void done.finally(() => setRunning(false));
  };

  const onTone = (kind: ToneKind) => {
    const env = createPlaybackEnv(() => assets);
    void runToneTest(env, kind).then(add);
  };

  const toneWeb = () => onTone("webaudio");
  const toneTag = () => onTone("element");

  const onCopy = async () => {
    const meta = {
      version: __APP_VERSION__,
      when: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    try {
      await navigator.clipboard.writeText(formatReport(rows, meta));
      setNote("Copied.");
    } catch {
      setNote("Copy didn’t work here — take a screenshot instead.");
    }
  };

  return (
    <section className="hm-check" aria-label="Playback check">
      <p className="hm-check-intro">{INTRO}</p>
      <div className="hm-check-actions">
        <button className="hm-check-btn hm-check-primary" onClick={onRun} disabled={running}>
          {running ? "Checking…" : rows.length ? "Run again" : "Run check"}
        </button>
        <button className="hm-check-btn" onClick={toneWeb}>
          Web Audio tone
        </button>
        <button className="hm-check-btn" onClick={toneTag}>
          Audio tag tone
        </button>
      </div>
      {rows.length > 0 && (
        <ul className="hm-check-rows">
          {rows.map((r) => (
            <li key={r.id} className={`hm-check-row ${r.status}`}>
              <span className="hm-check-mark">{statusSymbol(r.status)}</span>
              <div>
                <strong>{r.label}</strong>
                <span className="hm-check-detail">{r.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && !running && (
        <div className="hm-check-actions">
          <button className="hm-check-btn" onClick={onCopy}>
            Copy report
          </button>
          {note && <span className="hm-check-note">{note}</span>}
        </div>
      )}
    </section>
  );
}
