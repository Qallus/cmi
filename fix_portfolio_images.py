"""
Patch all portfolio pages to:
1. Change `const lbSrcs` → `window.lbSrcs` so the Supabase script can update it
2. Add hero image + gallery rebuild to the Supabase dynamic script
"""
import os, re

PORTFOLIO_DIR = os.path.join(os.path.dirname(__file__), 'portfolio')

# 1. Old lbSrcs declaration
OLD_LBSRCS = 'const lbSrcs    = Array.from(thumbBtns).map(b => b.dataset.src);'
NEW_LBSRCS = 'window.lbSrcs   = Array.from(thumbBtns).map(b => b.dataset.src);'

# 2. End of Supabase dynamic script — insert hero/gallery update before catch
OLD_CATCH = "    } catch(e) { /* fail silently */ }\n  })();\n  </script>"
NEW_CATCH = """\
      // Hero image
      if (data.featured_image) {
        const heroImg = document.getElementById('heroImg');
        if (heroImg) heroImg.src = data.featured_image;
      }
      // Gallery thumbnails + lightbox sources
      if (data.gallery_images && data.gallery_images.length) {
        const strip = document.getElementById('thumbStrip');
        if (strip) {
          strip.innerHTML = data.gallery_images.map((url, i) =>
            '<button class="thumb' + (i === 0 ? ' active' : '') +
            ' flex-shrink-0 h-[88px] w-[132px] rounded-xl overflow-hidden focus:outline-none"' +
            ' data-src="' + url + '" aria-label="View image ' + (i + 1) + '">' +
            '<img src="' + url + '" alt="Photo ' + (i + 1) + '" class="w-full h-full object-cover pointer-events-none" />' +
            '</button>'
          ).join('');
          window.lbSrcs = data.gallery_images.slice();
          strip.querySelectorAll('.thumb').forEach((btn, i) => {
            btn.addEventListener('click', () => openLightbox(i));
          });
        }
      }
    } catch(e) { /* fail silently */ }
  })();
  </script>"""

files = [f for f in os.listdir(PORTFOLIO_DIR) if f.endswith('.html')]
for fname in files:
    path = os.path.join(PORTFOLIO_DIR, fname)
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    changed = False

    if OLD_LBSRCS in html:
        html = html.replace(OLD_LBSRCS, NEW_LBSRCS)
        changed = True
    else:
        print(f'[skip lbSrcs] {fname}')

    if OLD_CATCH in html:
        html = html.replace(OLD_CATCH, NEW_CATCH)
        changed = True
    else:
        print(f'[skip catch]  {fname}')

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'[ok] {fname}')

print('Done.')
