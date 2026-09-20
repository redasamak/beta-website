import { h } from '../ui.js';

/**
 * One-question-at-a-time quiz. questions: [{id,q,options,answer,explain}]
 * hooks: onAnswer(q, correct), onFinish(scorePct, correctCount, total)
 */
export function createQuiz(questions, hooks = {}, title = 'اختبر نفسك') {
  const box = h('section', { class: 'sheet quiz', 'aria-label': title });
  let i = 0; let right = 0; let answered = false;

  function finish() {
    const pct = Math.round((right / questions.length) * 100);
    if (hooks.onFinish) hooks.onFinish(pct, right, questions.length);
    const msg = pct === 100 ? 'ممتاز! إجابات كاملة.' : pct >= 60 ? 'كويس. راجع الأسئلة اللي غلطت فيها.' : 'محتاج مراجعة. ارجع للنقاط الرئيسية وجرّب تاني.';
    box.replaceChildren(h('h2', null, title), h('p', { class: 'score' }, `${right} / ${questions.length}`), h('p', null, msg),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { i = 0; right = 0; draw(); } }, 'أعد المحاولة'));
  }

  function draw() {
    if (i >= questions.length) return finish();
    const q = questions[i]; answered = false;
    const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const nextWrap = h('div', { class: 'row' });
    const qid = 'q-' + Math.random().toString(36).slice(2, 8);
    const opts = h('div', { class: 'opts', role: 'group', 'aria-labelledby': qid });
    q.options.forEach((o, k) => opts.appendChild(h('button', {
      class: 'opt', type: 'button',
      onclick: (ev) => {
        if (answered) return; answered = true;
        const ok = k === q.answer; if (ok) right++;
        if (hooks.onAnswer) hooks.onAnswer(q, ok);
        [...opts.children].forEach((b, idx) => {
          b.disabled = true;
          if (idx === q.answer) { b.classList.add('right'); b.appendChild(h('span', { class: 'mark' }, ' ✓ صح')); }
          else if (idx === k) { b.classList.add('wrong'); b.appendChild(h('span', { class: 'mark' }, ' ✗ غلط')); }
        });
        fb.appendChild(h('p', { class: 'why' }, h('strong', null, ok ? 'إجابة صحيحة. ' : 'إجابة غير صحيحة. '), q.explain || ''));
        const nxt = h('button', { class: 'btn primary', type: 'button', onclick: () => { i++; draw(); } },
          i === questions.length - 1 ? 'شوف النتيجة' : 'السؤال التالي');
        nextWrap.appendChild(nxt); nxt.focus();
      } }, o)));
    box.replaceChildren(
      h('div', { class: 'q-top' }, h('h2', null, title), h('span', { class: 'muted small' }, `سؤال ${i + 1} من ${questions.length}`)),
      h('p', { class: 'q', id: qid }, q.q), opts, fb, nextWrap);
  }
  draw();
  return box;
}
