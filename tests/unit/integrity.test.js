import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('service worker precaches every app file (no file forgotten)', () => {
  const sw = readFileSync(root + 'sw.js', 'utf8');
  const shell = [...sw.matchAll(/'([^']+\.(?:js|css|json|svg|png|webmanifest|html))'/g)].map((m) => m[1]);
  const need = [...walk(root + 'js'), root + 'css/app.css', root + 'index.html', root + 'manifest.webmanifest', root + 'icon.svg', root + 'icon-192.png', root + 'icon-512.png', root + 'data/courses.json', root + 'data/config.json']
    .map((f) => relative(root, f));
  for (const f of need) assert.ok(shell.includes(f), `sw.js SHELL is missing ${f}`);
  for (const f of shell) if (f !== './') assert.ok(statSync(root + f, { throwIfNoEntry: false }), `sw.js lists a file that does not exist: ${f}`);
});

test('index.html: strict CSP (no unsafe-inline/eval, no inline scripts/handlers/styles), relative URLs only', () => {
  const html = readFileSync(root + 'index.html', 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp)); assert.match(csp, /default-src 'none'/); assert.match(csp, /script-src 'self'/);
  assert.ok(!/<script(?![^>]*\bsrc=)/.test(html), 'inline <script> found');
  assert.ok(!/\son[a-z]+\s*=/.test(html), 'inline event handler found'); assert.ok(!/\sstyle\s*=/.test(html), 'inline style attribute found');
  for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) assert.ok(!m[1].startsWith('/') && !/^https?:/.test(m[1]), 'non-relative URL: ' + m[1]);
});

test('source has no innerHTML/eval/document.write/localStorage-outside-store', () => {
  for (const f of walk(root + 'js')) {
    const src = readFileSync(f, 'utf8'); const rel = relative(root, f);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(src), `${rel}: unsafe API`);
    if (!rel.endsWith('store.js')) assert.ok(!/localStorage|sessionStorage/.test(src), `${rel}: storage used outside store`);
  }
});

test('no secrets or third-party scripts in the repo', () => {
  for (const f of [...walk(root + 'js'), root + 'index.html', root + 'sw.js']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}/i.test(src), `possible secret in ${f}`);
    assert.ok(!/<script[^>]+src="https?:/.test(src), `third-party script in ${f}`);
  }
});

test('manifest is valid and points at real files', () => {
  const m = JSON.parse(readFileSync(root + 'manifest.webmanifest', 'utf8'));
  assert.equal(m.dir, 'rtl'); assert.equal(m.start_url, './');
  for (const i of m.icons) assert.ok(statSync(root + i.src));
});

test('curriculum: 15 lessons for A, 12 for B, and B term 2 is intentionally empty', () => {
  const d = JSON.parse(readFileSync(root + 'data/courses.json', 'utf8')).courses;
  const count = (c) => c.terms.reduce((n, t) => n + t.units.reduce((m, u) => m + u.lessons.length, 0), 0);
  assert.equal(count(d[0]), 15); assert.equal(count(d[1]), 12);
  const t2 = d[1].terms[1]; assert.equal(t2.status, 'coming_soon'); assert.equal(t2.units.length, 0);
});
