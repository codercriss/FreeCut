import { createContext } from "react";

export interface LaunchOptions {
  /** Open the phone editor with this bottom sheet showing (Home's "Import media" passes "media"). */
  sheet?: "media" | "edit";
}

export interface Nav {
  /** Return to the Home screen. */
  goHome: () => void;
  /** Options Home passed when opening the editor. */
  launch: LaunchOptions | null;
}

export const NavContext = createContext<Nav>({ goHome: () => {}, launch: null });
