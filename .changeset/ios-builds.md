---
"plans": patch
---

The iOS app builds and installs on a phone. The deployment target rises to
iOS 15, which is the floor current Xcode accepts; the mobile entry point sits
on `run()` rather than on the dev-icon helper it had drifted onto; the three
desktop-only commands that open Finder, the settings file or a terminal say
so on a phone instead of failing to compile; and the iOS configuration names
the signing team so automatic signing works.
