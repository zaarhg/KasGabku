import {
  listActivityLogs,
  getActivityLogOptions
} from '../services/activity-log.js';

import {
  escapeHtml,
  formatDateTime,
  getTodayInputDate
} from '../utils/format.js';

export function renderLogAktivitasPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack log-aktivitas-page';

  const state = {
    profile,
    logs: [],
    options: {
      actions: [],
      entityTables: []
    },
    filters: {
      action: 'all',
      entity_table: 'all',
      startDate: '',
      endDate: '',
      limit: 100
    }
  };

  page.innerHTML = `
    <div class="page-header log-page-header">
      <div>
        <p class="eyebrow">Audit</p>
        <h1 class="page-title">Log Aktivitas</h1>
        <p class="page-description">
          Lihat riwayat aktivitas penting seperti finalisasi transaksi, generate PDF,
          perubahan master data, backup, dan perubahan user.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="log-filter-card">
      <div class="log-filter-header">
        <div>
          <span class="log-filter-label">Filter Log</span>
          <strong>Audit Aktivitas Aplikasi</strong>
          <p>
            Gunakan filter untuk menelusuri aktivitas berdasarkan aksi, data terkait,
            atau rentang tanggal tertentu.
          </p>
        </div>

        <div class="log-filter-actions">
          <button class="btn btn-light" type="button" id="today-log-btn">
            Hari Ini
          </button>

          <button class="btn btn-light" type="button" id="reset-log-btn">
            Reset Filter
          </button>

          <button class="btn btn-primary" type="button" id="refresh-log-btn">
            Refresh Log
          </button>
        </div>
      </div>

      <div class="log-filter-grid">
        <div class="form-group">
          <label for="log-action">Aksi</label>
          <select class="form-control" id="log-action">
            <option value="all">Semua aksi</option>
          </select>
        </div>

        <div class="form-group">
          <label for="log-entity">Data Terkait</label>
          <select class="form-control" id="log-entity">
            <option value="all">Semua data</option>
          </select>
        </div>

        <div class="form-group">
          <label for="log-start-date">Mulai Tanggal</label>
          <input class="form-control" id="log-start-date" type="date" />
        </div>

        <div class="form-group">
          <label for="log-end-date">Sampai Tanggal</label>
          <input class="form-control" id="log-end-date" type="date" />
        </div>
      </div>
    </section>

    <section class="log-hero-grid">
      <article class="log-main-card" id="log-main-card">
        <div class="empty-mini">Memuat ringkasan log...</div>
      </article>

      <div class="log-summary-grid" id="log-summary"></div>
    </section>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Daftar Log</h2>
          <p id="log-table-caption">Memuat log aktivitas...</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table log-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>User</th>
              <th>Aksi</th>
              <th>Data</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody id="log-body">
            <tr>
              <td colspan="5">Memuat log aktivitas...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  bindEvents();
  loadInitialData();

  return page;

  function bindEvents() {
    page.querySelector('#refresh-log-btn')?.addEventListener('click', async () => {
      await loadLogs();
    });

    page.querySelector('#reset-log-btn')?.addEventListener('click', async () => {
      resetFilters();
      await loadLogs();
    });

    page.querySelector('#today-log-btn')?.addEventListener('click', async () => {
      const today = getTodayInputDate();

      state.filters.startDate = today;
      state.filters.endDate = today;

      page.querySelector('#log-start-date').value = today;
      page.querySelector('#log-end-date').value = today;

      await loadLogs();
    });

    ['log-action', 'log-entity', 'log-start-date', 'log-end-date'].forEach((id) => {
      page.querySelector(`#${id}`)?.addEventListener('change', async () => {
        state.filters.action = page.querySelector('#log-action').value;
        state.filters.entity_table = page.querySelector('#log-entity').value;
        state.filters.startDate = page.querySelector('#log-start-date').value;
        state.filters.endDate = page.querySelector('#log-end-date').value;

        await loadLogs();
      });
    });
  }

  async function loadInitialData() {
    try {
      setMessage('Memuat opsi log...', 'info');

      state.options = await getActivityLogOptions();

      renderFilterOptions();
      await loadLogs();

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderMainCardError();
      renderEmptyLogs('Gagal memuat log aktivitas.');
    }
  }

  async function loadLogs() {
    try {
      renderLoadingLogs();

      state.logs = await listActivityLogs(state.filters);

      renderMainCard();
      renderSummary();
      renderLogs();

      const caption = page.querySelector('#log-table-caption');
      if (caption) {
        caption.textContent = `${state.logs.length} log aktivitas ditampilkan.`;
      }

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderMainCardError();
      renderEmptyLogs('Gagal memuat log aktivitas.');
    }
  }

  function renderFilterOptions() {
    const actionInput = page.querySelector('#log-action');
    const entityInput = page.querySelector('#log-entity');

    if (actionInput) {
      actionInput.innerHTML = `
        <option value="all">Semua aksi</option>
        ${state.options.actions
          .map((action) => {
            return `
              <option value="${escapeHtml(action)}">
                ${escapeHtml(formatAction(action))}
              </option>
            `;
          })
          .join('')}
      `;
    }

    if (entityInput) {
      entityInput.innerHTML = `
        <option value="all">Semua data</option>
        ${state.options.entityTables
          .map((entityTable) => {
            return `
              <option value="${escapeHtml(entityTable)}">
                ${escapeHtml(formatEntityTable(entityTable))}
              </option>
            `;
          })
          .join('')}
      `;
    }
  }

  function renderMainCard() {
    const root = page.querySelector('#log-main-card');
    if (!root) return;

    const latestLog = state.logs[0];
    const activeFilterLabel = getActiveFilterLabel();

    root.innerHTML = `
      <div>
        <span class="log-main-label">Log Terbaru</span>
        <strong class="log-main-title">
          ${latestLog ? escapeHtml(formatAction(latestLog.action)) : 'Belum ada log'}
        </strong>
        <p>
          ${latestLog
        ? escapeHtml(latestLog.description || 'Aktivitas tercatat tanpa deskripsi.')
        : 'Belum ada aktivitas yang sesuai dengan filter saat ini.'
      }
        </p>
      </div>

      <div class="log-main-footer">
        <div>
          <span>Waktu</span>
          <strong>${latestLog ? formatDateTime(latestLog.created_at) : '-'}</strong>
        </div>

        <div>
          <span>Filter aktif</span>
          <strong>${escapeHtml(activeFilterLabel)}</strong>
        </div>
      </div>
    `;
  }

  function renderMainCardError() {
    const root = page.querySelector('#log-main-card');
    if (!root) return;

    root.innerHTML = `
      <div class="empty-mini">
        Gagal memuat ringkasan log.
      </div>
    `;
  }

  function renderSummary() {
    const root = page.querySelector('#log-summary');
    if (!root) return;

    const total = state.logs.length;
    const uniqueUsers = new Set(
      state.logs.map((log) => log.user_id).filter(Boolean)
    ).size;

    const transactionLogs = state.logs.filter((log) => {
      return log.entity_table === 'transactions';
    }).length;

    const documentLogs = state.logs.filter((log) => {
      return log.entity_table === 'generated_documents';
    }).length;

    const masterLogs = state.logs.filter((log) => {
      return [
        'organizations',
        'spending_categories',
        'signatories'
      ].includes(log.entity_table);
    }).length;

    root.innerHTML = `
      <article class="log-summary-card">
        <span>Total Log</span>
        <strong>${total}</strong>
        <small>Berdasarkan filter saat ini</small>
      </article>

      <article class="log-summary-card">
        <span>User Terlibat</span>
        <strong>${uniqueUsers}</strong>
        <small>User unik pada daftar ini</small>
      </article>

      <article class="log-summary-card">
        <span>Transaksi / Dokumen</span>
        <strong>${transactionLogs} / ${documentLogs}</strong>
        <small>Aktivitas kas dan PDF</small>
      </article>

      <article class="log-summary-card">
        <span>Master Data</span>
        <strong>${masterLogs}</strong>
        <small>Organisasi, kategori, penandatangan</small>
      </article>
    `;
  }

  function renderLogs() {
    const body = page.querySelector('#log-body');
    if (!body) return;

    if (!state.logs.length) {
      renderEmptyLogs('Belum ada log untuk filter ini.');
      return;
    }

    body.innerHTML = state.logs
      .map((log) => {
        return `
          <tr>
            <td>
              <strong>${formatDateTime(log.created_at)}</strong>
            </td>
            <td>
              <strong>${escapeHtml(getUserName(log))}</strong>
              <small>${escapeHtml(log.profiles?.email || '-')}</small>
              <small>${escapeHtml(formatRole(log.profiles?.role || '-'))}</small>
            </td>
            <td>
              <span class="badge ${getActionBadgeClass(log.action)}">
                ${escapeHtml(formatAction(log.action))}
              </span>
            </td>
            <td>
              <strong>${escapeHtml(formatEntityTable(log.entity_table))}</strong>
              <small>${escapeHtml(shortenId(log.entity_id))}</small>
            </td>
            <td>
              <span class="log-description">
                ${escapeHtml(log.description || '-')}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderLoadingLogs() {
    const body = page.querySelector('#log-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="5">Memuat log aktivitas...</td>
      </tr>
    `;
  }

  function renderEmptyLogs(message) {
    const body = page.querySelector('#log-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }

  function resetFilters() {
    state.filters = {
      action: 'all',
      entity_table: 'all',
      startDate: '',
      endDate: '',
      limit: 100
    };

    page.querySelector('#log-action').value = 'all';
    page.querySelector('#log-entity').value = 'all';
    page.querySelector('#log-start-date').value = '';
    page.querySelector('#log-end-date').value = '';
  }

  function getActiveFilterLabel() {
    const labels = [];

    if (state.filters.action !== 'all') {
      labels.push(formatAction(state.filters.action));
    }

    if (state.filters.entity_table !== 'all') {
      labels.push(formatEntityTable(state.filters.entity_table));
    }

    if (state.filters.startDate || state.filters.endDate) {
      labels.push('Tanggal tertentu');
    }

    return labels.length ? labels.join(' • ') : 'Semua log';
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

function getUserName(log) {
  return log.profiles?.full_name || log.profiles?.email || 'User tidak diketahui';
}

function formatAction(action) {
  const labels = {
    login: 'Login',
    create_transaction: 'Tambah Transaksi',
    finalize_transaction: 'Finalisasi Transaksi',
    cancel_transaction: 'Batalkan Transaksi',
    delete_draft_transaction: 'Hapus Draft',
    upload_note: 'Upload Nota',
    generate_bend26: 'Generate Bend 26',
    generate_buku_kas: 'Generate Buku Kas',
    export_backup: 'Export Backup',
    update_organization: 'Ubah Organisasi',
    create_category: 'Tambah Kategori',
    update_category: 'Ubah Kategori',
    toggle_category: 'Aktif/Nonaktif Kategori',
    create_signatory: 'Tambah Penandatangan',
    update_signatory: 'Ubah Penandatangan',
    toggle_signatory: 'Aktif/Nonaktif Penandatangan',
    set_default_signatory: 'Set Default Penandatangan',
    update_user_profile: 'Ubah User',
    toggle_user: 'Aktif/Nonaktif User'
  };

  return labels[action] || action || '-';
}

function formatEntityTable(entityTable) {
  const labels = {
    transactions: 'Transaksi',
    transaction_attachments: 'Nota',
    generated_documents: 'Dokumen PDF',
    organizations: 'Organisasi',
    spending_categories: 'Kategori',
    signatories: 'Penandatangan',
    profiles: 'User'
  };

  return labels[entityTable] || entityTable || '-';
}

function formatRole(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'bendahara') return 'Bendahara';
  if (role === 'viewer') return 'Viewer';

  return role || '-';
}

function shortenId(value) {
  if (!value) return '-';

  const text = String(value);

  if (text.length <= 12) return text;

  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function getActionBadgeClass(action) {
  if (String(action || '').includes('generate')) return 'badge-success';
  if (String(action || '').includes('export')) return 'badge-success';
  if (String(action || '').includes('cancel')) return 'badge-danger';
  if (String(action || '').includes('delete')) return 'badge-danger';
  if (String(action || '').includes('toggle')) return 'badge-warning';
  if (String(action || '').includes('update')) return 'badge-warning';

  return 'badge-muted';
}