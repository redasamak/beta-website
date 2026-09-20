import { h, ring } from '../ui.js';

export function renderHome(ctx) {
  const { config, courses, catalog } = ctx.app;
  const { store } = ctx;
  const last = store.last && catalog.byId.get(store.last.id);
  const first = catalog.lessons[0];

  const cta = last
    ? h('a', { class: 'btn primary big', href: `#/l/${last.lesson.id}` }, 'كمّل من حيث وقفت ←')
    : first ? h('a', { class: 'btn primary big', href: `#/l/${first.lesson.id}` }, 'ابدأ أول درس ←') : null;

  const hero = h('section', { class: 'sheet ruled hero' },
    h('h1', { class: 'draw' }, config.brand.name),
    h('p', { class: 'lead' }, config.brand.tagline),
    last ? h('p', { class: 'muted' }, 'آخر درس فتحته: ', h('strong', null, last.lesson.title)) : null,
    h('div', { class: 'row' }, cta, h('a', { class: 'btn', href: '#/search' }, 'ابحث في الدروس')));

  const due = store.dueQuestions().length;
  const review = due > 0
    ? h('a', { class: 'sheet note-card', href: '#/review' },
      h('strong', null, `عندك ${due} ${due === 1 ? 'سؤال' : 'أسئلة'} للمراجعة`),
      h('span', { class: 'muted' }, 'خمس دقايق دلوقتي بتثبّت المعلومة أكتر.'))
    : null;

  const cards = courses.map((c) => {
    const all = catalog.courseLessons(c.id).map((r) => r.lesson.id);
    const done = store.completedCount(all);
    return h('a', { class: 'sheet course-card', href: `#/c/${c.id}` },
      ring(all.length ? done / all.length : 0, `أنجزت ${done} من ${all.length} دروس`),
      h('div', { class: 'grow' },
        h('h2', null, c.title),
        h('p', { class: 'muted small' }, c.stage, ' · ', h('span', { dir: 'ltr', lang: 'en' }, c.titleEn)),
        h('p', null, c.description),
        h('p', { class: 'small strong' }, `${done} من ${all.length} دروس`)));
  });

  return { title: 'الرئيسية', node: h('div', { class: 'view' }, hero, review, h('div', { class: 'grid' }, ...cards)) };
}
