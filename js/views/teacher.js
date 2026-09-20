import { h, banner } from '../ui.js';

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: '#', download: name }); a.href = url; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function renderTeacher(ctx) {
  const { config } = ctx.app; const t = config.teacher; const { store } = ctx;
  const msg = h('div', { 'aria-live': 'polite' });
  const say = (kind, text) => { msg.replaceChildren(); banner(msg, kind, text); };

  const contact = h('div', { class: 'row' },
    t.whatsapp ? h('a', { class: 'btn primary', href: `https://wa.me/${t.whatsapp}`, target: '_blank' }, 'واتساب') : null,
    t.telegram && t.telegram !== 'https://t.me/' ? h('a', { class: 'btn', href: t.telegram, target: '_blank' }, 'تليجرام') : null,
    h('button', { class: 'btn', type: 'button', onclick: async () => {
      const data = { title: config.brand.name, text: config.brand.tagline, url: location.href.split('#')[0] };
      try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); say('info', 'اتنسخ الرابط.'); } }
      catch { /* user cancelled */ }
    } }, 'شارك المنصة'));

  const schedule = config.schedule.length ? h('div', { class: 'tblwrap' }, h('table', null,
    h('thead', null, h('tr', null, ...['اليوم', 'الوقت', 'المجموعة', 'النوع'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, ...config.schedule.map((r) => h('tr', null, h('td', null, r.day), h('td', null, r.time), h('td', null, r.group), h('td', null, r.mode || '')))))) : h('p', { class: 'muted' }, 'المواعيد هتظهر هنا.');

  const themeSel = h('select', { id: 'theme', class: 'select', 'aria-label': 'شكل الصفحة', onchange: (e) => { store.setTheme(e.target.value); ctx.applyTheme(); } },
    ...[['auto', 'حسب الجهاز'], ['light', 'فاتح'], ['dark', 'ليلي']].map(([v, l]) => h('option', { value: v, selected: store.theme === v ? true : null }, l)));

  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', 'aria-label': 'اختر ملف التقدم' });
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    const r = store.importJSON(await f.text());
    say(r.ok ? 'info' : 'error', r.ok ? `اتسجّل تقدمك (${r.lessons} درس مكتمل).` : r.reason);
  });

  return { title: 'المدرس', node: h('div', { class: 'view' },
    h('h1', { class: 'draw' }, 'المدرس والمواعيد'),
    h('section', { class: 'sheet' }, h('h2', null, t.name || 'المدرس'), t.bio ? h('p', null, t.bio) : null, contact),
    h('section', { class: 'sheet' }, h('h2', null, 'مواعيد الحصص'), schedule),
    h('section', { class: 'sheet' }, h('h2', null, 'تقدمك وإعداداتك'),
      h('p', { class: 'muted' }, store.persistent ? 'تقدمك محفوظ على جهازك فقط. مفيش بيانات بتتبعت لأي حد.' : 'المتصفح مانع الحفظ، فتقدمك هيتمسح لما تقفل الصفحة.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => download('basata-progress.json', store.exportJSON()) }, 'احفظ تقدمك في ملف'),
        h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'استرجع تقدمك من ملف'),
        h('button', { class: 'btn', type: 'button', onclick: () => { if (confirm('متأكد؟ ده هيمسح كل تقدمك على الجهاز ده.')) { store.reset(); say('info', 'اتمسح التقدم.'); } } }, 'امسح التقدم')),
      file, h('label', { class: 'field', for: 'theme' }, 'شكل الصفحة', themeSel), msg),
    h('section', { class: 'sheet' }, h('h2', null, 'المصادر وحالة المحتوى'),
      h('p', null, 'عناوين الدروس متبعة منهج وزارة التربية والتعليم للعام 2026/2027، وهي قيد تأكيد المدرس على الكتاب المدرسي. أي درس عليه علامة "مسودة" محتواه لسه بيتراجع.'),
      h('a', { class: 'btn', href: '#/checklist' }, 'قائمة تجهيز المحتوى (للمدرس)'))) };
}
