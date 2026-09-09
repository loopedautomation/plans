---
status: done
---
# Browse a remote computer over SSH

> <br />
>
> At some point I want to mobile app. 
>
> This app should be able to connect to my computers over SSH or mosh 
>
> And should allow me to browse through the files in my repos or in a workspace
>
> I think a good first step would just have it be browsing through a workspace.
>
> Similarly, it would be nice if the Plans app could open remote repos in the desktop version as well over SSH

## The first useful slice is a reader

The mobile use case starts when the computer holding the files is somewhere
else. You want to pick that computer, move through a directory and read a plan
without cloning its repository onto the phone. The desktop version has the
same missing source: `open_repo` accepts an absolute local directory, verifies
it with local `git -C` and returns that local path as the repository's identity
(`src-tauri/src/lib.rs:204-236`). Reading and writing then join a relative path
onto that directory and call `std::fs` (`src-tauri/src/lib.rs:496-505`,
`src-tauri/src/lib.rs:783-804`). An `ssh://...` string in the existing
`RepoInfo.path` field would therefore reach local filesystem and git commands
as though it were a directory on this device.

The first release should let you save an SSH connection, choose one remote
root and browse it read-only. It should ship in the mobile app and in the
desktop shelf from the same transport. This is enough to answer the seed's
first question and it gives the later editing work a real source boundary to
build on. Editing, git operations, terminals and agents can follow once we
have used the reader over real home, cellular and VPN connections.

“Workspace” already means a hosted, live folder in this codebase: its truth is
an HTTP API and one websocket per open document (`src/workspace.ts:1-8`), and
the app describes it as a folder edited together and live
(`src/Workspaces.tsx:31-38`). Call the SSH concept a **remote root** in code and
in the UI. A remote root can point at a git repository, a `plans/` folder or
any other directory the account can read. This keeps it distinct from hosted
workspaces and avoids making git a prerequisite for browsing.

## SSH is the file transport

