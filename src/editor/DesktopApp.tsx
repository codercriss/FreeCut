import { SceneDefs } from "./footage/scenes";
import { MediaPanel } from "./MediaPanel";
import { PlayerPanel } from "./PlayerPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./timeline/Timeline";
import { TitleBar } from "./TitleBar";

export function DesktopApp() {
  return (
    <div className="ve-app">
      <SceneDefs />
      <TitleBar />
      <main className="ve-main ve-studio">
        <MediaPanel rail />
        <div className="ve-center">
          <PlayerPanel />
          <Timeline />
        </div>
        <PropertiesPanel />
      </main>
    </div>
  );
}
