import {
  getActiveCategories,
  createTransaction,
  finalizeTransaction,
  getTransactionDetail
} from '../services/transaksi.js';

import {
  uploadTransactionNote
} from '../services/storage.js';

import { formatFileSize } from '../utils/image-compress.js';

import {
  getMasterData
} from '../services/master-data.js';

import {
  escapeHtml,
  getTodayInputDate,
  parseAmountInput,
  formatRupiah
} from '../utils/format.js';

import {
  showConfirmModal,
  showContentModal,
  showLoadingModal
} from '../utils/modal.js';

import {
  getActiveSignatories,
  generateBend26Pdf
} from '../services/pdf.js';

export function renderTambahTransaksiPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack tambah-transaksi-page';

  const state = {
    profile,
    categories: [],
    signatories: [],
    pendingNoteFile: null
  };

  page.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Pencatatan</p>
        <h1 class="page-title">Tambah Transaksi</h1>
        <p class="page-description">
          Catat kas masuk dan kas keluar baru. Setelah disimpan, Anda dapat mengelola detailnya di menu Daftar Transaksi.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="transaction-form-card">
      <form id="transaction-form" class="transaction-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="transaction_date">Tanggal</label>
            <input
              class="form-control"
              id="transaction_date"
              name="transaction_date"
              type="date"
              value="${getTodayInputDate()}"
              required
            />
          </div>

          <div class="form-group">
            <label for="type">Tipe</label>
            <select class="form-control" id="type" name="type" required>
              <option value="keluar">Kas Keluar</option>
              <option value="masuk">Kas Masuk</option>
            </select>
          </div>

          <div class="form-group">
            <label for="category_id">Jenis / Kategori</label>
            <select class="form-control" id="category_id" name="category_id">
              <option value="">Memuat kategori...</option>
            </select>
          </div>

          <div class="form-group">
            <label for="amount">Nominal</label>
            <input
              class="form-control"
              id="amount"
              name="amount"
              type="text"
              inputmode="numeric"
              placeholder="Contoh: 150000"
              required
            />
          </div>

          <div class="form-group form-group-wide">
            <label for="description">Uraian</label>
            <input
              class="form-control"
              id="description"
              name="description"
              type="text"
              placeholder="Contoh: Konsumsi rapat pengurus"
              required
            />
          </div>

          <div class="form-group form-group-wide" id="party-field-container">
            <label for="party_name">Penerima / Sumber Dana</label>
            <input
              class="form-control"
              id="party_name"
              name="party_name"
              type="text"
              placeholder="Contoh: Toko Makmur / Iuran anggota"
            />
          </div>

          <div class="form-group form-group-wide">
            <label for="notes">Rincian</label>
            <textarea
              class="form-control"
              id="notes"
              name="notes"
              rows="3"
              placeholder="Opsional"
            ></textarea>
          </div>

          <div class="form-group form-group-wide" style="margin-top: 16px;">
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                  <strong style="display: block; color: var(--text-heading); font-size: 15px; margin-bottom: 2px;">Foto Nota</strong>
                  <span style="color: var(--text-muted); font-size: 13px;">Opsional. Pilih nota untuk transaksi ini.</span>
                </div>
              </div>
              <div id="pending-note-preview" style="display: none; align-items: center; gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--gray-50); border: 1px dashed var(--gray-300); border-radius: 12px;">
                <span style="font-size: 20px;">📄</span>
                <div style="display: flex; flex-direction: column; overflow: hidden;">
                  <strong id="pending-note-name" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--gray-800);"></strong>
                  <small id="pending-note-size" style="font-size: 12px; color: var(--gray-500);"></small>
                </div>
                <button type="button" id="btn-cancel-note" class="btn btn-small btn-light" style="margin-left: auto; padding: 4px 8px;">Batal</button>
              </div>
              <button class="btn btn-light full-width" type="button" id="btn-pick-note">
                Pilih Foto Nota
              </button>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit" id="extra-action-btn">
            Simpan & Generate Bend 26
          </button>
          <button class="btn btn-secondary" type="submit" id="finalize-transaction-btn">
            Simpan & Finalkan
          </button>
          <button class="btn btn-light" type="submit" id="save-transaction-btn">
            Simpan Draft
          </button>
        </div>
      </form>
    </section>
  `;

  bindEvents();
  loadInitialData();

  return page;

  function bindEvents() {
    const form = page.querySelector('#transaction-form');
    const typeInput = page.querySelector('#type');
    const amountInput = page.querySelector('#amount');

    amountInput?.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = formatRupiah(val);
    });

    const extraBtn = page.querySelector('#extra-action-btn');
    const finalizeBtn = page.querySelector('#finalize-transaction-btn');
    const saveBtn = page.querySelector('#save-transaction-btn');

    const btnPickNote = page.querySelector('#btn-pick-note');
    const btnCancelNote = page.querySelector('#btn-cancel-note');
    const pendingPreview = page.querySelector('#pending-note-preview');
    const pendingName = page.querySelector('#pending-note-name');
    const pendingSize = page.querySelector('#pending-note-size');

    btnPickNote?.addEventListener('click', async () => {
      const file = await pickImageFile();
      if (!file) return;

      const ok = await showConfirmModal({
        title: 'Upload Foto Nota?',
        message: `File akan otomatis diupload saat Anda menekan tombol Simpan. File: ${file.name} (${formatFileSize(file.size)}).`,
        confirmText: 'Pilih Foto',
        cancelText: 'Batal',
        tone: 'primary'
      });

      if (ok) {
        state.pendingNoteFile = file;
        pendingName.textContent = file.name;
        pendingSize.textContent = formatFileSize(file.size);
        pendingPreview.style.display = 'flex';
        btnPickNote.style.display = 'none';
      }
    });

    btnCancelNote?.addEventListener('click', () => {
      state.pendingNoteFile = null;
      pendingPreview.style.display = 'none';
      btnPickNote.style.display = 'block';
    });

    const updateFormActions = () => {
      const type = typeInput.value;
      const isKeluar = type === 'keluar';
      const canFinalize = ['admin', 'bendahara'].includes(profile?.role);

      if (isKeluar) {
        // Keluar: Generate (PT), Final (ST), Draft (Light)
        extraBtn.style.display = canFinalize ? 'inline-flex' : 'none';
        extraBtn.className = 'btn btn-primary';
        extraBtn.textContent = 'Simpan & Generate Bend 26';

        finalizeBtn.style.display = canFinalize ? 'inline-flex' : 'none';
        finalizeBtn.className = 'btn btn-secondary';
        finalizeBtn.textContent = 'Simpan & Finalkan';

        saveBtn.className = 'btn btn-light';
        saveBtn.textContent = 'Simpan Draft';
      } else {
        // Masuk: Final (PT), Draft (ST), Extra (Hidden)
        extraBtn.style.display = 'none';

        finalizeBtn.style.display = canFinalize ? 'inline-flex' : 'none';
        finalizeBtn.className = 'btn btn-primary';
        finalizeBtn.textContent = 'Simpan & Finalkan';

        saveBtn.className = 'btn btn-secondary';
        saveBtn.textContent = 'Simpan Draft';
      }
    };

    typeInput?.addEventListener('change', () => {
      renderCategoryOptions(typeInput.value);
      renderPartyField(typeInput.value);
      updateFormActions();
    });
    updateFormActions();

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleCreateTransaction(event);
    });

    extraBtn?.addEventListener('click', async (e) => {
      // Logic for extraBtn is now only for Generate Bend 26 as Reset Form is gone from here
      // But we keep the condition just in case it's used elsewhere
      if (extraBtn.textContent === 'Reset Form') {
        e.preventDefault();
        const confirmed = await showConfirmModal({
          title: 'Reset Form',
          message: 'Apakah Anda yakin ingin mengosongkan kembali seluruh isi form?',
          confirmText: 'Ya, Reset',
          cancelText: 'Batal',
          type: 'warning'
        });

        if (confirmed) {
          resetForm();
        }
      }
    });
  }

  async function loadInitialData() {
    try {
      setMessage('Memuat kategori...', 'info');

      const masterData = await getMasterData();
      state.categories = masterData.categories;
      state.signatories = masterData.signatories;

      renderCategoryOptions(page.querySelector('#type')?.value || 'masuk');
      renderPartyField(page.querySelector('#type')?.value || 'masuk');

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleCreateTransaction(event) {
    const form = event.currentTarget;
    const submitter = event.submitter;
    const formData = new FormData(form);

    const amountValue = formData.get('amount');
    const amount = parseAmountInput(amountValue);

    if (!amount) {
      setMessage('Nominal harus lebih dari 0.', 'error');
      return;
    }

    const payload = {
      transaction_date: formData.get('transaction_date'),
      type: formData.get('type'),
      category_id: formData.get('category_id') || null,
      description: String(formData.get('description') || '').trim(),
      amount,
      notes: String(formData.get('notes') || '').trim()
    };

    if (payload.type === 'masuk') {
      payload.party_name = String(formData.get('party_name') || '').trim();
    } else {
      const signerId = formData.get('signer_penerima_id');
      if (signerId === 'new_manual') {
        payload.signer_penerima_id = null;
        payload.penerima_name_manual = String(page.querySelector('#penerima_name_manual')?.value || '').trim();
        payload.party_name = payload.penerima_name_manual;
      } else if (signerId) {
        const signer = state.signatories.find((s) => s.id === signerId);
        payload.signer_penerima_id = signerId;
        payload.party_name = signer?.full_name || '';
      }
    }

    if (!payload.description) {
      setMessage('Uraian wajib diisi.', 'error');
      return;
    }

    if (payload.type === 'keluar' && !payload.party_name) {
      setMessage('Nama penerima wajib diisi.', 'error');
      return;
    }

    try {
      const isDirectFinal = submitter?.id === 'finalize-transaction-btn' || submitter?.id === 'extra-action-btn';
      const isGenerateAction = submitter?.id === 'extra-action-btn' && payload.type === 'keluar';

      const saveBtn = page.querySelector('#save-transaction-btn');
      const finalBtn = page.querySelector('#finalize-transaction-btn');
      const extraBtn = page.querySelector('#extra-action-btn');

      if (saveBtn) saveBtn.disabled = true;
      if (finalBtn) finalBtn.disabled = true;
      if (extraBtn) extraBtn.disabled = true;

      const transaction = await createTransaction(payload);
      let finalTransaction = transaction;

      if (isDirectFinal) {
        finalTransaction = await finalizeTransaction(transaction.id);
      }

      if (state.pendingNoteFile) {
        setMessage('Mengompres dan mengupload foto nota...', 'info');
        await uploadTransactionNote({
          transaction: finalTransaction,
          file: state.pendingNoteFile
        });
        setMessage('Foto nota berhasil diupload.', 'success');
        
        // Refresh transaction data to include the new attachment before generating PDF
        finalTransaction = await getTransactionDetail(finalTransaction.id);
      }

      if (isGenerateAction) {
        await handleGenerateBend26AfterCreate(finalTransaction);
        return; // Redirect handled by generation success modal
      }

      if (isDirectFinal) {
        setMessage('Transaksi berhasil disimpan dan difinalkan.', 'success');
      } else {
        setMessage('Draft transaksi berhasil disimpan.', 'success');
      }

      resetForm();

      setTimeout(() => {
        window.location.hash = '#transaksi';
      }, 1500);

    } catch (error) {
      setMessage(error.message || String(error), 'error');
      const saveBtn = page.querySelector('#save-transaction-btn');
      const finalBtn = page.querySelector('#finalize-transaction-btn');
      if (saveBtn) saveBtn.disabled = false;
      if (finalBtn) finalBtn.disabled = false;
      submitter.textContent = submitter.id === 'finalize-transaction-btn' ? 'Simpan & Finalkan' : 'Simpan Draft';
    }
  }

  function renderCategoryOptions(type) {
    const categoryInput = page.querySelector('#category_id');
    if (!categoryInput) return;

    const filteredCategories = state.categories.filter((category) => {
      return !category.applies_to || category.applies_to === 'all' || category.applies_to === type;
    });

    categoryInput.innerHTML = `
      <option value="">Tanpa kategori</option>
      ${filteredCategories
        .map((category) => {
          return `
            <option value="${category.id}">
              ${escapeHtml(category.name)}
            </option>
          `;
        })
        .join('')}
    `;
  }

  function renderPartyField(type) {
    const container = page.querySelector('#party-field-container');
    if (!container) return;

    if (type === 'masuk') {
      container.innerHTML = `
        <label for="party_name">Sumber Dana</label>
        <input
          class="form-control"
          id="party_name"
          name="party_name"
          type="text"
          placeholder="Contoh: Iuran anggota / Hibah"
        />
      `;
    } else {
      const recipientSigners = state.signatories.filter(
        (s) => s.signer_position === 'penerima' && s.is_active
      );

      container.innerHTML = `
        <label for="signer_penerima_id">Penerima</label>
        <select class="form-control" id="signer_penerima_id" name="signer_penerima_id">
          <option value="">Pilih penerima...</option>
          ${recipientSigners
          .map(
            (s) => `
              <option value="${s.id}">
                ${escapeHtml(s.full_name)}
              </option>
            `
          )
          .join('')}
          <option value="new_manual">Lainnya (Ketik Manual)</option>
        </select>
        
        <div id="manual-recipient-container" class="form-group is-hidden" style="margin-top: 10px; margin-bottom: 0;">
          <input 
            type="text" 
            id="penerima_name_manual" 
            class="form-control" 
            placeholder="Ketik Nama Penerima..."
          >
        </div>
      `;

      container.querySelector('#signer_penerima_id')?.addEventListener('change', (e) => {
        const manualContainer = container.querySelector('#manual-recipient-container');
        if (e.target.value === 'new_manual') {
          manualContainer?.classList.remove('is-hidden');
          manualContainer?.querySelector('input')?.focus();
        } else {
          manualContainer?.classList.add('is-hidden');
        }
      });
    }
  }

  async function handleGenerateBend26AfterCreate(transaction) {
    const signatories = await getActiveSignatories();

    const getDefaultSignerId = (pos) => {
      return signatories.find(s => s.signer_position === pos && s.is_default)?.id ||
             signatories.find(s => s.signer_position === pos)?.id;
    };

    const renderSignerOptions = (selectedId, pos) => {
      const filtered = signatories.filter(s => s.signer_position === pos);
      return filtered.map(s => `
        <option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>
          ${escapeHtml(s.full_name)} (${escapeHtml(s.position_title)})
        </option>
      `).join('');
    };

    const mengetahuiDefaultId = getDefaultSignerId('mengetahui_menerima');
    const bendaharaDefaultId = getDefaultSignerId('bendahara_pengeluaran_pembantu') || mengetahuiDefaultId;

    await showContentModal({
      title: 'Generate Bend 26',
      message: 'Pilih penandatangan untuk Bend 26 yang baru saja disimpan.',
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
            <span>No Bukti: ${escapeHtml(transaction.proof_number || '-')}</span>
            <span>Uraian: ${escapeHtml(transaction.description || '-')}</span>
            <span>Nominal: ${formatRupiah(transaction.amount)}</span>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-primary" type="button" id="start-generate-btn">
          Mulai Generate PDF
        </button>
        <button class="btn btn-light" type="button" data-modal-close>
          Lompati (Ke Detail)
        </button>
      `,
      onMount: (modal, { close }) => {
        // Special case: if user closes modal without generating, still redirect to detail
        const skipBtn = modal.querySelector('[data-modal-close]');
        skipBtn?.addEventListener('click', () => {
          window.location.hash = `detail-transaksi/${transaction.id}`;
        });

        modal.querySelector('#start-generate-btn')?.addEventListener('click', async (e) => {
          const signerMengetahuiId = modal.querySelector('#signer-mengetahui').value;
          const signerBendaharaId = modal.querySelector('#signer-bendahara').value;

          const loading = showLoadingModal({
            title: 'Menghasilkan Bend 26',
            message: 'Sedang memproses dokumen PDF...',
            tone: 'primary'
          });

          try {
            const doc = await generateBend26Pdf({
              transaction,
              signerMengetahuiId,
              signerBendaharaId
            });

            await loading.close();
            await close();
            await showSuccessGenerationModal(transaction, doc);
          } catch (err) {
            await loading.close();
            alert('Gagal generate: ' + err.message);
          }
        });
      }
    });
  }

  async function showSuccessGenerationModal(transaction, doc) {
    const redirectToDetail = () => {
      window.location.hash = `detail-transaksi/${transaction.id}`;
    };

    await showContentModal({
      title: 'Bend 26 Berhasil Dibuat',
      message: doc.file_name || 'PDF Bend 26 berhasil dibuat.',
      tone: 'primary',
      bodyHtml: `
        <div class="success-doc-box">
          <strong>${escapeHtml(doc.file_name || 'Bend 26.pdf')}</strong>
          <span>Dokumen sudah tersimpan di Google Drive.</span>
        </div>
      `,
      footerHtml: `
        <a class="btn btn-primary" href="${escapeHtml(doc.file_url)}" target="_blank" rel="noopener noreferrer" data-action="open-pdf">
          Buka PDF
        </a>
        <button class="btn btn-secondary" type="button" data-action="share-doc">
          Bagikan
        </button>
        <button class="btn btn-light" type="button" data-modal-close>
          Tutup
        </button>
      `,
      onMount: (modal, { close }) => {
        // Handle Share
        modal.querySelector('[data-action="share-doc"]')?.addEventListener('click', async () => {
          const shareTitle = `Bend 26 - ${transaction.proof_number || 'Draft'}`;
          const shareUrl = doc.file_url;
          const fullMessage = `${shareTitle}\n\n${shareUrl}`;

          if (navigator.share) {
            try {
              await navigator.share({ title: shareTitle, text: fullMessage });
            } catch (err) {
              console.log('Share canceled or failed');
            }
          } else {
            navigator.clipboard.writeText(fullMessage);
            alert('Link disalin ke clipboard.');
          }
        });

        // Add redirect listener to ALL action buttons/links
        modal.querySelectorAll('.btn').forEach(btn => {
          btn.addEventListener('click', () => {
             // Delay redirect slightly if opening PDF in new tab
             if (btn.getAttribute('data-action') === 'open-pdf') {
                setTimeout(redirectToDetail, 500);
             } else {
                redirectToDetail();
             }
          });
        });

        // Also handle the Backdrop click if possible, or just the buttons
      }
    });
  }

  function resetForm() {
    const form = page.querySelector('#transaction-form');
    if (!form) return;

    form.reset();
    page.querySelector('#transaction_date').value = getTodayInputDate();
    renderCategoryOptions(page.querySelector('#type')?.value || 'masuk');
    renderPartyField(page.querySelector('#type')?.value || 'masuk');

    state.pendingNoteFile = null;
    const btnPickNote = page.querySelector('#btn-pick-note');
    const pendingPreview = page.querySelector('#pending-note-preview');
    if (btnPickNote) btnPickNote.style.display = 'block';
    if (pendingPreview) pendingPreview.style.display = 'none';
  }

  function setMessage(message, type = 'info') {
    const messageBox = page.querySelector('#message-box');
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
    messageBox.classList.remove('is-hidden');
  }

  function hideMessage() {
    const messageBox = page.querySelector('#message-box');
    if (!messageBox) return;

    messageBox.className = 'message-box is-hidden';
    messageBox.textContent = '';
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
}
