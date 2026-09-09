---
status: done
---
# Distill this design

> We should create a storybook that contains the key elements of this design system
>
> - should note things like colours
> - the type first ideas
> - Common components
> - and more

## Problem / context

The design system exists, and it exists in one place: `src/App.css`, whose
first comment is the whole thesis ("the ledger and the page": two
typographic registers held in tension, chrome as ink at varying opacity, the
only chromatic values being the git states). The three papers are forty
lines each at the top of that file, the type choices are a table in
`src/fonts.ts` with a designer and a note per face, and every component is
a class family in the same stylesheet with a paragraph above it saying why.
Someone who reads the source can reconstruct the system. Nobody else can,
and the people who most need to are the ones who never open the CSS: an
agent asked to add a sheet, a contributor asked to draw a new panel, you
six months from now wondering what the approved ink was for.

What is missing is the thing a storybook is: every element on one page,
drawn by the real code, in all three papers, with the rule beside it.

## Approach

**The gallery is a third Vite entry, built from the app's own components.**
The share page already proved the pattern (`vite.config.ts`, `share(mode)`):
a mode with its own `root`, importing `../App.css` and the real `Editor`,
so it can never disagree with the app about a table. The gallery is
`src/design/`, built by `vite build --mode design` into `site/design/`, and
the site workflow deploys `site/` as it does today. So the storybook is at
`plans.ratulmaharaj.com/design/`, one link from the marketing page, and it
is React rendering `Avatar`, `Dropdown`, `TextPrompt`, `MatterPeople`, the
tree row, the palette row, the status badge and the editor with a sample
document in it. A change to `.rail-btn` changes the gallery on the next
build; a screenshot would have been stale by the second release.

Why not Storybook the tool: it is a second dev server, a second config, a
dependency an order of magnitude larger than the app's UI code, and its
job is isolating components that here are deliberately not isolated; the
page and the ledger are a relationship, and the gallery should show them
together. Ladle and Histoire are smaller and have the same shape. One page
we own is the smallest thing that does the job, and it costs no dependency.

**The page is a document, in the design's own voice.** Sections down the
page, each a heading, a paragraph of the rule in prose, and the elements
drawn live under it:

1. *The thesis.* The ledger-and-page paragraph from `App.css`, quoted, and
   the two registers side by side: a run of body prose in the reading
   face next to a tree row and a rail button in Space Mono.
2. *Paper and ink.* The three papers as switchable, the whole page
   re-inking when you pick one, the way the Aa menu does. Under it the
   token table: `--paper`, `--raised`, `--shade`, `--ink`, `--ink-2`,
   `--ink-3`, `--rule`, `--rule-strong`, each a swatch with its hex read
   from the live computed style, so the table cannot drift from the
   stylesheet.
3. *Colour means a difference.* The three git inks and where each is
   used, the approved mulberry and why it sits between ready and done, the
   five code inks and the diff pair, the five alert inks, the six chart
   series. Each swatch names the token; the prose names the rule that
   made it.
4. *Type first.* The five faces from `FONTS`, each set in a paragraph of
   the same text with its designer and note, the measure and size sliders
   the reader has, and the mono voice: uppercase, tracked, small, and the
   places it goes.
5. *The ledger's parts.* Rail button, tree row with each git mark and
   status dot, the workspace heading with its counts, the status badge in
   every tone, the palette row, a dropdown, a sheet with a one-line
   question, an avatar and a row of faces, the page head with owner,
   reviewers and the two offers.
6. *The page's parts.* One sample markdown document in the real read-only
   `Editor`: headings, a list, a table, a code block with every token
   class, a mermaid diagram, an alert of each kind, a comment thread, a
   suggestion card, a frontmatter block. This section is the editor
   rendering the same fixture the e2e use, so what the gallery shows is
   what the tests hold still.

**The tokens are read, never retyped.** Every swatch's hex is
`getComputedStyle(root).getPropertyValue(name)` at render time. The
gallery lists the token names; the stylesheet supplies the values. If a
token is renamed the swatch goes blank and the drift is visible, which is
the failure mode we want.

Costs. The gallery is a second build in CI and a second bundle of the
editor on the site; the share page already pays that and it has been fine.
It is desktop-sized and will scroll on a phone rather than reflow. It shows
components with the props they are given, so a state the gallery does not
name (a conflict bar, the chat transcript) is a state the gallery does not
show; the sections are the common parts, and the rest can be added when
someone reaches for them.

## Implementation guide

- [x] `vite.config.ts` - a `design(mode)` beside `share(mode)`: root
      `src/design`, `publicDir: false`, out `../../site/design`, base
      `/design/`
- [x] `package.json` - `build:design`; `site.yml` installs, builds the
      gallery, then uploads `site/`
- [x] `src/design/index.html`, `main.tsx` - the entry, importing
      `../App.css`, applying default settings and the chosen paper
- [x] `src/design/Gallery.tsx` - the six sections above, each a component
      of its own file under `src/design/sections/`
- [x] `src/design/tokens.ts` - the token lists (paper and ink, git, status,
      code, diff, alerts, chart) with the one-line rule for each, read live
      by a `Swatch`
- [x] `src/design/sample.md` - the fixture the editor section renders
- [x] `src/design/gallery.css` - the gallery's own layout only; nothing that
      restyles an app element
- [x] `site/index.html` - a "Design" link beside GitHub
- [x] `e2e/design.spec.ts` - the gallery builds and renders: every section
      heading present, every swatch non-empty in each paper, the editor
      section shows a comment card and a suggestion card

## Out of scope

- Storybook, Ladle or any story format; there are no stories, there is one
  page.
- Documenting the chat panel, the git panel, settings pages, the terminal:
  each is a screen rather than an element, and the marketing site's
  screenshots already show them.
- A theme editor or token export. The tokens are CSS custom properties and
  the stylesheet is the source; anyone who wants them can read forty lines.

## Open questions

- ~~A link from inside the app?~~ Decided: no. The gallery is for people
  building the app, and they have the site; a Settings entry can come if
  anyone reaches for it.

## What landed

The gallery went in as planned: `src/design/` is the third Vite entry,
`pnpm build:design` writes it to `site/design/`, the site workflow builds
it before uploading and now also runs when `src/` changes, and the site's
header links to it. Every swatch reads its value from the live stylesheet
when it draws, so switching paper re-reads all forty-odd of them; the e2e
switches through the three papers and checks none came back blank and that
the paper swatch differs between day and night.

Two things were found by looking rather than by planning. A read-only editor
draws frontmatter as a block rather than hiding it, since the button that
hides it belongs to the app's page head; the sample's prose says so instead
of claiming otherwise. And the gallery draws the page head from the review
flow plan, owner and reviewer states and the Approve offer, so that branch
is merged into this one; the two ship in that order.

- `vite.config.ts` `design(mode)`, `package.json` `build:design`,
  `site/design` ignored like `server/public`.
- `src/design/Gallery.tsx` and six sections under `sections/`;
  `tokens.ts` lists names and rules only; `sample.md` is the editor's
  fixture; `gallery.css` is layout and never restyles an app element.
- `e2e/design.spec.ts` renders the gallery from the dev server at its
  source path, which is the same page the site build serves at `/design/`.
