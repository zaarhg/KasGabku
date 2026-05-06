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

      <button class="btn btn-danger" type="button" data-logout>
        Keluar
      </button>
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