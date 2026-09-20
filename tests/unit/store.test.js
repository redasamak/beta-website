import test from 'node:test';
import assert from 'node:assert/strict';
import { BasataStore, LocalBackend } from '../../js/data/store.js';
import { MemStorage, BlockedStorage } from './_dom.js';

const mk = (st = new MemStorage()) => ({ st, store: new BasataStore(new LocalBackend(st)) });

test('progress persists across store instances', () => {
  const { st, store } = mk();
  store.setComplete('a-t1-u1-l1'); store.setLast('a-t1-u1-l1'); store.setBest('a-t1-u1-l1', 67); store.setBest('a-t1-u1-l1', 33);
  const again = new BasataStore(new LocalBackend(st));
  assert.equal(again.isComplete('a-t1-u1-l1'), true); assert.equal(again.last.id, 'a-t1-u1-l1'); assert.equal(again.bestScore('a-t1-u1-l1'), 67);
  again.setComplete('a-t1-u1-l1', false); assert.equal(again.isComplete('a-t1-u1-l1'), false);
});

test('blocked storage falls back to memory and never throws', () => {
  const store = new BasataStore(new LocalBackend(new BlockedStorage()));
  assert.equal(store.persistent, false);
  assert.doesNotThrow(() => { store.setComplete('x'); store.setTheme('dark'); });
  assert.equal(store.isComplete('x'), true); assert.equal(store.theme, 'dark');
});

test('corrupted saved data resets safely', () => {
  const st = new MemStorage(); st.setItem('basata:v1:progress', '{not json');
  const store = new BasataStore(new LocalBackend(st));
  assert.deepEqual(store.dueQuestions(), []); assert.equal(store.isComplete('x'), false);
  st.setItem('basata:v1:progress', JSON.stringify({ schemaVersion: 99 }));
  assert.equal(new BasataStore(new LocalBackend(st)).last, null);
});

test('Leitner: wrong is due tomorrow, right moves up, mastered leaves the review pile', () => {
  const { store } = mk(); const t0 = 1_000_000;
  store.recordAnswer('q1', false, t0);
  assert.deepEqual(store.dueQuestions(t0 + 86400000 - 1), []);
  assert.deepEqual(store.dueQuestions(t0 + 86400000), ['q1']);
  for (let i = 0; i < 5; i++) store.recordAnswer('q1', true, t0);
  assert.deepEqual(store.dueQuestions(t0 + 1e10), []);
});

test('import: rejects garbage, sanitizes hostile shapes, merges without losing progress', () => {
  const { store } = mk(); store.setComplete('keep');
  assert.equal(store.importJSON('nope').ok, false);
  assert.equal(store.importJSON('{"hello":1}').ok, false);
  const hostile = '{"schemaVersion":1,"completed":{"good":5,"bad":"x","__proto__":5,"' + 'y'.repeat(200) + '":1},"best":{"l":999},"quiz":{"q":{"box":99,"due":1},"__proto__":{"box":1,"due":1}},"last":{"id":{},"at":1}}';
  const r = store.importJSON(hostile);
  assert.equal(r.ok, true); assert.equal(store.isComplete('good'), true); assert.equal(store.isComplete('keep'), true);
  assert.equal(store.isComplete('bad'), false); assert.equal(store.bestScore('l'), null); assert.equal(store.hasQuestionHistory('q'), false);
  assert.equal({}.box, undefined); assert.equal(Object.getPrototypeOf(store.p.quiz), Object.prototype);
});

test('export/import round trip', () => {
  const a = mk().store; a.setComplete('l1'); a.recordAnswer('l1:0', false);
  const b = mk().store; assert.equal(b.importJSON(a.exportJSON()).ok, true);
  assert.equal(b.isComplete('l1'), true); assert.ok(b.hasQuestionHistory('l1:0'));
});
