import type { CardDraft } from "../../types";

function features(draft: CardDraft): string[] {
  return draft.features
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function priceLabel(draft: CardDraft): string | null {
  if (!draft.price.trim()) return null;
  const n = Number(draft.price);
  const money = Number.isFinite(n) ? `$${n.toLocaleString()}` : draft.price;
  return draft.price_unit ? `${money} / ${draft.price_unit}` : money;
}

// Branded, client-ready Selection Card. Used both as the live side-panel preview
// and (larger) inside the expand modal. Colors come from the CMI CSS tokens, so
// it renders correctly in light and dark.
export function SelectionCard({ draft, large = false }: { draft: CardDraft; large?: boolean }) {
  const feats = features(draft);
  const price = priceLabel(draft);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: large ? 240 : 150,
          background: "var(--card-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {draft.image_url ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img
            src={draft.image_url}
            alt={draft.title || "Product"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>No image</span>
        )}
      </div>

      <div style={{ padding: large ? "18px 20px 20px" : "14px 16px 16px" }}>
        {draft.eyebrow ? (
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            {draft.eyebrow}
          </div>
        ) : null}

        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: large ? 26 : 18,
            lineHeight: 1.2,
            color: "var(--fg)",
          }}
        >
          {draft.title || "Product title"}
        </h2>

        {(draft.vendor_name || draft.sku || draft.model_number) && (
          <div style={{ marginTop: 5, fontSize: 12, color: "var(--muted)" }}>
            {[draft.vendor_name, draft.model_number || draft.sku].filter(Boolean).join(" · ")}
          </div>
        )}

        {price && (
          <div style={{ marginTop: 10, fontSize: large ? 20 : 16, fontWeight: 700, color: "var(--fg)" }}>{price}</div>
        )}

        {draft.short_description && (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg)" }}>
            {draft.short_description}
          </p>
        )}

        {large && draft.long_description && (
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
            {draft.long_description}
          </p>
        )}

        {feats.length > 0 && (
          <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 5 }}>
            {feats.slice(0, large ? 20 : 5).map((f, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--fg)" }}>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Fullscreen overlay showing the card large. Themeable via tokens.
export function CardModal({ draft, onClose }: { draft: CardDraft; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--card)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        <SelectionCard draft={draft} large />
      </div>
    </div>
  );
}
