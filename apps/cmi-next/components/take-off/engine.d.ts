export type RenderedPage = {
  /** PNG/JPEG data URL. No remote image URL, untrusted SVG, or markup. */
  image: string;
  width: number;
  height: number;
  page?: number;
};
export interface TakeOffOptions {
  theme?: "light" | "dark";
  /** Standalone component review only; false inside the CMI dashboard. */
  showThemeControl?: boolean;
  onThemeChange?: (theme: "light" | "dark") => void;
  pdfRenderer?: (file: File) => Promise<RenderedPage[]>;
}
export interface TakeOffController {
  destroy(): void;
  getSnapshot(): unknown;
  /** Changes a marker without replacing DOM or losing focused input. */
  setTheme(theme: "light" | "dark"): void;
}
export function mountTakeOff(host: HTMLElement, options?: TakeOffOptions): TakeOffController;
