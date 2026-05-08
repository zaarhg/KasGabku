import { getSession, getCurrentProfile, signOut } from './services/auth.js';
import { renderLoginPage } from './pages/login.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderTransaksiPage } from './pages/transaksi.js';
import { renderDetailTransaksiPage } from './pages/detail-transaksi.js';
import { renderBukuKasPage } from './pages/buku-kas.js';
import { renderMasterDataPage } from './pages/master-data.js';
import { renderAdminUserPage } from './pages/admin-user.js';
import { renderLogAktivitasPage } from './pages/log-aktivitas.js';
import { renderBackupPage } from './pages/backup.js';

const appState = {
  session: null,
  profile: null
};

let hashChangeBound = false;

const routes = [
  {
    key: 'dashboard',
    label: 'Beranda',
    icon: '⌂',
    roles: ['admin', 'bendahara', 'viewer']
  },
  {
    key: 'transaksi',
    label: 'Transaksi',
    icon: '↕',
    roles: ['admin', 'bendahara', 'viewer']
  },
  {
    key: 'buku-kas',
    label: 'Buku Kas',
    icon: '▤',
    roles: ['admin', 'bendahara', 'viewer']
  },
  {
    key: 'master-data',
    label: 'Master Data',
    icon: '⚙',
    roles: ['admin']
  },
  {
    key: 'admin',
    label: 'Admin User',
    icon: '◉',
    roles: ['admin']
  },
  {
    key: 'log',
    label: 'Log Aktivitas',
    icon: '◎',
    roles: ['admin']
  },
  {
    key: 'backup',
    label: 'Backup',
    icon: '⇩',
    roles: ['admin']
  }
];

const PUBLIC_BASE = import.meta.env.BASE_URL || '/';

function publicAsset(path) {
  const normalizedPath = String(path || '').replace(/^\/+/, '');

  if (import.meta.env.DEV) {
    return `/${normalizedPath}`;
  }

  return `${PUBLIC_BASE}${normalizedPath}`;
}

export async function startApp() {
  const root = getRoot();

  // PWA Gate: Hanya izinkan akses jika di dalam mode standalone (terinstall)
  if (!isStandalone() && !import.meta.env.DEV) {
    renderPwaGate(root);
    return;
  }

  bindHashChange(root);
  renderBoot(root);

  try {
    appState.session = await getSession();

    if (!appState.session) {
      renderLogin(root);
      return;
    }

    appState.profile = await getCurrentProfile();
    renderShell(root);
  } catch (error) {
    console.error(error);
    renderLogin(root, error.message);
  }
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function renderPwaGate(root) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  root.innerHTML = `
    <div class="pwa-gate">
      <div class="pwa-gate-content">
        <div class="pwa-gate-icon">
          <img src="${publicAsset('icon-512.png')}" alt="Kas Gabku">
        </div>
        <h1>Akses Terbatas</h1>
        <p>Kas Gabku hanya dapat dibuka melalui aplikasi yang terpasang di HP untuk menjamin keamanan data Anda.</p>
        
        <div class="pwa-gate-steps">
          <div class="pwa-step">
            <span class="step-number">1</span>
            <div class="step-body">
              <span id="pwa-step-1-text">${isIOS ? 'Tekan ikon <strong>"Share"</strong> (kotak dengan panah atas) dan pilih <strong>"Add to Home Screen"</strong>.' : 'Tekan tombol <strong>"Instal Aplikasi"</strong> di bawah ini.'}</span>
              <button class="btn btn-primary btn-block" id="pwa-gate-install-btn" style="display: none; margin-top: 12px;">
                Instal Aplikasi
              </button>
              <a href="${publicAsset('')}" class="btn btn-success btn-block" id="pwa-gate-open-btn" style="display: none; margin-top: 12px; text-decoration: none;">
                Buka Aplikasi
              </a>
            </div>
          </div>
          <div class="pwa-step">
            <span class="step-number">2</span>
            <div class="step-body">
              <span>Buka ikon <strong>"Kas Gabku"</strong> yang muncul di layar utama (Home Screen) HP Anda.</span>
            </div>
          </div>
        </div>

        <div class="pwa-gate-footer">
          <p>Jika tombol instal tidak muncul, buka menu browser Anda (titik tiga atau tanda panah) dan cari menu <strong>"Instal Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</p>
        </div>
      </div>
    </div>
  `;

  const installBtn = root.querySelector('#pwa-gate-install-btn');
  const openBtn = root.querySelector('#pwa-gate-open-btn');
  const step1Text = root.querySelector('#pwa-step-1-text');
  
  import('./main.js').then(async ({ promptPwaInstall, getDeferredPrompt }) => {
    // Deteksi apakah sudah terinstall (Hanya di Chrome Android/Desktop tertentu)
    let alreadyInstalled = false;
    if ('getRelatedApps' in navigator) {
        const relatedApps = await navigator.getRelatedApps();
        alreadyInstalled = relatedApps.length > 0;
    }

    const updateBtnVisibility = () => {
        if (alreadyInstalled) {
            step1Text.innerHTML = 'Aplikasi sudah terpasang. Tekan tombol di bawah untuk mencoba membuka aplikasi atau buka manual dari layar utama.';
            openBtn.style.display = 'block';
            installBtn.style.display = 'none';
            return;
        }

        if (getDeferredPrompt() && !isIOS) {
            installBtn.style.display = 'block';
        } else {
            installBtn.style.display = 'none';
        }
    };

    updateBtnVisibility();
    window.addEventListener('pwa-install-available', updateBtnVisibility);

    installBtn.addEventListener('click', async () => {
      await promptPwaInstall();
    });
  });
}

