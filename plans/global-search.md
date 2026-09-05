---
status: ready
---
# Global Search

> Would be good to have a way to search through all files — would be nice to
> take inspiration from telescope / neovim style search.

## Problem / context

Global search half-exists, and the plan has to start by admitting it. The
palette's `*` mode already searches file contents (`Palette.tsx:848-872`)
through Rust's `search_plans` (`lib.rs:626-686`) — case-insensitive
substring, gitignore-respecting via ripgrep's walker (`lib.rs:319-324`),
debounced at 160ms, and a hit already opens the file *with the find bar
seeded* — query prefilled, nearest match to the hit line current
(`App.tsx:6871-6880`, the "missing half" that
[`search-inside-a-file.md`](search-inside-a-file.md) built). The VS Code
preset even binds ⌘⇧F to it. So "a way to search through all files" is not
the feature; the seed's second clause is.

What telescope actually is — the reason people miss it — is three things the
`*` mode lacks:

1. **A live preview.** In telescope you see the hit *in situ* before you
   commit to it; here you get a 160-char trimmed line (`lib.rs:663-668`) and
   have to open the file to learn whether it was the right one. Nothing in
   the app previews a file without opening it — the palette's DOM is input,
   list, footer, and that's all (`Palette.tsx:1035-1104`).
2. **All repos.** File-name search spans every open repo
   (`Palette.tsx:958-971`); content search takes exactly one —
   `props.searchRepo` is the active repo (`App.tsx:6865`) and the row's
   `run` bails without it (`Palette.tsx:938`). In an app whose sidebar
   normalises several repos, "search all files" that silently means "search
   this repo's files" is the empty-result-reads-as-does-not-exist trap that
   [`branch-search.md`](branch-search.md) already called out for branches.
3. **Honest results.** The `limit` is a global hit budget, not per file
   (`lib.rs:645-659`): one hit-dense file eats the entire cap of 60 and
   every later file is never read at all. The flat, ungrouped row list
   (`Palette.tsx:933-940`) then hides that this happened. Sixty lines from
   one file is not a search of all files; it is a search that gave up
   without saying so.

## Approach

**Grow the `*` mode; do not build a second surface.** Telescope is a modal
picker with a preview pane, and this app already has the modal picker — the
palette *is* its telescope, with the fuzzy scorer (`score.ts:13-29`), the
modes, the muscle memory. A dedicated full-screen search view would be a
second door to the same answers, and the branch-search plan already
declined exactly that shape once ("filtering, not a second palette with
most of itself amputated" — the argument cuts the same way in reverse). The
work lands in three places.

**The preview pane.** When the palette is in `*` mode, it widens and grows
a second column: results left, preview right, the highlighted row's hit
shown in context. The CSS is genuinely small — `.palette` is a 620px
column flex (`App.css:1212-1221`); `*` mode makes it wider row-flex with
the list capped at its current width. The content is where restraint
matters: the preview is **plain rendered lines around the hit** — fetch the
file, slice a window of ~20 lines centred on the hit line, mark the match —
not a live editor. Mounting a Milkdown or CodeMirror instance per
arrow-keystroke is exactly the cost profile the app's own perf notes warn
about, and `Editor` having a `readOnly` mode (`Editor.tsx:102`) does not
make it cheap to churn. A `<pre>` with a highlight span, styled like the
source view, updated as the selection moves, debounced like everything else
here. Arrow keys move rows and the preview follows — the palette's existing
key handling (`Palette.tsx:1018-1029`) needs no new keys.

**Fair results, grouped.** `search_plans` gets a per-file cap (say 5) under
the global one, so the budget spreads across files instead of drowning in
the first dense one; the doc comment at `lib.rs:628-630` stays true —
substring, not regex, because content search wants literal matching and the
fuzzy scorer would make `plan` match half of every file. The results list
groups hits under their file path the way the tree already teaches paths,
with "+n more in this file" when the per-file cap bit. Grouping also fixes
selection semantics for free: Enter on a hit opens at that line (already
threaded), Enter on a file header opens the file with the bar seeded to its
first hit.

**All repos, with the scope visible.** The frontend fans the query out —
one `search_plans` per open repo, results merged and grouped under
`repoName/relPath` the way file mode already labels multi-repo results
(`Palette.tsx:966-971`). No Rust change: the command's single-repo shape is
right, and fanning out in the caller keeps per-repo failures (a repo on a
slow disk, a huge repo) from blocking the rest. The palette's existing
scope chip (`.palette-scope`, the pattern chats already use) toggles
this-repo/all-repos, defaulting to all — because "all files" is what the
seed said, and the toggle is for narrowing, not for discovering the wider
world exists.

**No index, still.** Re-walking on every debounced keystroke sounds wrong
and measures fine: the walker is ripgrep's, capped at two threads on
purpose (`lib.rs:316-318`), with the whole-file `contains` fast-reject
(`lib.rs:653-655`). Plans repos are small by nature. An index (or a
`grep`-style streaming protocol) is the answer if fan-out across many
repos ever makes the 160ms debounce feel laggy — measure with the PerfHud
first, build second. The one cheap win worth taking now: the fan-out
should reuse the debounce's `live` guard (`Palette.tsx:860-869`) so a
stale repo's late results can't interleave into a newer query's list.

## Open questions

- **Does the preview render markdown or source?** Source (raw text) is
  honest about line numbers and trivially cheap; rendered markdown is what
  the reader will actually see on opening. Leaning source — the hit line
  came from the raw text, and a preview that reflows it can't underline the
  match it is previewing.
- **Where does the preview go on a narrow window?** `min(620px, 100vw -
  64px)` already fights small screens; below some width the preview should
  vanish rather than crush the list. Pick the width in review, like the
  dropdown threshold was.
- **Should `*` search respect `showAllFiles`?** It does today
  (`App.tsx:6868` inverts it into `onlyMarkdown`), and the palette's
  footer toggle flips it — but that couples "what the tree shows" to "what
  search reads". Searching all files while the tree shows only markdown
  seems right for a search whose name is *global*; decoupling means a
  second toggle, which is a control the bar has to justify.
- **Per-file cap value and total cap.** 5-per-file under a 60 total is a
  guess; multi-repo fan-out multiplies the total. Does the cap become
  per-repo too, and does the footer say "60+" the way the find bar's count
  saturates (`FindBar.tsx:44-46`)?
- **Is `*` still the right door?** With a preview pane the mode is much
  heavier than its siblings. ⌘⇧F opening the palette pre-seeded into `*`
  already exists via the preset pack; should it become a default binding
  in `DEFAULT_KEYS` rather than pack-only, now that the mode earns it?

## Next

- [ ] `search_plans` grows a per-file cap under the global limit; "+n
      more" count per file threaded back in the response
- [ ] Results grouped by file in the palette's `*` mode; Enter on hit
      opens at line (existing path), Enter on header opens seeded to first
      hit
- [ ] Fan out across open repos with the `live` guard; merge, group under
      `repoName/relPath`; scope chip to narrow to the active repo
- [ ] The preview pane: widened `*`-mode palette, `<pre>` window of ~20
      lines around the highlighted row's hit, match marked, styled like
      source view; follows arrow-key selection
- [ ] Decide preview width cutoff and the cap numbers in review
- [ ] Promote ⌘⇧F from the VS Code pack to `DEFAULT_KEYS` if the door
      question resolves that way
- [ ] Measure fan-out latency on the largest real multi-repo setup with
      the PerfHud before considering any index; e2e over `*` grouping,
      preview follow, and multi-repo merge — run with the batched suite
