import { ChevronDown, Keyboard, Upload } from "lucide-react";
import { useContext } from "react";
import { BRAND_NAME } from "../app/brand";
import { NavContext } from "../app/NavContext";
import { saveStatusStore } from "../storage/autosave";
import { useStore } from "../store/createStore";
import { useProject } from "../store/ProjectContext";
import { BrandMark } from "../ui/BrandMark";
import { IconLayout } from "../ui/icons";
import { saveLabel } from "./saveLabel";

/** Room kept at the right for the OS window controls (minimise / maximise / close). Set to 0 to remove. */
const WINDOW_CONTROLS_SPACE = 102;

export function TitleBar() {
  const { goHome } = useContext(NavContext);
  const name = useProject((p) => p.name);
  const status = useStore(saveStatusStore, (s) => s);
  return (
    <header className="ve-title">
      <button
        className="ve-brand ve-brand-btn"
        onClick={goHome}
        title="Back to home"
        aria-label="Back to home"
      >
        <BrandMark size={16} />
        <span>{BRAND_NAME}</span>
      </button>
      <span className="ve-title-sep" />
      <div className="ve-doc-title">{name}</div>
      <span className="ve-autosave" data-state={status.state} role="status">
        <i />
        {saveLabel(status, "Saved locally")}
      </span>
      <div className="ve-title-right" style={{ paddingRight: WINDOW_CONTROLS_SPACE }}>
        <button className="ve-menu">
          <span>Menu</span>
          <ChevronDown size={9} strokeWidth={2.4} />
        </button>
        <button className="ve-layout-btn" title="Layout">
          <IconLayout size={14} />
          <ChevronDown size={9} strokeWidth={2.4} />
        </button>
        <button className="ve-shortcut">
          <Keyboard size={11} strokeWidth={1.8} />
          <span>Shortcut</span>
        </button>
        <button className="ve-export">
          <Upload size={11} strokeWidth={2.5} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
