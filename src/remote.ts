import { useCallback, useMemo, useRef, useState } from "react";
import {
  api,
  type RemoteConnect,
  type RemoteEntry,
  type RemoteRoot,
} from "./api";

export const remoteShelfKey = (id: string) => `ssh:${id}`;
export const remoteIdOf = (key: string | null | undefined) =>
  key?.startsWith("ssh:") ? key.slice(4) : null;

export type RemotePhase =
  "disconnected" | "connecting" | "connected" | "attention";

export type RemoteSnapshot = {
  phase: RemotePhase;
  entries: RemoteEntry[];
  loadedDirs: string[];
  fingerprint: string | null;
  error: string | null;
  attention: RemoteConnect | null;
};

const empty = (): RemoteSnapshot => ({
  phase: "disconnected",
  entries: [],
  loadedDirs: [],
  fingerprint: null,
  error: null,
  attention: null,
});

/** Replace only one directory's children, preserving every lazily loaded sibling. */
export function mergeDirectory(
  previous: RemoteEntry[],
  dir: string,
  incoming: RemoteEntry[],
): RemoteEntry[] {
  const parentOf = (path: string) =>
    path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const kept = previous.filter((entry) => parentOf(entry.path) !== dir);
  return [...kept, ...incoming].sort((a, b) => a.path.localeCompare(b.path));
}

export class RemoteNeedsAttention extends Error {
  constructor(public result: RemoteConnect) {
    super(result.message ?? "This connection needs attention.");
  }
}

/**
 * The in-memory half of remote browsing. Nothing here is an offline cache:
 * entries survive a dropped socket only for as long as this React tree does.
 */
export function useRemoteBrowser() {
  const [snapshots, setSnapshots] = useState<Record<string, RemoteSnapshot>>(
    {},
  );
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  const patch = useCallback((id: string, change: Partial<RemoteSnapshot>) => {
    setSnapshots((all) => ({
      ...all,
      [id]: { ...(all[id] ?? empty()), ...change },
    }));
  }, []);

  const connect = useCallback(
    async (remote: RemoteRoot) => {
      patch(remote.id, { phase: "connecting", error: null, attention: null });
      try {
        const result = await api.remoteConnect(remote);
        patch(remote.id, {
          phase: result.status === "connected" ? "connected" : "attention",
          fingerprint: result.fingerprint,
          attention: result.status === "connected" ? null : result,
          error: null,
        });
        return result;
      } catch (error) {
        patch(remote.id, { phase: "disconnected", error: String(error) });
        throw error;
      }
    },
    [patch],
  );

  const ensure = useCallback(
    async (remote: RemoteRoot) => {
      const result = await connect(remote);
      if (result.status !== "connected") throw new RemoteNeedsAttention(result);
    },
    [connect],
  );

  const listDir = useCallback(
    async (remote: RemoteRoot, dir: string, force = false) => {
      const current = snapshotsRef.current[remote.id] ?? empty();
      if (
        !force &&
        current.loadedDirs.includes(dir) &&
        current.phase === "connected"
      ) {
        return current.entries.filter((entry) => {
          const at = entry.path.lastIndexOf("/");
          return (at === -1 ? "" : entry.path.slice(0, at)) === dir;
        });
      }
      if (current.phase !== "connected") await ensure(remote);
      try {
        const entries = await api.remoteList(remote.id, dir);
        setSnapshots((all) => {
          const before = all[remote.id] ?? empty();
          return {
            ...all,
            [remote.id]: {
              ...before,
              phase: "connected",
              entries: mergeDirectory(before.entries, dir, entries),
              loadedDirs: before.loadedDirs.includes(dir)
                ? before.loadedDirs
                : [...before.loadedDirs, dir],
              error: null,
            },
          };
        });
        return entries;
      } catch (error) {
        if (error instanceof RemoteNeedsAttention) throw error;
        patch(remote.id, { phase: "disconnected", error: String(error) });
        throw error;
      }
    },
    [ensure, patch],
  );

  const readFile = useCallback(
    async (remote: RemoteRoot, path: string) => {
      const current = snapshotsRef.current[remote.id] ?? empty();
      if (current.phase !== "connected") await ensure(remote);
      try {
        const text = await api.remoteRead(remote.id, path);
        patch(remote.id, { phase: "connected", error: null });
        return text;
      } catch (error) {
        if (error instanceof RemoteNeedsAttention) throw error;
        patch(remote.id, { phase: "disconnected", error: String(error) });
        throw error;
      }
    },
    [ensure, patch],
  );

  const disconnect = useCallback(
    async (id: string) => {
      await api.remoteDisconnect(id).catch(() => {});
      patch(id, { phase: "disconnected", attention: null });
    },
    [patch],
  );

  const forget = useCallback((id: string) => {
    void api.remoteDisconnect(id).catch(() => {});
    setSnapshots((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  }, []);

  return useMemo(
    () => ({ snapshots, connect, listDir, readFile, disconnect, forget }),
    [snapshots, connect, listDir, readFile, disconnect, forget],
  );
}
