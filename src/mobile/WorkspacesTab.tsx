/**
 * The phone's home: the person's workspaces, one folder at a time, and the
 * live editor for a file in one.
 *
 * Everything here is the desktop's client on a smaller screen: the same
 * sign-in, the same rooms, the same editor bound to the same Yjs document.
 * The phone has no repository, no git and no agent of its own; what it has
 * is a place to read, comment, approve and answer, which is what a
 * workspace is for. See plans/mobile-workspaces.md.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "../Editor";
import { SignInSheet } from "../SignInSheet";
import { statusTone } from "../matter";
import {
  colorFor,
  configured,
  openRoom,
  token,
  treeEntries,
  treeMap,
  treeRoomId,
  workspace,
  type Account,
  type Profile,
  type Room,
  type Workspace,
  type WorkspaceEntry,
} from "../workspace";

type Screen = "list" | "folder" | "document";

/** Wait for the server's state, or give up quietly: an empty tree is not "no files" until then. */
function settled(room: Room, ms = 4000): Promise<void> {
  if (room.synced) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = room.onSynced(() => {
      clearTimeout(timer);
      stop();
      resolve();
    });
    const timer = setTimeout(() => {
      stop();
      resolve();
    }, ms);
  });
}

const titleOf = (name: string) => name.replace(/\.(md|markdown)$/i, "").replace(/[-_]+/g, " ");

type Props = {
  /** Drawn under the list, at the root of the stack. */
  bar: React.ReactNode;
  onError: (message: string | null) => void;
};

