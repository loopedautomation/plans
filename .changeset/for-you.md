---
"plans": minor
---

The workspaces now tell you what is waiting on you. A review you were asked
for, a plan of yours that everyone has approved, a suggestion someone left on
it: each is a row at the top of the palette under *For you*, a count on the
workspace's heading in the tree, and a heavier name on the file. All of it is
read from the tree's copy of each file's head, which now carries `owner:`,
`reviewers:`, `approved:` and the count of open suggestions beside `status:`,
kept by whoever has the file open and repaired by the server for the files
nobody has. Nothing records what you have seen; opening the file is the read.

When the window is not in front, a gained entry posts a system notification
naming the file and the reason. The first look after signing in is the
baseline and posts nothing, so a laptop opened after a weekend shows a count
rather than a burst.

The page head reads as one sentence now: the owner with their face, then the
reviewers, each asked, commented or approved. A reviewer who has left an open
thread is drawn with a speech mark until they approve. Approve sits in the
header beside the handles for a reviewer who has not yet, the twin of Mark
approved. Requesting a review writes `owner:` into a file that never said
whose it was.
