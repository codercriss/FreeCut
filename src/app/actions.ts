import { sweepOrphanMedia } from "../media/mediaStore";
import { createSampleProject } from "../model/sample";
import { defaultSelection } from "../model/selectors";
import { setSelection } from "../store/editorStore";
import { projectStore } from "../store/singleton";

/** Replace the current project with a fresh copy of the demo project (autosave persists it). */
export function resetDemoProject(): void {
  const sample = createSampleProject();
  projectStore.replaceProject(sample);
  setSelection(defaultSelection(sample));
  void sweepOrphanMedia().catch(() => undefined); // frees imported media (recent files are kept until the next start)
}
