/**
 * VISION.TREKKING — Service Worker
 * Cache-first for assets, stale-while-revalidate for HTML
 */

const CACHE_NAME = 'vt-v1';
const ASSET_CACHE = 'vt-assets-v1';
const HTML_CACHE = 'vt-html-v1';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/expedicoes.html',
  '/sobre.html',
  '/css/main.css',
  '/js/main.js',
  '/manifest.webmanifest'
];

// Install — precache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== ASSET_CACHE && k !== HTML_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET
  if (request.method !== 'GET') return;
  
  // Skip cross-origin
  if (url.origin !== location.origin) return;
  
  // HTML — stale-while-revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, HTML_CACHE));
    return;
  }
  
  // Assets (CSS, JS, fonts, images) — cache-first
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' ||
      request.destination === 'image' ||
      url.pathname.startsWith('/images/') ||
      url.pathname.startsWith('/thumbs/') ||
      url.pathname.startsWith('/videos/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  
  // Manifest & others — network-first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// Network-first
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}