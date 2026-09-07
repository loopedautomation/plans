---
"looped-plans": patch
---

A comment signed with an email renders as a comment again. A workspace login
is an email, and the card's `@handle:` grammar stopped at the second `@`, so
`<!-- @ratul@example.com: … -->` was not read as a turn at all: the raw line
showed, unsigned, and no member was looked up for a face. Handles may now be
emails, the card draws the part before the `@` with the full login on hover,
and typing `@` completes to an email too. A new setting, "Workspace comments
sign as", signs a workspace comment with git's name instead of the account
for anyone who wants a room's comments to read like a repository's.