export function WorkspacesTab({ bar, onError }: Props) {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);
  const [list, setList] = useState<Workspace[]>([]);
  const [screen, setScreen] = useState<Screen>("list");
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [tree, setTree] = useState<Room | null>(null);
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [dir, setDir] = useState("");
  const [open, setOpen] = useState<{ entry: WorkspaceEntry; room: Room } | null>(null);
  const rooms = useRef<Room[]>([]);

  const me = useCallback(
    () =>
      account
        ? { name: account.name ?? account.login, color: colorFor(account.login), avatar: account.avatar, login: account.login }
        : null,
    [account],
  );

  // Who is signed in, once, and the list whenever that changes.
  useEffect(() => {
    let live = true;
    if (!configured()) {
      setAccount(null);
      return;
    }
    void workspace.me().then(
      (who) => live && setAccount(who),
      (e) => {
        if (!live) return;
        setAccount(null);
        onError(String((e as Error).message ?? e));
      },
    );
    return () => {
      live = false;
    };
  }, [onError]);
  useEffect(() => {
    if (!account) {
      setList([]);
      return;
    }
    let live = true;
    void workspace.list().then(
      (ws) => live && setList(ws),
      (e) => live && onError(String((e as Error).message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [account, onError]);

  // Rooms close with the screen that opened them; nothing outlives the tab.
  useEffect(() => () => rooms.current.forEach((r) => r.close()), []);

  /*
   * After the editor has let go, never before. An editor bound to a room
   * unmounts on the render the state change causes, and its teardown is
   * asynchronous; a Y.Doc destroyed under a live binding throws from inside
   * the collab plugin. The same rule, and the same moment, as the desktop.
   */
  const release = (room: Room) => {
    rooms.current = rooms.current.filter((r) => r !== room);
    window.setTimeout(() => room.close(), 500);
  };

  const closeDoc = useCallback(() => {
    if (open) release(open.room);
    setOpen(null);
  }, [open]);

  const leaveFolder = useCallback(() => {
    closeDoc();
    if (tree) release(tree);
    setTree(null);
    setEntries([]);
    setCurrent(null);
    setDir("");
    setScreen("list");
  }, [closeDoc, tree]);

  const openWorkspace = async (ws: Workspace) => {
    const who = me();
    const session = await token();
    if (!who || !session) return;
    onError(null);
    const room = openRoom(treeRoomId(ws.id), ws.id, session, who);
    rooms.current.push(room);
    const draw = () => setEntries(treeEntries(room));
    treeMap(room).observe(draw);
    room.onSynced(draw);
    setTree(room);
    setCurrent(ws);
    setDir("");
    setScreen("folder");
    await settled(room);
    draw();
  };

  const openFile = async (entry: WorkspaceEntry) => {
    const who = me();
    const session = await token();
    if (!who || !session || !current || !entry.doc) return;
    onError(null);
    const room = openRoom(entry.doc, current.id, session, who);
    rooms.current.push(room);
    setOpen({ entry, room });
    setScreen("document");
  };

  const profiles: Record<string, Profile> = {};
  for (const p of current?.profiles ?? []) profiles[p.login.toLowerCase()] = p;
  for (const login of current?.members ?? []) profiles[login.toLowerCase()] ??= { login, name: null, avatar: null };

  const here = entries.filter((e) => {
    const at = e.path.lastIndexOf("/");
    return (at === -1 ? "" : e.path.slice(0, at)) === dir;
  });

  if (screen === "list") {
    return (
      <>
        <header className="mobile-head">
          <h1>Workspaces</h1>
        </header>
        <main className="mobile-list" data-testid="workspaces">
          {account === undefined ? null : !account ? (
            <p className="mobile-empty">
              A workspace is a folder of files, edited together and live.{" "}
              {configured() ? "Sign in to open one." : "No workspace server is configured on this phone."}
            </p>
          ) : list.length === 0 ? (
            <p className="mobile-empty">None yet. Make one on your computer, or ask to be invited.</p>
          ) : (
            list.map((ws) => (
              <button className="mobile-row" key={ws.id} onClick={() => void openWorkspace(ws)}>
                <span>
                  <b>{ws.name}</b>
                  <small>
                    {ws.members.length} {ws.members.length === 1 ? "member" : "members"}
                  </small>
                </span>
              </button>
            ))
          )}
        </main>
        <footer className="mobile-foot mobile-toggle">
          {account ? (
            <>
              <span className="mobile-account" data-testid="account">
                {account.login}
              </span>
              <button
                onClick={() => {
                  void workspace.signOut().finally(() => setAccount(null));
                }}
              >
                Sign out
              </button>
            </>
          ) : configured() ? (
            <button className="mobile-primary" onClick={() => setSigningIn(true)}>
              Sign in
            </button>
          ) : (
            <span />
          )}
        </footer>
        {bar}
        {signingIn && (
          <SignInSheet
            onDone={(who) => {
              setSigningIn(false);
              setAccount(who);
            }}
            onCancel={() => setSigningIn(false)}
          />
        )}
      </>
    );
  }

  if (screen === "folder" && current) {
    return (
      <>
        <header className="mobile-head">
          <button
            onClick={() => {
              if (dir) setDir(dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "");
              else leaveFolder();
            }}
          >
            Back
          </button>
          <span>
            <b>{current.name}</b>
            <small>{dir || "/"} · {tree?.status ?? "connecting"}</small>
          </span>
          <span />
        </header>
        <main className="mobile-list" data-testid="folder">
          {here.map((e) => (
            <button
              className="mobile-row"
              key={e.path}
              onClick={() => (e.kind === "folder" ? setDir(e.path) : void openFile(e))}
            >
              <span>{e.kind === "folder" ? `${e.path.split("/").pop()}/` : e.path.split("/").pop()}</span>
              {e.status && (
                <span className={`mobile-status tone-${statusTone(e.status)}`}>
                  <span className="status-dot" aria-hidden /> {e.status}
                </span>
              )}
            </button>
          ))}
          {!here.length && <p className="mobile-empty">{tree?.synced ? "No files here." : "Opening…"}</p>}
        </main>
      </>
    );
  }

  if (screen === "document" && current && open && account) {
    const name = open.entry.path.split("/").pop() ?? open.entry.path;
    return (
      <>
        <header className="mobile-head">
          <button
            onClick={() => {
              closeDoc();
              setScreen("folder");
            }}
          >
            Back
          </button>
          <span>
            <b>{titleOf(name)}</b>
            <small>
              {current.name} · {open.entry.path}
            </small>
          </span>
          <span />
        </header>
        <main className="mobile-document">
          <Editor
            key={open.room.id}
            room={open.room}
            docKey={open.room.id}
            repo=""
            relPath={open.entry.path}
            initialValue={`# ${titleOf(name)}\n`}
            spellcheck
            imageFolder=""
            author={account.login}
            profiles={profiles}
            // The editor publishes the markdown into the room itself.
            onChange={() => {}}
          />
        </main>
      </>
    );
  }
  return null;
}
