import {
  getActiveSignatories,
  getBukuKasPreview,
  generateBukuKasPdf,
  deleteGeneratedDocument
} from '../services/pdf.js';

import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatRupiah,
  getCurrentMonth,
  getCurrentYear,
  getMonthName
} from '../utils/format.js';

import {
  showConfirmModal,
  showContentModal,
  showLoadingModal
} from '../utils/modal.js';

export function renderBukuKasPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack buku-kas-page';

  const state = {
    profile,
    month: getCurrentMonth(),
    year: getCurrentYear(),
    preview: null,
    signatories: [],
    documentPage: 1
  };

  page.innerHTML = `
    <div class="page-header buku-kas-page-header">
      <div>
        <p class="eyebrow">Laporan</p>
        <h1 class="page-title">Buku Kas Bulanan</h1>
        <p class="page-description">
          Pilih periode, cek ringkasan transaksi final, lalu generate PDF buku kas.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="book-control-card">
      <div class="book-control-main">
        <div>
          <span class="book-control-label">Periode Buku Kas</span>
          <strong id="book-period-title">
            ${getMonthName(state.month)} ${state.year}
          </strong>
          <p>
            Buku kas hanya mengambil transaksi berstatus final pada periode yang dipilih.
          </p>
        </div>

        <div class="book-control-actions">
          <button class="btn btn-light" type="button" id="refresh-book-btn">
            Refresh Preview
          </button>

          ${['admin', 'bendahara'].includes(profile?.role)
      ? `
                <button class="btn btn-primary" type="button" id="generate-book-btn">
                  Generate Buku Kas
                </button>
              `
      : ''
    }
        </div>
      </div>

      <div class="book-filter-grid">
        <div class="form-group">
          <label for="book-month">Bulan</label>
          <select class="form-control" id="book-month">
            ${renderMonthOptions(state.month)}
          </select>
        </div>

        <div class="form-group">
          <label for="book-year">Tahun</label>
          <select class="form-control" id="book-year">
            ${renderYearOptions(state.year)}
          </select>
        </div>

        <div class="form-group">
          <label for="book-signer">Penandatangan Buku Kas</label>
          <select class="form-control" id="book-signer">
            <option value="">Memuat penandatangan...</option>
          </select>
        </div>
      </div>
    </section>

    <section class="book-hero-grid">
      <article class="book-balance-card" id="book-balance-card">
        <div class="empty-mini">Memuat saldo buku kas...</div>
      </article>

      <div class="book-summary-grid" id="book-summary"></div>
    </section>

    <div class="book-content-grid">
      <section class="table-card">
        <div class="section-heading">
          <div>
            <h2>Dokumen Buku Kas</h2>
            <p>PDF buku kas yang pernah dibuat untuk periode ini.</p>
          </div>
        </div>

        <div id="book-documents"></div>
      </section>

      <section class="table-card">
        <div class="section-heading">
          <div>
            <h2>Catatan Periode</h2>
            <p>Ringkasan status data sebelum generate PDF.</p>
          </div>
        </div>

        <div id="book-period-note">
          <div class="empty-mini">Memuat catatan periode...</div>
        </div>
      </section>
    </div>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Preview Buku Kas</h2>
          <p id="book-table-caption">Memuat data...</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table book-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>No Bukti</th>
              <th>Uraian</th>
              <th>Jenis</th>
              <th class="text-right">Kas Masuk</th>
              <th class="text-right">Kas Keluar</th>
              <th class="text-right">Saldo</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody id="book-rows">
            <tr>
              <td colspan="9">Memuat buku kas...</td>
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
    page.querySelector('#book-month')?.addEventListener('change', async (event) => {
      state.month = Number(event.target.value);
      await loadPreview();
    });

    page.querySelector('#book-year')?.addEventListener('change', async (event) => {
      state.year = Number(event.target.value);
      await loadPreview();
    });

    page.querySelector('#refresh-book-btn')?.addEventListener('click', async () => {
      await loadPreview();
    });

    page.querySelector('#generate-book-btn')?.addEventListener('click', async () => {
      await handleGenerateBukuKas();
    });

    page.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === 'delete-document') {
        await handleDeleteDocument(id);
      }

      if (action === 'doc-prev') {
        state.documentPage = Math.max(1, state.documentPage - 1);
        renderDocuments();
      }

      if (action === 'doc-next') {
        const totalPages = Math.ceil((state.preview.documents || []).length / 3);
        state.documentPage = Math.min(totalPages, state.documentPage + 1);
        renderDocuments();
      }
    });
  }

  async function loadInitialData() {
    try {
      setMessage('Memuat data buku kas...', 'info');

      state.signatories = await getActiveSignatories();
      renderSignerOptions();

      await loadPreview();

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderEmptyRows('Gagal memuat data buku kas.');
      renderPreviewError();
    }
  }

  async function loadPreview() {
    try {
      renderLoadingRows();
      updatePeriodTitle();

      state.documentPage = 1;

      state.preview = await getBukuKasPreview({
        month: state.month,
        year: state.year
      });

      renderBalance();
      renderSummary();
      renderDocuments();
      renderPeriodNote();
      renderRows();

      const caption = page.querySelector('#book-table-caption');
      if (caption) {
        caption.textContent = `${state.preview.rows.length} transaksi final pada ${state.preview.periodLabel}.`;
      }

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderEmptyRows('Gagal memuat preview buku kas.');
      renderPreviewError();
    }
  }

  async function handleGenerateBukuKas() {
    if (!['admin', 'bendahara'].includes(profile?.role)) {
      setMessage('Role kamu tidak memiliki akses untuk generate buku kas.', 'error');
      return;
    }

    const signerId = page.querySelector('#book-signer')?.value;

    if (!signerId) {
      setMessage('Pilih penandatangan buku kas terlebih dahulu.', 'error');
      return;
    }

    if (!state.preview?.rows?.length) {
      setMessage('Belum ada transaksi final pada bulan ini.', 'error');
      return;
    }

    const ok = await showConfirmModal({
      title: 'Generate Buku Kas Bulanan?',
      message:
        `PDF buku kas ${state.preview.periodLabel} akan dibuat dari semua transaksi final pada periode ini.`,
      confirmText: 'Generate PDF',
      cancelText: 'Batal',
      tone: 'primary'
    });

    if (!ok) return;

    let loadingModal = null;

    try {
      loadingModal = showLoadingModal({
        title: 'Membuat PDF Buku Kas...',
        message:
          'Kas Gabku sedang menghitung saldo, mengisi template, dan menyimpan PDF ke Google Drive.',
        detail:
          'Mohon tunggu sampai proses selesai. Jangan tutup halaman dan jangan refresh browser.'
      });

      const document = await generateBukuKasPdf({
        month: state.month,
        year: state.year,
        bookSignerId: signerId
      });

      loadingModal.update({
        title: 'Menyimpan hasil...',
        detail: 'PDF berhasil dibuat. Kas Gabku sedang memperbarui daftar dokumen.'
      });

      await loadPreview();
      await loadingModal.close();
      loadingModal = null;

      await showContentModal({
        title: 'Buku Kas Berhasil Dibuat',
        message: document.file_name || 'PDF buku kas berhasil dibuat dan disimpan ke Google Drive.',
        tone: 'primary',
        bodyHtml: `
          <div class="success-doc-box">
            <strong>${escapeHtml(document.file_name || 'Buku Kas.pdf')}</strong>
            <span>Dokumen sudah tersimpan di Google Drive dan dicatat di aplikasi.</span>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-light" type="button" data-modal-close>
            Tutup
          </button>
          <a
            class="btn btn-primary"
            href="${escapeHtml(document.file_url || '#')}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka PDF
          </a>
        `
      });
    } catch (error) {
      if (loadingModal) {
        await loadingModal.close();
      }

      await showContentModal({
        title: 'Gagal Membuat Buku Kas',
        message:
          'PDF buku kas belum berhasil dibuat. Periksa pesan error di bawah ini.',
        tone: 'danger',
        bodyHtml: `
          <div class="message-box message-error" style="margin-top: 16px;">
            ${escapeHtml(error.message || String(error))}
          </div>
        `,
        footerHtml: `
          <button class="btn btn-primary" type="button" data-modal-close>
            Tutup
          </button>
        `
      });
    }
  }

  function renderSignerOptions() {
    const input = page.querySelector('#book-signer');
    if (!input) return;

    if (!state.signatories.length) {
      input.innerHTML = '<option value="">Belum ada penandatangan aktif</option>';
      return;
    }

    const defaultId = getDefaultSignerId();

    input.innerHTML = state.signatories
      .map((signer) => {
        const selected = signer.id === defaultId ? 'selected' : '';

        return `
          <option value="${signer.id}" ${selected}>
            ${escapeHtml(formatSignerLabel(signer))}
          </option>
        `;
      })
      .join('');
  }

  function renderBalance() {
    const root = page.querySelector('#book-balance-card');
    if (!root || !state.preview) return;

    root.innerHTML = `
      <div>
        <span class="book-balance-label">Saldo Akhir</span>
        <strong class="book-balance-value">
          ${formatRupiah(state.preview.endingBalance)}
        </strong>
        <p>
          Saldo akhir dihitung dari saldo awal, kas masuk, dan kas keluar pada
          periode ${escapeHtml(state.preview.periodLabel)}.
        </p>
      </div>

      <div class="book-balance-footer">
        <div>
          <span>Saldo Awal</span>
          <strong>${formatRupiah(state.preview.openingBalance)}</strong>
        </div>

        <div>
          <span>Jumlah Transaksi</span>
          <strong>${state.preview.rows.length}</strong>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const root = page.querySelector('#book-summary');
    if (!root || !state.preview) return;

    root.innerHTML = `
      <article class="book-summary-card">
        <span>Total Kas Masuk</span>
        <strong>${formatRupiah(state.preview.totalIncome)}</strong>
        <small>Transaksi final periode ini</small>
      </article>

      <article class="book-summary-card">
        <span>Total Kas Keluar</span>
        <strong>${formatRupiah(state.preview.totalExpense)}</strong>
        <small>Transaksi final periode ini</small>
      </article>

      <article class="book-summary-card">
        <span>Saldo Awal</span>
        <strong>${formatRupiah(state.preview.openingBalance)}</strong>
        <small>Sebelum ${escapeHtml(state.preview.periodLabel)}</small>
      </article>

      <article class="book-summary-card">
        <span>PDF Dibuat</span>
        <strong>${(state.preview.documents || []).length}</strong>
        <small>Dokumen untuk periode ini</small>
      </article>
    `;
  }

  function renderDocuments() {
    const root = page.querySelector('#book-documents');
    if (!root || !state.preview) return;

    const documents = state.preview.documents || [];

    if (!documents.length) {
      root.innerHTML = `
        <div class="empty-mini">
          Belum ada PDF buku kas untuk periode ini.
        </div>
      `;
      return;
    }

    const itemsPerPage = 3;
    const totalPages = Math.ceil(documents.length / itemsPerPage);
    const currentPage = Math.min(state.documentPage, totalPages);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const displayedDocuments = documents.slice(startIndex, startIndex + itemsPerPage);

    root.innerHTML = `
      <div class="document-list">
        ${displayedDocuments
        .map((document) => {
          const isAdmin = profile?.role === 'admin';
          return `
              <div class="document-list-row">
                <a
                  class="document-item"
                  href="${escapeHtml(document.file_url || '#')}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="attachment-icon">📄</span>
                  <span>
                    <strong>${escapeHtml(document.file_name || 'Buku Kas.pdf')}</strong>
                    <small>${document.generated_at ? formatDateTime(document.generated_at) : '-'}</small>
                  </span>
                </a>
                ${isAdmin ? `
                  <button class="btn btn-small btn-danger" type="button" data-action="delete-document" data-id="${document.id}" title="Hapus PDF">
                    Hapus
                  </button>
                ` : ''}
              </div>
            `;
        })
        .join('')}
      </div>

      ${totalPages > 1 ? `
        <div class="list-pagination">
          <span class="pagination-info">Halaman ${currentPage} dari ${totalPages}</span>
          <div class="pagination-controls">
            <button class="btn btn-light btn-small" type="button" data-action="doc-prev" ${currentPage === 1 ? 'disabled' : ''}>
              ←
            </button>
            <button class="btn btn-light btn-small" type="button" data-action="doc-next" ${currentPage === totalPages ? 'disabled' : ''}>
              →
            </button>
          </div>
        </div>
      ` : ''}
    `;
  }

  async function handleDeleteDocument(documentId) {
    const ok = await showConfirmModal({
      title: 'Hapus Dokumen PDF?',
      message: 'Data rekaman PDF ini akan dihapus dari aplikasi. File di Google Drive tetap ada namun tidak lagi terhubung di sini.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      setMessage('Menghapus dokumen...', 'info');
      await deleteGeneratedDocument(documentId);
      setMessage('Dokumen berhasil dihapus.', 'success');
      await loadPreview();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  function renderPeriodNote() {
    const root = page.querySelector('#book-period-note');
    if (!root || !state.preview) return;

    const rows = state.preview.rows || [];
    const hasRows = rows.length > 0;
    const signerName = getSelectedSignerLabel();

    root.innerHTML = `
      <div class="book-note-list">
        <div class="book-note-item">
          <span>Status data</span>
          <strong>${hasRows ? 'Siap digenerate' : 'Belum ada transaksi final'}</strong>
        </div>

        <div class="book-note-item">
          <span>Periode</span>
          <strong>${escapeHtml(state.preview.periodLabel)}</strong>
        </div>

        <div class="book-note-item">
          <span>Penandatangan</span>
          <strong>${escapeHtml(signerName || 'Belum dipilih')}</strong>
        </div>
      </div>
    `;
  }

  function renderRows() {
    const body = page.querySelector('#book-rows');
    if (!body || !state.preview) return;

    const rows = state.preview.rows || [];

    if (!rows.length) {
      renderEmptyRows('Belum ada transaksi final pada periode ini.');
      return;
    }

    body.innerHTML = rows
      .map((row) => {
        return `
          <tr>
            <td>${row.no}</td>
            <td>${formatDate(row.date)}</td>
            <td><strong>${escapeHtml(row.proofNumber)}</strong></td>
            <td>
              <strong>${escapeHtml(row.description)}</strong>
            </td>
            <td>${escapeHtml(row.categoryName)}</td>
            <td class="text-right amount-income">
              ${row.income ? formatRupiah(row.income) : '-'}
            </td>
            <td class="text-right amount-expense">
              ${row.expense ? formatRupiah(row.expense) : '-'}
            </td>
            <td class="text-right">
              <strong>${formatRupiah(row.balance)}</strong>
            </td>
            <td>${renderNoteStatus(row.noteStatus)}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderNoteStatus(noteStatus) {
    if (noteStatus === 'Ada nota') {
      return '<span class="badge badge-success">Ada nota</span>';
    }

    return '<span class="badge badge-muted">-</span>';
  }

  function renderLoadingRows() {
    const body = page.querySelector('#book-rows');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="9">Memuat buku kas...</td>
      </tr>
    `;
  }

  function renderEmptyRows(message) {
    const body = page.querySelector('#book-rows');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }

  function renderPreviewError() {
    const balance = page.querySelector('#book-balance-card');
    const summary = page.querySelector('#book-summary');
    const documents = page.querySelector('#book-documents');
    const note = page.querySelector('#book-period-note');

    if (balance) {
      balance.innerHTML = '<div class="empty-mini">Gagal memuat saldo buku kas.</div>';
    }

    if (summary) {
      summary.innerHTML = '';
    }

    if (documents) {
      documents.innerHTML = '<div class="empty-mini">Gagal memuat dokumen buku kas.</div>';
    }

    if (note) {
      note.innerHTML = '<div class="empty-mini">Gagal memuat catatan periode.</div>';
    }
  }

  function updatePeriodTitle() {
    const title = page.querySelector('#book-period-title');

    if (title) {
      title.textContent = `${getMonthName(state.month)} ${state.year}`;
    }
  }

  function getDefaultSignerId() {
    const bendaharaSigners = state.signatories.filter((signer) => {
      return signer.signer_position === 'bendahara_pengeluaran_pembantu';
    });

    const defaultBendahara = bendaharaSigners.find((signer) => signer.is_default);

    return (
      defaultBendahara?.id ||
      bendaharaSigners[0]?.id ||
      state.signatories.find((signer) => signer.is_default)?.id ||
      state.signatories[0]?.id ||
      ''
    );
  }

  function getSelectedSignerLabel() {
    const signerId = page.querySelector('#book-signer')?.value;
    const signer = state.signatories.find((item) => item.id === signerId);

    if (!signer) return '';

    return `${signer.full_name} — ${signer.position_title}`;
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

function renderMonthOptions(selectedMonth) {
  const options = [];

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

function formatSignerLabel(signer) {
  const identity = signer.identity_number
    ? ` • ${signer.identity_type || 'ID'}: ${signer.identity_number}`
    : '';

  return `${signer.full_name} — ${signer.position_title}${identity}`;
}