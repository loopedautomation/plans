---
status: busy
---
# Markdown images resolve like HTML ones

From [issue #19](https://github.com/loopedautomation/plans/issues/19).

> A document containing a standard Markdown image with a relative path, e.g.
> `![](images/photo.png)`, shows nothing (broken image), even though the file
> exists next to the document in the repository. Rewriting the same reference
> as HTML — `<img src="images/photo.png" />` — renders correctly.
>
> `src/html-view.ts` (`resolveAssets`) rewrites relative `src`/`srcset`
> attributes to data URLs via the `read_asset` Tauri command, but it only runs
> over the HTML atom nodes. Milkdown's native image node (from `![]()` syntax)
> is rendered straight to the webview with the raw relative path, which
> resolves against the dev server / app origin and fails.
>
> Suggested fix: apply the same asset resolution (with the existing per-repo
> cache and the 12 MB cap) to Milkdown image nodes, e.g. a node view or
> decoration for the `image` schema node that removes `src` and replaces it
> with the data URL from `api.readAsset`, mirroring what `resolveAssets` does
> for `<img>`.
>
> Found while opening a generated product catalog (~640 images across 22
> files, all `![](images/...)`), which had to be bulk-rewritten to `<img>`
> tags to display.

## The shape of the fix

The intent is the issue's: one rule for relative image paths, whichever syntax
wrote them. What follows is how that is reached without betting on a schema
this app does not own.
