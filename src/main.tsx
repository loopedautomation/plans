import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Fault, watchForFaults } from "./Fault";
import { startAnalytics, track } from "./analytics";
import { loadSettings } from "./settings";
import { api } from "./api";

const DesktopApp =
  __PLANS_BUILD_TARGET__ !== "mobile" ? lazy(() => import("./App")) : null;
const MobileApp =
  __PLANS_BUILD_TARGET__ !== "desktop"
    ? lazy(() => import("./mobile/MobileApp"))
    : null;

function TargetApp() {
  const fixed =
    __PLANS_BUILD_TARGET__ === "runtime" ? null : __PLANS_BUILD_TARGET__;
  const [target, setTarget] = useState<"desktop" | "mobile" | null>(fixed);
  useEffect(() => {
    void api.targetKind().then(setTarget, () => setTarget("desktop"));
  }, []);
  if (!target) return null;
  if (target === "mobile" && MobileApp) return <MobileApp />;
  if (target === "desktop" && DesktopApp) return <DesktopApp />;
  return null;
}

// Anything thrown anywhere ends up in the log, not in a blank window.
watchForFaults();

// Before the first render, so the preference is honoured from the first event
// rather than from whenever App happens to mount. Off means nothing starts.
startAnalytics(loadSettings().telemetry);
track("app_opened");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Fault>
      <Suspense fallback={null}>
        <TargetApp />
      </Suspense>
    </Fault>
  </React.StrictMode>,
);
