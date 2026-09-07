/**
 * Tauri's `listen`, with an unlisten that means it.
 *
 * A listener is registered in two places: Rust keeps it, and a script Rust
 * evaluates in the webview records its id. `listen()` resolves when Rust has
 * answered, which can be before that script has run — and Tauri's unlisten
 * reads the record first and throws when it is not there yet, so the Rust
 * half is never removed and the handler keeps firing. Any effect that
 * unsubscribes soon after subscribing — a prop that changes right after
 * mount, a hot reload — hits that window, and every event from then on
 * arrives once per leaked subscription: a streamed answer with each chunk
 * repeated, three times over in a workspace chat.
 *
 * So the handler is gated on a flag the unlisten clears first — a removed
 * listener drops what still reaches it, whatever Rust thinks — and the
 * unlisten itself is retried once the record has had time to land.
 */
import { listen as tauriListen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export function listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
  let live = true;
  const registered = tauriListen<T>(event, (e) => {
    if (live) handler(e);
  });
  return registered.then((un) => () => {
    if (!live) return;
    live = false;
    void retrying(un);
  });
}

/** Call `un`, and once more a moment later if it threw. */
export async function retrying(un: () => void | Promise<void>): Promise<void> {
  try {
    await un();
  } catch {
    await new Promise<void>((r) => setTimeout(r, 200));
    try {
      await un();
    } catch {
      // Still not recorded: the handler is gated, so nothing more reaches it.
    }
  }
}
