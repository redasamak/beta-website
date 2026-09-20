import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, matchRoute } from '../../js/router.js';
import { normalize } from '../../js/lib/normalize.js';

const routes = [{ path: '/' }, { path: '/c/:id' }, { path: '/l/:id' }, { path: '/search' }];

test('routes and params', () => {
  assert.equal(matchRoute(routes, '').route.path, '/');
  assert.equal(matchRoute(routes, '#/').route.path, '/');
  const m = matchRoute(routes, '#/l/a-t1-u1-l1'); assert.equal(m.route.path, '/l/:id'); assert.equal(m.params.id, 'a-t1-u1-l1');
  assert.equal(matchRoute(routes, '#/nope/x/y').route, null);
  assert.equal(matchRoute(routes, '#/main').route, null);
});
test('query parsing incl. Arabic and bad escapes', () => {
  assert.equal(parseHash('#/search?q=%D9%86%D8%B9%D8%B1%D9%85%D8%B1').query.q, 'نعرمر');
  assert.equal(parseHash('#/c/a?t=a-t2').query.t, 'a-t2');
  assert.doesNotThrow(() => parseHash('#/search?q=%E0%A4%A'));
  assert.doesNotThrow(() => matchRoute(routes, '#/l/%E0%A4%A'));
});
test('Arabic normalization for search', () => {
  assert.equal(normalize('الحَضَارَة'), normalize('الحضاره'));
  assert.equal(normalize('أحمس'), normalize('احمس'));
  assert.equal(normalize('مصطفى'), normalize('مصطفي'));
  assert.equal(normalize('ثورة ١٩١٩'), 'ثوره 1919');
});
