import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, MemStorage } from './_dom.js';
setupDom();
const { h, safeHref, banner } = await import('../../js/ui.js');
const { BasataStore, LocalBackend } = await import('../../js/data/store.js');
const { loadApp, getLesson, clearLessonCache } = await import('../../js/data/loader.js');
const { renderLesson } = await import('../../js/views/lesson.js');
const { renderCourse } = await import('../../js/views/course.js');
const { renderHome } = await import('../../js/views/home.js');
const { renderSearch } = await import('../../js/views/search.js');
const { renderTeacher } = await import('../../js/views/teacher.js');
const { renderChecklist } = await import('../../js/views/checklist.js');

const XSS = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';

test('safeHref only allows in-app hashes and https', () => {
  assert.equal(safeHref('#/l/x'), '#/l/x');
  assert.match(safeHref('https://t.me/abc'), /^https:\/\/t\.me\//);
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>', 'http://insecure.example', 'vbscript:x', '//evil.example', 'JaVaScRiPt:alert(1)', null, 5]) assert.equal(safeHref(bad), null, String(bad));
});

test('h(): text is text, event-handler attributes and style are dropped, _blank gets noopener', () => {
  const el = h('a', { href: 'javascript:alert(1)', onclick: () => {}, 'onmouseover': 'x()', style: 'x', target: '_blank' }, XSS);
  assert.equal(el.getAttribute('href'), null); assert.equal(el.getAttribute('onmouseover'), null); assert.equal(el.getAttribute('style'), null);
  assert.equal(el.getAttribute('rel'), 'noopener noreferrer'); assert.equal(el.querySelector('img,script'), null); assert.equal(el.textContent, XSS);
});

function embedWith(mutate) {
  const read = (f) => JSON.parse(readFileSyncUtf8(f));
  const courses = read('data/courses.json'); const cfg = read('data/config.json'); const lesson = read('data/lessons/a-t1-u1-l1.json');
  mutate({ courses, cfg, lesson });
  return { 'data/courses.json': JSON.stringify(courses), 'data/config.json': JSON.stringify(cfg), 'data/lessons/a-t1-u1-l1.json': JSON.stringify(lesson) };
}
import { readFileSync } from 'node:fs';
const readFileSyncUtf8 = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

async function ctxFor(embed) {
  clearLessonCache();
  const app = await loadApp(undefined, embed);
  const store = new BasataStore(new LocalBackend(new MemStorage()));
  return { app, store, banner: () => {}, applyTheme() {}, getLesson: (id) => getLesson(id, undefined, embed) };
}

test('hostile content in every JSON field renders as inert text in all views', async () => {
  const embed = embedWith(({ courses, cfg, lesson }) => {
    const l = courses.courses[0].terms[0].units[0].lessons[0];
    l.title = XSS; l.titleEn = XSS; courses.courses[0].title = XSS; courses.courses[0].terms[0].units[0].title = XSS;
    cfg.brand.name = XSS; cfg.brand.tagline = XSS; cfg.teacher.name = XSS; cfg.teacher.bio = XSS; cfg.teacher.telegram = 'javascript:alert(1)';
    cfg.teacher.whatsapp = '201000000000';
    lesson.hook = XSS; lesson.keyPoints = [XSS]; lesson.glossary = [{ term: XSS, def: XSS }]; lesson.timeline = [{ year: XSS, title: XSS, text: XSS }];
    lesson.quiz[0].q = XSS; lesson.quiz[0].options[0] = XSS; lesson.quiz[0].explain = XSS; lesson.mistakes = [XSS]; lesson.objectives = [XSS];
  });
  const ctx = await ctxFor(embed);
  // config with hostile telegram is rejected by validation, so app falls back to defaults but still loads
  assert.ok(ctx.app.problems.length >= 1); assert.ok(ctx.app.courses);
  const outs = [
    await renderHome(ctx), await renderCourse(ctx, { params: { id: 'a' }, query: {} }),
    await renderLesson(ctx, { params: { id: 'a-t1-u1-l1' } }), await renderTeacher(ctx), await renderChecklist(ctx),
  ];
  const s = await renderSearch(ctx, { query: { q: XSS } }); outs.push(s);
  for (const o of outs) {
    document.body.appendChild(o.node);
    assert.equal(o.node.querySelector('img,script,iframe,object,embed'), null, o.title);
    assert.equal(o.node.querySelectorAll('[onerror],[onclick],[onload]').length, 0, o.title);
    assert.equal(globalThis.window.__pwned, undefined);
  }
  const lessonHtml = outs[2].node.textContent; assert.ok(lessonHtml.includes('<img src=x'), 'payload is shown as literal text');
});

test('video facade: only valid 11-char ids create an iframe, always on youtube-nocookie', async () => {
  const good = await ctxFor(embedWith(({ lesson }) => { lesson.video = { id: 'dQw4w9WgXcQ' }; }));
  const out = await renderLesson(good, { params: { id: 'a-t1-u1-l1' } });
  assert.equal(out.node.querySelector('iframe'), null, 'no iframe before the user taps');
  out.node.querySelector('button.video.play').click();
  const f = out.node.querySelector('iframe'); assert.ok(f); assert.match(f.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  const bad = await ctxFor(embedWith(({ lesson }) => { lesson.video = { id: '"><script>x' }; }));
  assert.ok(bad.app.courses); // lesson fails validation -> friendly error, no iframe
  const out2 = await renderLesson(bad, { params: { id: 'a-t1-u1-l1' } });
  assert.equal(out2.node.querySelector('iframe, button.video.play'), null);
});

test('lesson without a content file shows the friendly template, and unknown lesson id returns null (404 view)', async () => {
  const ctx = await ctxFor({ 'data/courses.json': readFileSyncUtf8('data/courses.json') });
  const out = await renderLesson(ctx, { params: { id: 'a-t1-u2-l3' } });
  assert.match(out.node.textContent, /لسه بيتجهّز/);
  assert.equal(await renderLesson(ctx, { params: { id: 'nope' } }), null);
  assert.equal(renderCourse(ctx, { params: { id: 'nope' }, query: {} }), null);
});

test('course B term 2 shows "coming soon" instead of inventing lessons', async () => {
  const ctx = await ctxFor({ 'data/courses.json': readFileSyncUtf8('data/courses.json') });
  const out = renderCourse(ctx, { params: { id: 'b' }, query: { t: 'b-t2' } });
  assert.match(out.node.textContent, /لسه بيتجهّز/); assert.equal(out.node.querySelectorAll('.lrow').length, 0);
});

test('quiz flow: feedback, scoring, spaced-repetition history, best score', async () => {
  const ctx = await ctxFor({ 'data/courses.json': readFileSyncUtf8('data/courses.json'), 'data/lessons/a-t1-u1-l1.json': readFileSyncUtf8('data/lessons/a-t1-u1-l1.json') });
  const out = await renderLesson(ctx, { params: { id: 'a-t1-u1-l1' } }); document.body.appendChild(out.node);
  const answers = [1, 0, 1]; // last one deliberately wrong (correct is 0)
  for (const a of answers) {
    out.node.querySelectorAll('.opt')[a].click();
    assert.ok(out.node.querySelector('.why')); out.node.querySelector('.q-top ~ .row .btn, .row .btn.primary').click();
  }
  assert.match(out.node.querySelector('.score').textContent, /2 \/ 3/);
  assert.equal(ctx.store.bestScore('a-t1-u1-l1'), 67);
  assert.deepEqual(ctx.store.dueQuestions(Date.now() + 86400000 * 1.5).sort(), ['a-t1-u1-l1:2']); // wrong answer returns tomorrow; correct ones wait 2 days
});

test('search finds Arabic regardless of hamza/ta-marbuta/diacritics', async () => {
  const ctx = await ctxFor({ 'data/courses.json': readFileSyncUtf8('data/courses.json'), 'data/lessons/a-t1-u1-l1.json': readFileSyncUtf8('data/lessons/a-t1-u1-l1.json') });
  const out = await renderSearch(ctx, { query: {} }); document.body.appendChild(out.node);
  await new Promise((r) => setTimeout(r, 30));
  const input = out.node.querySelector('input'); input.value = 'الحضاره'; input.dispatchEvent(new window.Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(out.node.querySelectorAll('.hit').length >= 1);
  input.value = 'كلمة مش موجودة أبدا'; input.dispatchEvent(new window.Event('input')); await new Promise((r) => setTimeout(r, 200));
  assert.equal(out.node.querySelectorAll('.hit').length, 0);
});
