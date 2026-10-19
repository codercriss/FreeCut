import { createSampleProject } from "../model/sample";
import { createProjectStore } from "./projectStore";

/** The app's one project store. Boot (app/bootstrap.ts) replaces its project with the saved one. */
export const projectStore = createProjectStore(createSampleProject());
