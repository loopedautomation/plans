/**
 * One Yjs document per room, relayed over websockets.
 *
 * A room is a document, not a workspace: a workspace is a *tree* room holding
 * a map of path → `{ kind, doc }`, plus one room per file keyed by that file's
 * document id. Which workspace a room belongs to is what the socket's
 * membership check is made of, and it comes from the `docs` table.
 *
 * This is the y-websocket wire protocol — sync steps and awareness — written
 * out rather than pulled in, because the whole server is a few hundred lines
 * and the dependency would be most of them.
 */
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { newId } from "./db.js";

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;

/** How long a burst of edits waits before it is written to the database. */
const SAVE_AFTER_MS = 800;

/**
 * The name a workspace's first file has.
 *
 * A workspace used to be one document, and the read endpoint and every share
 * link minted before folders named `plan.md`. Seeding a new tree with the same
 * name is what keeps all of that answering.
 */
export const FIRST_FILE = "plan.md";

/** The tree of a workspace lives in the room whose id *is* the workspace's. */
export const treeId = (workspaceId) => workspaceId;

/**
 * The head of a document, the way the app reads it: a `---` fence at byte
 * zero, flat `key: value` lines, no YAML library. Four keys come back —
 * `status`, and the three about people (`owner`, `reviewers`, `approved`) —
 * plus `asks`, the count of open suggestions in the body. Mirrors
 * src/matter.ts; the tree carries this so the app can say what is waiting on
 * whom without opening every file.
 */
const KEYS = ["status", "owner", "reviewers", "approved"];
const HANDLE = "[A-Za-z0-9_.+-]+(?:@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)?";
const SUGGESTS = new RegExp(`^(?:@(${HANDLE})\\s+)?suggests:$`);

/** Whether one comment body is a suggestion: the head line, one `---`, an old side. */
function isSuggestion(body) {
  const lines = body.split(/\r?\n/);
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const head = (lines.shift() ?? "").trim();
  if (!SUGGESTS.test(head)) return false;
  const at = lines.flatMap((l, i) => (l.trim() === "---" ? [i] : []));
  if (at.length !== 1) return false;
  return lines.slice(0, at[0]).join("\n").trim().length > 0;
}

export function head(markdown) {
  const out = { status: null, owner: null, reviewers: null, approved: null, asks: 0 };
  if (typeof markdown !== "string") return out;
  if (/^---[ \t]*\r?\n/.test(markdown)) {
    const close = markdown.slice(4).match(/\r?\n---[ \t]*(?:\r?\n|$)/);
    const block = close ? markdown.slice(markdown.indexOf("\n") + 1, 4 + close.index) : "";
    let assignee = null;
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (key === "assignee") assignee = v.length ? v : null;
      if (!KEYS.includes(key) || out[key] !== null) continue;
      out[key] = v.length ? v : null;
    }
    // The app reads `assignee:` where `owner:` is missing; so does the copy.
    if (out.owner === null) out.owner = assignee;
  }
  for (const m of markdown.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (isSuggestion(m[1])) out.asks += 1;
  }
  return out;
}

/** `status:` alone, for the callers that only ever wanted that. */
export function headStatus(markdown) {
  return head(markdown).status;
}

const sameHead = (value, h) =>
  KEYS.every((k) => (value[k] ?? null) === h[k]) && (value.asks ?? 0) === h.asks;

