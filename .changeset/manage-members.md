---
"looped-plans": minor
---

A workspace's members can be managed. The page head's Invite button is
Members now, and opens a sheet listing everyone in the room — face, name
and login, the owner marked, and who is in the workspace right now — with
the invite field in its foot. Any member may invite; only the owner may
remove someone, and a removed member is cut off at once rather than at
their next reconnect: their open editors close, the shelf leaves their
sidebar, and a line says why. The owner may also hand the workspace to
another member, after which they are an ordinary member and may leave.
Behind it, one route serves both ways out — `DELETE
/workspaces/{id}/members/{login}` is a leave for your own login and a
removal for anyone else's — and a removed member's read tokens go with
them; share links stay the workspace's.
