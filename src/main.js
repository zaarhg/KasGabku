import './styles/style.css';
import { startApp } from './app.js';

startApp();

registerServiceWorker();

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        try {
            const swUrl = `${import.meta.env.BASE_URL}sw.js`;

            await navigator.serviceWorker.register(swUrl, {
                scope: import.meta.env.BASE_URL
            });

            console.info('Kas Gabku service worker aktif.');
        } catch (error) {
            console.warn('Service worker gagal didaftarkan:', error);
        }
    });
}