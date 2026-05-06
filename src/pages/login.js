import { signIn } from '../services/auth.js';

const PUBLIC_BASE = import.meta.env.BASE_URL || '/';

function publicAsset(path) {
  const normalizedPath = String(path || '').replace(/^\/+/, '');

  if (import.meta.env.DEV) {
    return `/${normalizedPath}`;
  }

  return `${PUBLIC_BASE}${normalizedPath}`;
}

export function renderLoginPage({ onLoginSuccess }) {
  const page = document.createElement('div');
  page.className = 'login-page';

  page.innerHTML = `
    <section class="login-brand">
      <div class="login-brand-inner">
        <div class="login-logo-card">
          <img src="${publicAsset('logo-app.png')}" alt="Logo Kas Gabku" />
        </div>

        <h1>Kas Gabku</h1>

        <p>
          Buku kas dan bukti pengeluaran untuk pengurus
          Gabungan Bridge Kulon Progo.
        </p>
      </div>
    </section>

    <section class="login-panel">
      <form class="login-card" id="login-form">
        <h2>Masuk ke aplikasi</h2>
        <p class="muted">
          Gunakan akun yang sudah dibuat oleh admin.
        </p>

        <div class="error-message" id="login-error"></div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            class="form-control"
            id="email"
            type="email"
            autocomplete="email"
            placeholder="contoh: az@gabku.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            class="form-control"
            id="password"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan password"
            required
          />
          <div class="form-help">
            Akun dibuat manual dari Supabase Dashboard.
          </div>
        </div>

        <button class="btn btn-primary btn-block" type="submit" id="login-button">
          Masuk
        </button>
      </form>
    </section>
  `;

  const form = page.querySelector('#login-form');
  const emailInput = page.querySelector('#email');
  const passwordInput = page.querySelector('#password');
  const errorBox = page.querySelector('#login-error');
  const button = page.querySelector('#login-button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    errorBox.classList.remove('is-visible');
    errorBox.textContent = '';

    button.disabled = true;
    button.textContent = 'Memproses...';

    try {
      await signIn(email, password);
      await onLoginSuccess();
    } catch (error) {
      errorBox.textContent = translateAuthError(error.message);
      errorBox.classList.add('is-visible');
    } finally {
      button.disabled = false;
      button.textContent = 'Masuk';
    }
  });

  return page;
}

function translateAuthError(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Email atau password salah.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi.';
  }

  return message || 'Gagal masuk. Coba lagi.';
}