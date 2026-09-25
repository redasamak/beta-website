import { h, stamp } from '../ui.js';
import { createQuiz } from './quiz.js';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function videoBlock(video) {
  const id = video && String(video.id || '');
  if (!id || !VIDEO_ID.test(id)) {
    return h('div', { class: 'video empty' }, h('p', null, 'فيديو الشرح قريبًا'));
  }
  const btn = h('button', { class: 'video play', type: 'button', 'aria-label': 'شغّل فيديو الشرح' },
    h('span', { class: 'tri', 'aria-hidden': 'true' }), h('span', { class: 'cap' }, 'شغّل فيديو الشرح'));
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe'); // created directly so `src` never flows through generic attrs
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    f.title = 'فيديو الشرح'; f.loading = 'lazy'; f.allowFullscreen = true;
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    f.className = 'video frame';
    btn.replaceWith(f); f.focus();
  }, { once: true });
  return btn;
}

const section = (title, ...kids) => h('section', { class: 'blk' }, h('h2', null, title), ...kids);

export async function renderLesson(ctx, { params }) {
  const rec = ctx.app.catalog.byId.get(params.id);
  if (!rec) return null;
  const { lesson, unit, term, course } = rec;
  ctx.store.setLast(lesson.id);
  const res = await ctx.getLesson(lesson.id);
  const c = res.content;

  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'مسار الصفحة' },
    h('a', { href: '#/' }, 'الرئيسية'), ' › ', h('a', { href: `#/c/${course.id}?t=${term.id}` }, course.title), ' › ', unit.title);

  const head = h('header', null, crumbs,
    h('h1', { class: 'draw' }, lesson.title),
    c && c.draft ? h('p', null, h('span', { class: 'badge' }, 'مسودة'), h('span', { class: 'muted small' }, ' المحتوى قيد مراجعة المدرس')) : null);

  const parts = [head];
  if (res.error) {
    ctx.banner('error', res.error.title, res.error.lines);
    parts.push(h('section', { class: 'sheet empty' }, h('h2', null, 'مش قادرين نعرض الدرس دلوقتي'),
      h('p', null, 'في مشكلة في ملف الدرس. المدرس هيصلحها قريب.')));
  } else if (!c) {
    parts.push(h('section', { class: 'sheet empty' }, h('h2', null, 'المحتوى لسه بيتجهّز'),
      h('p', null, 'عنوان الدرس مطابق للمنهج، وشرحه هيتضاف قريب.')));
  } else {
    parts.push(h('div', { class: 'sheet paper' },
      videoBlock(c.video),
      c.hook ? h('p', { class: 'hook' }, c.hook) : null,
      c.objectives && c.objectives.length ? section('هتقدر بعد الدرس ده', h('ul', { class: 'ticks' }, ...c.objectives.map((o) => h('li', null, o)))) : null,
      c.keyPoints && c.keyPoints.length ? section('النقاط الرئيسية', h('ol', { class: 'points' }, ...c.keyPoints.map((k) => h('li', null, k)))) : null,
      c.glossary && c.glossary.length ? section('كلمات مهمة', h('div', { class: 'notes' }, ...c.glossary.map((g) =>
        h('aside', { class: 'note' }, h('strong', null, g.term), h('span', null, g.def))))) : null,
      c.timeline && c.timeline.length ? section('الخط الزمني', h('ol', { class: 'tl' }, ...c.timeline.map((t) =>
        h('li', null, h('span', { class: 'yr' }, t.year), h('strong', null, t.title), t.text ? h('span', { class: 'muted' }, t.text) : null)))) : null,
      c.mistakes && c.mistakes.length ? section('أخطاء شائعة', h('ul', { class: 'warn' }, ...c.mistakes.map((m) => h('li', null, m)))) : null));

    if (c.quiz && c.quiz.length) {
      const qs = c.quiz.map((q, i) => ({ ...q, id: `${lesson.id}:${i}` }));
      const best = ctx.store.bestScore(lesson.id);
      parts.push(createQuiz(qs, {
        onAnswer: (q, ok) => ctx.store.recordAnswer(q.id, ok),
        onFinish: (pct) => ctx.store.setBest(lesson.id, pct),
      }, 'اختبر نفسك'));
      if (best != null) parts.push(h('p', { class: 'muted small' }, `أفضل نتيجة ليك في الدرس ده: ${best}%`));
    }
  }

  // completion (the red-pen stamp)
  const doneWrap = h('div', { class: 'complete' });
  const drawDone = () => {
    doneWrap.replaceChildren();
    if (ctx.store.isComplete(lesson.id)) {
      doneWrap.append(stamp('تم ✓'), h('button', { class: 'btn', type: 'button', onclick: () => { ctx.store.setComplete(lesson.id, false); drawDone(); } }, 'إلغاء العلامة'));
    } else {
      doneWrap.append(h('button', { class: 'btn primary big', type: 'button', onclick: () => { ctx.store.setComplete(lesson.id, true); drawDone(); } }, 'خلّصت الدرس'));
    }
  };
  drawDone(); parts.push(doneWrap);

  parts.push(h('nav', { class: 'pager', 'aria-label': 'التنقل بين الدروس' },
    rec.next ? h('a', { class: 'btn', href: `#/l/${rec.next.lesson.id}` }, 'الدرس التالي ←') : h('span'),
    rec.prev ? h('a', { class: 'btn', href: `#/l/${rec.prev.lesson.id}` }, '→ الدرس السابق') : h('span')));

  return { title: lesson.title, node: h('div', { class: 'view' }, ...parts) };
}
