---
"plans": patch
---

The iOS app no longer aborts at launch when built with a current Xcode. UIKit
now requires an app to adopt the scene lifecycle, and tao has a scene
delegate ready for it; the app's Info.plist declares that delegate, which is
what was missing.
