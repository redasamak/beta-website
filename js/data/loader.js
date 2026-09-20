// Loads JSON files with friendly, teacher-readable errors. Supports an embedded data map (single-file preview build).
import { validateConfig, validateCourses, validateLesson } from './validator.js';

export const DEFAULT_CONFIG = {
  brand: { name: 'منصة البساطة', tagline: 'التاريخ من غير تعقيد.' },
  teacher: { name: '', bio: '', whatsapp: '', telegram: '' },
  schedule: [],
};

function lineOf(text, pos) { return text.slice(0, pos).split('\n').length; }

/** Turn a JSON.parse error into "near line N" when the engine gives us a position. */
export function describeParseError(err, text) {
  const msg = String(err && err.message || '');
  let m = msg.match(/line (\d+)/i);
  if (m) return `قريب من السطر ${m[1]}`;
  m = msg.match(/position (\d+)/i);
  if (m) return `قريب من السطر ${lineOf(text, Number(m[1]))}`;
  return 'مش قادرين نحدد السطر بالظبط';
}

/** Returns { data, missing, error:{file,title,lines[]}|null } — never throws. */
export async function loadJson(file, fetchImpl = globalThis.fetch, embed = globalThis.__BASATA_EMBED__) {
  let text;
  try {
    if (embed) {
      if (!(file in embed)) return { data: null, missing: true, error: null };
      text = typeof embed[file] === 'string' ? embed[file] : JSON.stringify(embed[file]);
    } else {
      const res = await fetchImpl(file, { cache: 'no-cache' });
      if (res.status === 404) return { data: null, missing: true, error: null };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      text = await res.text();
    }
  } catch (err) {
    return { data: null, missing: false, error: { file, title: `مش قادرين نفتح الملف ${file}`,
      lines: ['اتأكد إن النت شغال وإن الملف مرفوع في مكانه.'] } };
  }
  try {
    return { data: JSON.parse(text), missing: false, error: null };
  } catch (err) {
    return { data: null, missing: false, error: { file, title: `في غلطة كتابة في الملف ${file}`,
      lines: [describeParseError(err, text), 'غالبًا فاصلة "," ناقصة أو زيادة، أو علامة اقتباس " ناقصة. صلّحها وارفع الملف تاني.'] } };
  }
}

function fromValidation(file, errs) {
  return { file, title: `الملف ${file} فيه مشاكل في المحتوى`,
    lines: errs.slice(0, 6).map((e) => `${e.path}: ${e.message}`).concat(errs.length > 6 ? [`... و${errs.length - 6} مشاكل تانية`] : []) };
}

/** Load config (optional) + courses (required). Collects problems into `problems`. */
export async function loadApp(fetchImpl, embed) {
  const problems = [];
  let config = DEFAULT_CONFIG;
  const c = await loadJson('data/config.json', fetchImpl, embed);
  if (c.error) problems.push(c.error);
  else if (c.data) {
    const errs = validateConfig(c.data);
    if (errs.length) problems.push(fromValidation('data/config.json', errs));
    else config = { ...DEFAULT_CONFIG, ...c.data, brand: { ...DEFAULT_CONFIG.brand, ...c.data.brand }, teacher: { ...DEFAULT_CONFIG.teacher, ...c.data.teacher } };
  }
  let courses = null;
  const k = await loadJson('data/courses.json', fetchImpl, embed);
  if (k.error) problems.push(k.error);
  else if (k.missing) problems.push({ file: 'data/courses.json', title: 'ملف المنهج data/courses.json مش موجود', lines: ['المنصة محتاجاه علشان تعرض الدروس.'] });
  else {
    const errs = validateCourses(k.data);
    if (errs.length) problems.push(fromValidation('data/courses.json', errs)); else courses = k.data.courses;
  }
  return { config, courses, problems, catalog: courses ? buildCatalog(courses) : null };
}

/** Flat, ordered lesson index with parents and prev/next. */
export function buildCatalog(courses) {
  const lessons = [];
  const byId = new Map();
  for (const course of courses) for (const term of course.terms) for (const unit of term.units) for (const lesson of unit.lessons) {
    const rec = { lesson, unit, term, course, prev: null, next: null };
    lessons.push(rec); byId.set(lesson.id, rec);
  }
  const perCourse = new Map();
  for (const r of lessons) { const a = perCourse.get(r.course.id) || []; a.push(r); perCourse.set(r.course.id, a); }
  for (const arr of perCourse.values()) arr.forEach((r, i) => { r.prev = arr[i - 1] || null; r.next = arr[i + 1] || null; });
  return { lessons, byId, courseLessons: (id) => perCourse.get(id) || [] };
}

const cache = new Map();
/** Lazy lesson content. Returns { content|null, missing, error|null } and caches results. */
export async function getLesson(id, fetchImpl, embed) {
  if (cache.has(id)) return cache.get(id);
  const r = await loadJson(`data/lessons/${id}.json`, fetchImpl, embed);
  let out;
  if (r.error) out = { content: null, missing: false, error: r.error };
  else if (r.missing) out = { content: null, missing: true, error: null };
  else {
    const errs = validateLesson(r.data, id);
    out = errs.length ? { content: null, missing: false, error: fromValidation(`data/lessons/${id}.json`, errs) }
      : { content: r.data, missing: false, error: null };
  }
  cache.set(id, out);
  return out;
}
export const clearLessonCache = () => cache.clear();
