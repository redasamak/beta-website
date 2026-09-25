import { h } from '../ui.js';
import { normalize } from '../lib/normalize.js';

function fieldsOf(rec, content) {
  const f = [{ label: 'العنوان', text: rec.lesson.title, w: 5 }];
  f.push({ label: 'الوحدة', text: rec.unit.title, w: 1 });
  if (content) {
    (content.keyPoints || []).forEach((t) => f.push({ label: 'نقطة رئيسية', text: t, w: 2 }));
    (content.glossary || []).forEach((g) => f.push({ label: 'كلمة مهمة', text: `${g.term}: ${g.def}`, w: 3 }));
    (content.timeline || []).forEach((t) => f.push({ label: 'خط زمني', text: `${t.year} ${t.title}`, w: 2 }));
  }
  return f.map((x) => ({ ...x, n: normalize(x.text) }));
}

export async function renderSearch(ctx, { query }) {
  const input = h('input', { type: 'search', id: 'q', class: 'search', placeholder: 'اكتب كلمة: مثلًا نعرمر، الحضارة، ثورة…', autocomplete: 'off', 'aria-label': 'ابحث في الدروس', value: query.q || '' });
  const results = h('div', { class: 'results', 'aria-live': 'polite' });
  const status = h('p', { class: 'muted small' }, 'بنجهّز البحث…');
  let index = [];

  const run = () => {
    const q = normalize(input.value);
    results.replaceChildren();
    if (!q) { status.textContent = `ابحث في ${index.length} درس.`; return; }
    const terms = q.split(' ');
    const hits = [];
    for (const it of index) {
      let score = 0; let best = null;
      for (const f of it.fields) {
        const matched = terms.filter((t) => f.n.includes(t)).length;
        if (matched === terms.length) { score += f.w * matched; if (!best || f.w > best.w) best = f; }
      }
      if (score) hits.push({ it, score, best });
    }
    hits.sort((a, b) => b.score - a.score);
    status.textContent = hits.length ? `${hits.length} نتيجة` : 'مفيش نتايج. جرّب كلمة تانية أو أقصر.';
    for (const { it, best } of hits.slice(0, 30)) {
      results.appendChild(h('a', { class: 'sheet hit', href: `#/l/${it.rec.lesson.id}` },
        h('strong', null, it.rec.lesson.title),
        h('span', { class: 'muted small' }, `${it.rec.course.title} · ${it.rec.term.title}`),
        best && best.label !== 'العنوان' ? h('span', { class: 'small' }, `${best.label}: ${best.text}`) : null));
    }
  };

  let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
  const node = h('div', { class: 'view' }, h('h1', { class: 'draw' }, 'ابحث'), input, status, results);
  Promise.all(ctx.app.catalog.lessons.map(async (rec) => ({ rec, fields: fieldsOf(rec, (await ctx.getLesson(rec.lesson.id)).content) })))
    .then((idx) => { index = idx; run(); });
  return { title: 'بحث', node };
}
