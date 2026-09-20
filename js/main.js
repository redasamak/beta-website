import { h, clear, banner } from './ui.js';
import { createRouter } from './router.js';
import { loadApp, getLesson } from './data/loader.js';
import { BasataStore } from './data/store.js';
import { renderHome } from './views/home.js';
import { renderCourse } from './views/course.js';
import { renderLesson } from './views/lesson.js';
import { renderReview } from './views/review.js';
import { renderSearch } from './views/search.js';
import { renderTeacher } from './views/teacher.js';
import { renderChecklist } from './views/checklist.js';
import { renderNotFound } from './views/notfound.js';

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=swap';
const routes = [
  { path: '/', view: renderHome, nav: 'home' },
  { path: '/c/:id', view: renderCourse, nav: 'home' },
  { path: '/l/:id', view: renderLesson, nav: 'home' },
  { path: '/review', view: renderReview, nav: 'review' },
  { path: '/search', view: renderSearch, nav: 'search' },
  { path: '/teacher', view: renderTeacher, nav: 'teacher' },
  { path: '/checklist', view: renderChecklist, nav: 'teacher' },
];

const $ = (sel) => document.querySelector(sel);
const store = new BasataStore();
const main = $('#main');
const banners = $('#banners');

function applyTheme() {
  const t = store.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
applyTheme();

function loadFontsLater() {
  const add = () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_CSS; document.head.appendChild(l); };
  if (document.readyState === 'complete') add(); else window.addEventListener('load', add, { once: true });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  // Reload ONLY when an existing controller is replaced (user tapped "update"). The very first install also fires
  // controllerchange (clients.claim) and must never reload the page under a student mid-quiz.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  const offer = (reg) => banner(banners, 'info', 'في نسخة أحدث من المنصة', ['حدّث علشان تشوف الجديد.'],
    [h('button', { class: 'btn', type: 'button', onclick: () => reg.waiting && reg.waiting.postMessage('SKIP_WAITING') }, 'حدّث دلوقتي')]);
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(reg); });
    });
  }).catch(() => { /* offline support is optional */ });
}

let app = null;
let token = 0;
let firstRender = true;
const ctx = {
  store, applyTheme,
  get app() { return app; },
  banner: (kind, title, lines) => banner(banners, kind, title, lines),
  getLesson: (id) => getLesson(id),
};

function setNav(key) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

async function show({ route, params, query }) {
  const my = ++token;
  setNav(route ? route.nav : '');
  let out = null;
  try {
    out = route ? await route.view(ctx, { params, query }) : null;
    if (!out) out = renderNotFound();
  } catch (err) {
    console.error(err);
    out = { title: 'مشكلة', node: h('div', { class: 'view' }, h('section', { class: 'sheet empty' },
      h('h1', null, 'حصلت مشكلة غير متوقعة'), h('p', null, 'جرّب تحدّث الصفحة. لو استمرت المشكلة قوللي علشان أصلحها.'),
      h('a', { class: 'btn primary', href: '#/' }, 'ارجع للرئيسية'))) };
  }
  if (my !== token) return; // a newer navigation won the race
  clear(main); out.node.classList.add('enter'); main.appendChild(out.node);
  document.title = `${out.title} | ${app ? app.config.brand.name : 'منصة البساطة'}`;
  window.scrollTo(0, 0);
  // Move focus only on in-app navigation. On first load keep the natural tab order so the skip link is first.
  if (!firstRender) main.focus({ preventScroll: true });
  firstRender = false;
}

async function boot() {
  const skip = $('.skip');
  if (skip) skip.addEventListener('click', (e) => { e.preventDefault(); main.focus(); });
  app = await loadApp();
  for (const p of app.problems) banner(banners, 'error', p.title, p.lines);
  const brand = $('#brand-name'); if (brand) brand.textContent = app.config.brand.name;
  if (!app.courses) {
    clear(main);
    main.appendChild(h('div', { class: 'view' }, h('section', { class: 'sheet empty' }, h('h1', null, 'المنصة مش قادرة تفتح المنهج'),
      h('p', null, 'في مشكلة في ملف المنهج (اقرأ الرسالة الحمرا فوق). لما تتصلح هتشتغل تاني.'))));
    return;
  }
  const router = createRouter(routes, show);
  router.run();
  loadFontsLater();
  registerSW();
}
boot();