/** The tree map, as the wire and the app both see it. */
function entriesOf(doc) {
  const out = [];
  for (const [path, value] of doc.getMap("tree")) {
    if (!value || typeof value !== "object") continue;
    out.push({
      path,
      kind: value.kind === "folder" ? "folder" : "file",
      doc: value.doc ?? null,
      status: value.status ?? null,
      owner: value.owner ?? null,
      reviewers: value.reviewers ?? null,
      approved: value.approved ?? null,
      asks: value.asks ?? 0,
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export class Rooms {
  constructor() {
    /** Set by the server once the database is up; no room opens before. */
    this.db = null;
    /** doc id -> { id, workspaceId, kind, doc, awareness, conns, saveTimer } */
    this.rooms = new Map();
  }

  /** The live document, loading it from the database on first sight. */
  async room(id, workspaceId, kind) {
    let room = this.rooms.get(id);
    if (room) return room;
    const doc = new Y.Doc();
    const stored = await this.db.loadDoc(id);
    if (stored) Y.applyUpdate(doc, stored);
    // A tree nobody has written yet is a workspace from before folders, or one
    // whose creation was interrupted: either way it gets its first file here,
    // before anyone can see the room as empty.
    if (kind === "tree") await this.seedInto(doc, workspaceId);
    // Two joins raced the load: the first to finish is the room.
    if (this.rooms.has(id)) {
      doc.destroy();
      return this.rooms.get(id);
    }
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    room = { id, workspaceId, kind, doc, awareness, conns: new Set(), saveTimer: null };

    doc.on("update", (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeUpdate(enc, update);
      const msg = encoding.toUint8Array(enc);
      for (const c of room.conns) if (c !== origin) send(c, msg);
      if (room.saveTimer) clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(() => {
        room.saveTimer = null;
        void this.save(room).catch(logSave);
      }, SAVE_AFTER_MS);
    });

    awareness.on("update", ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated, removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      const msg = encoding.toUint8Array(enc);
      for (const c of room.conns) if (c !== origin) send(c, msg);
    });

    this.rooms.set(id, room);
    return room;
  }

  save(room) {
    return this.db.saveDoc(room.id, room.workspaceId, room.kind, Y.encodeStateAsUpdate(room.doc));
  }

  /**
   * Give an empty tree its first file.
   *
   * A workspace that already has a document — one written before workspaces
   * were folders — keeps it, under the name the read endpoint and every share
   * link minted back then were already using. A new one gets an empty document
   * saved under a fresh id, so the tree never names a room that does not exist.
   */
  async seedInto(doc, workspaceId) {
    const map = doc.getMap("tree");
    if (map.size > 0) return false;
    const existing = await this.db.docsFor(workspaceId, "file");
    if (map.size > 0) return false;
    const id = existing[0]?.id ?? newId();
    if (!existing.length) {
      await this.db.saveDoc(id, workspaceId, "file", Y.encodeStateAsUpdate(new Y.Doc()));
    }
    map.set(FIRST_FILE, { kind: "file", doc: id });
    return true;
  }

  /** A workspace's tree, seeded if it has never had one. Read-only callers. */
  async tree(workspaceId) {
    const live = this.rooms.get(treeId(workspaceId));
    if (live) {
      await this.repairStatus(live.doc);
      return entriesOf(live.doc);
    }
    const doc = new Y.Doc();
    const stored = await this.db.loadDoc(treeId(workspaceId));
    if (stored) Y.applyUpdate(doc, stored);
    let dirty = await this.seedInto(doc, workspaceId);
    if (await this.repairStatus(doc)) dirty = true;
    if (dirty) {
      await this.db.saveDoc(treeId(workspaceId), workspaceId, "tree", Y.encodeStateAsUpdate(doc));
    }
    const out = entriesOf(doc);
    doc.destroy();
    return out;
  }

  /**
   * The tree's head — `status`, the people keys and the suggestion count —
   * is a copy kept by whichever client has a file open,
   * and a file nobody has opened since an agent's write — or one seeded
   * before anyone opened it — can carry a stale one. The frontmatter is the
   * truth; this makes the copy agree with it, entry by entry, for every
   * file whose document exists. Returns whether anything changed.
   */
  async repairStatus(doc) {
    const tree = doc.getMap("tree");
    let changed = false;
    for (const [path, value] of tree) {
      if (!value || typeof value !== "object" || value.kind === "folder" || !value.doc) continue;
      const markdown = await this.markdown(value.doc);
      if (!markdown) continue;
      const h = head(markdown);
      if (sameHead(value, h)) continue;
      tree.set(path, { ...value, ...h });
      changed = true;
    }
    return changed;
  }

  /** Make the tree for a workspace that has just been created. */
  seed(workspaceId) {
    return this.tree(workspaceId);
  }

  /** The markdown the clients last serialised, for one document. */
  async markdown(id) {
    const room = this.rooms.get(id);
    if (room) return room.doc.getMap("meta").get("markdown") ?? "";
    const stored = await this.db.loadDoc(id);
    if (!stored) return "";
    const doc = new Y.Doc();
    Y.applyUpdate(doc, stored);
    const text = doc.getMap("meta").get("markdown") ?? "";
    doc.destroy();
    return text;
  }

  /** One file of one workspace, by path; null when the tree has no such file. */
  async markdownAt(workspaceId, path) {
    const entry = (await this.tree(workspaceId)).find((e) => e.path === path && e.kind === "file");
    if (!entry?.doc) return null;
    return this.markdown(entry.doc);
  }

  async join(id, workspaceId, kind, ws, login = null) {
    ws.binaryType = "arraybuffer";
    // Remembered so a removal can find this person's sockets; membership
    // was checked before the upgrade and is not checked again.
    ws.login = login;
    /** Which awareness clients this socket spoke for, to clear on close. */
    const controlled = new Set();
    /**
     * Listen before the room exists. The client sends its first sync step the
     * moment the socket opens, and loading the document from the database
     * takes a real round trip — anything that arrived in between was lost,
     * and a lost step one is a client that never syncs.
     */
    let room = null;
    let gone = false;
    const early = [];
    ws.on("message", (data) => (room ? this.handle(room, ws, controlled, data) : early.push(data)));
    ws.on("close", () => {
      gone = true;
      if (room) void this.leave(room, ws, controlled);
    });

    room = await this.room(id, workspaceId, kind);
    if (gone) return;
    room.conns.add(ws);
    for (const data of early) this.handle(room, ws, controlled, data);
    if (ws.readyState !== 1) return;

    // Open with our state vector, then everyone's presence.
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(ws, encoding.toUint8Array(enc));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const a = encoding.createEncoder();
      encoding.writeVarUint(a, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        a,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]),
      );
      send(ws, encoding.toUint8Array(a));
    }
  }

  /**
   * One frame from one client. A frame the protocol cannot read — empty,
   * truncated, or not ours — closes that client and nothing else: a member's
   * bad byte must never take the room, let alone the process, down with it.
   */
  handle(room, ws, controlled, data) {
    try {
      this.decode(room, ws, controlled, data);
    } catch (e) {
      console.warn(`closing a client of ${room.id}: ${e.message}`);
      ws.close(1003, "bad frame");
    }
  }

  decode(room, ws, controlled, data) {
    const dec = decoding.createDecoder(new Uint8Array(data));
    const type = decoding.readVarUint(dec);
    if (type === MSG_SYNC) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.readSyncMessage(dec, enc, room.doc, ws);
      if (encoding.length(enc) > 1) send(ws, encoding.toUint8Array(enc));
    } else if (type === MSG_AWARENESS) {
      const update = decoding.readVarUint8Array(dec);
      // Remember whose states arrived through this socket.
      const peek = decoding.createDecoder(update);
      const n = decoding.readVarUint(peek);
      for (let i = 0; i < n; i++) {
        controlled.add(decoding.readVarUint(peek));
        decoding.readVarUint(peek);
        decoding.readVarString(peek);
      }
      awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
    }
  }

  async leave(room, ws, controlled) {
    room.conns.delete(ws);
    awarenessProtocol.removeAwarenessStates(room.awareness, [...controlled], null);
    if (room.conns.size !== 0) return;
    // The last reader left: write it out, and only then let the memory go.
    // The room stays in the map while the write is in flight, so someone
    // reconnecting in that window joins this document rather than loading
    // the database's older copy and being overwritten by this save later.
    if (room.saveTimer) clearTimeout(room.saveTimer);
    room.saveTimer = null;
    await this.save(room).catch(logSave);
    if (room.conns.size !== 0 || this.rooms.get(room.id) !== room) return;
    room.awareness.destroy();
    room.doc.destroy();
    this.rooms.delete(room.id);
  }

  /**
   * A workspace that no longer exists: every socket into its rooms is closed
   * with a code the client reads as "gone, do not come back", and the
   * documents are let go without a save — there is no row to save into.
   */
  evict(workspaceId) {
    for (const [id, room] of [...this.rooms]) {
      if (room.workspaceId !== workspaceId) continue;
      if (room.saveTimer) clearTimeout(room.saveTimer);
      room.saveTimer = null;
      for (const c of room.conns) c.close(4001, "workspace gone");
      room.conns.clear();
      room.awareness.destroy();
      room.doc.destroy();
      this.rooms.delete(id);
    }
  }

  /**
   * One person removed from a workspace: every socket of theirs into its
   * rooms closes with a code the client reads as "you were removed" —
   * distinct from 4001, which is the room itself being gone. The rooms
   * stay up for everyone else, and their leaving is handled by the close
   * event like any other disconnect.
   */
  kick(workspaceId, login) {
    for (const room of this.rooms.values()) {
      if (room.workspaceId !== workspaceId) continue;
      for (const c of [...room.conns]) if (c.login === login) c.close(4003, "removed from the workspace");
    }
  }

  /** Write everything out; called on shutdown. */
  async flush() {
    for (const room of this.rooms.values()) {
      if (room.saveTimer) clearTimeout(room.saveTimer);
      await this.save(room).catch(logSave);
    }
  }
}

function logSave(e) {
  console.error("could not save a document", e);
}

function send(ws, msg) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(msg);
  } catch {
    ws.close();
  }
}
