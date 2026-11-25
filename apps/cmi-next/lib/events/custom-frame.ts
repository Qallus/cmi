// Wrap a custom invitation design for its sandboxed iframe. Pure.
//
// Adds a tiny script that tells the parent page how tall the design is, and
// makes links open in a new tab (the sandbox can't navigate the CMI page).

const SIZER = `<script>(function(){function s(){try{var b=document.body;var h=b?Math.max(b.scrollHeight,b.offsetHeight):document.documentElement.scrollHeight;parent.postMessage({cmiInviteHeight:h},"*");}catch(e){}}
window.addEventListener("load",s);window.addEventListener("resize",s);setInterval(s,1000);s();
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(a&&!a.target){a.target="_blank";a.rel="noopener";}},true);})();</script>`;

export function frameDocument(html: string): string {
  const src = html ?? "";
  // A whole document: put the sizer before </body>. A fragment: wrap it.
  if (/<\/body>/i.test(src)) return src.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${SIZER}</body>`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}</style></head><body>${src}${SIZER}</body></html>`;
}
