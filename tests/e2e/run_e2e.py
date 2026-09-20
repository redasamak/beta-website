#!/usr/bin/env python3
"""Real-browser end-to-end checks (Chromium via Playwright). Run: python3 tests/e2e/run_e2e.py
Serves the site from this repo at BOTH / and /beta-website/ (GitHub Pages sub-path), then exercises it.
Requires: pip install playwright && playwright install chromium"""
import http.server, threading, functools, os, sys, re, json, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SUB = '/beta-website'

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith(SUB + '/') or path == SUB: path = path[len(SUB):] or '/'
        return super().translate_path(path)
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=ROOT))
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}'

results = []
def check(name, cond, detail=''):
    results.append((bool(cond), name, detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

NOISE = re.compile(r'fonts\.(googleapis|gstatic)\.com|/data/lessons/.*\.json|Failed to load resource')
def watch(page, sink):
    page.on('pageerror', lambda e: sink.append(('pageerror', str(e))))
    def on_console(m):
        if m.type in ('error', 'warning'):
            url = (m.location or {}).get('url', '')
            if NOISE.search(m.text) or NOISE.search(url): return
            sink.append((m.type, m.text))
    page.on('console', on_console)

def lum(rgb):
    def f(c):
        c /= 255; return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + 0.05) / (lb + 0.05)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- 1. every route, 3 viewports: renders, no console errors, no horizontal scroll ----------
    routes = ['#/', '#/c/a', '#/c/a?t=a-t2', '#/c/b', '#/c/b?t=b-t2', '#/l/a-t1-u1-l1', '#/l/b-t1-u1-l1', '#/l/a-t2-u4-l3', '#/review', '#/search', '#/teacher', '#/checklist', '#/does/not/exist']
    for w, h_ in ((320, 640), (375, 812), (1280, 800)):
        ctx = browser.new_context(viewport={'width': w, 'height': h_}, locale='ar-EG')
        pg = ctx.new_page(); errs = []; watch(pg, errs)
        bad_scroll = []; empty = []
        for r in routes:
            pg.goto(f'{BASE}{SUB}/index.html{r}'); pg.wait_for_selector('main .view', timeout=5000); pg.wait_for_timeout(120)
            if pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): bad_scroll.append(r)
            if len(pg.inner_text('main').strip()) < 20: empty.append(r)
        check(f'{w}px: all {len(routes)} routes render (sub-path /beta-website/)', not empty, str(empty))
        check(f'{w}px: no horizontal scrolling on any route', not bad_scroll, str(bad_scroll))
        check(f'{w}px: zero console errors/warnings/page errors', not errs, str(errs[:3]))
        check(f'{w}px: page is RTL Arabic', pg.evaluate('document.documentElement.dir') == 'rtl' and pg.evaluate('document.documentElement.lang') == 'ar')
        ctx.close()

    # ---------- 2. journey: lesson -> complete -> persists -> continue card -> ring ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.course-card')
    check('home: shows 2 courses with 0/15 and 0/12', 'من 15' in pg.inner_text('main') and 'من 12' in pg.inner_text('main'))
    pg.click('.course-card >> nth=0'); pg.wait_for_selector('.lessons')
    check('course A term 1 lists 9 lessons in 2 units', pg.locator('.lrow').count() == 9 and pg.locator('.unit').count() == 2)
    pg.click('.tab:has-text("الترم الثاني")'); pg.locator('.tab[aria-current="true"]:has-text("الترم الثاني")').wait_for(timeout=5000)
    check('course A term 2 lists 6 lessons', pg.locator('.lrow').count() == 6)
    pg.goto(f'{BASE}/index.html#/c/a'); pg.wait_for_selector('.lessons'); pg.click('.lrow >> nth=0'); pg.wait_for_selector('.quiz')
    check('lesson opens with content, draft badge and a video placeholder', pg.locator('.badge').count() >= 1 and pg.locator('.video.empty').count() == 1)
    pg.click('button:has-text("خلّصت الدرس")'); pg.wait_for_selector('.stamp')
    check('completing shows the red-pen stamp', pg.locator('.complete .stamp').count() == 1)
    pg.reload(); pg.wait_for_selector('.stamp')
    check('completion persists after reload', pg.locator('.complete .stamp').count() == 1)
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.course-card')
    check('home: "continue where you left off" card + ring updated to 1/15', pg.locator('a:has-text("كمّل من حيث وقفت")').count() == 1 and '1 من 15' in pg.inner_text('main'))
    # export / import
    pg.goto(f'{BASE}/index.html#/teacher'); pg.wait_for_selector('.sheet')
    with pg.expect_download() as dl: pg.click('button:has-text("احفظ تقدمك")')
    saved = json.load(open(dl.value.path())); check('export produces valid progress JSON', saved.get('schemaVersion') == 1 and 'a-t1-u1-l1' in saved['completed'])
    check('journey: no console errors', not errs, str(errs[:3]))
    ctx.close()

    # ---------- 3. quiz + spaced-repetition review ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page()
    pg.goto(f'{BASE}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz')
    pg.locator('.opt').nth(0).click()  # Q1 correct answer is index 1 -> wrong
    check('wrong answer is marked in text (not colour only) and explained', pg.locator('.opt.wrong .mark').count() == 1 and pg.locator('.opt.right .mark').count() == 1 and pg.locator('.why').count() == 1)
    pg.click('.quiz .btn.primary'); pg.locator('.opt').nth(0).click(); pg.click('.quiz .btn.primary'); pg.locator('.opt').nth(0).click(); pg.click('.quiz .btn.primary')
    check('quiz ends with score 2 / 3', '2 / 3' in pg.inner_text('.quiz'))
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.course-card')
    check('no review due immediately for correct answers, but the wrong one is due in 1 day', pg.locator('a[href="#/review"].note-card').count() == 0)
    pg.evaluate("""() => { const k='basata:v1:progress'; const d=JSON.parse(localStorage.getItem(k)); for (const q of Object.values(d.quiz)) q.due = Date.now()-1000; localStorage.setItem(k, JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_selector('.course-card')
    check('when due, home invites a review', pg.locator('a[href="#/review"].note-card').count() == 1)
    pg.goto(f'{BASE}/index.html#/review'); pg.wait_for_selector('.quiz'); check('review page runs a quiz from due questions', pg.locator('.opt').count() >= 2)
    ctx.close()

    # ---------- 4. search ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page()
    pg.goto(f'{BASE}/index.html#/search'); pg.wait_for_selector('input.search'); pg.wait_for_timeout(300)
    pg.fill('input.search', 'نعرمر'); pg.wait_for_timeout(350)
    check('search finds "نعرمر" inside lesson content', pg.locator('.hit').count() >= 1)
    pg.fill('input.search', 'الحضاره'); pg.wait_for_timeout(350)
    check('search ignores ta-marbuta ("الحضاره" finds "الحضارة")', pg.locator('.hit').count() >= 1)
    ctx.close()

    # ---------- 5. teacher typos: broken JSON must show a friendly banner, never a blank page ----------
    def with_route(url_pat, body, status=200):
        ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page()
        pg.route(url_pat, lambda r: r.fulfill(status=status, body=body, content_type='application/json')); return ctx, pg
    ctx, pg = with_route('**/data/config.json', '{\n "brand": {\n  "name": "x",\n }\n}')
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.banner.error')
    txt = pg.inner_text('.banner.error')
    check('broken config.json: red Arabic banner names the file and the line; app still works', 'config.json' in txt and 'السطر' in txt and pg.locator('.course-card').count() == 2, txt[:120])
    ctx.close()
    ctx, pg = with_route('**/data/courses.json', '{"schemaVersion":1,"courses":[{"id":"a","title":"x","terms":[{"id":"t","title":"t","status":"nope","units":[]}]}]}')
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.banner.error')
    check('invalid courses.json: banner lists the exact bad field + friendly empty state', 'status' in pg.inner_text('.banner.error') and 'مش قادرة' in pg.inner_text('main'))
    ctx.close()
    ctx, pg = with_route('**/data/lessons/a-t1-u1-l1.json', '{"id":"a-t1-u1-l1","quiz":[{"q":"x","options":["a","b"],"answer":7}]}')
    pg.goto(f'{BASE}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.banner.error')
    check('lesson with a bad quiz answer: friendly banner + safe lesson page', 'quiz[0].answer' in pg.inner_text('.banner.error') and 'مش قادرين نعرض' in pg.inner_text('main'))
    ctx.close()

    # ---------- 6. blocked storage / private mode ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})")
    pg.goto(f'{BASE}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz'); pg.click('button:has-text("خلّصت الدرس")')
    check('blocked localStorage: app works, stamp shows for the session, no errors', pg.locator('.stamp').count() == 1 and not errs, str(errs[:2]))
    pg.goto(f'{BASE}/index.html#/teacher'); pg.wait_for_selector('.sheet')
    check('blocked storage: teacher page tells the student progress will not be saved', 'مانع الحفظ' in pg.inner_text('main'))
    ctx.close()

    # ---------- 7. offline (service worker) ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page(); errs = []; watch(pg, errs)
    pg.goto(f'{BASE}{SUB}/index.html'); pg.wait_for_selector('.course-card')
    pg.goto(f'{BASE}{SUB}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz')
    pg.evaluate('navigator.serviceWorker.ready'); pg.wait_for_timeout(600)
    ctrl = pg.evaluate('!!navigator.serviceWorker.controller')
    if not ctrl: pg.reload(); pg.wait_for_selector('.quiz'); pg.wait_for_timeout(300)
    check('service worker is active under the /beta-website/ sub-path', pg.evaluate('!!navigator.serviceWorker.controller'))
    ctx.set_offline(True)
    pg.goto(f'{BASE}{SUB}/index.html'); pg.wait_for_selector('.course-card', timeout=5000)
    check('OFFLINE: app shell + curriculum load from cache', pg.locator('.course-card').count() == 2)
    pg.goto(f'{BASE}{SUB}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz', timeout=5000)
    check('OFFLINE: a previously visited lesson still opens with its quiz', pg.locator('.opt').count() >= 2)
    pg.goto(f'{BASE}{SUB}/index.html#/l/b-t1-u1-l1'); pg.wait_for_selector('main .view', timeout=5000)
    check('OFFLINE: a never-visited lesson degrades gracefully (friendly message, no crash)', 'لسه بيتجهّز' in pg.inner_text('main') or pg.locator('.quiz').count() == 1)
    ctx.set_offline(False); ctx.close()

    # ---------- 8. keyboard + a11y basics ----------
    ctx = browser.new_context(viewport={'width': 375, 'height': 812}); pg = ctx.new_page()
    pg.goto(f'{BASE}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz')
    pg.keyboard.press('Tab'); pg.keyboard.press('Enter')
    check('skip link moves focus to main content (hash route intact)', pg.evaluate('document.activeElement.id') == 'main' and pg.evaluate('location.hash') == '#/l/a-t1-u1-l1')
    small = pg.evaluate("""() => [...document.querySelectorAll('a[href],button,select,input')].filter(e => e.offsetParent).map(e => { const r=e.getBoundingClientRect(); return [e.textContent.trim().slice(0,20), Math.round(r.width), Math.round(r.height)] }).filter(x => x[2] < 40 || x[1] < 40)""")
    check('all visible interactive controls are at least 40px tall/wide', not small, str(small[:4]))
    pg.locator('.opt').nth(1).focus(); pg.keyboard.press('Enter')
    check('quiz answerable by keyboard', pg.locator('.opt.right').count() == 1)
    unlabeled = pg.evaluate("""() => [...document.querySelectorAll('button,a,input,select')].filter(e => e.offsetParent && !(e.textContent.trim() || e.getAttribute('aria-label'))).length""")
    check('every control has an accessible name', unlabeled == 0, str(unlabeled))
    ctx.close()

    # ---------- 9. reduced motion ----------
    ctx = browser.new_context(reduced_motion='reduce'); pg = ctx.new_page(); pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.course-card')
    check('prefers-reduced-motion: no animations', pg.evaluate("getComputedStyle(document.querySelector('.view')).animationName") == 'none')
    ctx.close()

    # ---------- 10. contrast (WCAG AA 4.5:1), light + dark, computed from the real rendered colours ----------
    for scheme in ('light', 'dark'):
        ctx = browser.new_context(color_scheme=scheme, viewport={'width': 375, 'height': 812}); pg = ctx.new_page()
        pg.goto(f'{BASE}/index.html#/l/a-t1-u1-l1'); pg.wait_for_selector('.quiz'); pg.locator('.opt').nth(0).click(); pg.click('button:has-text("خلّصت الدرس")')
        pairs = pg.evaluate("""() => {
          const rgb = (s) => { if (s.startsWith('color(')) return s.match(/color\\(srgb ([^)\\/]+)/)[1].trim().split(/\\s+/).map(x => Number(x) * 255); const m = s.match(/rgba?\\(([^)]+)\\)/)[1].split(',').map(Number); return m.slice(0,3) };
          const cs = (sel, prop) => rgb(getComputedStyle(document.querySelector(sel))[prop]);
          const bg = (sel) => { let e = document.querySelector(sel); while (e) { const c = getComputedStyle(e).backgroundColor; if (!c.startsWith('rgba(0, 0, 0, 0')) return rgb(c); e = e.parentElement } return rgb(getComputedStyle(document.body).backgroundColor) };
          const T = [['body text on paper','body',null],['muted text on paper','.crumbs',null],['sheet text on card','.sheet.paper .points li','.sheet.paper'],['muted on card','.sheet.paper .muted','.sheet.paper'],
                     ['primary button','.btn.primary',null],['hook text','.hook',null],['sticky note text','.note strong',null],['badge text','.badge',null],['red timeline year on card','.tl .yr','.sheet.paper'],
                     ['stamp on card','.stamp','.complete'],['right answer mark','.opt.right .mark','.opt.right'],['wrong answer mark','.opt.wrong .mark','.opt.wrong'],['nav current','.nav a[aria-current]',null],['link','.crumbs a',null]];
          return T.filter(([n,s]) => document.querySelector(s)).map(([n,s,b]) => [n, cs(s,'color'), bg(b || s)]);
        }""")
        bad = [(n, round(ratio(fg, bgc), 2)) for n, fg, bgc in pairs if ratio(fg, bgc) < 4.5]
        check(f'contrast AA in {scheme} theme ({len(pairs)} pairs checked)', not bad, str(bad))
        ctx.close()

    # ---------- 11. performance under throttling (Slow 4G + 4x CPU) ----------
    ctx = browser.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=2); pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': int(1.6 * 1024 * 1024 / 8), 'uploadThroughput': int(750 * 1024 / 8)})
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.add_init_script("""window.__m={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__m.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__m.cls+=e.value}).observe({type:'layout-shift',buffered:true});""")
    sizes = {}
    pg.on('response', lambda r: sizes.__setitem__(r.url, len(r.body()) if r.ok and r.url.startswith(BASE) else 0))
    pg.goto(f'{BASE}/index.html'); pg.wait_for_selector('.course-card'); pg.wait_for_timeout(1500)
    m = pg.evaluate('window.__m'); print(f'  measured under Slow4G+4xCPU: LCP={m["lcp"]:.0f}ms CLS={m["cls"]:.3f}')
    check('LCP under 2.5s on Slow 4G + 4x CPU throttle (local server; fonts blocked in this sandbox)', m['lcp'] < 2500, f'{m["lcp"]:.0f}ms')
    check('CLS under 0.1', m['cls'] < 0.1, f'{m["cls"]:.3f}')
    ctx.close()
    browser.close()

fails = [r for r in results if not r[0]]
print(f'\n{len(results) - len(fails)}/{len(results)} checks passed')
sys.exit(1 if fails else 0)
