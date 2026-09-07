---
status: draft
---
# opengraph

We should have dynamically generated og images for the shared documents
(maybe with the title and the first few lines) + frontmatter rendered out if
applicable e.g. author, status etc.

Follows on from public-plan-pages.md (which shipped the pages these tags
decorate) and workspace-lifecycle.md (which will grow the frontmatter worth
showing).

## The real problem is that unfurlers see nothing at all

The reader is a client-side SPA: `reader()` serves the same
`server/public/index.html` shell verbatim for `/` and every `/{id}`
(server/src/index.js:522–556), and the shell carries only charset, viewport,
and a robots noindex — no og tags, no title, nothing
(src/share/index.html:4–8). Even the page title is set by JavaScript after
the fetch (src/share/Page.tsx:81). Unfurlers don't run JavaScript, so a plan
pasted into Slack today previews as a bare URL. The og *image* is the
headline ask, but it's the second half of the fix; the first half is that
the shell needs per-page `<meta>` at all. Do both in one motion, because the
mechanism is the same: the server, which already special-cases `/{id}` via
`ID_PATH` (server/src/index.js:503), templates the shell instead of serving
it verbatim.

That templating is deliberately dumb: the shell gains one placeholder
comment in its `<head>`, and the server string-replaces it with escaped
`og:title`, `og:description`, `og:image`, `og:url`, and
`twitter:card=summary_large_image` when the id resolves via `readPage`
(server/src/index.js:96–113), or with nothing when it doesn't — a dead id
must serve the identical shell as today, so an unfurler probing ids learns
nothing a browser wouldn't. This is not SSR and must not drift toward it:
the page body stays client-rendered, the shell stays one file, and the
replacement is a handful of lines in `reader()`. The existing
`Cache-Control: no-store` on the shell (server/src/index.js:553) already
guarantees the tags are as live as the document.

## What leaks into the preview is a deliberate act of publishing

The old fragment-token design bragged that "link unfurlers can't leak
content" (plans/sharable-links.md:66) — that was a virtue when the secret
rode in the fragment. public-plan-pages.md changed the speech act: the id is
the address, the page is public, and anyone holding the URL sees the whole
plan. An unfurl that shows the title and opening lines reveals a strict
subset of what one click reveals; refusing to unfurl protects nothing and
just makes shared plans look broken next to every other link in the
channel. So the card shows, unapologetically: the document's first heading
(falling back to the page's stored name), the first paragraph or two of
body text, and the frontmatter that the reader itself already wears —
`status` and `owner`/`assignee` are exactly the keys `Page.tsx` reads
(src/share/Page.tsx:108–123), so the card and the page agree about what
matters. Frontmatter keys beyond those stay off the card; a preview is a
chip, not a table.

Extraction reuses the conventions the codebase already has rather than
inventing server-side parsing: frontmatter splits on the same "`---` at
byte 0, line-based `key: value`" contract as `src/matter.ts`
(src/matter.ts:30–41, :84–93) — the server is plain JS and can't import the
app's TS, so it gets a ~20-line sibling, not a YAML library, exactly as the
first viewer did. The description is the first non-heading, non-fence,
non-comment paragraph of the body, markdown syntax stripped naively and
truncated around 200 characters; HTML comments are the comment format
(plans/collaboration.md:52–54) and must not surface in a preview any more
than they do on the page.

## The image is satori, not Chromium, and not SVG on the wire

The server's ethos is one Node process on `node:http`, no framework
(server/src/index.js:48), and nothing image-shaped exists in any
package.json today. The two ways to make a picture without betraying that:

- **Headless browser screenshots.** Rejected for the same reason
  sharable-links.md rejected server-side PDFs (plans/sharable-links.md:97–99):
  the moment the server wants Chromium, the scope has slipped. Playwright in
  the repo is a test devDependency, not a runtime.
- **`satori` + `@resvg/resvg-js`.** Satori turns a JSX-ish element tree into
  SVG in pure JS; resvg (a small native/wasm binding) rasterises to PNG.
  PNG matters — the major unfurlers don't render SVG `og:image`. Two
  dependencies, no browser, runs happily in the Alpine image the Dockerfile
  already builds. Satori needs a real font file: ship one TTF (the reader's
  face, or Inter) into the image alongside `server/public/`.

The route is `GET /api/pages/:id/og.png`, unauthenticated like
`GET /api/pages/:id` itself (server/src/index.js:323–325) and 404-ing
through the same never-403 door when the id is dead. Rendering on request
keeps workspace-sourced pages honest — their markdown is live from the room
(server/src/index.js:96–113), and a card frozen at publish time would show
reviewers a title the authors renamed. The card renders from the same
extraction as the meta tags (one function, two consumers), in a fixed
1200×630 layout: title large, snippet under it, status chip and owner in a
footer row, the app's wordmark small in a corner. Any failure in
satori/resvg — bizarre unicode, an empty document — answers with a static
branded fallback PNG, never a 500; an unfurler that gets an error caches
the brokenness.

Give the PNG a short `Cache-Control` (say `max-age=300`) rather than
`no-store`: unfurlers cache aggressively on their own schedule anyway, and
five minutes keeps a Slack channel full of the same link from rasterising
per view, while a republished plan's card still catches up.

## What this deliberately does not touch

The marketing site keeps its hand-written static tags and screenshot
(site/index.html:11–19) — it's GitHub Pages with no server to render
anything, and one page needs no generator. Legacy `/share#token` links stay
unfurlable-as-nothing: their shell (server/src/share.html) has no id in the
path to resolve, which was that design's point. And the robots noindex on
the reader shell (src/share/index.html:7) stays — unfurl-on-paste and
index-by-crawl are different consents, and adding og tags must not quietly
grant the second.

## Open questions

- **How much body text is too much?** First paragraph, ~200 chars, is the
  proposal. A plan whose opening line is the sensitive part ("we are
  acquiring X") leaks it into every chat log the link touches. Is that the
  sharer's problem (they published it), or should the card offer a
  title-only mode — or read a frontmatter key like `description:` as an
  override when present?
- **Theme of the card.** The reader follows the viewer's theme; a PNG can't.
  Pick one — dark reads better in most chat clients — or render per the
  fetching client's hints (unfurlers send none, so realistically: pick one).
- **Does `og:url` use the request host or a canonical one?** The server can
  be self-hosted (src/workspace.ts:28–36 builds URLs from
  `VITE_WORKSPACE_URL`); deriving from the request's Host header keeps
  self-hosted instances honest but trusts a header. A `PUBLIC_URL` env var
  is the boring safe answer.
- **Wordmark and font.** Which face ships in the image, and is there a small
  SVG/PNG wordmark to stamp on the card, or does the corner just say
  "plans" in the font?

## Next

- [ ] `og.js` (or a section of index.js): shared extraction — line-based
      frontmatter split mirroring src/matter.ts:30–41, first-heading title,
      stripped-and-truncated first paragraph
- [ ] Placeholder comment in src/share/index.html `<head>`; `reader()`
      replaces it with escaped meta tags when `ID_PATH` matches and
      `readPage` resolves, with nothing otherwise
- [ ] `satori` + `@resvg/resvg-js` in server/package.json; one TTF added to
      the Docker image; `GET /api/pages/:id/og.png` rendering the 1200×630
      card, static fallback PNG on any render error, `max-age=300`
- [ ] server/test: `GET /{id}` HTML contains escaped og:title/description
      and the image URL; dead id serves the untouched shell; `og.png`
      answers `image/png` and 404s for a revoked page
- [ ] Sanity-check a real unfurl (Slack or opengraph.xyz) against
      plans.looped.sh once deployed
