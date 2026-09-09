import { Editor } from "../../Editor";
import sample from "../sample.md?raw";

/**
 * The page's parts are the editor's, so this section is the editor: the
 * same read-only renderer the share page uses, over one fixture that has a
 * bit of everything in it.
 */
export function Page() {
  return (
    <section className="gallery-section" id="page">
      <h2>The page's parts</h2>
      <p>
        Nothing below is drawn by the gallery. It is the app's editor with
        the caret taken away, rendering a document that has a heading, a
        list, a table, a code block, two alerts, a diagram, a comment thread
        and a suggestion in it. If the editor changes how it draws a table,
        so does this.
      </p>
      <div className="gallery-editor">
        <Editor
          docKey="design"
          repo=""
          relPath="design.md"
          initialValue={sample}
          spellcheck={false}
          imageFolder=""
          author=""
          tintHandles
          readOnly
          onChange={() => {}}
        />
      </div>
    </section>
  );
}
