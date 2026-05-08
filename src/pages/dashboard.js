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
    <div class="page-header dashboard-page-header">
      <div class="dashboard-info-header">
        <p class="eyebrow">Beranda</p>
        <h1 class="page-title">Dashboard Kas Gabku</h1>
        <div class="description-with-pill">
          <p class="page-description">
            Ringkasan saldo, transaksi, pengeluaran per kategori, dan dokumen terbaru.
          </p>
          <span class="dashboard-role-pill ${getRoleBadgeClass(profile?.role)}">
            ${escapeHtml(formatRole(profile?.role || 'viewer'))}
          </span>
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
                <strong>Admin User</strong>
                <small>Kelola role dan status user</small>
              </a>

              <a class="dashboard-action-item action-indigo" href="#log">
                <span>◎</span>
                <strong>Log Aktivitas</strong>
                <small>Audit aktivitas aplikasi</small>
              </a>

              <a class="dashboard-action-item action-teal" href="#backup">
                <span>⇩</span>
                <strong>Backup</strong>
                <small>Export data JSON</small>
              </a>
            </div>
          </section>
        `
      : ''
    }

    <div class="dashboard-grid">
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
            <h2>Dokumen PDF Terbaru</h2>
            <p>Bend 26 dan Buku Kas yang terakhir dibuat.</p>
          </div>
        </div>

        <div id="dashboard-documents"></div>
      </section>
    </div>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Transaksi Terbaru</h2>
          <p>Aktivitas pencatatan kas terbaru.</p>
        </div>

        <a class="btn btn-light" href="#transaksi">
          Lihat Semua
        </a>
      </div>

      <div class="table-responsive">
        <table class="data-table dashboard-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No Bukti</th>
              <th>Uraian</th>
              <th>Tipe</th>
              <th class="text-right">Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="recent-transactions-body">
            <tr>
              <td colspan="6">Memuat transaksi terbaru...</td>
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
      renderDocuments();
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
          <span>Selisih bulan ini</span>
          <strong class="${netClass}">
            ${formatRupiah(monthNet)}
          </strong>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const root = page.querySelector('#dashboard-summary');
    if (!root || !state.data) return;

    const summary = state.data.summary;
    const periodLabel = `${getMonthName(state.data.period.month)} ${state.data.period.year}`;

    root.innerHTML = `
      <article class="dashboard-metric-card">
        <span>Kas Masuk Bulan Ini</span>
        <strong>${formatRupiah(summary.currentMonthIncome)}</strong>
        <small>${escapeHtml(periodLabel)}</small>
      </article>

      <article class="dashboard-metric-card">
        <span>Kas Keluar Bulan Ini</span>
        <strong>${formatRupiah(summary.currentMonthExpense)}</strong>
        <small>${escapeHtml(periodLabel)}</small>
      </article>

      <article class="dashboard-metric-card">
        <span>Transaksi Draft</span>
        <strong>${summary.draftCount}</strong>
        <small>Belum masuk buku kas</small>
      </article>

      <article class="dashboard-metric-card">
        <span>Transaksi Final</span>
        <strong>${summary.finalCount}</strong>
        <small>Total transaksi yang sah</small>
      </article>
    `;
  }

  function renderExpenseByCategory() {
    const root = page.querySelector('#expense-category-list');
    const caption = page.querySelector('#expense-caption');
    if (!root || !state.data) return;

    const rows = state.data.expenseByCategory || [];
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    if (caption) {
      caption.textContent = `${rows.length} kategori pengeluaran pada bulan ini.`;
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

  function renderDocuments() {
    const root = page.querySelector('#dashboard-documents');
    if (!root || !state.data) return;

    const documents = state.data.documents || [];

    if (!documents.length) {
      root.innerHTML = `
        <div class="empty-mini">
          Belum ada dokumen PDF yang dibuat.
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="document-list">
        ${documents
        .map((document) => {
          return `
              <a
                class="document-item"
                href="${escapeHtml(document.file_url || '#')}"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="attachment-icon">📄</span>
                <span>
                  <strong>${escapeHtml(formatDocumentType(document.document_type))}</strong>
                  <small>${escapeHtml(document.file_name || '-')}</small>
                  <small>${document.generated_at ? formatDateTime(document.generated_at) : '-'}</small>
                </span>
              </a>
            `;
        })
        .join('')}
      </div>
    `;
  }

  function renderRecentTransactions() {
    const body = page.querySelector('#recent-transactions-body');
    if (!body || !state.data) return;

    const rows = state.data.recentTransactions || [];

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6">
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
              <strong>${escapeHtml(transaction.proof_number || 'Belum final')}</strong>
            </td>
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

    if (documents) {
      documents.innerHTML = `
        <div class="empty-mini">
          Gagal memuat dokumen terbaru.
        </div>
      `;
    }

    if (transactions) {
      transactions.innerHTML = `
        <tr>
          <td colspan="6">
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