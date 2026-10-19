import { clockTime } from "../model/time";
import type { SaveStatus } from "../storage/autosave";

/** The truthful text for the autosave indicator. `prefix` differs by layout ("Saved locally" / "Auto save local"). */
export function saveLabel(s: SaveStatus, prefix: string): string {
  switch (s.state) {
    case "saved":
      return s.savedAt ? `${prefix} at ${clockTime(s.savedAt)}` : prefix;
    case "saving":
      return "Saving…";
    case "error":
      return "Couldn’t save — retrying";
    case "unavailable":
      return "Not saved (storage unavailable)";
    default:
      return "Not saved yet";
  }
}
