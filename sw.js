const CACHE_NAME = 'radio-pwa-v5';

  const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './stations.js',
    './player-fixes.js',
    './player-fixes.css',
    './sw.js',
    './icon-192.png',
    './icon-512.png'
  ];

  self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        }))
      )
    );
    self.clients.claim();
  });

  self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Never cache streams, playlists, or dynamic API calls
    if (
      url.pathname.endsWith('.m3u8') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.aacp') ||
      url.pathname.endsWith('.mp3') ||
      url.pathname.endsWith('.ogg') ||
      url.hostname.includes('workers.dev') ||
      url.hostname === 'radiopotok.ru' ||
      url.searchParams.has('url') ||
      url.searchParams.has('id')
    ) {
      return;
    }

    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') return response;
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
          })
          .catch(() => cached);
      })
    );
  });