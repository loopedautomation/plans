---
status: done
---
# The phone works in workspaces

> Once you're done with distilling the design, I want you to build a react
> native or tauri mobile app (if it's in a good enough state). Mobile should
> operate on the workspaces with a ssh being the way we get agent repo access

## Problem / context

There is a phone app, and it is Tauri. [ssh](ssh.md) built it: `pnpm tauri
ios dev` runs a `MobileApp` with three screens, Computers, Files and
Document, that browses a remote root over SSH and reads a file in the same
read-only editor the share page uses. The iOS project is generated and
checked in; Android needs an SDK on the machine that runs `tauri android
init`, and nothing else. That is a good enough state to build on, and it
answers the seed's first question: Tauri, because the shell, the editor, the
theme and the Rust core are already the app's own, and a React Native app
would be a second app that had to keep up with the first.

What the phone cannot do is the thing the seed asks for. It has no account,
no workspaces, no live document. Everything collaborative in this app lives
in a workspace (a folder of files on the server, edited together, with
comments, reviews, suggestions and an agent that can be asked in), and the
phone can see none of it. The SSH slice reaches a computer's repositories,
which is the right way for a phone to get at an agent's working tree: the
agent runs there, the files are there, and the phone reads them. But the
place a person on a phone actually does something, leaves a comment,
approves a plan, answers a question, is a workspace.

## Approach

**Two tabs: Workspaces and Computers.** Workspaces is the phone's home; it
is where the person acts. Computers is the SSH shell as it stands, one tab
over, and it is how a repository an agent is working in gets read from the
phone. Nothing about the SSH slice changes; it gains a tab bar and loses the
assumption that it is the whole app.

**Workspaces are the desktop's rooms, on a smaller screen.** The client is
already shared: `workspace.me()`, `workspace.list()`, `openRoom` for the
tree and for a document, `treeEntries` for the folder, `Editor` with a
`room` for the live text. The sign-in sheet is the desktop's device-code
sheet; it opens the browser, and the phone's browser is a fine place to
type a code. The token goes to the OS credential store through the same
Rust command the desktop uses, which the SSH work already built for iOS and
Android. So the screens are:

1. *Workspaces* lists the person's workspaces, or offers Sign in.
2. *Folder* is one workspace's tree, one directory at a time like the SSH
   Files screen, with each file's status dot from the tree's copy.
3. *Document* is the live editor bound to the file's room: editable,
   collaborative, with comments, suggestion cards and everyone's cursors,
   signed with the person's login. Back closes the room.

The editor is the app's, so a suggestion card's Accept works on the phone
because it works in the editor, and a comment reply is signed because the
author is the login. None of that is mobile code.

**What the phone does not get, and why.** No chat panel: an agent in a
workspace runs in the desktop app's scratch folder on a computer, and the
phone has no computer to run one on. That is exactly what the Computers tab
is for, and asking the desktop's agent from the phone is the next plan, not
this one. No git, no repositories on the device, no palette, no split. The
phone reads a computer over SSH and works in a workspace over the server,
and that is the whole of it.

The cost of two tabs is one more state to keep straight: which stack the
person is in. It is kept as a single `tab`, and the bar is drawn only at the
root of each stack, so a document is a document and Back means Back.

## Implementation guide

- [x] `src/mobile/WorkspacesTab.tsx` - the three screens above over the
      shared client: account, list, tree room, document room; sign-in via
      `SignInSheet`; sign-out
- [x] `src/mobile/MobileApp.tsx` - a `tab` and the bar; the SSH screens
      unchanged under Computers
- [x] `src/mobile/mobile.css` - the tab bar, the workspace rows, the status
      dot, and the sign-in sheet at phone width
- [x] `e2e/workspace.spec.ts` - a phone boots signed in against the test
      server, sees the workspace alice made, opens the file and reads what
      alice typed; types a line that reaches alice

## Out of scope

- Chat with an agent from the phone. Depends on a computer to run it on,
  which is the Computers tab plus a plan of its own.
- Creating workspaces, inviting, renaming, moving files. The desktop does
  all of it, and a phone that reads and comments is the first thing worth
  having in a pocket.
- Android generation on this machine: no SDK here. The configuration is in
  place; the command is in the README.

## Open questions

- Should the phone remember which workspace and file were open, and reopen
  them on launch? Leaning yes, in settings the way the desktop keeps tabs,
  once someone has used it for a week and knows whether that is what they
  want.
  - Answer:

## What landed

The two tabs, as designed. `WorkspacesTab` is the home: sign in with the
desktop's device-code sheet, the list of workspaces, a folder one directory
at a time with each file's status from the tree's copy, and the live
editor bound to the file's room, editable and signed with the login. The
SSH shell is unchanged under Computers, and its spec now taps the tab
first. A phone in the workspace e2e reads what the desk typed and types a
line the desk sees.

One thing was found by doing rather than planning, and it was in the
editor, not the phone. Leaving a document unmounts the editor while its
room is still live, and the collab plugin dispatches every remote update
and cursor move into the view; an update arriving while destroy() was
taking the context down threw "editorState not found" from inside the
plugin. The editor now disconnects the collab service before it is
destroyed, so nothing more arrives. The desktop had the same gap and never
hit it in a test.

Rooms close half a second after the screen that held them, the desktop's
rule for the same reason: a Y.Doc destroyed under a live binding throws.
