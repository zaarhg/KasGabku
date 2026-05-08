import './styles/style.css';
import { startApp } from './app.js';

startApp();
setupServiceWorker();
setupInstallPrompt();

let deferredPrompt = null;

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Dispatch event so UI can react
        window.dispatchEvent(new CustomEvent('pwa-install-available'));
    });

    window.addEventListener('appinstalled', () => {
        console.info('Kas Gabku telah diinstal ke perangkat.');
        deferredPrompt = null;
        window.dispatchEvent(new CustomEvent('pwa-installed'));
    });
}

export function getDeferredPrompt() {
    return deferredPrompt;
}

export async function promptPwaInstall() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return outcome === 'accepted';
}

function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        if (import.meta.env.DEV) {
            await cleanDevelopmentServiceWorker();
            return;
        }

        await registerProductionServiceWorker();
    });
}

async function registerProductionServiceWorker() {
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

async function cleanDevelopmentServiceWorker() {
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
    } catch (error) {
        console.warn('Gagal membersihkan service worker development:', error);
    }
}