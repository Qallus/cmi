// "Download HTML": the invitation as one self-contained file a staff member can
// host anywhere (their own site, a Claude artifact, a shared drive). The hero
// animation is the same function the live page runs (inlined), and the RSVP
// form posts back to CMI, so responses still land in Bookings → Events.
//
// Personal links keep working: open the file with ?i=<token> (copied from the
// guest list) and it loads that guest's RSVP. Open-link RSVPs from an exported
// copy fall back to the hosted page if CMI's spam check (Turnstile) needs them to.
import { cmiHero } from "./hero-script";
import { themeById } from "./themes";
import { formatDay, formatWhen, mapUrl, splitLocation, splitTitle } from "./format";
import { frameDocument } from "./custom-frame";
import type { InvitationEvent } from "./types";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const br = (v: string) => esc(v).replace(/\n/g, "<br>");
/** JSON that is safe inside a <script> tag. */
const LS = new RegExp(String.fromCharCode(0x2028), "g");
const PS = new RegExp(String.fromCharCode(0x2029), "g");
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(LS, "\\u2028").replace(PS, "\\u2029");

function linkify(text: string): string {
  return esc(text)
    .replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a href="mailto:$1">$1</a>')
    .replace(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g, (m) => `<a href="tel:${m.replace(/\D/g, "")}">${m}</a>`);
}

