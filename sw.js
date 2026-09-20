// Service worker: app shell = cache-first (versioned), /data/ = network-first (teacher edits show up), offline fallback.
// To ship an update: bump VERSION. Users get a "حدّث دلوقتي" banner instead of a stale app.
const VERSION = 'basata-v1.0.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'css/app.css',
  'js/main.js', 'js/router.js', 'js/ui.js', 'js/lib/normalize.js',
  'js/data/loader.js', 'js/data/store.js', 'js/data/validator.js',
  'js/views/home.js', 'js/views/course.js', 'js/views/lesson.js', 'js/views/quiz.js', 'js/views/review.js',
  'js/views/search.js', 'js/views/teacher.js', 'js/views/checklist.js', 'js/views/notfound.js',
  'data/config.json', 'data/courses.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts, video: browser handles them
  const isData = url.pathname.includes('/data/');
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (isData) {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || new Response('', { status: 404 });
      }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
