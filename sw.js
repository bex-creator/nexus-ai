const CACHE_NAME = 'nexus-cache-v2';
const urlsToCache = [
    '/',
    './index.html', // Make sure this matches your main HTML file's name
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// Install Event - Cache essential files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[ServiceWorker] Caching app shell');
            return cache.addAll(urlsToCache);
        })
    );
});

// Fetch Event - Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // Cache hit - return the cached response
            if (response) {
                return response;
            }
            
            // Network request
            return fetch(event.request).catch(() => {
                console.log('[ServiceWorker] Offline fallback triggered for:', event.request.url);
                // Optional: You could return a specific offline.html page here if you cache one
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
});
