const CACHE_NAME = 'nexus-cache-v5';
const urlsToCache = [
    '/',
    './index.html', 
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://api.dicebear.com/7.x/bottts/png?seed=CosmicNexus&backgroundColor=transparent',
    'https://api.dicebear.com/7.x/bottts/png?seed=CosmicNexus&backgroundColor=1e1f20'
];

// Install Event - Cache essential files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[ServiceWorker] Caching app shell');
            return cache.addAll(urlsToCache);
        })
    );
    // Force the waiting service worker to become the active service worker immediately.
    self.skipWaiting();
});

// Fetch Event - Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) { return response; }
            return fetch(event.request).catch(() => {
                console.log('[ServiceWorker] Offline fallback triggered for:', event.request.url);
            });
        })
    );
});

// Activate Event - Clean up old caches when a new service worker takes over
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Tell the active service worker to take control of the page immediately.
    return self.clients.claim();
});
