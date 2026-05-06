import './styles/style.css';
import { startApp } from './app.js';

startApp();
setupServiceWorker();

function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        if (import.meta.env.DEV) {
            await unregisterServiceWorkersInDevelopment();
            return;
        }

        await registerServiceWorker();
    });
}

async function registerServiceWorker() {
    try {
        const swUrl = `${import.meta.env.BASE_URL}sw.js`;

        await navigator.serviceWorker.register(swUrl, {
            scope: import.meta.env.BASE_URL
        });

        console.info('Kas Gabku service worker aktif.');
    } catch (error) {
        console.warn('Service worker gagal didaftarkan:', error);
    }
}

async function unregisterServiceWorkersInDevelopment() {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(
            registrations.map((registration) => registration.unregister())
        );

        if ('caches' in window) {
            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName.startsWith('kas-gabku'))
                    .map((cacheName) => caches.delete(cacheName))
            );
        }

        if (registrations.length) {
            console.info('Service worker dinonaktifkan di mode development. Refresh halaman sekali lagi.');
        }
    } catch (error) {
        console.warn('Gagal membersihkan service worker development:', error);
    }
}