/**
 * Markdown's own images, pointed at the repository.
 *
 * `<img src="images/cover.png">` inside a markdown file is rendered by the
 * HTML view, which rewrites the relative path to a data URL read through Rust
 * — see `resolveAssets` in `html-view.ts`. `![](images/cover.png)` is not
 * HTML: it is a node in the editor's own schema, drawn by Milkdown straight
 * into the webview with the path exactly as written. That path resolves
 * against the app's origin, where nothing lives, so the picture is a broken
 * frame and the same file rendered two different ways.
 *
 * This closes that gap for every image the editor draws, whatever wrote it.
 *
 * ## Why the DOM and not the schema
 *
 * The obvious fix is a node view on the `image` node. The obvious fix is also
 * a bet on a schema this app does not own: Crepe's image feature replaces the
 * plain commonmark image with block and inline nodes of its own, each with a
 * component that renders — and re-renders — its own `<img>`. A node view would
 * have to name those types, fight the components for the element, and be
 * rewritten the next time Crepe rearranges them.
 *
 * Watching the editor's DOM instead is indifferent to all of it. Whatever node
 * put an `<img>` on the page, if its source is relative it gets the bytes; and
 * when a component redraws and puts the raw path back, the observer sees that
 * too and resolves it again.
 *
 * Mutation records rather than a document-wide sweep on every change: the file
 * this was reported from holds ~640 images, and re-scanning all of them on each
 * keystroke is the kind of fix that trades a broken picture for a slow one.
 *
 * Where the paths are read from is passed in by the editor that installs the
 * plugin, rather than taken from a module-global: two panes hold two files, and
 * an image in one must not be read out of the other's repository.
 */
import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { ABSOLUTE_SRC, assetPath, assetUrl, cachedAsset } from "./html-view";

/**
 * Which repository, and which file within it, an editor's relative paths are
 * relative to.
 *
 * Read through a function rather than taken once: an editor keeps its instance
 * across a file swap, so the plugin outlives any single document. And it is
 * the editor's own — not the module-global `htmlContext` — because two panes
 * can hold two files at once, and the second to open must not decide where the
 * first one's pictures are read from.
 */
export type AssetContext = () => { repo: string; relPath: string };

/**
 * A 1×1 transparent GIF, worn while the real bytes are being read.
 *
 * The relative path has to come off the element before the browser acts on it,
 * or the request fails against the app's origin within the same tick and the
 * reader sees a broken frame flash. Removing the attribute outright is not an
 * option here: an image component with no source shows its "add an image"
 * placeholder, which is a worse flash. So the source is replaced rather than
 * removed, with something that loads instantly and shows nothing.
 */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** The path this image is waiting on, so a redraw does not ask again. */
const PENDING = "plansAsset";

function missing(img: HTMLImageElement, rel: string, why: string) {
  img.setAttribute("src", BLANK);
  img.classList.add("md-asset-missing");
  img.alt = `image did not load — ${rel} (${why})`;
  img.title = img.alt;
}

function resolved(img: HTMLImageElement, url: string) {
  img.classList.remove("md-asset-missing");
  img.setAttribute("src", url);
}

function resolveImage(img: HTMLImageElement, context: AssetContext) {
  // The HTML view resolves the images inside its own fragments, and a
  // <picture> widget resolves the source it chose. Both would be undone here.
  if (img.closest(".md-html")) return;
  // A read already in flight for this element: its `then` will set the source.
  if (img.dataset[PENDING]) return;

  const raw = img.getAttribute("src");
  if (!raw || ABSOLUTE_SRC.test(raw)) return;

  const { repo, relPath } = context();
  const rel = assetPath(relPath, raw);

  const hit = cachedAsset(repo, rel);
  if (hit) return resolved(img, hit);
  // The share page has no repository to resolve against — an image the plan
  // points at on someone else's disk says so, rather than showing a frame.
  if (!repo) return missing(img, rel, "no repository");

  img.dataset[PENDING] = rel;
  img.setAttribute("src", BLANK);
  void assetUrl(repo, rel).then(
    (url) => {
      delete img.dataset[PENDING];
      resolved(img, url);
    },
    (e) => {
      delete img.dataset[PENDING];
      missing(img, rel, String(e).replace(/^Error:\s*/, ""));
    },
  );
}

/** Every image in a subtree, the node itself included. */
function resolveIn(node: Node, context: AssetContext) {
  if (node instanceof HTMLImageElement) return resolveImage(node, context);
  if (node instanceof HTMLElement)
    node.querySelectorAll("img").forEach((img) => resolveImage(img, context));
}

export const imageAssets = (context: AssetContext) =>
  $prose(
    () =>
      new Plugin({
        key: new PluginKey("plans-image-assets"),
        view: (view: EditorView) => {
          const observer = new MutationObserver((records) => {
            for (const r of records) {
              if (r.type === "attributes") resolveIn(r.target, context);
              else r.addedNodes.forEach((n) => resolveIn(n, context));
            }
          });
          /**
           * Synchronous, in the observer's own callback, rather than deferred
           * to a frame: a mutation callback runs as a microtask, before the
           * browser has had a task in which to fail the relative request.
           * Deferred, the error lands first and a component that watches for
           * one has already drawn its broken state by the time the bytes
           * arrive.
           */
          observer.observe(view.dom, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["src"],
          });
          // Whatever is already on the page: the first document is mounted
          // before this plugin's view is built.
          resolveIn(view.dom, context);
          return { destroy: () => observer.disconnect() };
        },
      }),
  );
