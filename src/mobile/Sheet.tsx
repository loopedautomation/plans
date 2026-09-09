/**
 * A slide-over: a scrim, a panel from one edge, Escape and a tap outside to
 * close. The profile comes in from the left, the way a drawer does; the Aa
 * settings rise from the bottom, the way an e-reader's do. Focus is kept
 * inside while it is up, as with every sheet in the app.
 */
import { useEffect, useRef } from "react";
import { useFocusTrap } from "../focus";

type Props = {
  side: "left" | "bottom";
  title: string;
  onClose: () => void;
  testid?: string;
  children: React.ReactNode;
};

export function Sheet({ side, title, onClose, testid, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className={`mobile-scrim ${side}`} onClick={onClose}>
      <div
        className={`mobile-sheet ${side}`}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testid}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-sheet-head">
          <span>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            Done
          </button>
        </div>
        <div className="mobile-sheet-body">{children}</div>
      </div>
    </div>
  );
}
