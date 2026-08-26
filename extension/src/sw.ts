// Service worker (MV3). Two jobs in Phase 1:
// 1) Open the side panel when the toolbar icon is clicked.
// 2) Receive the Supabase session token from the CMI web app's /extension-auth
//    page (externally_connectable) and stash it in session storage. The panel
//    watches storage.onChanged and refreshes when the token lands.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

type AuthMessage = { type?: string; token?: unknown; staffName?: unknown };

chrome.runtime.onMessageExternal.addListener((message: AuthMessage, _sender, sendResponse) => {
  if (message?.type === "CMI_AUTH" && typeof message.token === "string" && message.token) {
    chrome.storage.session
      .set({
        cmi_token: message.token,
        cmi_staff_name: typeof message.staffName === "string" ? message.staffName : null,
      })
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }));
    return true; // keep the message channel open for the async response
  }
  sendResponse({ ok: false });
  return false;
});
