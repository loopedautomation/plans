/**
 * What the window says when it has been made too small to draw the page.
 *
 * The rail is the narrowest thing in the app that cannot wrap, and it runs out
 * of room at about 520px; below that the buttons start overlapping each other
 * rather than the layout degrading. Height has no such hard floor — the body
 * simply shrinks — so `MIN_H` is a judgement about when a page stops being
 * worth reading rather than a measurement.
 *
 * It covers the app rather than replacing it: an editor that unmounted at
 * 519px and remounted at 521px would lose its selection, its scroll position
 * and any in-flight edit, which is a worse trade than a panel over the top.
 *
 * The whole surface drags, and the window buttons come with it. On a frameless
 * window that is not decoration: without them a window dragged too small has no
 * titlebar to grab and no button to close, and the only way out is the
 * compositor's own keys — which is exactly the state this screen exists to
 * rescue someone from.
 */
import { IS_MAC } from "./platform";
import { WindowControls } from "./WindowControls";

/** The width the rail stops fitting at, measured rather than chosen. */
export const MIN_W = 520;
/** Nothing breaks at this height; below it there is too little page to read. */
export const MIN_H = 360;

export function TooSmall({ w, h }: { w: number; h: number }) {
  return (
    <div className="too-small" data-tauri-drag-region>
      {!IS_MAC && (
        <div className="too-small-controls">
          <WindowControls />
        </div>
      )}
      <div className="too-small-body" data-tauri-drag-region>
        <p className="too-small-title" data-tauri-drag-region>
          The window is too small
        </p>
        <p className="too-small-size" data-tauri-drag-region>
          <span className={w < MIN_W ? "short" : ""}>{w}</span>
          {" × "}
          <span className={h < MIN_H ? "short" : ""}>{h}</span>
        </p>
        <p className="too-small-need" data-tauri-drag-region>
          needs {MIN_W} × {MIN_H}
        </p>
      </div>
    </div>
  );
}
