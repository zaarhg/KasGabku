const CACHE_VERSION = 'kas-gabku-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
    './',
    './logo-app.png',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png',
    './favicon-50.png',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );

    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        return ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(cacheName);
                    })
                    .map((cacheName) => caches.delete(cacheName))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstForNavigation(request));
        return;
    }

    if (
        url.pathname.includes('/assets/') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.webmanifest')
    ) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

async function networkFirstForNavigation(request) {
    try {
        const freshResponse = await fetch(request);

        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, freshResponse.clone());

        return freshResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        return caches.match('./');
    }
}

async function networkFirst(request) {
    try {
        const freshResponse = await fetch(request);

        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, freshResponse.clone());

        return freshResponse;
    } catch (error) {
        return caches.match(request);
    }
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    const freshResponse = await fetch(request);

    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, freshResponse.clone());

    return freshResponse;
}