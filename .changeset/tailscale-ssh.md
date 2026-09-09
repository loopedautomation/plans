---
"plans": patch
---

A computer can be reached over Tailscale SSH. The connection sheet has a
third authentication choice, None, for a server that accepts you on
identity alone: nothing is typed and nothing is stored. A server in
Tailscale's check mode answers with a link to confirm in a browser, and the
sheet shows that link instead of calling the connection rejected.

The connection sheet asks for a repository rather than a "remote root": the
path of one git repository on that computer, which the app opens the way it
opens a local one.
