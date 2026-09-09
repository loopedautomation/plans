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
import { statusTone } from "../matter";
import {
  colorFor,
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
  /** Undefined until the phone has asked who is signed in. */
  account: Account | null | undefined;
  /** The root screen's header — profile at the left, Aa at the right — and the bar under it. */
  head: (title: string) => React.ReactNode;
  aa: React.ReactNode;
  bar: React.ReactNode;
  /** Where the edge swipe lands: this stack's Back, or null at its root. */
  backRef: React.MutableRefObject<(() => void) | null>;
  onError: (message: string | null) => void;
};

/** The last list the server gave, so the tab paints before it answers again. */
const LIST_KEY = "plans.mobile.workspaces.v1";
function rememberedList(): Workspace[] {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) ?? "[]") as Workspace[];
  } catch {
    return [];
  }
}

export function WorkspacesTab({ account, head, aa, bar, backRef, onError }: Props) {
  const [list, setList] = useState<Workspace[]>(rememberedList);
  /**
   * Rooms stay open for as long as the tab does. A tree room is opened for
   * every workspace as soon as the list arrives, so a folder is on screen
   * the moment it is tapped; a document room, once opened, is kept so that
   * Back and then the same file again costs nothing. A phone has room for a
   * few sockets, and closing them on every Back was what made each screen
   * take a second to fill.
   */
  const trees = useRef(new Map<string, Room>());
  const docs = useRef(new Map<string, Room>());
  const [screen, setScreen] = useState<Screen>("list");
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [tree, setTree] = useState<Room | null>(null);
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [dir, setDir] = useState("");
  const [open, setOpen] = useState<{ entry: WorkspaceEntry; room: Room } | null>(null);

  const me = useCallback(
    () =>
      account
        ? { name: account.name ?? account.login, color: colorFor(account.login), avatar: account.avatar, login: account.login }
        : null,
    [account],
  );

  /**
   * Everything closes half a second after the last screen that used it, and
   * never before: an editor bound to a room unmounts on the render a state
   * change causes, and its teardown is asynchronous; a Y.Doc destroyed under
   * a live binding throws from inside the collab plugin.
   */
  const closeAll = useCallback(() => {
    const all = [...trees.current.values(), ...docs.current.values()];
    trees.current.clear();
    docs.current.clear();
    window.setTimeout(() => all.forEach((r) => r.close()), 500);
  }, []);
  useEffect(() => closeAll, [closeAll]);

  /** The tree room for a workspace, opened once and kept. */
  const treeFor = useCallback(
    async (ws: Workspace): Promise<Room | null> => {
      const have = trees.current.get(ws.id);
      if (have) return have;
      const who = me();
      const session = await token();
      if (!who || !session) return null;
      const again = trees.current.get(ws.id);
      if (again) return again;
      const room = openRoom(treeRoomId(ws.id), ws.id, session, who);
      trees.current.set(ws.id, room);
      return room;
    },
    [me],
  );

  // The list, whenever who is signed in changes: what was remembered first,
  // then the server's answer, remembered in turn. Signed out, every room goes.
  useEffect(() => {
    if (!account) {
      setList([]);
      try {
        localStorage.removeItem(LIST_KEY);
      } catch {
        // storage is a convenience
      }
      closeAll();
      return;
    }
    let live = true;
    void workspace.list().then(
      (ws) => {
        if (!live) return;
        setList(ws);
        try {
          localStorage.setItem(LIST_KEY, JSON.stringify(ws));
        } catch {
          // storage is a convenience
        }
        // Warm every folder now, so the first tap is already answered.
        for (const w of ws) void treeFor(w);
      },
      (e) => live && onError(String((e as Error).message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [account, onError, closeAll, treeFor]);

  // The folder on screen follows its room; nothing is copied out of it.
  useEffect(() => {
    if (!tree) return;
    const draw = () => setEntries(treeEntries(tree));
    draw();
    treeMap(tree).observe(draw);
    const stop = tree.onSynced(draw);
    return () => {
      treeMap(tree).unobserve(draw);
      stop();
    };
  }, [tree]);

  const closeDoc = useCallback(() => setOpen(null), []);

  const leaveFolder = useCallback(() => {
    setOpen(null);
    setTree(null);
    setEntries([]);
    setCurrent(null);
    setDir("");
    setScreen("list");
  }, []);

  const openWorkspace = async (ws: Workspace) => {
    onError(null);
    // The screen first: a warm room fills it at once, a cold one in a moment.
    setCurrent(ws);
    setDir("");
    setScreen("folder");
    const room = await treeFor(ws);
    if (!room) return;
    setTree(room);
    await settled(room);
    setEntries(treeEntries(room));
  };

  const openFile = async (entry: WorkspaceEntry) => {
    if (!current || !entry.doc) return;
    onError(null);
    let room = docs.current.get(entry.doc);
    if (!room) {
      const who = me();
      const session = await token();
      if (!who || !session) return;
      room = openRoom(entry.doc, current.id, session, who);
      docs.current.set(entry.doc, room);
    }
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

  backRef.current =
    screen === "list"
      ? null
      : screen === "document"
        ? () => {
            closeDoc();
            setScreen("folder");
          }
        : () => {
            if (dir) setDir(dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "");
            else leaveFolder();
          };

  if (screen === "list") {
    return (
      <>
        {head("Workspaces")}
        <main className="mobile-list" data-testid="workspaces">
          {account === undefined ? null : !account ? (
            <p className="mobile-empty">
              A workspace is a folder of files, edited together and live. Sign in from the top left to open yours.
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
        {bar}
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
          {aa}
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
          {aa}
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
