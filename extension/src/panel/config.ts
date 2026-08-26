// The CMI web app that serves the /api/extension/* routes and the auth handoff.
// The live app is on my.constructedmatter.com (app.constructedmatter.com is not
// routed). Change here if the domain moves.
export const API_BASE = "https://my.constructedmatter.com";
export const AUTH_URL = `${API_BASE}/extension-auth`;
export const EXTENSION_VERSION = "0.1.0";
