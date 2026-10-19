import type { ReactNode } from "react";
import { PlaybackProvider } from "../engine/playback";
import { createSampleProject } from "../model/sample";
import { projectDuration } from "../model/selectors";
import { ProjectStoreProvider } from "../store/ProjectContext";
import { createProjectStore, type ProjectStore } from "../store/projectStore";

/** A fresh sample-project store + the providers editor components need. */
export function makeHarness() {
  const store = createProjectStore(createSampleProject(1));
  const wrap = (children: ReactNode, opts: { autoPlay?: boolean } = {}) => (
    <ProjectStoreProvider store={store}>
      <PlaybackProvider
        fps={60}
        totalFrames={projectDuration(store.getProject())}
        startFrame={165}
        autoPlay={opts.autoPlay ?? false}
      >
        {children}
      </PlaybackProvider>
    </ProjectStoreProvider>
  );
  return { store, wrap };
}

export const track = (store: ProjectStore, id: string) =>
  store.getProject().tracks.find((t) => t.id === id)!;
export const clip = (store: ProjectStore, id = "clip-main") =>
  store.getProject().clips.find((c) => c.id === id)!;
