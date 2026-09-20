import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadJson, loadApp, describeParseError, getLesson, clearLessonCache, buildCatalog } from '../../js/data/loader.js';

const root = new URL('../../', import.meta.url);
const disk = (f) => readFileSync(new URL(f, root), 'utf8');
const mkFetch = (files) => async (f) => (f in files
  ? { ok: true, status: 200, text: async () => files[f] }
  : { ok: false, status: 404, text: async () => '' });
const real = () => ({ 'data/config.json': disk('data/config.json'), 'data/courses.json': disk('data/courses.json') });

test('404 is "missing", not an error (optional files)', async () => {
  const r = await loadJson('data/x.json', mkFetch({}));
  assert.equal(r.missing, true); assert.equal(r.error, null);
});

test('syntax error names the file and gives a friendly Arabic hint', async () => {
  const bad = '{\n  "a": 1,\n  "b": 2,\n}\n';
  const r = await loadJson('data/config.json', mkFetch({ 'data/config.json': bad }));
  assert.ok(r.error); assert.match(r.error.title, /data\/config\.json/); assert.ok(r.error.lines.some((l) => /السطر/.test(l)));
});

test('describeParseError extracts a line for both V8 message styles', () => {
  assert.match(describeParseError(new Error('Unexpected token } in JSON at position 20'), '{\n"a":1,\n"b":2,\n}'), /السطر 4/);
  assert.match(describeParseError(new Error('Expected double-quoted (line 3 column 5)'), ''), /السطر 3/);
});

test('network failure gives a friendly error and never throws', async () => {
  const r = await loadJson('data/courses.json', async () => { throw new Error('offline'); });
  assert.ok(r.error); assert.match(r.error.title, /مش قادرين/);
});

test('broken config.json becomes a visible problem but the app still loads with defaults', async () => {
  const files = { ...real(), 'data/config.json': '{ "brand": ' };
  const app = await loadApp(mkFetch(files));
  assert.equal(app.problems.length, 1); assert.match(app.problems[0].title, /config\.json/);
  assert.ok(app.courses); assert.ok(app.config.brand.name);
});

test('missing config.json is fine; missing courses.json is reported', async () => {
  const noCfg = await loadApp(mkFetch({ 'data/courses.json': disk('data/courses.json') }));
  assert.equal(noCfg.problems.length, 0); assert.ok(noCfg.courses);
  const noCourses = await loadApp(mkFetch({}));
  assert.equal(noCourses.courses, null); assert.match(noCourses.problems[0].title, /courses\.json/);
});

test('invalid content (typo in a value) is reported with paths', async () => {
  const d = JSON.parse(disk('data/courses.json')); d.courses[0].terms[0].status = 'oops';
  const app = await loadApp(mkFetch({ ...real(), 'data/courses.json': JSON.stringify(d) }));
  assert.equal(app.courses, null); assert.ok(app.problems[0].lines.some((l) => /status/.test(l)));
});

test('catalog: 27 lessons, prev/next stay inside a course', async () => {
  const app = await loadApp(mkFetch(real()));
  assert.equal(app.catalog.lessons.length, 27);
  assert.equal(app.catalog.courseLessons('a').length, 15); assert.equal(app.catalog.courseLessons('b').length, 12);
  const firstB = app.catalog.courseLessons('b')[0]; assert.equal(firstB.prev, null);
  const lastA = app.catalog.courseLessons('a').at(-1); assert.equal(lastA.next, null);
});

test('lesson loading: content, missing, id mismatch, cache', async () => {
  clearLessonCache();
  const files = { 'data/lessons/a-t1-u1-l1.json': disk('data/lessons/a-t1-u1-l1.json'), 'data/lessons/x.json': '{"id":"wrong"}' };
  const f = mkFetch(files);
  assert.ok((await getLesson('a-t1-u1-l1', f)).content);
  assert.equal((await getLesson('nothing', f)).missing, true);
  assert.ok((await getLesson('x', f)).error);
  const again = await getLesson('a-t1-u1-l1', async () => { throw new Error('should be cached'); });
  assert.ok(again.content);
});

test('embed mode (single-file preview) serves data without fetch', async () => {
  const embed = { 'data/courses.json': disk('data/courses.json') };
  const app = await loadApp(async () => { throw new Error('no fetch'); }, embed);
  assert.ok(app.courses); assert.equal(app.problems.length, 0);
});

test('every lesson file on disk matches a catalog lesson id', async () => {
  const app = await loadApp(mkFetch(real()));
  for (const f of readdirSync(new URL('data/lessons/', root))) assert.ok(app.catalog.byId.has(f.replace('.json', '')), f);
});

test('curriculum titles (27 lessons) are unique and non-empty', () => {
  const cat = buildCatalog(JSON.parse(disk('data/courses.json')).courses);
  const ids = cat.lessons.map((r) => r.lesson.id); assert.equal(new Set(ids).size, 27);
  assert.ok(cat.lessons.every((r) => r.lesson.title.length > 3));
});
