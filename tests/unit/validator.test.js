import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validateCourses, validateLesson } from '../../js/data/validator.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

test('shipped data files are valid', () => {
  assert.deepEqual(validateConfig(read('data/config.json')), []);
  assert.deepEqual(validateCourses(read('data/courses.json')), []);
  for (const id of ['a-t1-u1-l1', 'b-t1-u1-l1']) assert.deepEqual(validateLesson(read(`data/lessons/${id}.json`), id), []);
});

test('config: bad whatsapp / telegram / schedule are caught with Arabic messages', () => {
  const errs = validateConfig({ teacher: { whatsapp: '+20 100', telegram: 'http://evil.example' }, schedule: [{ day: 'السبت' }] });
  const paths = errs.map((e) => e.path);
  assert.ok(paths.includes('teacher.whatsapp')); assert.ok(paths.includes('teacher.telegram'));
  assert.ok(paths.includes('schedule[0].time')); assert.ok(errs.every((e) => /[\u0600-\u06FF]/.test(e.message)));
});

test('courses: duplicate ids and missing titles are caught', () => {
  const d = read('data/courses.json');
  d.courses[0].terms[0].units[0].lessons[1].id = d.courses[0].terms[0].units[0].lessons[0].id;
  delete d.courses[1].terms[0].units[0].lessons[0].title;
  const errs = validateCourses(d);
  assert.ok(errs.some((e) => /مكرر/.test(e.message)));
  assert.ok(errs.some((e) => e.path.endsWith('.title')));
});

test('courses: wrong status value is caught', () => {
  const d = read('data/courses.json'); d.courses[0].terms[0].status = 'soon';
  assert.ok(validateCourses(d).some((e) => e.path.endsWith('.status')));
});

test('lesson: quiz answer out of range, bad video id, id mismatch', () => {
  const l = read('data/lessons/a-t1-u1-l1.json');
  l.quiz[0].answer = 9; l.video = { id: 'short' }; l.id = 'other';
  const paths = validateLesson(l, 'a-t1-u1-l1').map((e) => e.path);
  assert.ok(paths.includes('quiz[0].answer')); assert.ok(paths.includes('video.id')); assert.ok(paths.includes('id'));
});

test('lesson: garbage input does not throw', () => {
  for (const bad of [null, 5, 'x', [], { keyPoints: 'no' }, { quiz: [null] }]) assert.doesNotThrow(() => validateLesson(bad, 'x'));
});
