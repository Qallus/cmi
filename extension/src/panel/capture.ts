import { cmiPageExtractor, cmiElementPicker, type ExtractResult } from "../content/injected";

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

function injectable(tab: chrome.tabs.Tab | null): tab is chrome.tabs.Tab & { id: number } {
  return !!tab?.id && /^https?:\/\//.test(tab.url ?? "");
}

export class CaptureError extends Error {}

// Run the extraction pipeline in the active tab and return the field map.
export async function autoBuild(): Promise<ExtractResult> {
  const tab = await activeTab();
  if (!injectable(tab)) throw new CaptureError("Open a vendor product page (http/https) in this tab first.");
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: cmiPageExtractor });
  const result = results[0]?.result as ExtractResult | undefined;
  if (!result) throw new CaptureError("Couldn't read this page.");
  return result;
}

// Arm the one-shot element picker for a field in the active tab. The captured
// value comes back to the panel as a CMI_PICK runtime message.
export async function startPick(fieldKey: string): Promise<void> {
  const tab = await activeTab();
  if (!injectable(tab)) throw new CaptureError("Open a vendor product page (http/https) in this tab first.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: cmiElementPicker, args: [fieldKey] });
}
