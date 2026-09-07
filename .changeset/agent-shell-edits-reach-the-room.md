---
"looped-plans": patch
---

An agent's edit to a workspace file that never came through the app — a
`sed -i` in its shell, a heredoc, an agent whose adapter writes straight to
disk — used to land in the scratch folder and nowhere else: not in anyone's
editor, and gone on the next rewrite of the folder. The folder now remembers
what it put on disk, notices a file that no longer reads as that, and the app
turns the change into an edit of the shared document the moment the tool call
finishes — the same way a write through the client lands. A file the agent
makes on disk is added to the workspace the same way. The folder itself has
moved out of the cache directory to `~/plans/workspaces/<id>` (the same path
under the home folder on Windows and Linux), where a person can find it and a
disk cleaner will not empty it under a running agent.
