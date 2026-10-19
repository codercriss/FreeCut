import { IS_IPHONE, IS_STANDALONE } from "../app/platform";
import { useIsMobile, type LayoutMode } from "../app/useIsMobile";
import "../styles/editor.css";
import { DesktopApp } from "./DesktopApp";
import { MobileApp } from "./MobileApp";
import { useUndoRedoShortcuts } from "./shortcuts";

/** The editor screen. Lazy-loaded (see app/App.tsx) so Home starts without the editor's code or CSS. */
export default function Editor({ layout = "auto" }: { layout?: LayoutMode }) {
  const mobile = useIsMobile(layout);
  useUndoRedoShortcuts();
  const cls =
    "ve-scroll" +
    (mobile ? " ve-scroll-m" : "") +
    (IS_IPHONE ? " ios" : "") +
    (IS_IPHONE && IS_STANDALONE ? " pwa" : "");
  return (
    <div className={cls}>
      {mobile ? (
        <div className="ve-mob-frame">
          <MobileApp />
        </div>
      ) : (
        <DesktopApp />
      )}
    </div>
  );
}
