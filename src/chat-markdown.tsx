/**
 * Just enough markdown for a chat bubble.
 *
 * Not Milkdown: that is an editor, and a second instance of it per message
 * would be absurd for text nobody edits. Not `dangerouslySetInnerHTML`
 * either — this renders text an agent produced, which is text a *file*
 * produced, and injecting that into the DOM as markup is how a plan file ends
 * up executing something.
 *
 * So: React elements, built from four things that actually show up in an
 * agent's prose — fenced code, inline code, bold, and bullet or numbered
 * lists. Anything else is left as the characters the agent typed, which is
 * the honest failure for a renderer this small.
 */
import type { ReactNode } from "react";

/** `**bold**` and `` `code` ``, which can appear mid-sentence. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    if (m[1]) out.push(<code key={`${key}-${m.index}`}>{m[1].slice(1, -1)}</code>);
    else out.push(<strong key={`${key}-${m.index}`}>{m[2].slice(2, -2)}</strong>);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] | null = null;
  let fence: string[] | null = null;
  let lang = "";

  /**
   * A fence as a block. A `diff` or `patch` fence is drawn as rows — added,
   * removed, hunk header, context — with the sign in a gutter and the row
   * tinted, the way a review tool shows it; anything else is the code as
   * written. Agents quote partial patches as often as whole ones, so this
   * reads the lines rather than parsing a unified diff.
   */
  const code = (lines: string[], key: string) => {
    if (lang !== "diff" && lang !== "patch") {
      return (
        <pre key={key} className="chat-md-code">
          {lines.join("\n")}
        </pre>
      );
    }
    return (
      <pre key={key} className="chat-md-code chat-md-diff">
        {lines.map((l, i) => {
          const kind = /^\+\+\+ |^--- /.test(l)
            ? "meta"
            : l.startsWith("+")
              ? "add"
              : l.startsWith("-")
                ? "del"
                : l.startsWith("@@")
                  ? "hunk"
                  : "ctx";
          const sign = kind === "add" || kind === "del" ? l[0] : " ";
          const text = kind === "add" || kind === "del" ? l.slice(1) : l;
          return (
            <span key={i} className={`diff-row ${kind}`}>
              <span className="diff-sign" aria-hidden>
                {sign}
              </span>
              {text}
              {"\n"}
            </span>
          );
        })}
      </pre>
    );
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(
      <ul key={`l${blocks.length}`} className="chat-md-list">
        {list.map((li, i) => (
          <li key={i}>{inline(li, `${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = null;
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (fence) {
        blocks.push(code(fence, `f${blocks.length}`));
        fence = null;
      } else {
        flushList();
        fence = [];
        lang = line.trim().slice(3).trim().split(/\s/)[0].toLowerCase();
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    const bullet = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      list = list ?? [];
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    blocks.push(
      <p key={`p${blocks.length}`} className="chat-md-p">
        {inline(line, `p${blocks.length}`)}
      </p>,
    );
  }
  flushList();
  // An unterminated fence is still code; the answer was cut off, not malformed.
  if (fence?.length) blocks.push(code(fence, `f${blocks.length}`));
  return <>{blocks}</>;
}
