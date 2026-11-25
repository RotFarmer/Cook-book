// Keeps the app usable offline when it is served as a normal website.
// Cached files are served first and refreshed in the background.
const CACHE = 'primal-cookbook-v16';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/update.js', 'js/unlock.js', 'js/metric.js', 'js/markdown.js', 'js/data/recipes.pack.js', 'js/data/foods.js', 'js/data/recipes.js', 'js/data/corrections.js',
  'js/views/recipes.js', 'js/views/plan.js', 'js/views/food.js', 'js/views/habits.js', 'js/views/weight.js', 'js/views/lists.js', 'js/views/notes.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
