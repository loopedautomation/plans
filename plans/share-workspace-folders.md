---
status: ready
---
# Share a workspace folder as one public page

> Write a plan for sharing workspace folders publically. Maybe with a
> minimal sidebar of the shared files as well

## Problem

A shared page is one file. `public-plan-pages.md` made sharing a plan a
matter of one random id per file (`server/src/db.js:346-359`), and that
shape is the right one for a plan that stands alone. It falls over the
moment plans refer to each other, which in a workspace they do: a meal plan
links to the diet it was built from, a roadmap links to the plan for each
item on it. On the public page a relative link does nothing at all
(`src/share/Page.tsx:153-162`), on the reasoning that there is nothing on
the far side of it to open. That reasoning holds for a single shared file.
When both files are shared, each has an id the other knows nothing about,
so the reader gets two links from you and a dead link between them.

Stopping has the same shape. Stop revokes one id (`db.js:392-398`), and
sharing the file again mints a new one, so a set of shared plans is a set
of addresses to hand out and a set of addresses to kill.

The workspace side already has what a folder page needs. A workspace page
stores no markdown; it reads the room by workspace id and path on every
request (`server/src/index.js:96-107`), and the reader polls it every five
seconds (`Page.tsx:40-77`). The server can already list a workspace's tree
and answer any path in it (`index.js:389-410`), though only to a member or
to the factory's token.

## Approach

A page can name a folder. Its `path` is a prefix ending in `/`, with the
empty prefix meaning the whole workspace, and everything under that prefix
is readable at `plans.looped.sh/{id}/{path}`. One id, one Stop, and a
relative link between two files in the folder is a link that works.

**One page row, one more shape of `path`.** The `pages` table stays as it
is (`server/src/schema.js:80-95`). A folder page is a workspace page whose
`path` ends in `/`. The partial unique index on live workspace pages keys on
that string, so a folder and a file inside it can both be live, and two
members sharing the same folder at once still get one URL, which is the
promise the index was written for.

**Two reads, both public.** `GET /api/pages/{id}` on a folder page answers
the folder: its name, the files under the prefix as the tree has them now
and which of them is the landing file. `GET /api/pages/{id}/{path}` answers
one file's markdown, and only if `path` starts with the prefix; anything
else is the same 404 a stopped page gets, because a page id must never be a
way to read outside what was shared. Both read the room the way `readPage`
does today, so the folder follows the workspace as people add and rename
files in it. A file page keeps answering exactly as it does now.

**The reader gets a sidebar.** On a folder page the reader shows a narrow
list of the shared files to the left of the document, grouped by
subfolder, with the open file marked. Clicking one changes the address with
`pushState` and swaps the document; the back button works because the
address is the state. On a phone the list collapses into a button in the
head that opens it as a sheet, since the measure is the whole width there.
The list comes back with every poll, so a file added to the folder shows up
without a reload.

**Relative links resolve inside the share.** `openLink` resolves an `href`
against the file being read, and if the result is a file under the prefix
it navigates within the page. A link to something outside the prefix stays
inert, as every relative link is today. A link with a scheme still opens in
a new tab.

**The landing file.** Opening `/{id}` with no path shows `README.md` if the
folder has one, then `plan.md`, then the first file in tree order. That is
also what the sidebar marks as open.

**Sharing from the app.** A workspace folder's context menu and a workspace
heading's context menu get "Share this folder…" and "Share this
workspace…", which open the same share sheet the page uses
(`src/ShareSheet.tsx`) with the folder's name. Publishing calls the existing
`publishWorkspace` with a path ending in `/` (`src/workspace.ts:234`), and
the app remembers the page under a share key for that prefix, the way it
remembers a file's (`src/App.tsx:2467-2493`). Stop is the same Stop.

**Costs.** A folder share is broader than a file share by design: every file
under the prefix is public while the share is on, including one someone
adds tomorrow without thinking about the link. The sheet says so in a
sentence. Repository folders are left out for now, because a repository
page is a copy pushed on every save (`db.js:315-334`) and a folder of them
would be a copy per file per save, which is a different amount of traffic
and a different design.

