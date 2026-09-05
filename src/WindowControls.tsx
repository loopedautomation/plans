/**
 * Minimise, maximise and close — for the desktops whose frame the app removed.
 *
 * macOS keeps its traffic lights: `titleBarStyle: "Overlay"` hides the bar and
 * leaves the buttons floating over the rail, which is why the rail has a left
 * inset there and none here. Linux and Windows have no such mode — the frame is
 * on or it is off — so turning it off takes the buttons with it, and a window
 * with no way to close it is not a trade anyone agreed to.
 *
 * The window handle is fetched inside the handlers rather than at module scope.
 * The same page runs in a plain browser — `pnpm web`, and the Playwright suite
 * against it — where there is no Tauri window to return and reaching for one
 * throws.
 */
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** The current window, or null in a browser, where these buttons do nothing. */
function currentWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function WindowControls() {
  // Which glyph the middle button wears. Windows and most GTK themes show
  // "restore" once a window is maximised, and the difference is the only
  // feedback the button has.
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const w = currentWindow();
    if (!w) return;
    let alive = true;
    let off: (() => void) | undefined;
    const read = () => {
      w.isMaximized()
        .then((m) => alive && setMaximized(m))
        .catch(() => {});
    };
    read();
    // Resize rather than a maximise event: dragging a maximised window off the
    // top of the screen restores it without anything else saying so.
    w.onResized(read)
      .then((fn) => (alive ? (off = fn) : fn()))
      .catch(() => {});
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  return (
    <span className="win-controls">
      <button
        className="win-btn"
        onClick={() => currentWindow()?.minimize()}
        title="Minimise"
        aria-label="Minimise"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" />
        </svg>
      </button>
      <button
        className="win-btn"
        onClick={() => currentWindow()?.toggleMaximize()}
        title={maximized ? "Restore" : "Maximise"}
        aria-label={maximized ? "Restore" : "Maximise"}
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 0.5h7v7M0.5 2.5h7v7h-7z" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5h9v9h-9z" />
          </svg>
        )}
      </button>
      <button
        className="win-btn close"
        onClick={() => currentWindow()?.close()}
        title="Close"
        aria-label="Close"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
        </svg>
      </button>
    </span>
  );
}