Use one SSH connection with an SFTP subsystem. SFTP gives the app directory
entries, file metadata and file bytes without parsing terminal output. A Rust
client based on [`russh`](https://docs.rs/russh/latest/russh/) and
[`russh-sftp`](https://docs.rs/russh-sftp/latest/russh_sftp/) can live in the
Tauri core shared by desktop, iOS and Android. The project already runs its
backend on Tauri's async runtime (`src-tauri/src/agent/session.rs:10-12`) and
already gates desktop-only dependencies away from mobile targets
(`src-tauri/Cargo.toml:48-53`), so the SSH client belongs beside the filesystem
commands in Rust rather than in a native plugin per phone platform.

Mosh belongs to a terminal feature. It starts through SSH and then keeps an
interactive terminal screen in sync over UDP; its own documentation says it
does not support SSH's non-interactive uses
([mobile-shell/mosh](https://github.com/mobile-shell/mosh#readme)). A file
browser needs named reads and directory listings, so putting mosh underneath
it would require building a command protocol inside a terminal session. The
SSH manager can later open a mosh-backed terminal if roaming shells become a
feature, while SFTP remains the file transport.

The Rust side should own a `RemoteManager` keyed by a generated connection id.
It keeps at most one live SSH session per id and exposes a small command
surface:

```text
remote_connect(id)             -> connected | trust-required | auth-required
remote_list(id, relative_dir)  -> entries in that directory
remote_read(id, relative_path) -> UTF-8 text and a content stamp
remote_disconnect(id)
remote_secret_set(id, secret)
remote_secret_clear(id)
```

`remote_connect` canonicalises the configured root through SFTP. Every later
path is relative to that root and rejects absolute paths, `..` and directory
symlinks before traversal. That is the remote counterpart of `safe_join`,
which currently admits only normal and current-directory components
(`src-tauri/src/lib.rs:14-27`), and of the local walker refusing to follow
links (`src-tauri/src/lib.rs:314-329`). A lost socket is retried once by
opening a new session and repeating the read-only request. The UI keeps the
last successful screen visible with a disconnected label if that retry also
fails.

Directory reads should be lazy. Connecting reads the root; opening a folder
reads that folder. The local app can afford a parallel walk because the data
is on disk (`src-tauri/src/lib.rs:300-331`), though even there the frontend
limits repository walks and runs them on its slower polling cadence
(`src/App.tsx:1434-1455`, `src/App.tsx:1554-1581`). Repeating that recursive
walk as SFTP round trips would make a large remote home directory the price of
opening one plan. `remote_list` returns folders and the files allowed by the
current “all files” setting. For markdown files it may read the 2 KB head with
bounded concurrency so status dots still come from frontmatter, following the
existing head-only parser (`src-tauri/src/lib.rs:239-297`).

There is no background SSH poll in this slice. Pull to refresh on mobile and a
Refresh action on desktop re-read the current directory or file, and bringing
the app back to the foreground refreshes the visible item once. This gives a
sleeping phone and a laptop behind a closed lid an ordinary reconnect path
without keeping a socket alive for the sake of a document nobody can see.

## A connection is configuration plus a secret

Store the non-secret connection record in settings:

```ts
type RemoteRoot = {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  root: string;
  auth: "password" | "key";
  hostKey: string | null;
};
```

The `id` is the stable shelf and tab identity; renaming a connection or
changing its host does not rewrite every key. Host, user and root can live in
the settings file because that file is already the app's cross-launch source
of truth (`src/App.tsx:976-1019`). Passwords, private keys and key passphrases
go into the OS credential store under the connection id. The repository
already uses the `keyring` crate because a bearer token has no place in the
settings file (`src-tauri/Cargo.toml:33-36`), and the frontend already reaches
that store through narrow get, set and clear commands (`src/api.ts:340-346`).

Host verification is part of adding the connection. The first connection
shows the server's SHA-256 fingerprint and waits for **Trust and connect**.
That fingerprint is then saved as `hostKey`. A different key on a later
connection stops before authentication and shows the old and new fingerprints;
accepting the replacement is an explicit action in the connection sheet.
There is no “trust every host” setting.

The first sheet supports a password and an imported OpenSSH private key. It
does not read `~/.ssh/config`, talk to `ssh-agent` or follow `ProxyCommand` in
this slice. Those desktop conveniences have no equivalent on a new phone, and
making the explicit connection work on every target gives us one behaviour to
debug. A hostname provided by Tailscale or another VPN is still an ordinary
hostname to this client.

## Remote roots are their own source kind

Keep `RepoInfo` as the description of a local git checkout. Its frontend shape
is a path, name, branch and list of plan directories (`src/api.ts:9-14`), and
the app persists local repositories as an array of absolute paths
(`src/settings.ts:68-76`). Widening `path` into a URI would leak transport
checks into the file calls that currently accept `(repo, relPath)`
(`src/api.ts:173-184`, `src/api.ts:241-282`) and into agent sessions whose
repository value is their working directory (`src-tauri/src/agent/mod.rs:194-200`).

Use an opaque shelf key such as `ssh:<id>` and recognise it at the same routing
layer that recognises hosted workspaces. The app already shapes hosted
workspace entries into `RepoInfo` and `PlanFile` values for the tree, then
routes an open to the server or disk from one handler
(`src/App.tsx:6343-6413`, `src/App.tsx:6424-6438`). A remote root can use that
pattern while retaining `RemoteRoot` as its real type:

- Expanding a remote folder calls `remote_list` once and adds the returned
  entries to that root's loaded snapshot.
- Opening a remote file calls `remote_read` and records an active source of
  `{ kind: "ssh", id, path }`.
- The tree gets per-source capabilities so a remote menu contains Refresh,
  Connection settings and Forget. Today `FileTree` requires mutation, git,
  terminal and split handlers for every shelf entry
  (`src/FileTree.tsx:188-243`), and `App` supplies all of them unconditionally
  (`src/App.tsx:7223-7267`). Capability data keeps unavailable actions out of
  the menu and drag logic in one place.
- A remote document renders through `Editor` with `readOnly`. That prop already
  exists for documents nobody may type into and removes the caret after the
  editor is created (`src/Editor.tsx:95-104`, `src/Editor.tsx:642-654`). Source,
  Diff, frontmatter editing, sharing, git and chat stay hidden for this source.
- Remote tabs are session-only in this release. The current tab persistence
  already filters sources that cannot be reopened from disk
  (`src/App.tsx:1395-1402`); apply the same rule to `ssh:<id>` until reconnect
  and credential prompts have a good cold-start experience.

This separate type is a little more code now, but it leaves a clear route to
editing later. `remote_write(id, path, content, expect_stamp)` can adopt the
same conditional-write contract as the local backend, which refuses a stale
stamp before writing (`src-tauri/src/lib.rs:780-804`). Git can then become a
second remote capability through SSH exec, and agents can be designed around
an ACP process on the remote computer. None of those decisions have to be
smuggled into a read-only browser.

## The phone gets a phone shell

The desktop shell cannot collapse into the first mobile build. It assumes one
of three desktop platforms and treats every other platform as macOS
(`src/platform.ts:1-24`), the Tauri window requests a 900 px minimum width
(`src-tauri/tauri.conf.json:12-23`) and the React tree covers the app with a
“too small” panel below 520 px (`src/TooSmall.tsx:23-49`,
`src/App.tsx:7195-7197`). The entry point also always mounts the desktop `App`
(`src/main.tsx:1-20`).

Add a small target command in Rust and let the entry point load a dedicated
`MobileApp` on iOS and Android. It has three screens:

1. **Computers** lists saved remote roots and offers **Connect to a computer**.
2. **Files** shows one directory at a time with a back row, pull to refresh and
   the connection state in the header. Tapping a folder drills in; tapping a
   file opens it.
3. **Document** uses the existing read-only `Editor`, with Back, Refresh and the
   relative path in the header.

This shell shares remote types, connection state and commands with desktop.
It leaves the desktop rail, tabs, split panes, keyboard palette, git panel and
chat out of the mobile bundle. The read-only renderer is already shared with
the public page so markdown, Mermaid, code and HTML have one rendering path
(`src/share/Page.tsx:293-304`, `src/Editor.tsx:400-419`).

The Tauri core already marks its run function as a mobile entry point
(`src-tauri/src/lib.rs:1987`), but its one capability file uses the desktop
schema and grants updater and process permissions
(`src-tauri/capabilities/default.json:1-15`). Initialise both mobile targets
and split capabilities by target so a phone build contains the network,
dialog, opener and credential access it uses, while desktop keeps its updater
and process permissions.

## Out of scope

The first release is online and read-only. It remembers connection details,
but it does not persist remote directory listings or document contents. A
disconnected phone can keep reading the screen already in memory; after the
app is killed it has to reconnect. Remote plans may contain unreleased work,
so an offline cache deserves its own storage, encryption and eviction design.

The desktop version will show a remote root beside repositories, but it will
behave as a reader: no edits, drag-and-drop, git panel, terminal, sharing or
agent chat. This smaller promise gives us evidence about authentication,
latency, host reachability and phone suspension before remote writes can lose
work.

## Open questions

- Should the first release allow password authentication, or require an
  imported key? Supporting both is the current design because a phone often
  starts without an SSH key, though key-only would reduce the credential UI.
  - Answer:
- Should desktop import named hosts from `~/.ssh/config` after explicit
  connections work? Leaning yes as a follow-up, with imported hosts copied into
  an ordinary `RemoteRoot` so later behaviour stays explicit.
  - Answer:
- Should remote roots show every file by default on mobile? Leaning no. Match
  the desktop default and show markdown first, with an “All files” toggle for
  source browsing.
  - Answer:
- Is read-only useful enough on desktop to ship beside the mobile reader?
  Leaning yes. It completes the same browse-from-another-computer loop and
  tells us whether remote editing is the next feature people actually need.
  - Answer:
- Should a later offline cache use the device's encrypted storage, and how much
  should it retain? This does not block the online reader. Leaning toward an
  explicit “Keep on this device” action per root rather than caching every file
  that happens to be opened.
  - Answer:
- Which remote execution feature should follow reading: conditional writes,
  git or a mosh/tmux terminal? This does not block the reader. Leaning toward
  conditional writes because the existing editor and stale-write contract give
  that feature the clearest boundary.
  - Answer:

## Next

- [x] `src-tauri/Cargo.toml` - add the shared SSH and SFTP client dependencies,
      the Tokio networking feature and native iOS/Android credential-store
      features
- [x] `src-tauri/src/remote.rs` - implement `RemoteManager`, host-key pinning,
      password/key authentication, root confinement, lazy directory reads,
      stamped UTF-8 reads and one reconnect for read-only requests
- [x] `src-tauri/src/lib.rs` and `src/api.ts` - register the remote state and
      commands, expose the target kind and add the typed frontend API
- [x] `src/settings.ts`, `scripts/settings-schema.mjs`,
      `src/settings.schema.json` and `site/settings.schema.json` - persist
      structured `RemoteRoot` records while leaving credentials in the OS
      store
- [x] `src/RemoteSheet.tsx` - add, edit, trust, authenticate, reconnect and
      forget a saved computer without ever echoing a stored secret
- [x] `src/remote.ts` - hold loaded directories and connection state, merge
      lazy results and refresh the visible directory or file on demand
- [x] `src/FileTree.tsx` and `src/App.tsx` - add remote shelf entries,
      per-source capabilities, lazy folder expansion and the read-only remote
      document route on desktop
- [x] `src/main.tsx`, `src/platform.ts`, `src/mobile/MobileApp.tsx` and
      `src/mobile/mobile.css` - select the mobile shell and build the Computers,
      Files and Document screens around the shared remote client
- [x] `src-tauri/capabilities/`, target-specific Tauri configuration and the
      generated mobile projects - initialise the available mobile target and
      give each target only the plugins and permissions its shell uses; the
      Android generation exception is recorded below
- [x] `e2e/fake-backend.ts` and `e2e/remote.spec.ts` - exercise first-use trust,
      rejected host-key changes, password/key prompts, lazy navigation,
      reconnect, refresh and read-only behaviour at desktop and phone widths
- [x] `src-tauri/src/remote.rs` tests - cover relative-path rejection,
      symlink refusal, fingerprint comparison, UTF-8 errors and reconnect with
      a controllable SSH/SFTP test server
- [x] `README.md` and a changeset - document the read-only SSH slice, the mobile
      build commands and the omitted edit, git, terminal, agent and offline
      capabilities

## Divergences

- `remote_connect` receives the current non-secret `RemoteRoot` along with its
  id because settings are owned by the frontend. The Rust manager still keys
  sessions and credentials only by the stable id, and the remaining command
  surface matches the design.
- `remote_list` returns every direct child and the frontend applies the current
  “all files” setting to the in-memory snapshot. This keeps toggling the setting
  local while preserving the specified lazy SFTP reads and visible behaviour.
- Mobile window and build overrides live in `tauri.ios.conf.json` and
  `tauri.android.conf.json`; the desktop base configuration remains unchanged.
- The iOS project was generated. Android project generation was attempted with
  `pnpm tauri android init --ci --skip-targets-install`, but this machine has no
  Android SDK/NDK or `ANDROID_HOME`. Android-target configuration, capabilities
  and credential-store support landed, and the README records the same command
  to run after installing those prerequisites.

## Landed

The Tauri core now provides a pinned-host, credential-backed, root-confined
SSH/SFTP reader in `src-tauri/src/remote.rs`. Desktop remote roots, connection
management and strict read-only capabilities live in `src/App.tsx`,
`src/FileTree.tsx`, `src/RemoteSheet.tsx` and `src/remote.ts`; the separate phone
shell lives under `src/mobile/`. Target configuration, generated iOS sources,
settings/schema support, documentation, a changeset and desktop/mobile browser
coverage landed alongside them. Rust transport tests, all 303 browser tests,
schema/type checks and both production web builds pass (300 browser tests passed
and 3 screenshot tests were intentionally skipped).
