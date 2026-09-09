import { tokenValue, type Token } from "../tokens";

/** A token's chip, its name, its live value and the rule that made it. */
export function Swatches({ tokens }: { tokens: Token[] }) {
  return (
    <ul className="swatches">
      {tokens.map((t) => {
        const value = tokenValue(t.name);
        return (
          <li key={t.name} className="swatch" data-testid="swatch" data-token={t.name} data-value={value}>
            <span className="swatch-chip" style={{ background: `var(${t.name})` }} aria-hidden />
            <span>
              <span className="swatch-name">{t.name}</span>
              <span className="swatch-value">{value}</span>
              <br />
              <span className="swatch-rule">{t.rule}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
