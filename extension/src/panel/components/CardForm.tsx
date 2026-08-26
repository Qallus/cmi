import type { CardDraft } from "../../types";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="cmi-label">{label}</span>
      {children}
    </label>
  );
}

type Props = {
  draft: CardDraft;
  onChange: (patch: Partial<CardDraft>) => void;
};

// Manual capture fields (Phase 1 — no element picker yet). Controlled by App.
export function CardForm({ draft, onChange }: Props) {
  const set =
    (key: keyof CardDraft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value } as Partial<CardDraft>);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Eyebrow (optional)">
        <input className="cmi-input" value={draft.eyebrow} onChange={set("eyebrow")} placeholder="e.g. Kitchen · Plumbing" />
      </Field>

      <Field label="Product title *">
        <input className="cmi-input" value={draft.title} onChange={set("title")} placeholder="Product name" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Vendor">
          <input className="cmi-input" value={draft.vendor_name} onChange={set("vendor_name")} placeholder="Ferguson" />
        </Field>
        <Field label="Category">
          <input className="cmi-input" value={draft.category} onChange={set("category")} placeholder="Fixtures" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="SKU">
          <input className="cmi-input" value={draft.sku} onChange={set("sku")} placeholder="SKU" />
        </Field>
        <Field label="Model #">
          <input className="cmi-input" value={draft.model_number} onChange={set("model_number")} placeholder="Model" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Price">
          <input className="cmi-input" value={draft.price} onChange={set("price")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Unit">
          <input className="cmi-input" value={draft.price_unit} onChange={set("price_unit")} placeholder="each / sqft / lf" />
        </Field>
      </div>

      <Field label="Short description">
        <textarea className="cmi-input" rows={2} value={draft.short_description} onChange={set("short_description")} placeholder="One or two lines shown on the card." />
      </Field>

      <Field label="Long description">
        <textarea className="cmi-input" rows={3} value={draft.long_description} onChange={set("long_description")} placeholder="Full details (shown in the expanded view)." />
      </Field>

      <Field label="Features (one per line)">
        <textarea className="cmi-input" rows={3} value={draft.features} onChange={set("features")} placeholder={"Solid brass\nLifetime warranty"} />
      </Field>

      <Field label="Image URL">
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
