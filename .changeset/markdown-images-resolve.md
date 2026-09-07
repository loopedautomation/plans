---
"looped-plans": patch
---

A local image written the markdown way now renders. `![](images/cover.png)` and
`<img src="images/cover.png">` are the same picture in the same folder, but only
the second one was being read out of the repository — the resolver lived inside
the HTML node view, and markdown's own image node goes straight to the webview
with the path as written, where it resolves against the app's origin and finds
nothing. A folder of images had to be bulk-rewritten to `<img>` tags to be
readable.

Relative sources are now resolved for every image the editor draws, whichever
syntax wrote it, through the same `read_asset` call and the same per-repository
cache — so a cover referenced both ways is read once. An image that cannot be
read says which path it tried instead of showing an empty frame, as the HTML
side already did.
