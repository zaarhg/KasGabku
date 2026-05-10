import {
  getTransactionDetail,
  finalizeTransaction,
  cancelTransaction,
  deleteDraftTransaction,
  updateTransaction,
  getActiveCategories,
  deleteTransactionAdmin
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
  parseRupiah,
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

const MAX_NOTES_PER_TRANSACTION = 1;

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

      <button class="btn btn-primary" type="button" id="back-btn">
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

      if (action === 'edit') {
        await handleEditTransaction();
      }

      if (action === 'view-doc') {
        const id = button.dataset.id;
        await handleViewDocument(id);
      }

      if (action === 'generate-bend26') {
        await handleGenerateBend26();
      }

      if (action === 'admin-delete-transaction') {
        await handleAdminDeleteTransaction();
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

                ${(() => {
                  if (transaction.type !== 'keluar' || transaction.status !== 'final') return '';
                  const bend26Docs = documents.filter(d => d.document_type === 'bend_26');
                  const latest = bend26Docs[0];
                  const needsUpdate = !latest || (transaction.updated_at && latest.generated_at &&
                    new Date(transaction.updated_at).getTime() > new Date(latest.generated_at).getTime() + 2000);
                  
                  if (!needsUpdate) return '';
                  return `
                    <span class="detail-type-pill is-warning">
                      Bend 26 ${!latest ? 'Belum Dibuat' : 'Perlu Update'}
                    </span>
                  `;
                })()}
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
              transaction.party_name || '-',
              true
            )}
            ${renderInfoItem('Rincian', transaction.notes || '-', true)}
          </div>

          <div class="detail-actions-block">
            <div class="detail-block-heading">
              <div>
                <h3>Aksi Transaksi</h3>
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
                <h2>${isIncome ? 'Foto Surat / Kuitansi' : 'Foto Nota'}</h2>
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

          ${!isIncome ? `
          <section class="detail-panel">
            <div class="section-heading compact">
              <div>
                <h2>Dokumen PDF</h2>
              </div>
            </div>

            ${renderDocumentList(documents)}
            ${renderBend26Action(transaction, documents)}
          </section>
          ` : ''}

          <section class="detail-panel">
            <div class="section-heading compact">
              <div>
                <h2>Riwayat Status</h2>
              </div>
            </div>
            ${renderTimelineList(transaction)}
          </section>
        </aside>
      </div>
    `;
  }

  function renderTimelineList(transaction) {
    const items = [
      { label: 'Dibuat', value: transaction.created_at, icon: '✨' },
      { label: 'Terakhir Diubah', value: transaction.updated_at, icon: '📝' },
      { label: 'Finalisasi', value: transaction.finalized_at, icon: '✅' }
    ];

    return `
      <div class="document-list">
        ${items
          .map((item) => `
            <div class="document-item" style="cursor: default; background: transparent; border-color: var(--border-soft); padding: 12px 14px;">
              <span class="attachment-icon" style="font-size: 18px;">${item.icon}</span>
              <span>
                <strong>${item.label}</strong>
                <small>${item.value ? formatDateTime(item.value) : '-'}</small>
              </span>
            </div>
          `)
          .join('')}
        
        ${profile?.role === 'admin' ? `
          <div style="margin-top: 16px; padding: 0 4px;">
            <button class="btn btn-danger btn-block btn-small" type="button" data-action="admin-delete-transaction" style="opacity: 0.8; font-size: 12px; height: 38px;">
              Hapus Transaksi Permanen
            </button>
            <p style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 8px; line-height: 1.4;">
              Hanya Admin yang dapat menghapus transaksi yang sudah final.
            </p>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderInfoItem(label, value, isWide = false) {
    return `
      <div class="detail-info-item ${isWide ? 'is-wide' : ''}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderMainActions(transaction) {
    const role = profile?.role || 'viewer';
    const actions = [];

    if (transaction.status === 'draft' && ['admin', 'bendahara'].includes(role)) {
      actions.push(`
        <button class="btn btn-primary" type="button" data-action="finalize">
          Finalkan Transaksi
        </button>
      `);
    }

    if (transaction.status === 'final' && role === 'admin') {
      actions.push(`
        <button class="btn btn-primary" type="button" data-action="edit">
          Edit Transaksi
        </button>
      `);
    }

    if (transaction.status === 'final' && ['admin', 'bendahara'].includes(role)) {
      actions.push(`
        <button class="btn btn-danger" type="button" data-action="cancel">
          Batalkan Final
        </button>
      `);
    }

    if (transaction.status === 'draft' && ['admin', 'bendahara'].includes(role)) {
      actions.push(`
        <button class="btn btn-danger" type="button" data-action="delete-draft">
          Hapus Draft
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
              <div class="attachment-row" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                <div
                  class="attachment-item"
                  data-action="view-notes"
                  style="flex: 1; min-width: 0; margin-bottom: 0; cursor: pointer;"
                >
                  <span class="attachment-icon">🧾</span>
                  <span style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                    <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${escapeHtml(attachment.file_name || `Nota ${index + 1}`)}</strong>
                    <small style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${formatFileSize(attachment.file_size)} • ${formatDateTime(attachment.created_at)}</small>
                  </span>
                </div>
                ${isAdmin ? `
                  <button class="btn btn-small btn-danger btn-delete-note" type="button" data-action="delete-note" data-id="${attachment.id}" title="Hapus Foto" style="width: max-content; max-width: 80px; flex: 0 0 auto; white-space: nowrap; padding: 6px 12px; align-self: stretch; margin-bottom: 0; border-radius: 18px;">
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
              <div class="attachment-row" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                <div
                  class="document-item is-outdated"
                  data-action="view-outdated-doc"
                  style="flex: 1; min-width: 0; margin-bottom: 0; cursor: pointer;"
                >
                  <span class="attachment-icon">⚠️</span>
                  <span style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                    <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${escapeHtml(formatDocumentType(document.document_type))} (Kadaluwarsa)</strong>
                    <small style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">
                      Dibuat ${document.generated_at ? formatDateTime(document.generated_at) : '-'} • Nota berubah.
                    </small>
                  </span>
                </div>
                ${isAdmin ? `
                  <button class="btn btn-small btn-danger btn-delete-note" type="button" data-action="delete-document" data-id="${document.id}" title="Hapus Dokumen" style="width: max-content; max-width: 80px; flex: 0 0 auto; white-space: nowrap; padding: 6px 12px; align-self: stretch; margin-bottom: 0; border-radius: 18px;">
                    Hapus
                  </button>
                ` : ''}
              </div>
            `;
          }

          return `
              <div
                class="document-item"
                data-action="view-doc"
                data-id="${document.id}"
                style="width: 100%; min-width: 0; cursor: pointer;"
              >
                <span class="attachment-icon">📄</span>
                <span style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                  <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${escapeHtml(formatDocumentType(document.document_type))}</strong>
                  <small style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">
                    ${escapeHtml(document.file_name || '-')}
                    ${document.generated_at ? ` • ${formatDateTime(document.generated_at)}` : ''}
                  </small>
                </span>
              </div>
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
          <a
            class="btn btn-primary"
            href="${escapeHtml(document.file_url || '#')}"
            target="_blank"
            rel="noopener noreferrer"
            data-modal-close
          >
            Buka PDF
          </a>
          <button class="btn btn-secondary" type="button" data-action="share-doc">
            Bagikan
          </button>
          <button class="btn btn-light" type="button" data-modal-close>
            Tutup
          </button>
        `,
        onMount: (modal) => {
          modal.querySelector('[data-action="share-doc"]')?.addEventListener('click', () => {
            const proofNumber = transaction.proof_number || 'Draft';
            const shareTitle = `Bend 26 Gabugan Bridge Kulon Progo - ${proofNumber}`;
            const shareUrl = document.file_url;
            const fullMessage = `${shareTitle}\n\n${shareUrl}`;

            if (navigator.share) {
              navigator.share({
                title: shareTitle,
                text: fullMessage
              }).catch(() => {
                navigator.share({ title: shareTitle, url: shareUrl });
              });
            } else {
              navigator.clipboard.writeText(fullMessage);
              alert('Link dan keterangan berhasil disalin ke clipboard.');
            }
          });
        }
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
              ${renderSignerOptions(mengetahuiDefaultId, 'mengetahui_menerima')}
            </select>
          </div>

          <div class="form-group">
            <label for="signer-bendahara">Bendahara Pengeluaran Pembantu</label>
            <select class="form-control" id="signer-bendahara">
              ${renderSignerOptions(bendaharaDefaultId, 'bendahara_pengeluaran_pembantu')}
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

  function renderSignerOptions(selectedId, position) {
    return state.signatories
      .filter((signer) => !position || signer.signer_position === position)
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

    const positionTitle = signer.position_title ? ` — ${signer.position_title}` : '';

    return `${signer.full_name}${positionTitle}${identity}`;
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

  async function handleViewDocument(documentId) {
    const document = state.transaction?.generated_documents?.find(d => d.id === documentId);
    if (!document) return;

    await showContentModal({
      title: formatDocumentType(document.document_type),
      message: document.file_name || 'Detail dokumen PDF.',
      tone: 'primary',
      bodyHtml: `
        <div class="success-doc-box">
          <strong>${escapeHtml(document.file_name || 'Dokumen.pdf')}</strong>
          <p style="margin-top: 8px; font-size: 13px; color: var(--text-soft);">
            Dibuat pada ${document.generated_at ? formatDateTime(document.generated_at) : '-'}<br>
            Tersimpan di Google Drive
          </p>
        </div>
      `,
      footerHtml: `
        <a
          class="btn btn-primary"
          href="${escapeHtml(document.file_url || '#')}"
          target="_blank"
          rel="noopener noreferrer"
          data-modal-close
        >
          Buka PDF
        </a>
        <button class="btn btn-secondary" type="button" data-action="share-doc">
          Bagikan
        </button>
        <button class="btn btn-light" type="button" data-modal-close>
          Tutup
        </button>
      `,
      onMount: (modal) => {
        modal.querySelector('[data-action="share-doc"]')?.addEventListener('click', () => {
          let shareTitle = 'Dokumen Kas Gabukan';
          if (document.document_type === 'bend_26') {
            shareTitle = `Bend 26 Gabugan Bridge Kulon Progo - ${state.transaction.proof_number || 'Draft'}`;
          } else if (document.document_type === 'buku_kas_bulanan') {
            shareTitle = `Buku Kas Gabugan Bridge Kulon Progo Bulanan ${state.transaction.period_month} ${state.transaction.period_year}`;
          }
          
          const shareUrl = document.file_url;
          const fullMessage = `${shareTitle}\n\n${shareUrl}`;

          if (navigator.share) {
            navigator.share({
              title: shareTitle,
              text: fullMessage
            }).catch(() => {
              navigator.share({ title: shareTitle, url: shareUrl });
            });
          } else {
            navigator.clipboard.writeText(fullMessage);
            alert('Link dan keterangan berhasil disalin ke clipboard.');
          }
        });
      }
    });
  }

  async function handleFinalize() {
    const ok = await showConfirmModal({
      title: 'Finalkan Transaksi?',
      message:
        'Setelah transaksi difinalkan, nomor bukti akan dibuat otomatis dan transaksi masuk ke buku kas.',
      confirmText: 'Ya, Finalkan',
      cancelText: 'Batal',
      tone: 'primary',
      cancelTone: 'secondary'
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
      cancelTone: 'secondary',
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
      tone: 'danger',
      cancelTone: 'secondary'
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
      tone: 'danger',
      cancelTone: 'secondary'
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

  async function handleEditTransaction() {
    const transaction = state.transaction;
    if (!transaction) return;

    try {
      setMessage('Memuat data pendukung...', 'info');
      const [categories, signatories] = await Promise.all([
        getActiveCategories(),
        getActiveSignatories()
      ]);
      hideMessage();

      const isIncome = transaction.type === 'masuk';
      const recipients = signatories.filter(s => s.signer_position === 'penerima' && s.is_active);

      await showContentModal({
        title: 'Edit Transaksi',
        message: 'Anda sedang mengedit transaksi yang sudah final. Perubahan akan dicatat dalam log.',
        tone: 'primary',
        bodyHtml: `
          <form id="edit-transaction-form" class="modal-form-grid">
            <div class="form-group">
              <label>Tanggal</label>
              <input type="date" name="transaction_date" class="form-control" value="${transaction.transaction_date}" required>
            </div>
            <div class="form-group">
              <label>Kategori</label>
              <select name="category_id" class="form-control">
                <option value="">Tanpa kategori</option>
                ${categories.filter(c => c.applies_to === 'all' || c.applies_to === transaction.type)
          .map(c => `<option value="${c.id}" ${c.id === transaction.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
          .join('')}
              </select>
            </div>
            <div class="form-group form-group-wide">
              <label>Uraian</label>
              <input type="text" name="description" class="form-control" value="${escapeHtml(transaction.description)}" required>
            </div>
            <div class="form-group">
              <label>Nominal</label>
              <input type="text" id="edit-amount-input" class="form-control" value="${formatRupiah(transaction.amount)}" required>
            </div>
            <div class="form-group">
              <label>${isIncome ? 'Sumber Dana' : 'Penerima'}</label>
              ${isIncome ? `
                <input type="text" name="party_name" class="form-control" value="${escapeHtml(transaction.party_name || '')}" required>
              ` : `
                <select id="edit-signer-id" class="form-control">
                  <option value="">Pilih penerima...</option>
                  ${recipients.map(s => `<option value="${s.id}" ${s.id === transaction.signer_penerima_id ? 'selected' : ''}>${escapeHtml(s.full_name)}</option>`).join('')}
                  <option value="new_manual" ${!transaction.signer_penerima_id ? 'selected' : ''}>Lainnya (Ketik Manual)</option>
                </select>
                <div id="edit-manual-wrap" class="${transaction.signer_penerima_id ? 'is-hidden' : ''}" style="margin-top: 8px;">
                  <input type="text" id="edit-manual-name" class="form-control" placeholder="Nama Penerima..." value="${escapeHtml(transaction.penerima_name_manual || '')}">
                </div>
              `}
            </div>
            <div class="form-group form-group-wide">
              <label>Rincian</label>
              <textarea name="notes" class="form-control" rows="2">${escapeHtml(transaction.notes || '')}</textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <div class="form-actions">
            <button class="btn btn-primary" type="button" id="submit-edit-btn">Simpan Perubahan</button>
            <button class="btn btn-secondary" type="button" data-modal-close>Batal</button>
          </div>
        `,
        onMount: (modalPage, { close }) => {
          const amountInput = modalPage.querySelector('#edit-amount-input');
          amountInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = formatRupiah(val);
          });

          const signerSelect = modalPage.querySelector('#edit-signer-id');
          const manualWrap = modalPage.querySelector('#edit-manual-wrap');
          signerSelect?.addEventListener('change', (e) => {
            if (e.target.value === 'new_manual') {
              manualWrap?.classList.remove('is-hidden');
            } else {
              manualWrap?.classList.add('is-hidden');
            }
          });

          modalPage.querySelector('#submit-edit-btn').addEventListener('click', async () => {
            const form = modalPage.querySelector('#edit-transaction-form');
            const formData = new FormData(form);

            const payload = {
              transaction_date: formData.get('transaction_date'),
              category_id: formData.get('category_id') || null,
              description: formData.get('description'),
              amount: parseRupiah(amountInput.value),
              notes: formData.get('notes')
            };

            if (isIncome) {
              payload.party_name = formData.get('party_name');
            } else {
              const sid = signerSelect.value;
              if (sid === 'new_manual') {
                payload.signer_penerima_id = null;
                payload.penerima_name_manual = modalPage.querySelector('#edit-manual-name').value;
                payload.party_name = payload.penerima_name_manual;
              } else if (sid) {
                const s = signatories.find(i => i.id === sid);
                payload.signer_penerima_id = sid;
                payload.party_name = s?.full_name || '';
              }
            }

            if (!payload.description || !payload.amount) {
              alert('Uraian dan Nominal wajib diisi.');
              return;
            }

            try {
              setMessage('Menyimpan perubahan...', 'info');
              await updateTransaction(transaction.id, payload);
              close();
              setMessage('Transaksi berhasil diperbarui.', 'success');
              await loadDetail();
            } catch (err) {
              setMessage(err.message || String(err), 'error');
            }
          });
        }
      });
    } catch (err) {
      setMessage(err.message || String(err), 'error');
    }
  }

  async function handleDeleteDocument(id) {
    if (!id) return;

    const ok = await showConfirmModal({
      title: 'Hapus Dokumen?',
      message: 'Apakah Anda yakin ingin menghapus dokumen PDF ini? Tindakan ini tidak bisa dibatalkan.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger',
      cancelTone: 'secondary'
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

  async function handleAdminDeleteTransaction() {
    const transaction = state.transaction;
    if (!transaction) return;

    const confirmed = await showConfirmModal({
      title: 'Hapus Transaksi Permanen?',
      message: `Tindakan ini tidak bisa dibatalkan. Transaksi "${transaction.description}" beserta seluruh nota dan dokumen PDF terkait akan dihapus bersih dari sistem.`,
      confirmText: 'Ya, Hapus Sekarang',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!confirmed) return;

    const loading = showLoadingModal({
      title: 'Menghapus Transaksi...',
      message: 'Sedang membersihkan data dan file nota dari sistem...',
      tone: 'danger'
    });

    try {
      await deleteTransactionAdmin(transaction.id);
      
      await loading.close();
      
      setMessage('Transaksi berhasil dihapus secara permanen.', 'success');
      
      setTimeout(() => {
        window.location.hash = 'transaksi';
      }, 1500);
    } catch (error) {
      await loading.close();
      setMessage('Gagal menghapus transaksi: ' + (error.message || String(error)), 'error');
    }
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