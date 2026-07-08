import { readFile } from "node:fs/promises";
import path from "node:path";

// Loads the CMI logo from public/brand as a base64 data URI so @react-pdf can
// embed it (react-pdf's <Image> needs a data URI / URL / buffer, and PNG — not
// SVG). Cached in-process after the first read. Node runtime only.
let cachedLogo: string | null = null;

export async function getBrandLogoDataUri(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const file = path.join(process.cwd(), "public", "brand", "cmi-logo-dark.png");
    const buf = await readFile(file);
    cachedLogo = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedLogo;
  } catch {
    return null; // logo is optional — templates render fine without it
  }
}
