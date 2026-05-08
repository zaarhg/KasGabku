import {
  getMasterData,
  updateOrganization,
  createCategory,
  updateCategory,
  setCategoryActive,
  createSignatory,
  updateSignatory,
  setSignatoryActive,
  setDefaultSignatory,
  deleteCategory,
  deleteSignatory
} from '../services/master-data.js';

import {
  escapeHtml,
  formatDateTime
} from '../utils/format.js';

import {
  showConfirmModal,
  showContentModal
} from '../utils/modal.js';

export function renderMasterDataPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack master-data-page';

  const state = {
    profile,
    organization: null,
    categories: [],
    signatories: [],
    editingCategoryId: null,
    editingSignatoryId: null
  };

  page.innerHTML = `
    <div class="page-header master-data-page-header">
      <div>
        <p class="eyebrow">Pengaturan</p>
        <h1 class="page-title">Master Data</h1>
        <p class="page-description">
          Kelola data organisasi, jenis transaksi, dan penandatangan dokumen.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="master-overview-grid">
      <article class="master-card master-organization-card">
        <div class="section-heading">
          <div>
            <h2>Data Organisasi</h2>
            <p>Data ini dipakai untuk PDF Bend 26 dan Buku Kas Bulanan.</p>
          </div>
        </div>

        <form id="organization-form" class="master-organization-form">
          <div class="form-group form-group-wide">
            <label for="org-name">Nama Organisasi</label>
            <input class="form-control" id="org-name" name="name" required />
          </div>

          <div class="form-group">
            <label for="org-short-name">Singkatan</label>
            <input class="form-control" id="org-short-name" name="short_name" required />
          </div>

          <div class="form-group">
            <label for="org-city">Kota/Kabupaten</label>
            <input class="form-control" id="org-city" name="city" placeholder="Kulon Progo" />
          </div>

          <div class="form-group form-group-wide">
            <label for="org-address">Alamat</label>
            <textarea class="form-control" id="org-address" name="address" rows="3"></textarea>
          </div>

          <div class="form-actions form-group-wide">
            <button class="btn btn-primary" type="submit" id="save-org-btn">
              Simpan Data Organisasi
            </button>
          </div>
        </form>
      </article>

      <aside class="master-card master-status-card">
        <div class="section-heading compact">
          <div>
            <h2>Ringkasan Master</h2>
            <p>Status data yang dipakai aplikasi.</p>
          </div>
        </div>

        <div id="master-status-list">
          <div class="empty-mini">Memuat ringkasan master data...</div>
        </div>
      </aside>
    </section>

    <div class="master-two-columns">
      <section class="master-card">
        <div class="section-heading">
          <div>
            <h2>Jenis / Kategori</h2>
            <p>Dipakai sebagai dropdown pada form transaksi.</p>
          </div>
        </div>

        <form id="category-form" class="master-inline-form">
          <div class="form-group">
            <label for="category-name">Nama Kategori</label>
            <input
              class="form-control"
              id="category-name"
              name="name"
              placeholder="Contoh: Konsumsi"
              required
            />
          </div>

          <div class="form-group">
            <label for="category-applies-to">Berlaku Untuk</label>
            <select class="form-control" id="category-applies-to" name="applies_to">
              <option value="all">Kas Masuk & Keluar</option>
              <option value="masuk">Kas Masuk</option>
              <option value="keluar">Kas Keluar</option>
            </select>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="save-category-btn">
              Tambah Kategori
            </button>
            <button class="btn btn-light is-hidden" type="button" id="cancel-category-btn">
              Batal Edit
            </button>
          </div>
        </form>

        <div class="master-list-heading">
          <strong>Daftar Kategori</strong>
          <span id="category-count-label">Memuat...</span>
        </div>

        <div class="table-responsive master-table-wrap">
          <table class="data-table master-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Berlaku</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="category-body">
              <tr>
                <td colspan="4">Memuat kategori...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="master-card">
        <div class="section-heading">
          <div>
            <h2>Penandatangan</h2>
            <p>Dipakai untuk Bend 26 dan Buku Kas Bulanan.</p>
          </div>
        </div>

        <form id="signatory-form" class="master-signatory-form">
          <div class="form-group">
            <label for="signatory-name">Nama Lengkap & Gelar</label>
            <input
              class="form-control"
              id="signatory-name"
              name="full_name"
              placeholder="Contoh: Drs. Nama Pengurus"
              required
            />
          </div>

          <div class="form-group">
            <label for="signatory-title">Jabatan</label>
            <input
              class="form-control"
              id="signatory-title"
              name="position_title"
              placeholder="Contoh: Bendahara"
              required
            />
          </div>

          <div class="form-group">
            <label for="identity-type">Jenis Identitas</label>
            <input
              class="form-control"
              id="identity-type"
              name="identity_type"
              placeholder="NIP/NIK"
              value="NIP/NIK"
            />
          </div>

          <div class="form-group">
            <label for="identity-number">Nomor Identitas</label>
            <input
              class="form-control"
              id="identity-number"
              name="identity_number"
              placeholder="Boleh dikosongkan"
            />
          </div>

          <div class="form-group form-group-wide">
            <label for="signer-position">Posisi di Dokumen</label>
            <select class="form-control" id="signer-position" name="signer_position">
              <option value="mengetahui_menerima">Mengetahui / Menerima</option>
              <option value="bendahara_pengeluaran_pembantu">Bendahara Pengeluaran Pembantu</option>
            </select>
          </div>

          <label class="checkbox-line">
            <input type="checkbox" id="is-default-signer" name="is_default" />
            <span>Jadikan default untuk posisi ini</span>
          </label>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="save-signatory-btn">
              Tambah Penandatangan
            </button>
            <button class="btn btn-light is-hidden" type="button" id="cancel-signatory-btn">
              Batal Edit
            </button>
          </div>
        </form>

        <div class="master-list-heading">
          <strong>Daftar Penandatangan</strong>
          <span id="signatory-count-label">Memuat...</span>
        </div>

        <div class="table-responsive master-table-wrap">
          <table class="data-table master-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Posisi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="signatory-body">
              <tr>
                <td colspan="4">Memuat penandatangan...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  bindEvents();
  loadData();

  return page;

  function bindEvents() {
    page.querySelector('#organization-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleSaveOrganization(event.currentTarget);
    });

    page.querySelector('#category-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleSaveCategory(event.currentTarget);
    });

    page.querySelector('#cancel-category-btn')?.addEventListener('click', () => {
      resetCategoryForm();
    });

    page.querySelector('#signatory-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleSaveSignatory(event.currentTarget);
    });

    page.querySelector('#cancel-signatory-btn')?.addEventListener('click', () => {
      resetSignatoryForm();
    });

    page.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === 'edit-category') {
        fillCategoryForm(id);
      }

      if (action === 'toggle-category') {
        await handleToggleCategory(id);
      }

      if (action === 'edit-signatory') {
        fillSignatoryForm(id);
      }

      if (action === 'toggle-signatory') {
        await handleToggleSignatory(id);
      }

      if (action === 'set-default-signatory') {
        await handleSetDefaultSignatory(id);
      }

      if (action === 'delete-category') {
        await handleDeleteCategory(id);
      }

      if (action === 'delete-signatory') {
        await handleDeleteSignatory(id);
      }
    });
  }

  async function loadData() {
    try {
      setMessage('Memuat master data...', 'info');

      const data = await getMasterData();

      state.organization = data.organization;
      state.categories = data.categories;
      state.signatories = data.signatories;

      fillOrganizationForm();
      renderStatusList();
      renderCategories();
      renderSignatories();

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderStatusError();
      renderCategoriesError();
      renderSignatoriesError();
    }
  }

  function fillOrganizationForm() {
    const organization = state.organization || {};

    page.querySelector('#org-name').value = organization.name || '';
    page.querySelector('#org-short-name').value = organization.short_name || '';
    page.querySelector('#org-city').value = organization.city || 'Kulon Progo';
    page.querySelector('#org-address').value = organization.address || '';
  }

  function renderStatusList() {
    const root = page.querySelector('#master-status-list');
    if (!root) return;

    const activeCategories = state.categories.filter((item) => item.is_active).length;
    const inactiveCategories = state.categories.length - activeCategories;
    const activeSignatories = state.signatories.filter((item) => item.is_active).length;
    const defaultSignatories = state.signatories.filter((item) => item.is_default).length;

    root.innerHTML = `
      <div class="master-status-list">
        <div class="master-status-item">
          <span>Organisasi</span>
          <strong>${escapeHtml(state.organization?.short_name || state.organization?.name || '-')}</strong>
        </div>

        <div class="master-status-item">
          <span>Kategori Aktif</span>
          <strong>${activeCategories}</strong>
          <small>${inactiveCategories} nonaktif</small>
        </div>

        <div class="master-status-item">
          <span>Penandatangan Aktif</span>
          <strong>${activeSignatories}</strong>
          <small>${defaultSignatories} default</small>
        </div>

        <div class="master-status-item">
          <span>Terakhir Update Organisasi</span>
          <strong>${state.organization?.updated_at ? formatDateTime(state.organization.updated_at) : '-'}</strong>
        </div>
      </div>
    `;
  }

  function renderStatusError() {
    const root = page.querySelector('#master-status-list');
    if (!root) return;

    root.innerHTML = `
      <div class="empty-mini">
        Gagal memuat ringkasan master data.
      </div>
    `;
  }

  async function handleSaveOrganization(form) {
    const button = page.querySelector('#save-org-btn');
    const formData = new FormData(form);

    const payload = {
      name: formData.get('name'),
      short_name: formData.get('short_name'),
      city: formData.get('city'),
      address: formData.get('address')
    };

    if (!String(payload.name || '').trim()) {
      setMessage('Nama organisasi wajib diisi.', 'error');
      return;
    }

    if (!String(payload.short_name || '').trim()) {
      setMessage('Singkatan organisasi wajib diisi.', 'error');
      return;
    }

    try {
      button.disabled = true;
      button.textContent = 'Menyimpan...';

      await updateOrganization(payload);
      setMessage('Data organisasi berhasil disimpan.', 'success');

      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Simpan Data Organisasi';
    }
  }

  async function handleSaveCategory(form) {
    const button = page.querySelector('#save-category-btn');
    const formData = new FormData(form);

    const payload = {
      name: formData.get('name'),
      applies_to: formData.get('applies_to')
    };

    if (!String(payload.name || '').trim()) {
      setMessage('Nama kategori wajib diisi.', 'error');
      return;
    }

    const wasEditing = Boolean(state.editingCategoryId);

    try {
      button.disabled = true;
      button.textContent = wasEditing ? 'Menyimpan...' : 'Menambah...';

      if (state.editingCategoryId) {
        await updateCategory(state.editingCategoryId, payload);
        setMessage('Kategori berhasil diperbarui.', 'success');
      } else {
        await createCategory(payload);
        setMessage('Kategori berhasil ditambahkan.', 'success');
      }

      resetCategoryForm();
      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    } finally {
      button.disabled = false;
      button.textContent = state.editingCategoryId ? 'Simpan Perubahan' : 'Tambah Kategori';
    }
  }

  async function handleToggleCategory(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;

    const willActivate = !category.is_active;

    const ok = await showConfirmModal({
      title: willActivate ? 'Aktifkan Kategori?' : 'Nonaktifkan Kategori?',
      message: willActivate
        ? 'Kategori akan muncul kembali pada form transaksi.'
        : 'Kategori tidak akan muncul pada transaksi baru, tetapi data transaksi lama tetap aman.',
      confirmText: willActivate ? 'Aktifkan' : 'Nonaktifkan',
      cancelText: 'Batal',
      tone: willActivate ? 'primary' : 'danger'
    });

    if (!ok) return;

    try {
      await setCategoryActive(categoryId, willActivate);
      setMessage(
        willActivate ? 'Kategori berhasil diaktifkan.' : 'Kategori berhasil dinonaktifkan.',
        'success'
      );
      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleDeleteCategory(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;

    const ok = await showConfirmModal({
      title: 'Hapus Kategori?',
      message: `Apakah Anda yakin ingin menghapus kategori "${category.name}"? Tindakan ini tidak bisa dibatalkan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      setMessage('Menghapus kategori...', 'info');
      await deleteCategory(categoryId);
      setMessage('Kategori berhasil dihapus.', 'success');
      await loadData();
    } catch (error) {
      if (error.message.includes('digunakan dalam transaksi')) {
        await showContentModal({
          title: 'Kategori Sedang Digunakan',
          message: error.message,
          tone: 'warning'
        });
      } else {
        setMessage(error.message || String(error), 'error');
      }
    }
  }

  async function handleDeleteSignatory(signatoryId) {
    const signatory = state.signatories.find((item) => item.id === signatoryId);
    if (!signatory) return;

    const ok = await showConfirmModal({
      title: 'Hapus Penandatangan?',
      message: `Apakah Anda yakin ingin menghapus "${signatory.full_name}"? Tindakan ini tidak bisa dibatalkan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      if (!signatoryId) throw new Error('ID penandatangan tidak ditemukan.');
      
      setMessage('Menghapus penandatangan...', 'info');
      await deleteSignatory(signatoryId);
      setMessage('Penandatangan berhasil dihapus.', 'success');
      
      await loadData();
    } catch (error) {
      console.error('Delete signatory error:', error);
      if (error.message.includes('tercatat dalam') || error.message.includes('dokumen PDF')) {
        await showContentModal({
          title: 'Nama Masih Digunakan',
          message: error.message,
          tone: 'warning'
        });
      } else {
        setMessage(error.message || String(error), 'error');
      }
    }
  }

  function fillCategoryForm(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;

    state.editingCategoryId = category.id;

    page.querySelector('#category-name').value = category.name || '';
    page.querySelector('#category-applies-to').value = category.applies_to || 'all';

    page.querySelector('#save-category-btn').textContent = 'Simpan Perubahan';
    page.querySelector('#cancel-category-btn').classList.remove('is-hidden');
    page.querySelector('#category-name')?.focus();
  }

  function resetCategoryForm() {
    state.editingCategoryId = null;

    page.querySelector('#category-form')?.reset();
    page.querySelector('#category-applies-to').value = 'all';
    page.querySelector('#save-category-btn').textContent = 'Tambah Kategori';
    page.querySelector('#cancel-category-btn').classList.add('is-hidden');
  }

  async function handleSaveSignatory(form) {
    const button = page.querySelector('#save-signatory-btn');
    const formData = new FormData(form);

    const payload = {
      full_name: formData.get('full_name'),
      position_title: formData.get('position_title'),
      identity_type: formData.get('identity_type'),
      identity_number: formData.get('identity_number'),
      signer_position: formData.get('signer_position'),
      is_default: page.querySelector('#is-default-signer')?.checked || false
    };

    if (!String(payload.full_name || '').trim()) {
      setMessage('Nama penandatangan wajib diisi.', 'error');
      return;
    }

    if (!String(payload.position_title || '').trim()) {
      setMessage('Jabatan penandatangan wajib diisi.', 'error');
      return;
    }

    const wasEditing = Boolean(state.editingSignatoryId);

    try {
      button.disabled = true;
      button.textContent = wasEditing ? 'Menyimpan...' : 'Menambah...';

      if (state.editingSignatoryId) {
        await updateSignatory(state.editingSignatoryId, payload);
        setMessage('Penandatangan berhasil diperbarui.', 'success');
      } else {
        await createSignatory(payload);
        setMessage('Penandatangan berhasil ditambahkan.', 'success');
      }

      resetSignatoryForm();
      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    } finally {
      button.disabled = false;
      button.textContent = state.editingSignatoryId
        ? 'Simpan Perubahan'
        : 'Tambah Penandatangan';
    }
  }

  async function handleToggleSignatory(signatoryId) {
    const signatory = state.signatories.find((item) => item.id === signatoryId);
    if (!signatory) return;

    const willActivate = !signatory.is_active;

    const ok = await showConfirmModal({
      title: willActivate ? 'Aktifkan Penandatangan?' : 'Nonaktifkan Penandatangan?',
      message: willActivate
        ? 'Nama ini akan bisa dipilih kembali saat generate PDF.'
        : 'Nama ini tidak akan muncul pada pilihan generate PDF, tetapi dokumen lama tetap aman.',
      confirmText: willActivate ? 'Aktifkan' : 'Nonaktifkan',
      cancelText: 'Batal',
      tone: willActivate ? 'primary' : 'danger'
    });

    if (!ok) return;

    try {
      await setSignatoryActive(signatoryId, willActivate);
      setMessage(
        willActivate
          ? 'Penandatangan berhasil diaktifkan.'
          : 'Penandatangan berhasil dinonaktifkan.',
        'success'
      );
      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  async function handleSetDefaultSignatory(signatoryId) {
    const signatory = state.signatories.find((item) => item.id === signatoryId);
    if (!signatory) return;

    const ok = await showConfirmModal({
      title: 'Jadikan Default?',
      message:
        'Nama ini akan dipilih otomatis untuk posisi dokumen yang sesuai.',
      confirmText: 'Jadikan Default',
      cancelText: 'Batal',
      tone: 'primary'
    });

    if (!ok) return;

    try {
      await setDefaultSignatory(signatory.id, signatory.signer_position);
      setMessage('Default penandatangan berhasil diperbarui.', 'success');
      await loadData();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  function fillSignatoryForm(signatoryId) {
    const signatory = state.signatories.find((item) => item.id === signatoryId);
    if (!signatory) return;

    state.editingSignatoryId = signatory.id;

    page.querySelector('#signatory-name').value = signatory.full_name || '';
    page.querySelector('#signatory-title').value = signatory.position_title || '';
    page.querySelector('#identity-type').value = signatory.identity_type || 'NIP/NIK';
    page.querySelector('#identity-number').value = signatory.identity_number || '';
    page.querySelector('#signer-position').value = signatory.signer_position;
    page.querySelector('#is-default-signer').checked = Boolean(signatory.is_default);

    page.querySelector('#save-signatory-btn').textContent = 'Simpan Perubahan';
    page.querySelector('#cancel-signatory-btn').classList.remove('is-hidden');
    page.querySelector('#signatory-name')?.focus();
  }

  function resetSignatoryForm() {
    state.editingSignatoryId = null;

    page.querySelector('#signatory-form')?.reset();
    page.querySelector('#identity-type').value = 'NIP/NIK';
    page.querySelector('#signer-position').value = 'mengetahui_menerima';
    page.querySelector('#is-default-signer').checked = false;
    page.querySelector('#save-signatory-btn').textContent = 'Tambah Penandatangan';
    page.querySelector('#cancel-signatory-btn').classList.add('is-hidden');
  }

  function renderCategories() {
    const body = page.querySelector('#category-body');
    const countLabel = page.querySelector('#category-count-label');

    if (countLabel) {
      const active = state.categories.filter((item) => item.is_active).length;
      countLabel.textContent = `${state.categories.length} kategori • ${active} aktif`;
    }

    if (!body) return;

    if (!state.categories.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">Belum ada kategori.</div>
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = state.categories
      .map((category) => {
        return `
          <tr class="${category.is_active ? '' : 'row-muted'}">
            <td>
              <strong>${escapeHtml(category.name)}</strong>
              <small>${category.updated_at ? `Diubah ${formatDateTime(category.updated_at)}` : ''}</small>
            </td>
            <td>${escapeHtml(formatAppliesTo(category.applies_to))}</td>
            <td>
              <span class="badge ${category.is_active ? 'badge-success' : 'badge-muted'}">
                ${category.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </td>
            <td>
              <div class="actions-row master-action-row">
                <button class="btn btn-small btn-light" type="button" data-action="edit-category" data-id="${category.id}" title="Edit">
                  Edit
                </button>
                <button class="btn btn-small ${category.is_active ? 'btn-light' : 'btn-primary'}" type="button" data-action="toggle-category" data-id="${category.id}" title="${category.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                  ${category.is_active ? 'Nonaktif' : 'Aktifkan'}
                </button>
                <button class="btn btn-small btn-danger" type="button" data-action="delete-category" data-id="${category.id}" title="Hapus">
                  Hapus
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderSignatories() {
    const body = page.querySelector('#signatory-body');
    const countLabel = page.querySelector('#signatory-count-label');

    if (countLabel) {
      const active = state.signatories.filter((item) => item.is_active).length;
      countLabel.textContent = `${state.signatories.length} nama • ${active} aktif`;
    }

    if (!body) return;

    if (!state.signatories.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">Belum ada penandatangan.</div>
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = state.signatories
      .map((signatory) => {
        return `
          <tr class="${signatory.is_active ? '' : 'row-muted'}">
            <td>
              <strong>${escapeHtml(signatory.full_name)}</strong>
              <small>${escapeHtml(signatory.position_title)}</small>
              ${signatory.identity_number
            ? `<small>${escapeHtml(signatory.identity_type || 'ID')}: ${escapeHtml(signatory.identity_number)}</small>`
            : ''
          }
            </td>
            <td>
              ${escapeHtml(formatSignerPosition(signatory.signer_position))}
              ${signatory.is_default ? '<small class="default-label">Default</small>' : ''}
            </td>
            <td>
              <span class="badge ${signatory.is_active ? 'badge-success' : 'badge-muted'}">
                ${signatory.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </td>
            <td>
              <div class="actions-row master-action-row">
                <button class="btn btn-small btn-light" type="button" data-action="edit-signatory" data-id="${signatory.id}" title="Edit">
                  Edit
                </button>
                <button class="btn btn-small ${signatory.is_active ? 'btn-light' : 'btn-primary'}" type="button" data-action="toggle-signatory" data-id="${signatory.id}" title="${signatory.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                  ${signatory.is_active ? 'Nonaktif' : 'Aktifkan'}
                </button>
                ${!signatory.is_default
            ? `
                      <button class="btn btn-small btn-light" type="button" data-action="set-default-signatory" data-id="${signatory.id}" title="Jadikan Default">
                        Default
                      </button>
                      <button class="btn btn-small btn-danger" type="button" data-action="delete-signatory" data-id="${signatory.id}" title="Hapus">
                        Hapus
                      </button>
                    `
            : ''
          }
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderCategoriesError() {
    const body = page.querySelector('#category-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">Gagal memuat kategori.</div>
        </td>
      </tr>
    `;
  }

  function renderSignatoriesError() {
    const body = page.querySelector('#signatory-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">Gagal memuat penandatangan.</div>
        </td>
      </tr>
    `;
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

function formatAppliesTo(value) {
  if (value === 'masuk') return 'Kas Masuk';
  if (value === 'keluar') return 'Kas Keluar';

  return 'Kas Masuk & Keluar';
}

function formatSignerPosition(value) {
  if (value === 'mengetahui_menerima') return 'Mengetahui / Menerima';
  if (value === 'bendahara_pengeluaran_pembantu') {
    return 'Bendahara Pengeluaran Pembantu';
  }

  return value || '-';
}