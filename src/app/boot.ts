import { defaultSelection } from "../model/selectors";
import { startAutosave, type Autosave } from "../storage/autosave";
import { saveProject } from "../storage/projectRepo";
import { setSelection } from "../store/editorStore";
import { projectStore } from "../store/singleton";
import { bootstrapProject, type BootResult } from "./bootstrap";

let started: Promise<BootResult> | null = null;
export let autosave: Autosave | null = null;

/** Load (or create) the project, then start autosaving it. Runs once per page load, even under StrictMode. */
export function boot(): Promise<BootResult> {
  started ??= bootstrapProject({ store: projectStore }).then((result) => {
    autosave = startAutosave({ store: projectStore, save: saveProject, flushOnHide: true });
    setSelection(defaultSelection(result.project));
    if (result.warning) console.warn(`[FreeCut] ${result.warning}`);
    return result;
  });
  return started;
}
