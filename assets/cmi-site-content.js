(function () {
  'use strict';

  function pageName() {
    var path = window.location.pathname.split('/').pop();
    return path || 'index.html';
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    if (text) node.textContent = text;
    return node;
  }

  function addStyles() {
    if (document.getElementById('cmiSiteContentStyles')) return;
    var style = el('style', { id: 'cmiSiteContentStyles' });
    style.textContent = [
      '.cmi-site-notice{position:fixed;top:0;left:0;right:0;z-index:60;background:#111;color:#f7f5f2;border-bottom:1px solid rgba(255,255,255,.12);font-family:Roboto,system-ui,sans-serif}',
      '.cmi-site-notice-inner{max-width:1280px;margin:0 auto;padding:9px 24px;display:flex;align-items:center;justify-content:center;gap:14px;text-align:center;font-size:13px;line-height:1.35}',
      '.cmi-site-notice a{color:#c9a46e;text-decoration:none;font-weight:500}',
      '.cmi-site-cta{margin:72px auto;max-width:1180px;padding:0 24px;font-family:Roboto,system-ui,sans-serif}',
      '.cmi-site-cta-inner{border:1px solid rgba(158,111,46,.28);background:#f7f5f2;padding:36px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:28px}',
      '.dark .cmi-site-cta-inner{background:#161616;border-color:rgba(201,164,110,.28)}',
      '.cmi-site-cta h2{font-family:"DM Serif Display",Georgia,serif;font-size:clamp(30px,4vw,48px);line-height:1.05;margin:0;color:#1a1a1a}',
      '.dark .cmi-site-cta h2{color:#f0edea}',
      '.cmi-site-cta p{margin:10px 0 0;color:#6e6a66;max-width:680px;line-height:1.7}',
      '.cmi-site-cta a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;border-radius:6px;background:#9e6f2e;color:#fff;text-decoration:none;font-weight:500;white-space:nowrap}',
      '@media(max-width:760px){.cmi-site-notice-inner{padding:8px 14px;font-size:12px;flex-wrap:wrap}.cmi-site-cta{margin:48px auto;padding:0 18px}.cmi-site-cta-inner{padding:26px;align-items:flex-start;flex-direction:column}}'
    ].join('');
    document.head.appendChild(style);
  }

  function applyHero(block) {
    if (!block || !block.title) return;
    var h1 = document.querySelector('[data-cmi-hero-title], main h1, h1');
    if (h1) h1.textContent = block.title;
    var target = document.querySelector('[data-cmi-hero-subtitle]');
    if (!target && h1) {
      var candidates = Array.prototype.slice.call((h1.parentElement || document).querySelectorAll('p'));
      target = candidates[0] || null;
    }
    if (target && (block.subtitle || block.body)) target.textContent = block.subtitle || block.body;
  }

  function applyNotice(block) {
    if (!block || !block.enabled || (!block.title && !block.body)) return;
    var notice = el('div', { class: 'cmi-site-notice', role: 'status' });
    var inner = el('div', { class: 'cmi-site-notice-inner' });
    inner.appendChild(el('span', {}, [block.title, block.body].filter(Boolean).join(' - ')));
    if (block.button_label && block.button_url) inner.appendChild(el('a', { href: block.button_url }, block.button_label));
    notice.appendChild(inner);
    document.body.insertBefore(notice, document.body.firstChild);
    requestAnimationFrame(function () {
      var header = document.getElementById('siteHeader') || document.querySelector('header');
      if (header) header.style.top = notice.offsetHeight + 'px';
    });
  }

  function applyCta(block) {
    if (!block || !block.enabled || !block.title) return;
    var wrap = el('section', { class: 'cmi-site-cta' });
    var inner = el('div', { class: 'cmi-site-cta-inner' });
    var copy = el('div', {});
    copy.appendChild(el('h2', {}, block.title));
    if (block.subtitle || block.body) copy.appendChild(el('p', {}, block.subtitle || block.body));
    inner.appendChild(copy);
    if (block.button_label && block.button_url) inner.appendChild(el('a', { href: block.button_url }, block.button_label));
    wrap.appendChild(inner);
    var footer = document.querySelector('footer');
    if (footer) footer.parentNode.insertBefore(wrap, footer);
    else document.body.appendChild(wrap);
  }

  async function init() {
    addStyles();
    try {
      var res = await fetch('/api/public/site-content?page=' + encodeURIComponent(pageName()));
      if (!res.ok) return;
      var data = await res.json();
      var blocks = data.blocks || [];
      applyNotice(blocks.find(function (b) { return b.type === 'notification'; }));
      applyHero(blocks.find(function (b) { return b.type === 'hero'; }));
      applyCta(blocks.find(function (b) { return b.type === 'cta'; }));
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
