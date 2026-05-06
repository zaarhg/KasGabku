import {
  getCurrentUserId,
  getUserProfiles,
  updateUserProfile,
  setUserActive
} from '../services/admin-user.js';

import {
  escapeHtml,
  formatDateTime
} from '../utils/format.js';

import {
  showConfirmModal
} from '../utils/modal.js';

export function renderAdminUserPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack admin-user-page';

  const state = {
    profile,
    currentUserId: null,
    users: [],
    editingUserId: null
  };

  page.innerHTML = `
    <div class="page-header admin-user-page-header">
      <div>
        <p class="eyebrow">Administrasi</p>
        <h1 class="page-title">Admin User</h1>
        <p class="page-description">
          Kelola nama, role, dan status aktif user. Akun baru tetap dibuat manual dari Supabase Dashboard.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="admin-user-overview-grid">
      <article class="admin-user-card admin-user-editor-card">
        <div class="section-heading">
          <div>
            <h2>Edit User</h2>
            <p>Pilih user dari tabel untuk mengubah nama atau role.</p>
          </div>
        </div>

        <form id="user-form" class="admin-user-form">
          <div class="form-group form-group-wide">
            <label for="user-email">Email</label>
            <input
              class="form-control"
              id="user-email"
              type="email"
              disabled
              placeholder="Pilih user dari tabel"
            />
          </div>

          <div class="form-group form-group-wide">
            <label for="user-full-name">Nama Lengkap</label>
            <input
              class="form-control"
              id="user-full-name"
              name="full_name"
              placeholder="Contoh: Ahmad Zain"
              disabled
            />
          </div>

          <div class="form-group">
            <label for="user-role">Role</label>
            <select class="form-control" id="user-role" name="role" disabled>
              <option value="admin">Admin</option>
              <option value="bendahara">Bendahara</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div class="admin-selected-user-box" id="selected-user-box">
            <strong>Belum ada user dipilih</strong>
            <span>Klik tombol Edit pada tabel untuk mulai mengubah data user.</span>
          </div>

          <div class="form-actions form-group-wide">
            <button class="btn btn-primary" type="submit" id="save-user-btn" disabled>
              Simpan Perubahan
            </button>
            <button class="btn btn-light is-hidden" type="button" id="cancel-user-btn">
              Batal Edit
            </button>
          </div>
        </form>
      </article>

      <aside class="admin-user-card admin-user-summary-card">
        <div class="section-heading compact">
          <div>
            <h2>Ringkasan User</h2>
            <p>Status user yang terdaftar di aplikasi.</p>
          </div>
        </div>

        <div id="admin-user-summary">
          <div class="empty-mini">Memuat ringkasan user...</div>
        </div>
      </aside>
    </section>

    <section class="table-card">
      <div class="section-heading">
        <div>
          <h2>Daftar User</h2>
          <p id="user-table-caption">Memuat user...</p>
        </div>

        <button class="btn btn-light" type="button" id="refresh-user-btn">
          Refresh
        </button>
      </div>

      <div class="admin-note-box">
        <strong>Catatan</strong>
        <span>
          Untuk menambah user baru, buat akun terlebih dahulu di Supabase Dashboard.
          Setelah profilnya muncul di sini, admin bisa mengatur role dan status aktifnya.
        </span>
      </div>

      <div class="table-responsive">
        <table class="data-table admin-user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Diubah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="user-body">
            <tr>
              <td colspan="6">Memuat user...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  bindEvents();
  loadUsers();

  return page;

  function bindEvents() {
    page.querySelector('#refresh-user-btn')?.addEventListener('click', async () => {
      await loadUsers();
    });

    page.querySelector('#user-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleSaveUser(event.currentTarget);
    });

    page.querySelector('#cancel-user-btn')?.addEventListener('click', () => {
      resetUserForm();
    });

    page.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const userId = button.dataset.id;

      if (action === 'edit-user') {
        fillUserForm(userId);
      }

      if (action === 'toggle-user') {
        await handleToggleUser(userId);
      }
    });
  }

  async function loadUsers() {
    try {
      setMessage('Memuat daftar user...', 'info');

      const [currentUserId, users] = await Promise.all([
        getCurrentUserId(),
        getUserProfiles()
      ]);

      state.currentUserId = currentUserId;
      state.users = users;

      renderSummary();
      renderUsers();

      const caption = page.querySelector('#user-table-caption');
      if (caption) {
        caption.textContent = `${users.length} user ditemukan.`;
      }

      hideMessage();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
      renderSummaryError();
      renderUsersError();
    }
  }

  async function handleSaveUser(form) {
    if (!state.editingUserId) {
      setMessage('Pilih user yang akan diedit terlebih dahulu.', 'error');
      return;
    }

    const selectedUser = state.users.find((user) => user.id === state.editingUserId);

    if (!selectedUser) {
      setMessage('User tidak ditemukan.', 'error');
      return;
    }

    const formData = new FormData(form);

    const payload = {
      full_name: formData.get('full_name'),
      role: formData.get('role')
    };

    if (!['admin', 'bendahara', 'viewer'].includes(payload.role)) {
      setMessage('Role tidak valid.', 'error');
      return;
    }

    if (
      selectedUser.id === state.currentUserId &&
      selectedUser.role === 'admin' &&
      payload.role !== 'admin'
    ) {
      const ok = await showConfirmModal({
        title: 'Ubah Role Akun Sendiri?',
        message:
          'Kamu sedang mengubah role akun yang sedang dipakai. Pastikan masih ada admin lain sebelum melanjutkan.',
        confirmText: 'Tetap Ubah',
        cancelText: 'Batal',
        tone: 'warning'
      });

      if (!ok) return;
    }

    const button = page.querySelector('#save-user-btn');

    try {
      button.disabled = true;
      button.textContent = 'Menyimpan...';

      await updateUserProfile(state.editingUserId, payload);

      setMessage('Data user berhasil diperbarui.', 'success');
      resetUserForm();
      await loadUsers();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    } finally {
      if (state.editingUserId) {
        button.disabled = false;
        button.textContent = 'Simpan Perubahan';
      } else {
        button.disabled = true;
        button.textContent = 'Simpan Perubahan';
      }
    }
  }

  async function handleToggleUser(userId) {
    const user = state.users.find((item) => item.id === userId);
    if (!user) return;

    const willActivate = !user.is_active;

    if (user.id === state.currentUserId && !willActivate) {
      setMessage('Kamu tidak bisa menonaktifkan akun yang sedang dipakai.', 'error');
      return;
    }

    const ok = await showConfirmModal({
      title: willActivate ? 'Aktifkan User?' : 'Nonaktifkan User?',
      message: willActivate
        ? 'User akan bisa menggunakan aplikasi kembali.'
        : 'User tidak akan bisa menggunakan aplikasi sampai diaktifkan lagi.',
      confirmText: willActivate ? 'Aktifkan' : 'Nonaktifkan',
      cancelText: 'Batal',
      tone: willActivate ? 'primary' : 'danger'
    });

    if (!ok) return;

    try {
      await setUserActive(user.id, willActivate);

      setMessage(
        willActivate ? 'User berhasil diaktifkan.' : 'User berhasil dinonaktifkan.',
        'success'
      );

      await loadUsers();
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  function fillUserForm(userId) {
    const user = state.users.find((item) => item.id === userId);
    if (!user) return;

    state.editingUserId = user.id;

    page.querySelector('#user-email').value = user.email || '';
    page.querySelector('#user-full-name').value = user.full_name || '';
    page.querySelector('#user-role').value = user.role || 'viewer';

    page.querySelector('#user-full-name').disabled = false;
    page.querySelector('#user-role').disabled = false;
    page.querySelector('#save-user-btn').disabled = false;
    page.querySelector('#save-user-btn').textContent = 'Simpan Perubahan';
    page.querySelector('#cancel-user-btn').classList.remove('is-hidden');

    renderSelectedUserBox(user);

    page.querySelector('#user-full-name').focus();
  }

  function resetUserForm() {
    state.editingUserId = null;

    page.querySelector('#user-form')?.reset();
    page.querySelector('#user-email').value = '';
    page.querySelector('#user-full-name').value = '';
    page.querySelector('#user-role').value = 'viewer';

    page.querySelector('#user-full-name').disabled = true;
    page.querySelector('#user-role').disabled = true;
    page.querySelector('#save-user-btn').disabled = true;
    page.querySelector('#save-user-btn').textContent = 'Simpan Perubahan';
    page.querySelector('#cancel-user-btn').classList.add('is-hidden');

    const box = page.querySelector('#selected-user-box');
    if (box) {
      box.innerHTML = `
        <strong>Belum ada user dipilih</strong>
        <span>Klik tombol Edit pada tabel untuk mulai mengubah data user.</span>
      `;
    }
  }

  function renderSelectedUserBox(user) {
    const box = page.querySelector('#selected-user-box');
    if (!box) return;

    const isCurrentUser = user.id === state.currentUserId;

    box.innerHTML = `
      <strong>${escapeHtml(user.email || '-')}</strong>
      <span>
        Role saat ini: ${escapeHtml(formatRole(user.role))}
        ${isCurrentUser ? ' • akun yang sedang dipakai' : ''}
      </span>
    `;
  }

  function renderSummary() {
    const root = page.querySelector('#admin-user-summary');
    if (!root) return;

    const total = state.users.length;
    const active = state.users.filter((user) => user.is_active).length;
    const inactive = total - active;
    const adminCount = state.users.filter((user) => user.role === 'admin').length;
    const bendaharaCount = state.users.filter((user) => user.role === 'bendahara').length;
    const viewerCount = state.users.filter((user) => user.role === 'viewer').length;

    root.innerHTML = `
      <div class="admin-user-summary-list">
        <div class="admin-user-summary-item">
          <span>Total User</span>
          <strong>${total}</strong>
        </div>

        <div class="admin-user-summary-item">
          <span>User Aktif</span>
          <strong>${active}</strong>
          <small>${inactive} nonaktif</small>
        </div>

        <div class="admin-user-summary-item">
          <span>Admin</span>
          <strong>${adminCount}</strong>
        </div>

        <div class="admin-user-summary-item">
          <span>Bendahara / Viewer</span>
          <strong>${bendaharaCount} / ${viewerCount}</strong>
        </div>
      </div>
    `;
  }

  function renderSummaryError() {
    const root = page.querySelector('#admin-user-summary');
    if (!root) return;

    root.innerHTML = `
      <div class="empty-mini">
        Gagal memuat ringkasan user.
      </div>
    `;
  }

  function renderUsers() {
    const body = page.querySelector('#user-body');
    if (!body) return;

    if (!state.users.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">Belum ada user.</div>
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = state.users
      .map((user) => {
        const isCurrentUser = user.id === state.currentUserId;

        return `
          <tr class="${user.is_active ? '' : 'row-muted'}">
            <td>
              <strong>${escapeHtml(user.full_name || 'Tanpa nama')}</strong>
              <small>${escapeHtml(user.email || '-')}</small>
              ${isCurrentUser
            ? '<small class="current-user-label">Akun yang sedang dipakai</small>'
            : ''
          }
            </td>
            <td>
              <span class="badge ${getRoleBadgeClass(user.role)}">
                ${escapeHtml(formatRole(user.role))}
              </span>
            </td>
            <td>
              <span class="badge ${user.is_active ? 'badge-success' : 'badge-muted'}">
                ${user.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>${formatDateTime(user.updated_at)}</td>
            <td>
              <div class="actions-row admin-user-action-row">
                <button
                  class="btn btn-small btn-light"
                  type="button"
                  data-action="edit-user"
                  data-id="${user.id}"
                >
                  Edit
                </button>

                <button
                  class="btn btn-small ${user.is_active ? 'btn-danger' : 'btn-primary'}"
                  type="button"
                  data-action="toggle-user"
                  data-id="${user.id}"
                  ${isCurrentUser && user.is_active ? 'disabled' : ''}
                >
                  ${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderUsersError() {
    const body = page.querySelector('#user-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">Gagal memuat user.</div>
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

function formatRole(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'bendahara') return 'Bendahara';
  if (role === 'viewer') return 'Viewer';

  return role || '-';
}

function getRoleBadgeClass(role) {
  if (role === 'admin') return 'badge-danger';
  if (role === 'bendahara') return 'badge-warning';
  if (role === 'viewer') return 'badge-muted';

  return 'badge-muted';
}