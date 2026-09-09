/**
 * Aa: the paper, the type and the file toggles, in a sheet from the bottom.
 *
 * These are the same keys the desktop writes to settings.json, applied the
 * same way (`applySettings`), so a paper chosen here is the paper the phone
 * reads in, and a size chosen on the desk does not fight it: each device
 * keeps its own file. Only what changes how a page reads is here; the
 * desktop's panels, keymaps and agents have no phone to be set on.
 */
import { FONTS, MONO_FONTS } from "../fonts";
import { RANGES, type Settings } from "../settings";
import { THEMES } from "../theme";
import { Sheet } from "./Sheet";

type Props = {
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
  onClose: () => void;
};

const SAMPLE = "The plan is read more often than it is written, and by more people than wrote it.";

function Slider({
  label,
  value,
  range,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mobile-setting mobile-slider">
      <span className="mobile-setting-name">
        {label}
        <b>
          {Number.isInteger(range.step) ? value : value.toFixed(2)}
          {unit ?? ""}
        </b>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function AaSheet({ settings, set, onClose }: Props) {
  return (
    <Sheet side="bottom" title="Aa" onClose={onClose} testid="settings">
      <div className="mobile-settings">
        <section>
          <h2>Paper</h2>
          <div className="mobile-choices" role="radiogroup" aria-label="Paper">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={settings.theme === t.id}
                className={`mobile-choice ${settings.theme === t.id ? "on" : ""}`}
                style={{ background: t.swatch.paper, color: t.swatch.ink }}
                onClick={() => set({ theme: t.id })}
                data-testid={`paper-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Reading face</h2>
          <p className="mobile-sample" style={{ fontFamily: "var(--doc-font)", fontSize: "var(--doc-size)", lineHeight: "var(--doc-leading, 1.62)" }}>
            {SAMPLE}
          </p>
          <div className="mobile-faces" role="radiogroup" aria-label="Reading face">
            {FONTS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={settings.fontId === f.id}
                className={`mobile-face ${settings.fontId === f.id ? "on" : ""}`}
                style={{ fontFamily: f.stack }}
                onClick={() => set({ fontId: f.id })}
                data-testid={`face-${f.id}`}
              >
                <b>{f.label}</b>
                <small>{f.note}</small>
              </button>
            ))}
          </div>
          <Slider label="Size" value={settings.size} range={RANGES.size} unit="px" onChange={(size) => set({ size })} />
          <Slider label="Measure" value={settings.measure} range={RANGES.measure} unit="ch" onChange={(measure) => set({ measure })} />
          <Slider label="Leading" value={settings.leading} range={RANGES.leading} onChange={(leading) => set({ leading })} />
        </section>

        <section>
          <h2>Code</h2>
          <div className="mobile-faces" role="radiogroup" aria-label="Code face">
            {MONO_FONTS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={settings.monoId === m.id}
                className={`mobile-face ${settings.monoId === m.id ? "on" : ""}`}
                style={{ fontFamily: m.stack }}
                onClick={() => set({ monoId: m.id })}
                data-testid={`mono-${m.id}`}
              >
                <b>{m.label}</b>
                <small>{m.note}</small>
              </button>
            ))}
          </div>
          <Slider label="Code size" value={settings.codeSize} range={RANGES.codeSize} unit="px" onChange={(codeSize) => set({ codeSize })} />
        </section>

        <section>
          <h2>Files</h2>
          <label className="mobile-setting mobile-switch">
            <span className="mobile-setting-name">
              All files
              <small>Every file in a folder, rather than only the markdown.</small>
            </span>
            <input type="checkbox" checked={settings.showAllFiles} onChange={(e) => set({ showAllFiles: e.target.checked })} />
          </label>
          <label className="mobile-setting mobile-switch">
            <span className="mobile-setting-name">
              Extensions
              <small>Show .md on file names.</small>
            </span>
            <input type="checkbox" checked={settings.showExtensions} onChange={(e) => set({ showExtensions: e.target.checked })} />
          </label>
          <label className="mobile-setting mobile-switch">
            <span className="mobile-setting-name">
              Spellcheck
              <small>Underline misspellings while writing in a workspace.</small>
            </span>
            <input type="checkbox" checked={settings.spellcheck} onChange={(e) => set({ spellcheck: e.target.checked })} />
          </label>
        </section>
      </div>
    </Sheet>
  );
}
