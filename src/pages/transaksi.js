import {
  getActiveCategories,
  listTransactions,
  createTransaction
} from '../services/transaksi.js';

import {
  getMasterData
} from '../services/master-data.js';

import {
  getSignedUrlsForAttachments
} from '../services/storage.js';

import {
  escapeHtml,
  formatDate,
  formatRupiah,
  formatTransactionStatus,
  formatTransactionType,
  getCurrentMonth,
  getCurrentYear,
  getMonthName,
  getTodayInputDate,
  parseAmountInput
} from '../utils/format.js';

import { formatFileSize } from '../utils/image-compress.js';

import {
  showContentModal
} from '../utils/modal.js';

export function renderTransaksiPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack transaksi-page';

  const state = {
    profile,
    categories: [],
    signatories: [],
    transactions: [],
    filters: {
      month: String(getCurrentMonth()),
      year: String(getCurrentYear()),
      type: 'all',
      status: 'all'
    }
  };

  page.innerHTML = `
    <div class="page-header transaksi-page-header">
      <div>
        <p class="eyebrow">Pencatatan</p>
        <h1 class="page-title">Transaksi Kas</h1>
        <p class="page-description">
          Catat kas masuk dan kas keluar. Aksi lanjutan seperti upload nota,
          finalisasi, pembatalan, dan generate Bend 26 dilakukan dari halaman detail.
        </p>
      </div>

      <div class="header-actions">
        <button class="btn btn-primary" type="button" id="toggle-filters-btn">
          Opsi Filter
        </button>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>


    <div class="collapsible-toolbar is-collapsed" id="filters-collapsible">
      <section class="toolbar-card">
      <div class="filters-grid">
        <div class="form-group">
          <label for="filter-month">Bulan</label>
          <select class="form-control" id="filter-month">
            ${renderMonthOptions(state.filters.month)}
          </select>
        </div>

        <div class="form-group">
          <label for="filter-year">Tahun</label>
          <select class="form-control" id="filter-year">
            ${renderYearOptions(state.filters.year)}
          </select>
        </div>

        <div class="form-group">
          <label for="filter-type">Tipe</label>
          <select class="form-control" id="filter-type">
            <option value="all">Semua</option>
            <option value="masuk">Kas Masuk</option>
            <option value="keluar">Kas Keluar</option>
          </select>
        </div>

        <div class="form-group">
          <label for="filter-status">Status</label>
          <select class="form-control" id="filter-status">
            <option value="all">Semua</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>
        </div>
      </div>
    </section>
    </div>

    <section class="summary-grid" id="summary-grid"></section>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Daftar Transaksi</h2>
          <p id="table-caption">Memuat data transaksi...</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table transaction-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No Bukti</th>
              <th>Uraian</th>
              <th>Jenis</th>
              <th>Tipe</th>
              <th class="text-right">Nominal</th>
              <th>Status</th>
              <th>Nota</th>
              <th>B26</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="transactions-body">
            <tr>
              <td colspan="10">Memuat transaksi...</td>
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
    page.querySelector('#toggle-filters-btn')?.addEventListener('click', () => {
      const collapsible = page.querySelector('#filters-collapsible');
      const btn = page.querySelector('#toggle-filters-btn');
      
      if (collapsible) {
        collapsible.classList.toggle('is-collapsed');
        const isOpen = !collapsible.classList.contains('is-collapsed');
        btn.textContent = isOpen ? 'Tutup Filter' : 'Opsi Filter';
      }
    });

    ['filter-month', 'filter-year', 'filter-type', 'filter-status'].forEach((id) => {
      page.querySelector(`#${id}`)?.addEventListener('change', async () => {
        state.filters.month = page.querySelector('#filter-month').value;
        state.filters.year = page.querySelector('#filter-year').value;
        state.filters.type = page.querySelector('#filter-type').value;
        state.filters.status = page.querySelector('#filter-status').value;

        await loadTransactions();
      });
    });

    page.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      const action = actionButton.dataset.action;
      const transactionId = actionButton.dataset.id;

      if (action === 'view-notes') {
        await handleViewNotes(transactionId);
      }

      if (action === 'detail') {
        window.location.hash = `detail-transaksi/${transactionId}`;
      }
    });
  }

  async function loadInitialData() {
    try {
      setMessage('Memuat kategori dan transaksi...', 'info');

      const masterData = await getMasterData();
      state.categories = masterData.categories;
      state.signatories = masterData.signatories;

      await loadTransactions();

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderEmptyTable('Gagal memuat data transaksi.');
    }
  }

  async function loadTransactions() {
    try {
      renderLoadingTable();

      state.transactions = await listTransactions(state.filters);

      renderSummary();
      renderTable();

      const caption = page.querySelector('#table-caption');
      if (caption) {
        caption.textContent = `${state.transactions.length} transaksi ditemukan untuk filter saat ini.`;
      }
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderEmptyTable('Gagal memuat transaksi.');
    }
  }

  function renderSummary() {
    const summaryGrid = page.querySelector('#summary-grid');
    if (!summaryGrid) return;

    const finalTransactions = state.transactions.filter(
      (transaction) => transaction.status === 'final'
    );

    const totalMasuk = finalTransactions
      .filter((transaction) => transaction.type === 'masuk')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const totalKeluar = finalTransactions
      .filter((transaction) => transaction.type === 'keluar')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const saldo = totalMasuk - totalKeluar;

    const draftCount = state.transactions.filter(
      (transaction) => transaction.status === 'draft'
    ).length;

    const missingBend26Count = state.transactions.filter((transaction) => {
      return (
        transaction.type === 'keluar' &&
        transaction.status === 'final' &&
        !hasBend26(transaction)
      );
    }).length;

    summaryGrid.innerHTML = `
      <article class="summary-card">
        <span>Total Kas Masuk</span>
        <strong>${formatRupiah(totalMasuk)}</strong>
        <small>Hanya transaksi final</small>
      </article>

      <article class="summary-card">
        <span>Total Kas Keluar</span>
        <strong>${formatRupiah(totalKeluar)}</strong>
        <small>Hanya transaksi final</small>
      </article>

      <article class="summary-card">
        <span>Saldo Filter Ini</span>
        <strong>${formatRupiah(saldo)}</strong>
        <small>Kas masuk - kas keluar</small>
      </article>

      <article class="summary-card">
        <span>B26 Belum Dibuat</span>
        <strong>${missingBend26Count}</strong>
        <small>Kas keluar final tanpa Bend 26</small>
      </article>
    `;
  }

  function renderTable() {
    const body = page.querySelector('#transactions-body');
    if (!body) return;

    if (!state.transactions.length) {
      renderEmptyTable('Belum ada transaksi untuk filter ini.');
      return;
    }

    body.innerHTML = state.transactions
      .map((transaction) => {
        const category = getCategoryName(transaction.category_id);
        const isIncome = transaction.type === 'masuk';
        const amountClass = isIncome ? 'amount-income' : 'amount-expense';
        const attachments = transaction.transaction_attachments || [];

        return `
          <tr>
            <td>${formatDate(transaction.transaction_date)}</td>
            <td>
              <strong>${escapeHtml(transaction.proof_number || 'Belum final')}</strong>
            </td>
            <td>
              <a class="table-main-link" href="#detail-transaksi/${transaction.id}">
                ${escapeHtml(transaction.description)}
              </a>
              ${transaction.party_name
            ? `<small>${escapeHtml(transaction.party_name)}</small>`
            : ''
          }
            </td>
            <td>${escapeHtml(category)}</td>
            <td>
              <span class="badge ${isIncome ? 'badge-success' : 'badge-warning'}">
                ${formatTransactionType(transaction.type)}
              </span>
            </td>
            <td class="text-right ${amountClass}">
              ${formatRupiah(transaction.amount)}
            </td>
            <td>
              <span class="badge ${getStatusBadgeClass(transaction.status)}">
                ${formatTransactionStatus(transaction.status)}
              </span>
            </td>
            <td>
              ${renderNoteCell(transaction, attachments)}
            </td>
            <td>
              ${renderBend26Cell(transaction)}
            </td>
            <td>
              ${renderActions(transaction)}
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderNoteCell(transaction, attachments) {
    if (!attachments.length) {
      return `
        <span class="badge badge-muted">Belum ada</span>
      `;
    }

    return `
      <button
        class="note-pill"
        type="button"
        data-action="view-notes"
        data-id="${transaction.id}"
      >
        ${attachments.length} nota
      </button>
    `;
  }

  function renderBend26Cell(transaction) {
    if (transaction.type !== 'keluar') {
      return '<span class="badge badge-muted">-</span>';
    }

    if (transaction.status === 'dibatalkan') {
      return '<span class="badge badge-muted">-</span>';
    }

    if (transaction.status !== 'final') {
      return '<span class="badge badge-muted">Belum final</span>';
    }

    if (hasBend26(transaction)) {
      return '<span class="badge badge-success">Sudah</span>';
    }

    return '<span class="badge badge-warning">Belum</span>';
  }

  function renderActions(transaction) {
    return `
      <div class="transaction-actions-row">
        <button
          class="btn btn-small btn-primary"
          type="button"
          data-action="detail"
          data-id="${transaction.id}"
        >
          Detail
        </button>
      </div>
    `;
  }

  function renderLoadingTable() {
    const body = page.querySelector('#transactions-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="10">Memuat transaksi...</td>
      </tr>
    `;
  }

  function renderEmptyTable(message) {
    const body = page.querySelector('#transactions-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }

  async function handleViewNotes(transactionId) {
    const transaction = getTransactionById(transactionId);

    if (!transaction) {
      setMessage('Transaksi tidak ditemukan.', 'error');
      return;
    }

    const attachments = transaction.transaction_attachments || [];

    if (!attachments.length) {
      setMessage('Transaksi ini belum memiliki nota.', 'info');
      return;
    }

    try {
      setMessage('Membuka nota...', 'info');

      const notes = await getSignedUrlsForAttachments(attachments);

      hideMessage();

      await showContentModal({
        title: 'Foto Nota',
        message: `${transaction.proof_number || 'Transaksi draft'} — ${transaction.description}`,
        tone: 'primary',
        bodyHtml: renderNotesPreview(notes),
        footerHtml: `
          <button class="btn btn-primary" type="button" data-modal-close>
            Tutup
          </button>
        `
      });
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  function getCategoryName(categoryId) {
    if (!categoryId) return '-';

    const category = state.categories.find((item) => item.id === categoryId);

    return category?.name || '-';
  }

  function getTransactionById(transactionId) {
    return state.transactions.find((transaction) => transaction.id === transactionId);
  }

  function hasBend26(transaction) {
    return (transaction.generated_documents || []).some((document) => {
      return document.document_type === 'bend_26';
    });
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
function canCreateTransaction(profile) {
  return ['admin', 'bendahara'].includes(profile?.role);
}

function renderMonthOptions(selectedMonth) {
  const options = ['<option value="all">Semua bulan</option>'];

  for (let month = 1; month <= 12; month += 1) {
    const selected = String(month) === String(selectedMonth) ? 'selected' : '';

    options.push(`
      <option value="${month}" ${selected}>
        ${getMonthName(month)}
      </option>
    `);
  }

  return options.join('');
}

function renderYearOptions(selectedYear) {
  const currentYear = getCurrentYear();
  const years = [];

  for (let year = 2026; year <= 2030; year += 1) {
    years.push(year);
  }

  return years
    .map((year) => {
      const selected = String(year) === String(selectedYear) ? 'selected' : '';

      return `
        <option value="${year}" ${selected}>
          ${year}
        </option>
      `;
    })
    .join('');
}

function getStatusBadgeClass(status) {
  if (status === 'draft') return 'badge-muted';
  if (status === 'final') return 'badge-success';
  if (status === 'dibatalkan') return 'badge-danger';

  return 'badge-muted';
}

function renderNotesPreview(notes) {
  return `
    <div class="notes-preview-grid">
      ${notes
      .map((note, index) => {
        return `
            <article class="note-preview-card">
              <div class="note-preview-image">
                <img
                  src="${escapeHtml(note.signedUrl)}"
                  alt="Nota ${index + 1}"
                  loading="lazy"
                />
              </div>

              <div class="note-preview-meta">
                <strong>${escapeHtml(note.file_name || `Nota ${index + 1}`)}</strong>
                <span>${formatFileSize(note.file_size)} • ${escapeHtml(note.mime_type || '-')}</span>
                <a
                  href="${escapeHtml(note.signedUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka di tab baru
                </a>
              </div>
            </article>
          `;
      })
      .join('')}
    </div>
  `;
}