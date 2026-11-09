// Service worker (MV3). Two jobs in Phase 1:
// 1) Open the side panel when the toolbar icon is clicked.
// 2) Receive the Supabase session token from the CMI web app's /extension-auth
//    page (externally_connectable) and stash it in session storage. The panel
//    watches storage.onChanged and refreshes when the token lands.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

type AuthMessage = { type?: string; token?: unknown; staffName?: unknown };

// After sign-in: back to the page you were building from, and close the sign-in tab.
async function returnFromSignIn(senderTabId: number | undefined): Promise<void> {
  const r = await chrome.storage.session.get(["cmi_return_tab", "cmi_auth_tab"]);
  const returnTab = r.cmi_return_tab as number | null | undefined;
  const authTab = (r.cmi_auth_tab as number | null | undefined) ?? senderTabId;
  await chrome.storage.session.remove(["cmi_return_tab", "cmi_auth_tab"]);
  if (returnTab != null) {
    const tab = await chrome.tabs.update(returnTab, { active: true }).catch(() => null);
    if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  }
  // Only close the tab the extension opened, and only once we've switched away from it.
  if (authTab != null && authTab === senderTabId && returnTab != null) await chrome.tabs.remove(authTab).catch(() => {});
}

chrome.runtime.onMessageExternal.addListener((message: AuthMessage, sender, sendResponse) => {
  if (message?.type === "CMI_AUTH" && typeof message.token === "string" && message.token) {
    chrome.storage.session
      .set({
        cmi_token: message.token,
        cmi_staff_name: typeof message.staffName === "string" ? message.staffName : null,
        cmi_paused: false,
      })
      .then(() => {
        sendResponse({ ok: true });
        // Give the page a moment to show "Connected" before switching tabs.
        setTimeout(() => void returnFromSignIn(sender.tab?.id), 900);
      })
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }));
    return true; // keep the message channel open for the async response
  }
  sendResponse({ ok: false });
  return false;
});
