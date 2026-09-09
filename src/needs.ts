/**
 * What in the workspaces is waiting on you.
 *
 * A pure function of the trees and your login, with nothing fetched: every
 * tree entry carries a copy of the file's head (status, owner, reviewers,
 * approved) and a count of its open suggestions, kept by whoever has the file
 * open and repaired by the server for the files nobody has. Reading that copy
 * against one login is the whole of the inbox. What you have seen is recorded
 * nowhere; opening the file is the only "read".
 */
import { handleList } from "./matter.ts";
import type { WorkspaceEntry } from "./workspace";

export type Reason = "review" | "approved" | "asks";

export type Need = {
  workspace: string;
  path: string;
  doc: string | null;
  reason: Reason;
  /** For `asks`: how many suggestions await the owner. */
  count: number;
  /** "asked to review", "everyone approved", "2 suggestions". */
  label: string;
};

const lower = (v: string | null | undefined) => handleList(v).map((h) => h.toLowerCase());

/** Every reason a file has for you, in the order they are worth seeing. */
export function needsOf(entry: WorkspaceEntry, login: string): Need[] {
  if (entry.kind !== "file") return [];
  const me = login.toLowerCase();
  const status = (entry.status ?? "").toLowerCase();
  const reviewers = lower(entry.reviewers);
  const approved = new Set(lower(entry.approved));
  const owners = new Set(lower(entry.owner));
  const base = { workspace: "", path: entry.path, doc: entry.doc };
  const out: Need[] = [];
  if (status === "review" && reviewers.includes(me) && !approved.has(me)) {
    out.push({ ...base, reason: "review", count: 1, label: "asked to review" });
  }
  if (
    status === "review" &&
    owners.has(me) &&
    reviewers.length > 0 &&
    reviewers.every((r) => approved.has(r))
  ) {
    out.push({ ...base, reason: "approved", count: 1, label: "everyone approved" });
  }
  const asks = entry.asks ?? 0;
  if (asks > 0 && owners.has(me)) {
    out.push({
      ...base,
      reason: "asks",
      count: asks,
      label: asks === 1 ? "1 suggestion" : `${asks} suggestions`,
    });
  }
  return out;
}

/** Across every workspace's tree, one entry per reason per file. */
export function needsMe(
  trees: Record<string, WorkspaceEntry[]>,
  login: string | null | undefined,
): Need[] {
  if (!login) return [];
  const out: Need[] = [];
  for (const [workspace, entries] of Object.entries(trees)) {
    for (const e of entries) {
      for (const n of needsOf(e, login)) out.push({ ...n, workspace });
    }
  }
  return out;
}

/** The key a need is remembered by, so a later computation can say what is new. */
export const needKey = (n: Need) => `${n.workspace}/${n.path}#${n.reason}`;
