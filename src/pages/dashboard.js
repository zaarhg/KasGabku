import { getDashboardData } from '../services/dashboard.js';
import { getDeferredPrompt, promptPwaInstall } from '../main.js';

import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatRupiah,
  formatTransactionStatus,
  formatTransactionType,
  getMonthName
} from '../utils/format.js';

export function renderDashboardPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack dashboard-page';

  const state = {
    profile,
    data: null
  };

  page.innerHTML = `
    <div class="page-header dashboard-page-header" style="display: block; width: 100%;">
      <div class="dashboard-info-header" style="display: block; width: 100%;">
        <div class="welcome-glass-banner" style="display: flex; justify-content: space-between; align-items: center; width: 100%; min-width: 100%;">
          <span class="welcome-text-large" style="color: var(--gray-900); font-weight: 500;">Selamat Datang, <strong style="text-transform: capitalize; color: var(--blue-900); font-weight: 800;">${escapeHtml(profile?.email?.split('@')[0] || 'Pengguna')}</strong></span>
          <div class="welcome-role-section">
            <span class="welcome-role-label" style="white-space: nowrap;">Role Anda:</span>
            <span class="welcome-role-capsule ${profile?.role || 'viewer'}">
              ${escapeHtml(formatRole(profile?.role || 'viewer'))}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <div id="pwa-install-banner" class="pwa-install-banner is-hidden">
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">📱</div>
        <div>
          <strong>Pasang Aplikasi Kas Gabku</strong>
          <small>Akses lebih cepat & pengalaman layar penuh tanpa browser.</small>
        </div>
      </div>
      <div class="pwa-banner-actions">
        <button class="btn btn-small btn-primary" id="pwa-install-btn">Pasang</button>
        <button class="btn btn-small btn-light" id="pwa-dismiss-btn">Nanti</button>
      </div>
    </div>

    <section class="dashboard-hero-grid">
      <article class="dashboard-balance-card" id="dashboard-balance">
        <div class="empty-mini">Memuat saldo...</div>
      </article>

      <div class="dashboard-metric-grid" id="dashboard-summary"></div>
    </section>

    ${profile?.role === 'admin'
      ? `
          <section class="dashboard-action-card">
            <div class="section-heading">
              <div>
                <h2>Menu Admin</h2>
              </div>
            </div>

            <div class="dashboard-action-grid admin-action-grid">
              <a class="dashboard-action-item action-blue" href="#admin">
                <span>◉</span>
                <div class="action-info">
                  <strong>Admin User</strong>
                  <small>Kelola role dan status user</small>
                </div>
              </a>

              <a class="dashboard-action-item action-blue" href="#log">
                <span>◎</span>
                <div class="action-info">
                  <strong>Log Aktiv..</strong>
                  <small>Audit aktivitas aplikasi</small>
                </div>
              </a>

              <a class="dashboard-action-item action-blue" href="#master-data">
                <span>⚙</span>
                <div class="action-info">
                  <strong>Master Data</strong>
                  <small>Kategori & Penandatangan</small>
                </div>
              </a>

              <a class="dashboard-action-item action-blue" href="#backup">
                <span>⇩</span>
                <div class="action-info">
                  <strong>Backup</strong>
                  <small>Export data JSON</small>
                </div>
              </a>
            </div>
          </section>
        `
      : ''
    }

      <section class="table-card">
        <div class="section-heading">
          <div>
            <h2>Pengeluaran Bulan Ini</h2>
            <p id="expense-caption">Memuat data pengeluaran...</p>
          </div>
        </div>

        <div id="expense-category-list"></div>
      </section>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Transaksi Terbaru</h2>
          <p>Aktivitas pencatatan kas terbaru.</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table dashboard-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Uraian</th>
              <th>Tipe</th>
              <th class="text-right">Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="recent-transactions-body">
            <tr>
              <td colspan="5">Memuat transaksi terbaru...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  bindEvents();
  loadDashboard();

  return page;

  function bindEvents() {
    window.addEventListener('app-refresh-request', () => {
      loadDashboard();
    });

    const onPwaAvailable = () => {
      checkPwaPrompt();
    };

    window.addEventListener('pwa-install-available', onPwaAvailable);

    page.querySelector('#pwa-install-btn')?.addEventListener('click', async () => {
      const success = await promptPwaInstall();
      if (success) {
        page.querySelector('#pwa-install-banner')?.classList.add('is-hidden');
      }
    });

    page.querySelector('#pwa-dismiss-btn')?.addEventListener('click', () => {
      localStorage.setItem('pwa-dismissed', 'true');
      page.querySelector('#pwa-install-banner')?.classList.add('is-hidden');
    });
  }

  function checkPwaPrompt() {
    const banner = page.querySelector('#pwa-install-banner');
    if (!banner) return;

    const isDismissed = localStorage.getItem('pwa-dismissed');
    const prompt = getDeferredPrompt();

    if (prompt && !isDismissed) {
      banner.classList.remove('is-hidden');
    }
  }

  async function loadDashboard() {
    try {
      setMessage('Memuat dashboard...', 'info');

      state.data = await getDashboardData();

      renderBalance();
      renderSummary();
      renderExpenseByCategory();
      renderRecentTransactions();
      checkPwaPrompt();

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderDashboardError();
    }
  }

  function renderBalance() {
    const root = page.querySelector('#dashboard-balance');
    if (!root || !state.data) return;

    const summary = state.data.summary;
    const periodLabel = `${getMonthName(state.data.period.month)} ${state.data.period.year}`;
    const monthNet = Number(summary.currentMonthNet || 0);
    const netClass = monthNet >= 0 ? 'amount-income' : 'amount-expense';

    root.innerHTML = `
      <div>
        <span class="dashboard-balance-label">Saldo Kas Saat Ini</span>
        <strong class="dashboard-balance-value">
          ${formatRupiah(summary.currentBalance)}
        </strong>
        <p>
          Dihitung dari seluruh transaksi final. Draft dan transaksi dibatalkan
          tidak masuk saldo.
        </p>
      </div>

      <div class="dashboard-balance-footer">
        <div>
          <span>Periode berjalan</span>
          <strong>${escapeHtml(periodLabel)}</strong>
        </div>

        <div>
          <span>Siklus Transaksi</span>
          <strong>${summary.finalCount} Final / ${summary.draftCount} Draft</strong>
        </div>

        <div>
          <span>Kas Masuk</span>
          <strong class="amount-income">${formatRupiah(summary.currentMonthIncome)}</strong>
        </div>

        <div>
          <span>Kas Keluar</span>
          <strong class="amount-expense">${formatRupiah(summary.currentMonthExpense)}</strong>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const root = page.querySelector('#dashboard-summary');
    if (!root || !state.data) return;

    const summary = state.data.summary;
    const periodLabel = `${getMonthName(state.data.period.month)} ${state.data.period.year}`;

    root.innerHTML = ''; // Moved to balance card
  }

  function renderExpenseByCategory() {
    const root = page.querySelector('#expense-category-list');
    const caption = page.querySelector('#expense-caption');
    if (!root || !state.data) return;

    const allRows = state.data.expenseByCategory || [];
    // Sort descending by amount and take top 3
    const rows = [...allRows]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 3);

    const total = allRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    if (caption) {
      if (allRows.length > 3) {
        caption.textContent = `3 kategori pengeluaran terbanyak dari total ${allRows.length} kategori.`;
      } else {
        caption.textContent = `${allRows.length} kategori pengeluaran pada bulan ini.`;
      }
    }

    if (!rows.length) {
      root.innerHTML = `
        <div class="empty-mini">
          Belum ada pengeluaran final pada bulan ini.
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="expense-category-list">
        ${rows
        .map((row) => {
          const percentage = total > 0 ? Math.round((row.amount / total) * 100) : 0;

          return `
              <div class="expense-category-item">
                <div>
                  <strong>${escapeHtml(row.categoryName)}</strong>
                  <span>${formatRupiah(row.amount)} • ${percentage}%</span>
                </div>

                <div class="progress-track" aria-hidden="true">
                  <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
              </div>
            `;
        })
        .join('')}
      </div>
    `;
  }

  function renderRecentTransactions() {
    const body = page.querySelector('#recent-transactions-body');
    if (!body || !state.data) return;

    const rows = (state.data.recentTransactions || []).slice(0, 5);

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">Belum ada transaksi.</div>
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows
      .map((transaction) => {
        const isIncome = transaction.type === 'masuk';

        return `
          <tr>
            <td>${formatDate(transaction.transaction_date)}</td>
            <td>
              <a class="table-main-link" href="#detail-transaksi/${transaction.id}">
                ${escapeHtml(transaction.description || '-')}
              </a>
            </td>
            <td>
              <span class="badge ${isIncome ? 'badge-success' : 'badge-warning'}">
                ${formatTransactionType(transaction.type)}
              </span>
            </td>
            <td class="text-right ${isIncome ? 'amount-income' : 'amount-expense'}">
              ${formatRupiah(transaction.amount)}
            </td>
            <td>
              <span class="badge ${getStatusBadgeClass(transaction.status)}">
                ${formatTransactionStatus(transaction.status)}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderDashboardError() {
    const balance = page.querySelector('#dashboard-balance');
    const summary = page.querySelector('#dashboard-summary');
    const expense = page.querySelector('#expense-category-list');
    const documents = page.querySelector('#dashboard-documents');
    const transactions = page.querySelector('#recent-transactions-body');

    if (balance) {
      balance.innerHTML = `
        <div class="empty-mini">
          Gagal memuat saldo kas.
        </div>
      `;
    }

    if (summary) {
      summary.innerHTML = '';
    }

    if (expense) {
      expense.innerHTML = `
        <div class="empty-mini">
          Gagal memuat pengeluaran bulan ini.
        </div>
      `;
    }


    if (transactions) {
      transactions.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">Gagal memuat transaksi terbaru.</div>
          </td>
        </tr>
      `;
    }
  }

  function setMessage(message, type = 'info') {
    const messageBox = page.querySelector('#message-box');
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
  }

  function hideMessage() {
    const messageBox = page.querySelector('#message-box');
    if (!messageBox) return;

    messageBox.className = 'message-box is-hidden';
    messageBox.textContent = '';
  }
}

function formatDocumentType(type) {
  if (type === 'bend_26') return 'Bend 26';
  if (type === 'buku_kas_bulanan') return 'Buku Kas Bulanan';

  return 'Dokumen PDF';
}

function getStatusBadgeClass(status) {
  if (status === 'draft') return 'badge-muted';
  if (status === 'final') return 'badge-success';
  if (status === 'dibatalkan') return 'badge-danger';

  return 'badge-muted';
}

function formatRole(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'bendahara') return 'Bendahara';
  if (role === 'viewer') return 'Viewer';

  return role || '-';
}

function getRoleBadgeClass(role) {
  if (role === 'admin') return 'role-admin';
  if (role === 'bendahara') return 'role-bendahara';
  if (role === 'viewer') return 'role-viewer';

  return '';
}