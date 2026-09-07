---
status: done
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

The issue suggests a node view on the `image` schema node. That is the obvious
route and it is also a bet: Crepe's image feature replaces the plain commonmark
image with block and inline nodes of its own, each drawn by a component that
renders — and re-renders — its own `<img>`. A node view would have to name
those types, take the element off the component that owns it, and be rewritten
the next time Crepe rearranges its features.

So the resolution is attached to the thing every one of those paths produces:
an `<img>` in the editor's DOM with a relative `src`. A `MutationObserver` over
the editor's DOM catches each one as it is drawn, and catches it again when a
component redraws and puts the raw path back.

## What was done

- **`src/image-assets.ts`** is new: an `imageAssets` ProseMirror plugin whose
  view observes `view.dom` and resolves any relative `src` it sees, plus one
  pass over what is already on the page when the plugin is built. Images inside
  `.md-html` are left alone — the HTML view already owns those. Reads are done
  once per element: the pending path is parked in a data attribute so a redraw
  mid-flight does not ask again.
- The observer works from the mutation records, not from a document-wide sweep.
  The file this was reported from holds ~640 images; re-scanning them on every
  keystroke would trade a broken picture for a slow one.
- The swap happens **synchronously in the observer's callback** rather than on
  the next frame. A mutation callback is a microtask, so it runs before the
  browser has had a task in which to fail the relative request — deferred, the
  error lands first and a component watching for one has already drawn its
  broken state.
- A relative source is replaced by a 1×1 transparent GIF while the bytes are
  read, rather than removed. `resolveAssets` removes the attribute because a
  relative path would otherwise be attempted against the app's origin; removing
  it here would instead show an image component's "add an image" placeholder,
  which is a worse flash than none.
- **`src/html-view.ts`** now exports the asset machinery it had kept private —
  `ABSOLUTE_SRC`, `assetPath`, `cachedAsset`, `assetUrl` — and `resolveAssets`
  is rewritten in terms of them. One cache, one `read_asset` call per path, so
  a cover referenced both ways is read once. Behaviour there is unchanged.
- An image that cannot be read says which path it tried and why, as the HTML
  side already did: `md-asset-missing` on the frame, the reason as its alt text
  and title, styled in `editor-theme.css` to match `.md-html-missing`.
- The repository and file a path is relative to are handed to the plugin by the
  editor that installs it — `imageAssets(() => assetContextRef.current)` — and
  read afresh on each image rather than captured once, since one editor keeps
  its instance across a file swap. Not the module-global `htmlContext`: two
  panes hold two files at once, and the one opened second would otherwise
  decide where the first one's pictures are read from.
- `Editor.tsx` uses the plugin; `README.md` and `BUGS.md` say so; a changeset
  describes the fix for the release notes.

## Verification

Two e2e tests in `e2e/html.spec.ts`: `![](images/photo.png)` renders with a
data URL for a source and calls `read_asset` with `images/photo.png`, and the
same picture written as `<img>` still renders the way it always did.

The tests were not run on this machine — `pnpm` is not installed here and
installing it was not available, so `pnpm test` and `pnpm exec tsc --noEmit`
could not be executed locally. CI runs both on the pull request.
