const CACHE_VERSION = 'kas-gabku-v3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
    './',
    './manifest.webmanifest',
    './logo-app.png',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png',
    './favicon-50.png'
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
                    .filter((cacheName) => cacheName.startsWith('kas-gabku-'))
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
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

function isStaticAsset(url) {
    return (
        url.pathname.includes('/assets/') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.webmanifest')
    );
}

async function networkFirstNavigation(request) {
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
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((freshResponse) => {
            cache.put(request, freshResponse.clone());
            return freshResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}