function bindHashChange(root) {
  if (hashChangeBound) return;

  hashChangeBound = true;

  window.addEventListener('hashchange', () => {
    if (appState.session && appState.profile) {
      renderShell(root);
    }
  });
}

function getRoot() {
  const root = document.querySelector('#app');

  if (!root) {
    throw new Error('Elemen #app tidak ditemukan.');
  }

  return root;
}

function renderBoot(root) {
  document.body.classList.remove('modal-open');

  root.innerHTML = `
    <div class="app-boot">
      <img src="${publicAsset('logo-app.png')}" alt="Kas Gabku" class="app-boot-logo" />
      <p>Memuat Kas Gabku...</p>
    </div>
  `;
}

function renderLogin(root, initialError = '') {
  document.body.classList.remove('modal-open');

  root.innerHTML = '';

  const loginPage = renderLoginPage({
    onLoginSuccess: async () => {
      appState.session = await getSession();
      appState.profile = await getCurrentProfile();
      window.location.hash = 'dashboard';
      renderShell(root);
    }
  });

  if (initialError) {
    const errorBox = loginPage.querySelector('#login-error');
    if (errorBox) {
      errorBox.textContent = initialError;
      errorBox.classList.add('is-visible');
    }
  }

  root.appendChild(loginPage);
}

function renderShell(root) {
  document.body.classList.remove('modal-open');

  const currentRoute = getCurrentRoute();
  const activeMenuKey = getActiveMenuKey(currentRoute);
  const accessibleRoutes = getAccessibleRoutes();

  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(accessibleRoutes, activeMenuKey)}

      <main class="main-area">
        ${renderMobileTopbar()}
        <section class="content" id="page-content"></section>
      </main>
    </div>

    ${renderMobileNav(accessibleRoutes, activeMenuKey)}
  `;

  const content = root.querySelector('#page-content');
  content.appendChild(renderPage(currentRoute));

  root.querySelectorAll('[data-route]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.hash = element.dataset.route;
    });
  });

  root.querySelectorAll('[data-logout]').forEach((element) => {
    element.addEventListener('click', async () => {
      await handleLogout(root);
    });
  });

  root.querySelectorAll('[data-refresh]').forEach((element) => {
    element.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app-refresh-request'));
    });
  });
}

function renderPage(route) {
  if (route === 'dashboard') {
    return renderDashboardPage({
      profile: appState.profile
    });
  }

  if (route === 'transaksi') {
    return renderTransaksiPage({
      profile: appState.profile
    });
  }

  if (route === 'buku-kas') {
    return renderBukuKasPage({
      profile: appState.profile
    });
  }

  if (route === 'master-data') {
    return renderMasterDataPage({
      profile: appState.profile
    });
  }

  if (route === 'admin') {
    return renderAdminUserPage({
      profile: appState.profile
    });
  }

  if (route === 'log') {
    return renderLogAktivitasPage({
      profile: appState.profile
    });
  }

  if (route === 'backup') {
    return renderBackupPage({
      profile: appState.profile
    });
  }

  if (route.startsWith('detail-transaksi/')) {
    const transactionId = route.split('/')[1];

    return renderDetailTransaksiPage({
      profile: appState.profile,
      transactionId
    });
  }

  return renderPlaceholderPage(route);
}

function renderPlaceholderPage(route) {
  const routeData = routes.find((item) => item.key === route);

  const page = document.createElement('div');
  page.className = 'placeholder-page';

  page.innerHTML = `
    <div class="placeholder-card">
      <div class="placeholder-icon">☑</div>
      <h1 class="page-title" style="font-size: 30px;">
        ${escapeHtml(routeData?.label || 'Halaman')}
      </h1>
      <p class="page-description">
        Halaman ini belum diisi.
      </p>
      <button class="btn btn-primary" type="button" data-route="dashboard">
        Kembali ke Beranda
      </button>
    </div>
  `;

  return page;
}

function renderSidebar(accessibleRoutes, activeMenuKey) {
  const profile = appState.profile || {};
  const initial = getInitial(profile.full_name || profile.email || 'K');

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-logo">
          <img src="${publicAsset('logo-app.png')}" alt="Kas Gabku" />
        </div>
        <div>
          <div class="sidebar-brand-title">Kas Gabku</div>
          <div class="sidebar-brand-subtitle">Buku Kas & Bukti Pengeluaran</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        ${accessibleRoutes
      .map((route) => {
        const active = route.key === activeMenuKey ? 'is-active' : '';

        return `
              <a href="#${route.key}" class="nav-link ${active}" data-route="${route.key}">
                <span class="nav-icon">${route.icon}</span>
                <span>${route.label}</span>
              </a>
            `;
      })
      .join('')}
      </nav>

      <div class="sidebar-footer">
        <div class="user-mini">
          <div class="user-avatar">${escapeHtml(initial)}</div>
          <div>
            <div class="user-mini-name">${escapeHtml(profile.full_name || 'Pengguna')}</div>
            <div class="user-mini-role">${escapeHtml(formatRole(profile.role || 'viewer'))}</div>
          </div>
        </div>

        <button class="btn btn-danger btn-block" type="button" data-logout>
          Keluar
        </button>
      </div>
    </aside>
  `;
}

