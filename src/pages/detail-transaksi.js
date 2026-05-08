import {
  getTransactionDetail,
  finalizeTransaction,
  cancelTransaction,
  deleteDraftTransaction
} from '../services/transaksi.js';

import {
  uploadTransactionNote,
  getSignedUrlsForAttachments,
  deleteTransactionNote
} from '../services/storage.js';

import {
  getActiveSignatories,
  generateBend26Pdf,
  deleteGeneratedDocument
} from '../services/pdf.js';

import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatRupiah,
  formatTransactionStatus,
  formatTransactionType
} from '../utils/format.js';

import { formatFileSize } from '../utils/image-compress.js';

import {
  showConfirmModal,
  showPromptModal,
  showContentModal,
  showLoadingModal
} from '../utils/modal.js';

const MAX_NOTES_PER_TRANSACTION = 3;

export function renderDetailTransaksiPage({ profile, transactionId }) {
  const page = document.createElement('div');
  page.className = 'page-stack detail-transaksi-page';

  const state = {
    profile,
    transaction: null,
    signatories: [],
    isLoading: true
  };

  page.innerHTML = `
    <div class="page-header detail-page-header">
      <div>
        <p class="eyebrow">Detail</p>
        <h1 class="page-title">Detail Transaksi</h1>
        <p class="page-description">
          Lihat data lengkap transaksi, nota, status dokumen, dan aksi lanjutan.
        </p>
      </div>

      <button class="btn btn-light" type="button" id="back-btn">
        ← Kembali
      </button>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section id="detail-root">
      <div class="detail-card">
        <div class="empty-state">Memuat detail transaksi...</div>
      </div>
    </section>
  `;

  bindEvents();
  loadDetail();

  return page;

  function bindEvents() {
    page.querySelector('#back-btn')?.addEventListener('click', () => {
      window.location.hash = 'transaksi';
    });

    page.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;

      if (action === 'refresh') {
        await loadDetail();
      }

      if (action === 'upload-note') {
        await handleUploadNote();
      }

      if (action === 'view-notes') {
        await handleViewNotes();
      }

      if (action === 'delete-note') {
        const id = button.dataset.id;
        await handleDeleteNote(id);
      }

      if (action === 'view-outdated-doc') {
        await showContentModal({
          title: 'Dokumen Kadaluwarsa',
          message: 'Dokumen Bend 26 ini sudah tidak valid karena ada perubahan data atau nota setelah dokumen ini dibuat.',
          bodyHtml: `
            <p style="margin-top: 12px; color: var(--text-soft); font-size: 14px;">
              Untuk menjaga integritas data laporan, dokumen lama tidak dapat dibuka. Silakan tekan tombol <strong>Generate Bend 26</strong> untuk memperbarui dokumen sesuai dengan data terbaru.
            </p>
          `,
          tone: 'warning'
        });
      }

      if (action === 'generate-blocked') {
        await showContentModal({
          title: 'Dokumen Sudah Sesuai',
          message: 'Bend 26 yang ada sudah mencerminkan data dan nota terbaru.',
          bodyHtml: `
            <p style="margin-top: 12px; color: var(--text-soft); font-size: 14px;">
              Tidak ada perubahan pada nominal, deskripsi, maupun foto nota sejak Bend 26 terakhir dibuat. Anda tidak perlu melakukan generate ulang.
            </p>
          `,
          tone: 'primary'
        });
      }

      if (action === 'delete-document') {
        const id = button.dataset.id;
        await handleDeleteDocument(id);
      }

      if (action === 'finalize') {
        await handleFinalize();
      }

      if (action === 'cancel') {
        await handleCancel();
      }

      if (action === 'delete-draft') {
        await handleDeleteDraft();
      }

      if (action === 'generate-bend26') {
        await handleGenerateBend26();
      }
    });
  }

  async function loadDetail() {
    try {
      state.isLoading = true;
      renderLoading();
      hideMessage();

      const [transaction, signatories] = await Promise.all([
        getTransactionDetail(transactionId),
        getActiveSignatories()
      ]);

      state.transaction = transaction;
      state.signatories = signatories;

      renderDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderError(error.message || 'Gagal memuat detail transaksi.');
    } finally {
      state.isLoading = false;
    }
  }

  function renderLoading() {
    const root = page.querySelector('#detail-root');
    if (!root) return;

    root.innerHTML = `
      <div class="detail-card">
        <div class="empty-state">Memuat detail transaksi...</div>
      </div>
    `;
  }

  function renderError(message) {
    const root = page.querySelector('#detail-root');
    if (!root) return;

    root.innerHTML = `
      <div class="detail-card">
        <div class="empty-state">
          ${escapeHtml(message)}
          <div style="margin-top: 14px;">
            <button class="btn btn-light" type="button" data-action="refresh">
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDetail() {
    const root = page.querySelector('#detail-root');
    if (!root || !state.transaction) return;

    const transaction = state.transaction;
    const attachments = transaction.transaction_attachments || [];
    const documents = transaction.generated_documents || [];
    const categoryName = transaction.spending_categories?.name || '-';
    const isIncome = transaction.type === 'masuk';

    root.innerHTML = `
      <div class="detail-layout">
        <section class="detail-main">
          <div class="detail-hero-card ${isIncome ? 'detail-hero-income' : 'detail-hero-expense'}">
            <div class="detail-hero-content">
              <div class="detail-status-line">
                <span class="badge ${getStatusBadgeClass(transaction.status)}">
                  ${formatTransactionStatus(transaction.status)}
                </span>

                <span class="detail-type-pill">
                  ${formatTransactionType(transaction.type)}
                </span>
              </div>

              <h2>${escapeHtml(transaction.description)}</h2>

              <div class="detail-proof-number">
                ${escapeHtml(transaction.proof_number || 'Belum final')}
              </div>
            </div>

            <div class="detail-amount-block">
              <span>Nominal</span>
              <strong>${formatRupiah(transaction.amount)}</strong>
            </div>
          </div>

          <div class="detail-grid">
            ${renderInfoItem('Tanggal', formatDate(transaction.transaction_date))}
            ${renderInfoItem('Jenis / Kategori', categoryName)}
            ${renderInfoItem(
      transaction.type === 'masuk' ? 'Sumber Dana' : 'Penerima',
      transaction.party_name || '-'
    )}
            ${renderInfoItem('Bulan/Tahun', `${transaction.period_month || '-'} / ${transaction.period_year || '-'}`)}
            ${renderInfoItem('Finalisasi', transaction.finalized_at ? formatDateTime(transaction.finalized_at) : '-')}
            ${renderInfoItem('Dibuat', formatDateTime(transaction.created_at))}
            ${renderInfoItem('Terakhir Diubah', formatDateTime(transaction.updated_at))}
            ${renderInfoItem('Dokumen Bend 26', getBend26Label(transaction, documents))}
          </div>

          <div class="detail-note-box">
            <h3>Catatan</h3>
            <p>${escapeHtml(transaction.notes || 'Tidak ada catatan.')}</p>
          </div>

          <div class="detail-actions-block">
            <div class="detail-block-heading">
              <div>
                <h3>Aksi Transaksi</h3>
                <p>Aksi utama transaksi dilakukan dari halaman ini agar tidak memenuhi tabel.</p>
              </div>
            </div>

            <div class="detail-action-grid">
              ${renderMainActions(transaction)}
            </div>
          </div>
        </section>

        <aside class="detail-side">
          <section class="detail-panel">
            <div class="section-heading compact">
              <div>
                <h2>Foto Nota</h2>
                <p>${attachments.length} dari maksimal ${MAX_NOTES_PER_TRANSACTION} foto</p>
              </div>
            </div>

            ${renderAttachmentList(attachments)}

            ${canUploadNote(profile, transaction)
        ? `
                  <button class="btn btn-primary full-width" type="button" data-action="upload-note">
                    Upload Nota
                  </button>
                `
        : ''
      }
          </section>

          <section class="detail-panel">
            <div class="section-heading compact">
              <div>
                <h2>Dokumen PDF</h2>
                <p>Bend 26 dan buku kas terkait transaksi ini.</p>
              </div>
            </div>

            ${renderDocumentList(documents)}
            ${renderBend26Action(transaction, documents)}
          </section>
        </aside>
      </div>
    `;
  }

  function renderInfoItem(label, value) {
    return `
      <div class="detail-info-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderMainActions(transaction) {
    const role = profile?.role || 'viewer';
    const actions = [];

    actions.push(`
      <button class="btn btn-light" type="button" data-action="refresh">
        Refresh
      </button>
    `);

    if (transaction.status === 'draft' && ['admin', 'bendahara'].includes(role)) {
      actions.push(`
        <button class="btn btn-primary" type="button" data-action="finalize">
          Finalkan Transaksi
        </button>
      `);
    }

    if (transaction.status === 'draft' && role === 'admin') {
      actions.push(`
        <button class="btn btn-danger" type="button" data-action="delete-draft">
          Hapus Draft
        </button>
      `);
    }

    if (transaction.status === 'final' && role === 'admin') {
      actions.push(`
        <button class="btn btn-danger" type="button" data-action="cancel">
          Batalkan Final
        </button>
      `);
    }

    return actions.join('');
  }

  function renderAttachmentList(attachments) {
    if (!attachments.length) {
      return `
        <div class="empty-mini">
          Belum ada foto nota.
        </div>
      `;
    }

    return `
      <div class="attachment-list">
        ${attachments
        .map((attachment, index) => {
          const isAdmin = profile?.role === 'admin';
          return `
              <div class="attachment-row">
                <button
                  class="attachment-item"
                  type="button"
                  data-action="view-notes"
                >
                  <span class="attachment-icon">🧾</span>
                  <span>
                    <strong>${escapeHtml(attachment.file_name || `Nota ${index + 1}`)}</strong>
                    <small>${formatFileSize(attachment.file_size)} • ${formatDateTime(attachment.created_at)}</small>
                  </span>
                </button>
                ${isAdmin ? `
                  <button class="btn btn-small btn-danger btn-delete-note" type="button" data-action="delete-note" data-id="${attachment.id}" title="Hapus Foto">
                    Hapus
                  </button>
                ` : ''}
              </div>
            `;
        })
        .join('')}
      </div>
    `;
  }

  function renderDocumentList(documents) {
    if (!documents.length) {
      return `
        <div class="empty-mini">
          Belum ada dokumen PDF.
        </div>
      `;
    }

    const transaction = state.transaction;

    return `
      <div class="document-list">
        ${documents
        .map((document) => {
          // Check if document is outdated (Bend 26 only)
          const isBend26 = document.document_type === 'bend_26';
          const isOutdated = isBend26 && transaction.updated_at && document.generated_at &&
            new Date(transaction.updated_at).getTime() > new Date(document.generated_at).getTime() + 2000;

          if (isOutdated) {
            const isAdmin = profile?.role === 'admin';
            return `
              <div class="attachment-row">
                <button
                  class="document-item is-outdated"
                  type="button"
                  data-action="view-outdated-doc"
                >
                  <span class="attachment-icon">⚠️</span>
                  <span>
                    <strong>${escapeHtml(formatDocumentType(document.document_type))} (Kadaluwarsa)</strong>
                    <small>
                      Dibuat ${document.generated_at ? formatDateTime(document.generated_at) : '-'} • Nota berubah.
                    </small>
                  </span>
                </button>
                ${isAdmin ? `
                  <button class="btn btn-small btn-danger btn-delete-note" type="button" data-action="delete-document" data-id="${document.id}" title="Hapus Dokumen">
                    Hapus
                  </button>
                ` : ''}
              </div>
            `;
          }

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
                  <small>
                    ${escapeHtml(document.file_name || '-')}
                    ${document.generated_at ? ` • ${formatDateTime(document.generated_at)}` : ''}
                  </small>
                </span>
              </a>
            `;
        })
        .join('')}
      </div>
    `;
  }

  function renderBend26Action(transaction, documents) {
    const bend26Documents = documents.filter((document) => {
      return document.document_type === 'bend_26';
    });

    if (transaction.type !== 'keluar') {
      return `
        <div class="pending-feature-box">
          <strong>Bend 26 tidak tersedia</strong>
          <span>Bend 26 hanya dibuat untuk transaksi kas keluar.</span>
        </div>
      `;
    }

    if (transaction.status !== 'final') {
      return `
        <div class="pending-feature-box">
          <strong>Finalkan transaksi dulu</strong>
          <span>Bend 26 baru bisa dibuat setelah transaksi berstatus final.</span>
        </div>
      `;
    }

    if (!['admin', 'bendahara'].includes(profile?.role)) {
      return `
        <div class="pending-feature-box">
          <strong>Akses lihat saja</strong>
          <span>Role kamu tidak memiliki akses untuk generate Bend 26.</span>
        </div>
      `;
    }

    const latestBend26 = bend26Documents[0];
    const isUpdateNeeded = !latestBend26 ||
      (transaction.updated_at && latestBend26.generated_at &&
        new Date(transaction.updated_at).getTime() > new Date(latestBend26.generated_at).getTime() + 2000);

    return `
      <div class="generate-doc-box">
        <div>
          <strong>Generate Bend 26</strong>
          <span>
            ${isUpdateNeeded
        ? (latestBend26 ? 'Nota/data telah berubah. Silakan generate ulang.' : 'Buat PDF Bend 26 dari data transaksi ini.')
        : 'Dokumen sudah sesuai dengan data & nota terbaru.'
      }
          </span>
        </div>

        <button 
          class="btn ${isUpdateNeeded ? 'btn-primary' : 'btn-light'} full-width" 
          type="button" 
          data-action="${isUpdateNeeded ? 'generate-bend26' : 'generate-blocked'}"
        >
          Generate Bend 26
        </button>
      </div>
    `;
  }

  async function handleGenerateBend26() {
    const transaction = state.transaction;

    if (!transaction) return;

    if (transaction.type !== 'keluar') {
      setMessage('Bend 26 hanya bisa dibuat untuk transaksi kas keluar.', 'error');
      return;
    }

    if (transaction.status !== 'final') {
      setMessage('Transaksi harus final sebelum generate Bend 26.', 'error');
      return;
    }

    if (!state.signatories.length) {
      setMessage('Data penandatangan aktif belum tersedia.', 'error');
      return;
    }

    const selection = await openBend26SignerModal();

    if (!selection) return;

    let loadingModal = null;

    try {
      loadingModal = showLoadingModal({
        title: 'Membuat PDF Bend 26...',
        message:
          'Kas Gabku sedang mengisi template, membuat PDF, dan menyimpan dokumen ke Google Drive.',
        detail:
          'Mohon tunggu sampai proses selesai. Jangan tutup halaman dan jangan refresh browser.'
      });

      const document = await generateBend26Pdf({
        transaction,
        signerMengetahuiId: selection.signerMengetahuiId,
        signerBendaharaId: selection.signerBendaharaId
      });

      loadingModal.update({
        title: 'Menyimpan hasil...',
        detail: 'PDF berhasil dibuat. Kas Gabku sedang memperbarui data dokumen.'
      });

      await loadDetail();
      await loadingModal.close();
      loadingModal = null;

      await showContentModal({
        title: 'Bend 26 Berhasil Dibuat',
        message: document.file_name || 'PDF Bend 26 berhasil dibuat dan disimpan ke Google Drive.',
        tone: 'primary',
        bodyHtml: `
          <div class="success-doc-box">
            <strong>${escapeHtml(document.file_name || 'Bend 26.pdf')}</strong>
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
        title: 'Gagal Membuat Bend 26',
        message:
          'PDF Bend 26 belum berhasil dibuat. Periksa pesan error di bawah ini.',
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

  async function openBend26SignerModal() {
    const mengetahuiDefaultId = getDefaultSignerId('mengetahui_menerima');
    const bendaharaDefaultId =
      getDefaultSignerId('bendahara_pengeluaran_pembantu') ||
      mengetahuiDefaultId;

    return showContentModal({
      title: 'Generate Bend 26',
      message:
        'Pilih nama yang akan dimasukkan ke bagian tanda tangan. Data transaksi akan diambil otomatis.',
      tone: 'primary',
      bodyHtml: `
        <div class="modal-form-grid">
          <div class="form-group">
            <label for="signer-mengetahui">Mengetahui / Menerima</label>
            <select class="form-control" id="signer-mengetahui">
              ${renderSignerOptions(mengetahuiDefaultId)}
            </select>
          </div>

          <div class="form-group">
            <label for="signer-bendahara">Bendahara Pengeluaran Pembantu</label>
            <select class="form-control" id="signer-bendahara">
              ${renderSignerOptions(bendaharaDefaultId)}
            </select>
          </div>

          <div class="generate-preview-box">
            <strong>Data yang akan dipakai</strong>
            <span>No Bukti: ${escapeHtml(state.transaction.proof_number || '-')}</span>
            <span>Uraian: ${escapeHtml(state.transaction.description || '-')}</span>
            <span>Nominal: ${formatRupiah(state.transaction.amount)}</span>
            <span>Nota: ${(state.transaction.transaction_attachments || []).length ? 'terlampir' : 'belum dilampirkan'}</span>
          </div>

          <p class="modal-field-error is-hidden" data-generate-error>
            Penandatangan wajib dipilih.
          </p>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-light" type="button" data-modal-close>
          Batal
        </button>
        <button class="btn btn-primary" type="button" data-generate-bend26>
          Generate PDF
        </button>
      `,
      onMount: (modal, { close }) => {
        const errorText = modal.querySelector('[data-generate-error]');

        modal.querySelector('[data-generate-bend26]')?.addEventListener('click', () => {
          const signerMengetahuiId = modal.querySelector('#signer-mengetahui')?.value;
          const signerBendaharaId = modal.querySelector('#signer-bendahara')?.value;

          if (!signerMengetahuiId || !signerBendaharaId) {
            errorText?.classList.remove('is-hidden');
            return;
          }

          close({
            signerMengetahuiId,
            signerBendaharaId
          });
        });
      }
    });
  }

  function getDefaultSignerId(position) {
    const byPosition = state.signatories.filter((signer) => {
      return signer.signer_position === position;
    });

    const defaultSigner = byPosition.find((signer) => signer.is_default);

    return defaultSigner?.id || byPosition[0]?.id || state.signatories[0]?.id || '';
  }

  function renderSignerOptions(selectedId) {
    return state.signatories
      .map((signer) => {
        const selected = signer.id === selectedId ? 'selected' : '';

        return `
          <option value="${signer.id}" ${selected}>
            ${escapeHtml(formatSignerLabel(signer))}
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

  async function handleUploadNote() {
    const transaction = state.transaction;

    if (!transaction) return;

    const attachments = transaction.transaction_attachments || [];

    if (attachments.length >= MAX_NOTES_PER_TRANSACTION) {
      setMessage(
        `Maksimal ${MAX_NOTES_PER_TRANSACTION} foto nota per transaksi.`,
        'error'
      );
      return;
    }

    const file = await pickImageFile();

    if (!file) return;

    const ok = await showConfirmModal({
      title: 'Upload Foto Nota?',
      message: `File akan dikompres otomatis sebelum disimpan. File dipilih: ${file.name} (${formatFileSize(file.size)}).`,
      confirmText: 'Upload Nota',
      cancelText: 'Batal',
      tone: 'primary'
    });

    if (!ok) return;

    try {
      setMessage('Mengompres dan mengupload foto nota...', 'info');

      const result = await uploadTransactionNote({
        transaction,
        file
      });

      setMessage(
        `Nota berhasil diupload. Ukuran: ${formatFileSize(
          result.compression.originalSize
        )} → ${formatFileSize(result.compression.compressedSize)}.`,
        'success'
      );

      await loadDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleViewNotes() {
    const attachments = state.transaction?.transaction_attachments || [];

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
        message: `${state.transaction.proof_number || 'Transaksi draft'} — ${state.transaction.description}`,
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

  async function handleFinalize() {
    const ok = await showConfirmModal({
      title: 'Finalkan Transaksi?',
      message:
        'Setelah transaksi difinalkan, nomor bukti akan dibuat otomatis dan transaksi masuk ke buku kas.',
      confirmText: 'Ya, Finalkan',
      cancelText: 'Batal',
      tone: 'primary'
    });

    if (!ok) return;

    try {
      setMessage('Memfinalkan transaksi...', 'info');
      await finalizeTransaction(state.transaction.id);
      setMessage('Transaksi berhasil difinalkan.', 'success');
      await loadDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleCancel() {
    const reason = await showPromptModal({
      title: 'Batalkan Transaksi Final?',
      message:
        'Transaksi final tidak akan dihapus, tetapi statusnya menjadi dibatalkan dan tidak dihitung di buku kas.',
      label: 'Alasan pembatalan',
      placeholder: 'Contoh: Salah input nominal atau transaksi dibatalkan.',
      defaultValue: 'Dibatalkan oleh admin.',
      confirmText: 'Batalkan Transaksi',
      cancelText: 'Kembali',
      tone: 'danger',
      required: true
    });

    if (reason === null) return;

    try {
      setMessage('Membatalkan transaksi...', 'info');
      await cancelTransaction(state.transaction.id, reason);
      setMessage('Transaksi final berhasil dibatalkan.', 'success');
      await loadDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleDeleteDraft() {
    const ok = await showConfirmModal({
      title: 'Hapus Draft Transaksi?',
      message:
        'Draft transaksi akan dihapus permanen. Gunakan ini hanya untuk data salah input atau data percobaan.',
      confirmText: 'Ya, Hapus Draft',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      setMessage('Menghapus transaksi draft...', 'info');
      await deleteDraftTransaction(state.transaction.id);
      setMessage('Transaksi draft berhasil dihapus.', 'success');

      setTimeout(() => {
        window.location.hash = 'transaksi';
      }, 500);
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleDeleteNote(attachmentId) {
    if (!attachmentId) return;

    const ok = await showConfirmModal({
      title: 'Hapus Foto Nota?',
      message: 'Apakah Anda yakin ingin menghapus foto nota ini? Tindakan ini tidak bisa dibatalkan.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      setMessage('Menghapus foto...', 'info');
      await deleteTransactionNote(attachmentId);
      setMessage('Foto nota berhasil dihapus.', 'success');
      await loadDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleDeleteDocument(id) {
    if (!id) return;

    const ok = await showConfirmModal({
      title: 'Hapus Dokumen?',
      message: 'Apakah Anda yakin ingin menghapus dokumen PDF ini? Tindakan ini tidak bisa dibatalkan.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      setMessage('Menghapus dokumen...', 'info');
      await deleteGeneratedDocument(id);
      setMessage('Dokumen berhasil dihapus.', 'success');
      await loadDetail();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
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

function canUploadNote(profile, transaction) {
  return (
    ['admin', 'bendahara'].includes(profile?.role) &&
    transaction?.status !== 'dibatalkan' &&
    (transaction?.transaction_attachments || []).length < MAX_NOTES_PER_TRANSACTION
  );
}

function getStatusBadgeClass(status) {
  if (status === 'draft') return 'badge-muted';
  if (status === 'final') return 'badge-success';
  if (status === 'dibatalkan') return 'badge-danger';

  return 'badge-muted';
}

function formatDocumentType(type) {
  if (type === 'bend_26') return 'Bend 26';
  if (type === 'buku_kas_bulanan') return 'Buku Kas Bulanan';

  return 'Dokumen';
}

function getBend26Label(transaction, documents) {
  if (transaction.type !== 'keluar') return '-';
  if (transaction.status !== 'final') return 'Belum final';

  const hasBend26 = documents.some((document) => {
    return document.document_type === 'bend_26';
  });

  return hasBend26 ? 'Sudah dibuat' : 'Belum dibuat';
}

function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      input.remove();
      resolve(file);
    });

    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
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