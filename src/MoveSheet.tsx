/**
 * Move a file to another folder.
 *
 * Separate from renaming on purpose: they are different questions. Renaming
 * asks what a thing is called, and answering it should not mean retyping the
 * path it lives at; moving asks where it goes, and answering that is a choice
 * from what exists rather than free text with a chance of a typo.
 */
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import { useFocusTrap } from "./focus";

type Props = {
  /** The file being moved, repo-relative. */
  relPath: string;
  /** Every folder in the repository, plus the root. */
  folders: string[];
  /**
   * Other places the file may go — another workspace, with its folders. Each
   * is a group in the same list, headed by its name, so moving across is the
   * same gesture as moving within.
   */
  elsewhere?: { repo: string; label: string; folders: string[] }[];
  onCancel: () => void;
  /** `repo` is set only when the choice was in `elsewhere`. */
  onMove: (dir: string, repo?: string) => void;
};

/** One value for the dropdown: a folder here, or `repo⏎dir` elsewhere. A
 *  newline, because the app's own buffer prefixes already use `\u0000`. */
const AWAY = "\n";

export function MoveSheet({ relPath, folders, elsewhere = [], onCancel, onMove }: Props) {
  const name = relPath.split("/").pop() ?? relPath;
  const from = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
  const [pick, setPick] = useState(from);
  const away = pick.includes(AWAY) ? pick.split(AWAY) : null;
  const dir = away ? away[1] : pick;
  const repo = away ? away[0] : undefined;
  const setDir = setPick;
  const sheet = useRef<HTMLDivElement>(null);
  useFocusTrap(sheet);

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      // An open dropdown owns Escape and Enter: they back out of its filter or
      // pick a folder, and the sheet only hears them once the menu has closed.
      if ((e.target as HTMLElement | null)?.closest?.(".dd.open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pick !== from) onMove(dir, repo);
      }
    };
    window.addEventListener("keydown", keys, true);
    return () => window.removeEventListener("keydown", keys, true);
  }, [pick, dir, repo, from, onCancel, onMove]);

  return (
    <div className="matter-scrim" onMouseDown={onCancel}>
      <div
        className="matter-sheet"
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Move ${name}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="matter-head">
          <span className="tag">Move</span>
          <span className="tag">{name}</span>
        </div>

        <div className="name-where">
          <Dropdown
            ariaLabel="Folder"
            value={pick}
            onChange={setDir}
            choices={[
              { value: "", label: "repository root" },
              ...folders.map((f) => ({ value: f, label: f })),
              ...elsewhere.flatMap((w) => [
                { value: `${w.repo}${AWAY}`, label: `${w.label} · root`, apart: true },
                ...w.folders.map((f) => ({
                  value: `${w.repo}${AWAY}${f}`,
                  label: `${w.label} · ${f}`,
                })),
              ]),
            ]}
          />
        </div>
        <p className="name-path">
          {away ? `${elsewhere.find((w) => w.repo === repo)?.label ?? ""} · ` : ""}
          {dir ? `${dir}/${name}` : name}
        </p>

        <div className="matter-foot">
          <span>⏎ move · esc cancel</span>
          <button className="act" onClick={() => onMove(dir, repo)} disabled={pick === from}>
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