function renderMobileTopbar() {
  return `
    <header class="mobile-topbar">
      <div class="mobile-brand">
        <img src="${publicAsset('logo-app.png')}" alt="Kas Gabku" />
        <span>Kas Gabku</span>
      </div>

      <div class="mobile-topbar-actions">
        <button class="btn btn-topbar btn-refresh" type="button" data-refresh title="Refresh Data">
          Refresh
        </button>
        <button class="btn btn-topbar btn-logout" type="button" data-logout>
          Keluar
        </button>
      </div>
    </header>
  `;
}

function renderMobileNav(accessibleRoutes, activeMenuKey) {
  const visibleRoutes = accessibleRoutes.slice(0, 4);

  return `
    <nav class="mobile-nav">
      ${visibleRoutes
      .map((route) => {
        const active = route.key === activeMenuKey ? 'is-active' : '';

        return `
            <a href="#${route.key}" class="${active}" data-route="${route.key}">
              <span>${route.icon}</span>
              ${route.label}
            </a>
          `;
      })
      .join('')}
    </nav>
  `;
}

function getAccessibleRoutes() {
  const role = appState.profile?.role || 'viewer';

  return routes.filter((route) => route.roles.includes(role));
}

function getCurrentRoute() {
  const fallback = 'dashboard';
  const hash = window.location.hash.replace('#', '').trim();
  const requestedRoute = hash || fallback;

  if (isAllowedRoute(requestedRoute)) {
    return requestedRoute;
  }

  return fallback;
}

function isAllowedRoute(route) {
  const accessibleRoutes = getAccessibleRoutes();

  const exactRouteAllowed = accessibleRoutes.some((item) => {
    return item.key === route;
  });

  if (exactRouteAllowed) {
    return true;
  }

  if (route.startsWith('detail-transaksi/')) {
    const transactionId = route.split('/')[1];
    const canAccessTransactions = accessibleRoutes.some((item) => {
      return item.key === 'transaksi';
    });

    return Boolean(transactionId) && canAccessTransactions;
  }

  return false;
}

function getActiveMenuKey(route) {
  if (route.startsWith('detail-transaksi/')) {
    return 'transaksi';
  }

  return route;
}

async function handleLogout(root) {
  try {
    await signOut();
  } finally {
    appState.session = null;
    appState.profile = null;
    window.location.hash = '';
    renderLogin(root);
  }
}

function formatRole(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'bendahara') return 'Bendahara';
  if (role === 'viewer') return 'Viewer';

  return role || '-';
}

function getInitial(value) {
  return String(value || 'K').trim().slice(0, 1).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}