The alternative was to keep one page per file and teach the reader to
follow a relative link by looking up whether the target file has a live
page of its own. It keeps every id independent, but it makes a link work or
fail depending on what the author remembered to share, and it still leaves
a set of addresses to stop one by one. Naming the folder is the simpler
promise.

## Implementation guide

- [ ] `server/src/db.js` - `publishWorkspacePage` accepts a `path` ending in `/` (and `""` for the whole workspace) and normalises it; add `pageFile(page, path)` that checks the prefix; `page()` and `workspacePage()` unchanged
- [ ] `server/src/index.js` - `readPage` answers a folder page with `{ kind: "folder", name, prefix, files, landing }` built from `rooms.tree`; new `GET /pages/{id}/{path}` route answering one file's markdown under the prefix; the reader's `ID_PATH` (`index.js:509`) allows `/{id}/…` so a deep link serves the app
- [ ] `server/src/index.js` - the `POST /pages` name for a folder is the workspace name, or `${w.name} / ${folder}` for a subfolder
- [ ] `server/test/server.test.js` - a folder page lists its files and answers a file under it; a path outside the prefix is 404; stopping the folder kills every path at once; a file page is unchanged
- [ ] `src/share/pages.ts` - `pageId()` returns `{ id, at }` from `/{id}/{path}` or `?id=&at=`; `fetchPage` returns a file or a folder shape; `fetchFile(id, path)`
- [ ] `src/share/Page.tsx` - render the sidebar for a folder page; navigate with `pushState` and `popstate`; resolve relative links inside the prefix in `openLink`; keep the file page rendering as it is
- [ ] `src/share/page.css` - the two-column layout, the open file's mark, and the collapse to a head button below the narrow breakpoint
- [ ] `src/FileTree.tsx` - "Share this folder…" on a workspace folder's menu and "Share this workspace…" on a workspace heading's menu, through a new `onShareFolder(repoPath, dir)` prop
- [ ] `src/App.tsx` - a share target for a folder (kind `"workspace"`, path ending in `/`, share key for the prefix); the sheet's copy names the folder and says everything under it is public
- [ ] `src/ShareSheet.tsx` - a line for the folder case: what is shared, and that files added later are shared too
- [ ] `e2e/workspace.spec.ts` - share a folder from the tree, open the page as a reader, see the sidebar, follow a relative link between two files in it, add a file and see it appear, stop and see the whole set go
- [ ] `.changeset/share-workspace-folders.md` - the change, in the changelog's voice
- [ ] `server/README.md` - the two reads and the prefix rule, beside the page API

## Out of scope

- Repository folders. A repository page is a copy pushed on save; a folder of them is a later plan if it is still wanted after this one ships.
- Expiry for pages. A page lives until Stop, as it does today; the 30 day expiry stays with share tokens (`db.js:42-50`).
- Editing, comments or presence on the public page. A reader is anonymous and reads.
- Open Graph tags for folder pages. `opengraph.md` owns that and can extend to the landing file.

## Open questions

- Should a file inside a shared folder also be shareable on its own, with a
  second id? Leaning no for now: when the file is under a live folder
  share, its Share button offers the folder page's address for that file
  instead of minting another id, and Stop on the sheet stops the folder.
  One address per thing is easier to reason about when the time comes to
  kill it.
  - Answer:
- Is sharing a whole workspace allowed, or only a subfolder? Leaning yes:
  the empty prefix is the natural case and the first thing someone will
  try.
  - Answer:
- Which file lands first when the address has no path? Leaning `README.md`,
  then `plan.md`, then the first file in tree order, with the sidebar
  showing the rest.
  - Answer:
- Should a folder page expire after a period without a visit? Leaning no:
  a file page does not, and two rules for one sheet is confusing. If the
  worry is a forgotten share, the sheet could list every live share of the
  workspace so there is somewhere to find them.
  - Answer:
