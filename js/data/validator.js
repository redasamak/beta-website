// Hand-written validators with friendly Arabic messages. Each returns [{path, message}].
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function need(errs, cond, path, message) { if (!cond) errs.push({ path, message }); return cond; }

export function validateConfig(cfg) {
  const e = [];
  if (!need(e, isObj(cfg), 'الملف', 'لازم يكون الملف كائن { ... }')) return e;
  if (cfg.brand !== undefined) {
    need(e, isObj(cfg.brand), 'brand', 'قسم brand لازم يكون كائن');
    if (isObj(cfg.brand)) {
      need(e, cfg.brand.name === undefined || isStr(cfg.brand.name), 'brand.name', 'الاسم لازم يكون نص');
    }
  }
  if (cfg.teacher !== undefined) {
    if (need(e, isObj(cfg.teacher), 'teacher', 'قسم teacher لازم يكون كائن')) {
      const t = cfg.teacher;
      need(e, t.name === undefined || isStr(t.name), 'teacher.name', 'اسم المدرس لازم يكون نص');
      need(e, t.whatsapp === undefined || /^\d{8,15}$/.test(String(t.whatsapp)), 'teacher.whatsapp',
        'رقم الواتساب لازم أرقام فقط بالصيغة الدولية بدون + (مثال: 201012345678)');
      need(e, t.telegram === undefined || /^https:\/\/(t|telegram)\.me\//.test(String(t.telegram)), 'teacher.telegram',
        'رابط تليجرام لازم يبدأ بـ https://t.me/');
    }
  }
  if (cfg.schedule !== undefined) {
    if (need(e, Array.isArray(cfg.schedule), 'schedule', 'المواعيد لازم تكون قائمة [ ... ]')) {
      cfg.schedule.forEach((row, i) => {
        const p = `schedule[${i}]`;
        if (!need(e, isObj(row), p, 'كل موعد لازم يكون كائن')) return;
        for (const k of ['day', 'time', 'group']) need(e, isStr(row[k]), `${p}.${k}`, `الحقل ${k} ناقص أو مش نص`);
      });
    }
  }
  return e;
}

export function validateCourses(doc) {
  const e = [];
  if (!need(e, isObj(doc), 'الملف', 'لازم يكون الملف كائن { ... }')) return e;
  if (!need(e, Array.isArray(doc.courses) && doc.courses.length > 0, 'courses', 'لازم قائمة courses فيها كورس واحد على الأقل')) return e;
  const ids = new Set();
  const uniq = (id, path) => {
    if (!need(e, isStr(id), `${path}.id`, 'الحقل id ناقص')) return;
    need(e, !ids.has(id), `${path}.id`, `الـ id "${id}" مكرر`); ids.add(id);
  };
  doc.courses.forEach((c, ci) => {
    const cp = `courses[${ci}]`;
    if (!need(e, isObj(c), cp, 'كل كورس لازم يكون كائن')) return;
    uniq(c.id, cp); need(e, isStr(c.title), `${cp}.title`, 'عنوان الكورس ناقص');
    if (!need(e, Array.isArray(c.terms), `${cp}.terms`, 'قائمة terms ناقصة')) return;
    c.terms.forEach((t, ti) => {
      const tp = `${cp}.terms[${ti}]`;
      if (!need(e, isObj(t), tp, 'كل ترم لازم يكون كائن')) return;
      uniq(t.id, tp); need(e, isStr(t.title), `${tp}.title`, 'عنوان الترم ناقص');
      need(e, ['active', 'coming_soon'].includes(t.status), `${tp}.status`, 'status لازم يكون active أو coming_soon');
      if (!need(e, Array.isArray(t.units), `${tp}.units`, 'قائمة units ناقصة')) return;
      t.units.forEach((u, ui) => {
        const up = `${tp}.units[${ui}]`;
        if (!need(e, isObj(u), up, 'كل وحدة لازم تكون كائن')) return;
        uniq(u.id, up); need(e, isStr(u.title), `${up}.title`, 'عنوان الوحدة ناقص');
        if (!need(e, Array.isArray(u.lessons), `${up}.lessons`, 'قائمة lessons ناقصة')) return;
        u.lessons.forEach((l, li) => {
          const lp = `${up}.lessons[${li}]`;
          if (!need(e, isObj(l), lp, 'كل درس لازم يكون كائن')) return;
          uniq(l.id, lp); need(e, isStr(l.title), `${lp}.title`, 'عنوان الدرس ناقص');
        });
      });
    });
  });
  return e;
}

export function validateLesson(doc, expectedId) {
  const e = [];
  if (!need(e, isObj(doc), 'الملف', 'لازم يكون الملف كائن { ... }')) return e;
  need(e, doc.id === expectedId, 'id', `الـ id لازم يطابق اسم الملف (المتوقع "${expectedId}")`);
  const list = (key, itemCheck) => {
    if (doc[key] === undefined) return;
    if (!need(e, Array.isArray(doc[key]), key, `${key} لازم يكون قائمة [ ... ]`)) return;
    doc[key].forEach((it, i) => itemCheck(it, `${key}[${i}]`));
  };
  list('objectives', (v, p) => need(e, isStr(v), p, 'لازم نص'));
  list('keyPoints', (v, p) => need(e, isStr(v), p, 'لازم نص'));
  list('mistakes', (v, p) => need(e, isStr(v), p, 'لازم نص'));
  list('glossary', (v, p) => { if (need(e, isObj(v), p, 'لازم كائن')) { need(e, isStr(v.term), p + '.term', 'المصطلح ناقص'); need(e, isStr(v.def), p + '.def', 'التعريف ناقص'); } });
  list('timeline', (v, p) => { if (need(e, isObj(v), p, 'لازم كائن')) { need(e, isStr(v.year), p + '.year', 'السنة ناقصة'); need(e, isStr(v.title), p + '.title', 'العنوان ناقص'); } });
  list('quiz', (v, p) => {
    if (!need(e, isObj(v), p, 'لازم كائن')) return;
    need(e, isStr(v.q), p + '.q', 'نص السؤال ناقص');
    if (need(e, Array.isArray(v.options) && v.options.length >= 2 && v.options.every(isStr), p + '.options', 'لازم اختيارين نصيين على الأقل')) {
      need(e, Number.isInteger(v.answer) && v.answer >= 0 && v.answer < v.options.length, p + '.answer',
        `الإجابة الصحيحة لازم رقم من 0 إلى ${v.options.length - 1} (الأول = 0)`);
    }
  });
  if (doc.video !== undefined) {
    if (need(e, isObj(doc.video), 'video', 'video لازم يكون كائن')) {
      need(e, doc.video.id === '' || doc.video.id === undefined || VIDEO_ID.test(String(doc.video.id)), 'video.id',
        'كود الفيديو لازم 11 حرف (الجزء بعد v= في رابط يوتيوب)');
    }
  }
  return e;
}
