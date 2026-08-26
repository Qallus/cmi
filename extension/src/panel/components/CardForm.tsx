import type { CardDraft } from "../../types";
import type { Confidence } from "../../content/injected";

const PICKABLE = new Set<keyof CardDraft>([
  "title",
  "vendor_name",
  "category",
  "price",
  "sku",
  "model_number",
  "size",
  "finish",
  "colors",
  "short_description",
  "long_description",
  "image_url",
]);

const CONF_COLOR: Record<Confidence, string> = {
  high: "#3f9c52",
  medium: "#c8962f",
  low: "#9a9186",
};

function ConfidenceDot({ level }: { level: Confidence }) {
  const title = level === "high" ? "From structured data" : level === "medium" ? "From page metadata" : "Best guess — verify";
  return <span title={title} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: CONF_COLOR[level] }} />;
}

function PickButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Pick this from the page"
      style={{
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent-fg)" : "var(--accent)",
        borderRadius: 6,
        width: 22,
        height: 18,
        fontSize: 12,
        lineHeight: 1,
        cursor: "pointer",
        padding: 0,
      }}
    >
      ⌖
    </button>
  );
}

type Props = {
  draft: CardDraft;
  onChange: (patch: Partial<CardDraft>) => void;
  onPick?: (field: string) => void;
  picking?: string | null;
  confidence?: Record<string, Confidence>;
};

// Manual + picker capture fields. Controlled by App.
export function CardForm({ draft, onChange, onPick, picking, confidence }: Props) {
  const set =
    (key: keyof CardDraft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value } as Partial<CardDraft>);

  function Field({ label, k, children }: { label: string; k?: keyof CardDraft; children: React.ReactNode }) {
    const canPick = !!k && !!onPick && PICKABLE.has(k);
    const conf = k && confidence ? confidence[k] : undefined;
    return (
      <label style={{ display: "block" }}>
        <span className="cmi-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {label}
            {conf && <ConfidenceDot level={conf} />}
          </span>
          {canPick && <PickButton active={picking === k} onClick={() => onPick!(k!)} />}
        </span>
        {children}
      </label>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Eyebrow (optional)">
        <input className="cmi-input" value={draft.eyebrow} onChange={set("eyebrow")} placeholder="e.g. Kitchen · Plumbing" />
      </Field>

      <Field label="Product title *" k="title">
        <input className="cmi-input" value={draft.title} onChange={set("title")} placeholder="Product name" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Vendor" k="vendor_name">
          <input className="cmi-input" value={draft.vendor_name} onChange={set("vendor_name")} placeholder="Ferguson" />
        </Field>
        <Field label="Category" k="category">
          <input className="cmi-input" value={draft.category} onChange={set("category")} placeholder="Fixtures" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="SKU" k="sku">
          <input className="cmi-input" value={draft.sku} onChange={set("sku")} placeholder="SKU" />
        </Field>
        <Field label="Model #" k="model_number">
          <input className="cmi-input" value={draft.model_number} onChange={set("model_number")} placeholder="Model" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Size" k="size">
          <input className="cmi-input" value={draft.size} onChange={set("size")} placeholder={'24" x 48"'} />
        </Field>
        <Field label="Finish" k="finish">
          <input className="cmi-input" value={draft.finish} onChange={set("finish")} placeholder="Matte / Polished" />
        </Field>
      </div>

      <Field label="Colors" k="colors">
        <input className="cmi-input" value={draft.colors} onChange={set("colors")} placeholder="Limo, Melange, Sabbia" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Price" k="price">
          <input className="cmi-input" value={draft.price} onChange={set("price")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Unit">
          <input className="cmi-input" value={draft.price_unit} onChange={set("price_unit")} placeholder="each / sqft / lf" />
        </Field>
      </div>

      <Field label="Short description" k="short_description">
        <textarea className="cmi-input" rows={2} value={draft.short_description} onChange={set("short_description")} placeholder="One or two lines shown on the card." />
      </Field>

      <Field label="Long description" k="long_description">
        <textarea className="cmi-input" rows={3} value={draft.long_description} onChange={set("long_description")} placeholder="Full details (shown in the expanded view)." />
      </Field>

      <Field label="Features (one per line)">
        <textarea className="cmi-input" rows={3} value={draft.features} onChange={set("features")} placeholder={"Solid brass\nLifetime warranty"} />
      </Field>

      <Field label="Image URL" k="image_url">
        <input className="cmi-input" value={draft.image_url} onChange={set("image_url")} placeholder="https://…/product.jpg" />
      </Field>

      <Field label="Source URL">
        <input className="cmi-input" value={draft.source_url} onChange={set("source_url")} placeholder="https://vendor.com/product" />
      </Field>

      <Field label="Staff notes (never client-visible)">
        <textarea className="cmi-input" rows={2} value={draft.staff_notes} onChange={set("staff_notes")} placeholder="Internal notes" />
      </Field>
    </div>
  );
}
