const CACHE_NAME = 'nova-track-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // Fallback for dynamic development environment where some assets may not be available yet
        console.log('Some assets were not pre-cached, continuing install...');
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network First Strategy)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and exclude Firebase auth or browser extensions
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).then((response) => {
      // Cache successful requests for offline fallback
      if (response && response.status === 200 && response.type === 'basic' && !event.request.url.includes('/api/')) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Fallback to cache if network fails
      return caches.match(event.request);
    })
  );
});
