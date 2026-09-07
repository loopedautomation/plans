---
"looped-plans": patch
---

A streamed answer no longer arrives with every chunk repeated. Tauri's
unlisten throws when it runs before the webview has recorded the listener,
leaving the Rust half registered, so a panel that re-subscribed soon after
mounting — a workspace chat, whose folder arrives a beat later — heard every
event once per leaked subscription. A removed listener now drops whatever
still reaches it, and the unlisten is retried.