export function exportInvitationHtml(e: InvitationEvent, appUrl: string): string {
  const d = e.design;
  const t = themeById(d.theme);
  const title = splitTitle(e.title, d.title_accent);
  const where = splitLocation(e.location);
  const map = mapUrl(e.location);
  const custom = e.design_mode === "custom" && !!e.custom_html;
  const hosted = `${appUrl}/events/${e.slug}`;
  const pattern = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><g fill='none' stroke='${t.pattern}' stroke-width='1.2'><path d='M22 10l9 5v10l-9 5-9-5V15z'/><path d='M67 47v18M59 51l16 10M59 61l16-10'/><circle cx='67' cy='16' r='1.6'/><path d='M22 58v14M16 61l12 8M16 69l12-8'/></g></svg>`)}")`;

  const facts: string[] = [];
  const when = formatWhen(e.start_time, e.end_time);
  if (when) facts.push(`<dt>When</dt><dd>${esc(when)}</dd>`);
  if (where.venue) facts.push(`<dt>Where</dt><dd>${esc(where.venue)}${where.address ? `<br>${map ? `<a href="${esc(map)}" target="_blank" rel="noopener">${esc(where.address)}</a>` : esc(where.address)}` : ""}</dd>`);
  if (e.rsvp_deadline) facts.push(`<dt>RSVP by</dt><dd>${esc(formatDay(e.rsvp_deadline))}</dd>`);

  const hero = custom
    ? `<iframe class="custom" title="${esc(e.title)}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(frameDocument(e.custom_html ?? ""))}"></iframe>`
    : `<header class="hero" style="background:${t.heroBg};color:${t.heroInk}">
  <div class="pattern" style="background-image:${esc(pattern)}"></div>
  <canvas id="hero-canvas" aria-hidden="true"></canvas>
  <div class="wrap hero-in">
    <img class="logo" src="${appUrl}/brand/cmi_line_logo_white.png" alt="Constructed Matter, Inc.">
    ${d.eyebrow ? `<p class="eyebrow" style="color:${t.heroMuted}">${esc(d.eyebrow)}</p>` : ""}
    <h1>${esc(title.before)}${title.accent ? `<span style="color:${t.accent}">${esc(title.accent)}</span>` : ""}${esc(title.after)}</h1>
    ${facts.length ? `<dl class="facts">${facts.join("")}</dl>` : ""}
  </div>
</header>
<div class="stripe">${t.stripe.map((c) => `<span style="background:${c}"></span>`).join("")}</div>`;

  const message = !custom && (d.message_heading || d.message_body || d.signoff || d.image_url)
    ? `<section class="card first">
  ${d.image_url ? `<img class="photo" src="${esc(d.image_url)}" alt="">` : ""}
  ${d.message_heading ? `<h2 class="msg-h">${esc(d.message_heading)}</h2>` : ""}
  ${d.message_body ? `<p class="msg">${br(d.message_body)}</p>` : ""}
  ${d.signoff ? `<p class="signoff">${br(d.signoff)}</p>` : ""}
</section>`
    : "";

  const gtk = d.good_to_know.length
    ? `<section class="card"><h3 class="ct"><i style="background:${t.accent}"></i>Good to know</h3><dl class="gtk">${d.good_to_know
        .map((r) => `<dt>${esc(r.label)}</dt><dd>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.value || r.url)}</a>` : linkify(r.value)}</dd>`)
        .join("")}</dl></section>`
    : "";

  const config = {
    api: `${appUrl}/api/rsvp/${e.slug}`,
    hosted,
    slug: e.slug,
    access: e.access,
    plusOne: e.allow_plus_one,
    dietary: d.dietary,
    guestList: d.guest_list,
    animation: custom ? "none" : t.animation,
    colors: [t.accent, ...t.stripe],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(e.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap">
<style>
*{box-sizing:border-box}
body{margin:0;background:#f2f1ee;color:#1b1b1b;font-family:'Poppins',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 16px}
.hero{position:relative;overflow:hidden}
.pattern{position:absolute;inset:0;background-size:90px 90px}
#hero-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.hero-in{position:relative;padding:40px 20px 44px}
.logo{height:30px;width:auto;display:block}
.eyebrow{margin:36px 0 0;font-size:11.5px;letter-spacing:.28em;text-transform:uppercase;font-weight:500}
h1{margin:14px 0 0;font-size:clamp(28px,6vw,40px);line-height:1.15;font-weight:600}
.facts{margin:26px 0 0;display:grid;grid-template-columns:auto 1fr;column-gap:22px;row-gap:12px;font-size:15.5px}
.facts dt{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6);padding-top:4px}
.facts dd{margin:0;font-weight:500}
.facts a{text-underline-offset:3px}
.stripe{display:flex;height:5px}.stripe span{flex:1}
iframe.custom{display:block;width:100%;height:520px;border:0}
.card{background:#fff;border:1px solid #e3e1dd;border-radius:4px;padding:26px 28px;margin-top:18px}
.card.first{border-top:none;border-radius:0 0 4px 4px;margin-top:0;box-shadow:0 10px 30px rgba(0,0,0,.05)}
.photo{width:100%;height:auto;border-radius:2px;margin-bottom:18px;display:block}
.msg-h{margin:0;font-size:22px;font-weight:500;line-height:1.3}
.msg{margin:12px 0 0;font-size:16px;line-height:1.6}
.signoff{margin:18px 0 0;font-size:16px;line-height:1.6;font-style:italic;color:#4a4a4a}
.ct{display:flex;align-items:center;gap:10px;margin:0;font-size:19px;font-weight:500}
.ct i{width:9px;height:9px;border-radius:9px;display:inline-block}
.sub{margin:6px 0 14px;font-size:13px;color:#8a8a8a}
.note{background:#f2f1ee;border-left:3px solid ${t.stripe[1]};padding:12px 16px;font-size:14px;line-height:1.6;margin-bottom:18px}
.row{display:flex;gap:8px}
.choice{flex:1;min-height:50px;border-radius:2px;font:inherit;font-size:15px;cursor:pointer;border:1px solid #e3e1dd;background:#fff;color:#1b1b1b}
.choice.on{color:#fff;font-weight:500}
label{display:block;font-size:14px;font-weight:500;margin:18px 0 8px}
label small{color:#8a8a8a;font-weight:400;font-size:14px}
input,textarea{width:100%;border:1px solid #e3e1dd;border-radius:2px;padding:12px 14px;font:inherit;font-size:15px;background:#fff;color:#1b1b1b}
textarea{min-height:80px;resize:vertical}
.ids{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px}
.submit{background:${t.accent};color:#fff;border:none;border-radius:2px;padding:14px 22px;font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.status{font-size:14px;color:#8a8a8a;margin-left:14px}.status.err{color:#b42318}
.gtk{display:grid;grid-template-columns:minmax(90px,auto) 1fr;column-gap:22px;row-gap:14px;margin:14px 0 0;font-size:15px;line-height:1.55}
.gtk dt{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a8a8a;padding-top:3px}.gtk dd{margin:0}
.guests{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));row-gap:10px;column-gap:20px;font-size:15.5px}
.guests small{color:#8a8a8a;margin-left:6px;font-size:15px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
footer{text-align:center;margin:48px 0 40px}footer p{margin:0;font-size:16px}footer .co{margin-top:8px;font-size:13px;color:#8a8a8a}
[hidden]{display:none!important}
</style>
</head>
<body>
${hero}
<main class="wrap">
${message}
<section class="card"${message ? "" : ' style="margin-top:18px"'}>
  <h3 class="ct"><i style="background:${t.accent}"></i>Your RSVP</h3>
  <p class="sub" id="sub">You can come back and change it anytime.</p>
  ${d.rsvp_note ? `<div class="note">${linkify(d.rsvp_note)}</div>` : ""}
  <p id="locked" hidden>This invitation is personal. Please open the RSVP link from your invite email or text.</p>
  <form id="f" novalidate>
    <input class="hp" type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="ids" id="ids"><input id="name" placeholder="Your name" autocomplete="name" aria-label="Your name"><input id="email" type="email" placeholder="Email" autocomplete="email" aria-label="Email"></div>
    <p id="for" class="sub" hidden></p>
    <div class="row"><button type="button" class="choice" data-s="attending">I'll be there</button><button type="button" class="choice" data-s="declined">Can't make it</button></div>
    <div id="plus" hidden>
      <label>Bringing a +1?</label>
      <div class="row"><button type="button" class="choice" data-p="1">Yes, +1</button><button type="button" class="choice" data-p="0">Just me</button></div>
      <div id="pname" hidden><label>+1's name <small>optional</small></label><input id="plus_name"></div>
    </div>
    <div id="diet" hidden><label>Dietary needs or notes <small>optional</small></label><textarea id="notes" placeholder="Anything we should tell the restaurant"></textarea></div>
    <div style="margin-top:22px;display:flex;align-items:center;flex-wrap:wrap"><button class="submit" id="go" type="submit">Send RSVP</button><span class="status" id="st" role="status"></span></div>
  </form>
</section>
${gtk}
<section class="card" id="who"${d.guest_list === "off" ? " hidden" : ""}><h3 class="ct"><i style="background:${t.accent}"></i>Who's coming</h3><p class="sub" id="count"></p><ul class="guests" id="gl"></ul></section>
<footer>${d.footer_note ? `<p>${esc(d.footer_note)}</p>` : ""}<p class="co">Constructed Matter, Inc. &nbsp;|&nbsp; 7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251</p></footer>
</main>
<script>
// Some bundlers insert __name(fn, "name") calls into compiled functions.
var __name = function (f) { return f; };
var CMI_HERO = (${cmiHero.toString()});
(function(){
var C = ${scriptJson(config)};
var choiceColor = ${scriptJson(t.choice)};
var cv = document.getElementById("hero-canvas");
if (cv && C.animation !== "none") { try { CMI_HERO(cv, C.animation, C.colors); } catch (e) {} }
window.addEventListener("message", function(e){ var fr = document.querySelector("iframe.custom"); var h = e.data && Number(e.data.cmiInviteHeight); if (fr && e.source === fr.contentWindow && h > 40) fr.style.height = Math.min(6000, Math.ceil(h)) + "px"; });
var f = document.getElementById("f"), st = document.getElementById("st"), go = document.getElementById("go");
var started = Date.now(), status = null, plus = false, rsvp = null;
var key = "cmi-rsvp:" + C.slug;
var params = new URLSearchParams(location.search);
var token = /^[a-f0-9]{32}$/.test(params.get("i") || "") ? params.get("i") : null;
if (!token) { try { var s = localStorage.getItem(key); if (/^[a-f0-9]{32}$/.test(s || "")) token = s; } catch (e) {} }
function $(id){ return document.getElementById(id); }
function paint(){
  document.querySelectorAll("[data-s]").forEach(function(b){ var on = b.getAttribute("data-s") === status; b.classList.toggle("on", on); b.style.background = on ? choiceColor : ""; b.style.borderColor = on ? choiceColor : ""; });
  document.querySelectorAll("[data-p]").forEach(function(b){ var on = (b.getAttribute("data-p") === "1") === plus; b.classList.toggle("on", on); b.style.background = on ? "#1b1b1b" : ""; b.style.borderColor = on ? "#1b1b1b" : ""; });
  $("plus").hidden = !(status === "attending" && C.plusOne);
  $("pname").hidden = !plus;
  $("diet").hidden = !(status === "attending" && C.dietary);
  var personal = !!(rsvp && rsvp.token);
  $("ids").hidden = personal;
  $("for").hidden = !(personal && rsvp.name);
  if (personal && rsvp.name) $("for").textContent = "RSVP for " + rsvp.name;
  go.textContent = rsvp && rsvp.status && rsvp.status !== "invited" ? "Update RSVP" : "Send RSVP";
  var locked = !personal && C.access === "invite_only";
  $("locked").hidden = !locked; f.hidden = locked;
}
function guests(g){
  if (!g || C.guestList === "off") return;
  $("count").textContent = g.count + " coming so far";
  var ul = $("gl"); ul.innerHTML = "";
  (g.names || []).forEach(function(n){ var li = document.createElement("li"); li.textContent = n.name; if (n.plus_one) { var s = document.createElement("small"); s.textContent = "+1"; li.appendChild(s); } ul.appendChild(li); });
}
function load(r){
  if (!r) return; rsvp = r;
  if (r.status === "attending" || r.status === "declined") status = r.status;
  plus = !!r.plus_one; $("plus_name").value = r.plus_one_name || ""; $("notes").value = r.notes || "";
  $("name").value = r.name || ""; $("email").value = r.email || "";
}
document.querySelectorAll("[data-s]").forEach(function(b){ b.onclick = function(){ status = b.getAttribute("data-s"); if (status !== "attending") plus = false; paint(); }; });
document.querySelectorAll("[data-p]").forEach(function(b){ b.onclick = function(){ plus = b.getAttribute("data-p") === "1"; paint(); }; });
fetch(C.api + (token ? "?i=" + token : "")).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
  if (!j) return; if (j.rsvp) load(j.rsvp); guests(j.guests);
  if (j.closed) { $("sub").textContent = "RSVPs are closed."; go.hidden = true; }
  paint();
}).catch(function(){});
f.onsubmit = function(ev){
  ev.preventDefault(); st.className = "status"; st.textContent = "";
  if (!status) { st.className = "status err"; st.textContent = "Choose whether you'll be there."; return; }
  go.disabled = true; go.textContent = "Saving…";
  fetch(C.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    token: rsvp && rsvp.token ? rsvp.token : null, name: $("name").value, email: $("email").value, status: status, plus_one: plus,
    plus_one_name: $("plus_name").value, notes: $("notes").value, company_website: f.company_website.value, startedAt: started
  }) }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); }).then(function(x){
    if (!x.ok) {
      st.className = "status err";
      if (x.j && x.j.code === "turnstile_required") { st.innerHTML = 'Please RSVP on <a href="' + C.hosted + '">the event page</a>.'; }
      else st.textContent = (x.j && x.j.error) || "Something went wrong. Please try again.";
      return;
    }
    if (x.j.rsvp && x.j.rsvp.token) { load(x.j.rsvp); try { localStorage.setItem(key, x.j.rsvp.token); } catch (e) {} }
    else if (x.j.rsvp) { rsvp = Object.assign({}, x.j.rsvp, { token: null }); }
    guests(x.j.guests); st.textContent = "Saved. Thanks!";
  }).catch(function(){ st.className = "status err"; st.textContent = "Couldn't reach the server. Please try again."; })
  .then(function(){ go.disabled = false; paint(); });
};
paint();
})();
</script>
</body>
</html>`;
}
