---
"looped-plans": patch
---

Signing in to workspaces no longer fails with "Platform secure storage
failure: User interaction is not allowed" on a Mac whose login keychain is
locked or on an old password. A keychain that refuses to answer is treated
the way a missing one is on Linux: the token goes to a 0600 file under the
app's config directory instead, and the log says so once.
