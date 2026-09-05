---
"looped-plans": minor
---

The palette's `*` mode grows into the global search it was already halfway to
being. It searches every open repository at once rather than only the active
one — a hit is labelled with the repository it came from, and a chip in the
footer narrows it back to this one when that is what you meant. Searching all
files is the default, because a search that quietly means "these files" is the
one that answers "no such thing" when it meant "not here".

Results are grouped under the file they came from, and the budget is now spent
fairly. A search used to have one cap of sixty lines for the whole thing, so a
single hit-dense file could take all of it and every later file went unread —
sixty lines from one file, presented as a search of the repository. Each file
may now take five of that quota, and its heading says how many further matches
it is holding back. Enter on a line opens there; Enter on a heading opens the
file at its first hit; both arrive with the find bar already seeded.

Beside the results there is now a preview: the raw lines around the highlighted
hit, with the match marked, following the arrow keys as the selection moves —
so a hit can be judged without opening it. It is plain text rather than a live
editor on purpose, and it stands down on windows too narrow to hold it without
crushing the list.

⌘⇧F opens the palette straight into the mode, alongside a "Search inside every
file" command, and the scope is also a setting on the Settings page.
