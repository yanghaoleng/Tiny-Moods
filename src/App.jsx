import {lazy, Suspense, useEffect} from "react";
import {bindUISFX} from "uisfx";
import GeneratorApp from "./generator/GeneratorApp";
import EmotionCursorTrail from "./EmotionCursorTrail";
import {bindInteractionAnalytics} from "./analytics";
import {uiSfx, unlockUISfx} from "./uiSfx";

const preloadCues = [
  "press", "select", "toggle-on", "toggle-off", "delete", "copy",
  "open", "close", "back", "forward", "drop", "success", "error",
  "blocked", "retry", "start", "complete", "processing", "play", "skip-next",
];
const AdminApp = lazy(() => import("./admin/AdminApp"));

function ConsumerApp() {
  useEffect(() => {
    const {unbind} = bindUISFX(document, {player: uiSfx});
    const unbindAnalytics = bindInteractionAnalytics(document);
    let unlocked = false;

    const unlock = async () => {
      if (unlocked) return;
      unlocked = await unlockUISfx();
      if (unlocked) {
        void uiSfx.preload(preloadCues);
        document.removeEventListener("pointerdown", unlock, true);
        document.removeEventListener("keydown", unlock, true);
      }
    };

    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);

    return () => {
      unbind();
      unbindAnalytics();
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      uiSfx.stopAll();
    };
  }, []);

  return (
    <>
      <GeneratorApp />
      <EmotionCursorTrail />
    </>
  );
}

export default function App() {
  const isAdmin = window.location.pathname === "/admin" || window.location.pathname === "/admin/";
  return isAdmin ? <Suspense fallback={<main className="admin-loading-page">正在打开运营后台</main>}><AdminApp /></Suspense> : <ConsumerApp />;
}
