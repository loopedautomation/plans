---
"looped-plans": patch
---

An agent in a workspace now has the conventions. Its scratch folder had none
— a repository gets them from a button in Settings, and a workspace's folder
is nobody's to press a button for — so every document it wrote there was
written as if there were no rules. The folder gets the skills the first time
it is made, and the sweep that keeps it honest leaves them alone. For Claude
Code the install also writes a short section into `CLAUDE.md`, which it reads
on every turn, saying which skill to open before which kind of work: a skill
under `.claude/skills/` is offered, not applied, and the writing rules were
being offered to a model that did not think to take them. A repository that
already has the conventions will show an update in Settings for this.
