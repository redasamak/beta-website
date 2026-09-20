import { h } from '../ui.js';

export async function renderChecklist(ctx) {
  const rows = await Promise.all(ctx.app.catalog.lessons.map(async (rec) => ({ rec, res: await ctx.getLesson(rec.lesson.id) })));
  const total = rows.length;
  const ok = (b) => h('span', { class: b ? 'yes' : 'no' }, b ? '✓' : '✗', h('span', { class: 'sr' }, b ? ' موجود' : ' ناقص'));
  const withContent = rows.filter((r) => r.res.content).length;
  const body = rows.map(({ rec, res }) => {
    const c = res.content;
    return h('tr', null,
      h('th', { scope: 'row' }, h('a', { href: `#/l/${rec.lesson.id}` }, rec.lesson.title), h('div', { class: 'muted small' }, rec.course.title)),
      h('td', null, res.error ? h('span', { class: 'no' }, 'خطأ') : ok(!!c)),
      h('td', null, ok(!!(c && c.video && c.video.id))),
      h('td', null, c && c.quiz ? String(c.quiz.length) : '0'),
      h('td', null, c ? (c.needs_teacher_review || c.draft ? h('span', { class: 'badge' }, 'مسودة') : ok(true)) : '—'));
  });
  return { title: 'قائمة التجهيز', node: h('div', { class: 'view' },
    h('h1', { class: 'draw' }, 'قائمة تجهيز المحتوى'),
    h('p', { class: 'muted' }, `${withContent} من ${total} درس فيهم محتوى. الملفات في data/lessons/ باسم رقم الدرس.`),
    h('div', { class: 'tblwrap' }, h('table', null,
      h('thead', null, h('tr', null, ...['الدرس', 'محتوى', 'فيديو', 'أسئلة', 'مراجعة'].map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', null, ...body)))) };
}
