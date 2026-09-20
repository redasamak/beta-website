import { h } from '../ui.js';
import { createQuiz } from './quiz.js';

export async function renderReview(ctx) {
  const due = ctx.store.dueQuestions();
  const byLesson = new Map();
  for (const qid of due) { const [lid, idx] = qid.split(':'); (byLesson.get(lid) || byLesson.set(lid, []).get(lid)).push(Number(idx)); }
  const qs = [];
  for (const [lid, idxs] of byLesson) {
    const res = await ctx.getLesson(lid);
    if (!res.content || !res.content.quiz) continue;
    for (const i of idxs) { const q = res.content.quiz[i]; if (q) qs.push({ ...q, id: `${lid}:${i}` }); }
  }
  const head = h('header', null, h('h1', { class: 'draw' }, 'راجع اللي غلطت فيه'),
    h('p', { class: 'muted' }, 'الأسئلة اللي جاوبتها غلط بترجع لك بعد يوم، والصح بيتأجل أكتر.'));
  if (!qs.length) {
    return { title: 'المراجعة', node: h('div', { class: 'view' }, head,
      h('section', { class: 'sheet empty' }, h('h2', null, 'مفيش حاجة للمراجعة دلوقتي'),
        h('p', null, 'جاوب على كويز درس، والأسئلة اللي هتغلط فيها هتظهر هنا.'), h('a', { class: 'btn primary', href: '#/' }, 'ارجع للدروس'))) };
  }
  return { title: 'المراجعة', node: h('div', { class: 'view' }, head,
    createQuiz(qs, { onAnswer: (q, ok) => ctx.store.recordAnswer(q.id, ok) }, 'مراجعة سريعة')) };
}
