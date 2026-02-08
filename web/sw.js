// grub stars Service Worker
// Caching strategies: cache-first for static assets, network-first for API/pages

const CACHE_VERSION = 'grub-stars-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/details.html',
  '/bookmarks.html',
  '/map.html',
  '/stats.html',
  '/add-restaurant.html',
  '/index-location.html',
  '/offline.html',
  '/css/custom.css',
  '/js/vendor/twind.min.js',
  '/js/twind-config.js',
  '/js/api.js',
  '/images/favicon.svg',
  '/manifest.webmanifest'
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: route requests to appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip SSE streaming endpoints
  if (url.pathname === '/index/stream') return;

  // API requests: network-first with cache fallback
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets: cache-first with network fallback
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages: network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// Cache-first strategy: serve from cache, fall back to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy: try network, fall back to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: { code: 'OFFLINE', message: 'You are offline' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Network-first with offline HTML fallback
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}

function isApiRequest(url) {
  const apiPaths = ['/health', '/categories', '/locations', '/restaurants', '/index', '/adapters', '/stats'];
  return apiPaths.some((path) => url.pathname.startsWith(path));
}

function isStaticAsset(url) {
  return /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/.test(url.pathname);
}
