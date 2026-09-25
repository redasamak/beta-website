import { h, stamp } from '../ui.js';

export function renderCourse(ctx, { params, query }) {
  const { courses } = ctx.app;
  const course = courses.find((c) => c.id === params.id);
  if (!course) return null;
  const termId = course.terms.some((t) => t.id === query.t) ? query.t : (course.terms[0] && course.terms[0].id);
  const term = course.terms.find((t) => t.id === termId);

  const tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'اختر الترم' },
    ...course.terms.map((t) => h('a', { class: 'tab', href: `#/c/${course.id}?t=${t.id}`, 'aria-current': t.id === termId ? 'true' : null },
      t.title, t.status === 'coming_soon' ? h('small', null, ' (قريبًا)') : null)));

  let body;
  if (!term || term.status === 'coming_soon' || term.units.length === 0) {
    body = h('section', { class: 'sheet empty' },
      h('h2', null, 'الترم ده لسه بيتجهّز'),
      h('p', null, 'لما المدرس يضيف الدروس هتظهر هنا تلقائيًا. تابع المنصة.'));
  } else {
    body = h('div', null, ...term.units.map((u) => h('section', { class: 'sheet unit' },
      h('h2', null, u.title),
      h('ol', { class: 'lessons' }, ...u.lessons.map((l, i) => {
        const done = ctx.store.isComplete(l.id);
        return h('li', null, h('a', { class: 'lrow', href: `#/l/${l.id}` },
          h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { class: 'grow' }, h('span', { class: 'lt' }, l.title)),
          done ? stamp('تم ✓') : null));
      })))));
  }
  return { title: course.title, node: h('div', { class: 'view' },
    h('nav', { class: 'crumbs', 'aria-label': 'مسار الصفحة' }, h('a', { href: '#/' }, 'الرئيسية'), ' › ', course.title),
    h('h1', { class: 'draw' }, course.title),
    h('p', { class: 'muted' }, course.stage),
    tabs, body) };
}
