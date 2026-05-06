import {
  createBackupData,
  downloadJsonBackup
} from '../services/backup.js';

import {
  escapeHtml,
  formatDateTime
} from '../utils/format.js';

import {
  showConfirmModal,
  showContentModal,
  showLoadingModal
} from '../utils/modal.js';

export function renderBackupPage({ profile }) {
  const page = document.createElement('div');
  page.className = 'page-stack backup-page';

  const state = {
    profile,
    lastBackup: null
  };

  page.innerHTML = `
    <div class="page-header backup-page-header">
      <div>
        <p class="eyebrow">Cadangan Data</p>
        <h1 class="page-title">Backup / Export Data</h1>
        <p class="page-description">
          Unduh salinan data Kas Gabku dalam format JSON. Simpan file ini di tempat aman
          seperti Google Drive, OneDrive, atau penyimpanan lokal.
        </p>
      </div>
    </div>

    <div class="message-box is-hidden" id="message-box"></div>

    <section class="backup-hero-card">
      <div class="backup-hero-main">
        <div class="backup-icon">⇩</div>

        <div>
          <span class="backup-label">Export Sederhana</span>
          <h2>Backup Data JSON</h2>
          <p>
            Backup ini mencakup data organisasi, kategori, penandatangan,
            transaksi, metadata nota, dokumen PDF, user profile, dan log aktivitas.
          </p>
        </div>
      </div>

      <div class="backup-hero-actions">
        ${profile?.role === 'admin'
      ? `
              <button class="btn btn-primary" type="button" id="create-backup-btn">
                Buat & Download Backup JSON
              </button>
            `
      : `
              <button class="btn btn-primary" type="button" disabled>
                Hanya Admin
              </button>
            `
    }

        <button class="btn btn-light" type="button" id="show-backup-info-btn">
          Apa Saja Isinya?
        </button>
      </div>
    </section>

    <div class="backup-grid">
      <section class="backup-card">
        <div class="section-heading">
          <div>
            <h2>Status Backup Terakhir</h2>
            <p>Informasi ini hanya tersimpan selama halaman masih terbuka.</p>
          </div>
        </div>

        <div id="backup-status">
          <div class="empty-mini">
            Belum ada backup yang dibuat pada sesi ini.
          </div>
        </div>
      </section>

      <section class="backup-card">
        <div class="section-heading">
          <div>
            <h2>Catatan Penting</h2>
            <p>Perbedaan antara data backup dan file fisik.</p>
          </div>
        </div>

        <div class="backup-warning-box">
          <strong>File fisik belum ikut diunduh</strong>
          <span>
            File foto nota asli dari Supabase Storage dan file PDF asli dari Google Drive belum ikut
            sebagai file fisik. Yang ikut adalah metadata, path nota, dan link PDF.
          </span>
        </div>

        <div class="backup-note-list">
          <div class="backup-note-item">
            <span>Format file</span>
            <strong>.json</strong>
          </div>

          <div class="backup-note-item">
            <span>Lokasi hasil backup</span>
            <strong>Terunduh ke perangkat admin</strong>
          </div>

          <div class="backup-note-item">
            <span>Saran penyimpanan</span>
            <strong>Google Drive / OneDrive / arsip lokal</strong>
          </div>
        </div>
      </section>
    </div>
  `;

  bindEvents();

  return page;

  function bindEvents() {
    page.querySelector('#create-backup-btn')?.addEventListener('click', async () => {
      await handleCreateBackup();
    });

    page.querySelector('#show-backup-info-btn')?.addEventListener('click', async () => {
      await showBackupInfo();
    });
  }

  async function handleCreateBackup() {
    if (profile?.role !== 'admin') {
      setMessage('Hanya admin yang bisa membuat backup.', 'error');
      return;
    }

    const ok = await showConfirmModal({
      title: 'Buat Backup Data?',
      message:
        'Aplikasi akan mengambil data penting dari Supabase dan mengunduh file JSON ke perangkat ini.',
      confirmText: 'Buat Backup',
      cancelText: 'Batal',
      tone: 'primary'
    });

    if (!ok) return;

    let loadingModal = null;

    try {
      loadingModal = showLoadingModal({
        title: 'Membuat Backup...',
        message:
          'Kas Gabku sedang mengambil data organisasi, transaksi, dokumen, user, dan log aktivitas.',
        detail:
          'Mohon tunggu. Jangan tutup halaman sampai file backup selesai diunduh.'
      });

      const backup = await createBackupData();

      loadingModal.update({
        title: 'Menyiapkan File...',
        detail: 'Data backup sudah siap. File JSON sedang dibuat untuk diunduh.'
      });

      const fileName = downloadJsonBackup(backup);

      state.lastBackup = {
        fileName,
        generatedAt: backup.meta.generatedAt,
        totals: getBackupTotals(backup)
      };

      renderBackupStatus();

      await loadingModal.close();
      loadingModal = null;

      await showContentModal({
        title: 'Backup Berhasil Dibuat',
        message: 'File backup JSON sudah diunduh ke perangkat kamu.',
        tone: 'primary',
        bodyHtml: `
          <div class="success-doc-box">
            <strong>${escapeHtml(fileName)}</strong>
            <span>Simpan file ini di tempat aman, misalnya Google Drive atau OneDrive.</span>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-primary" type="button" data-modal-close>
            Selesai
          </button>
        `
      });
    } catch (error) {
      if (loadingModal) {
        await loadingModal.close();
      }

      await showContentModal({
        title: 'Backup Gagal',
        message:
          'File backup belum berhasil dibuat. Periksa pesan error di bawah ini.',
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

  async function showBackupInfo() {
    await showContentModal({
      title: 'Isi Backup Sederhana',
      message: 'Backup tahap awal disimpan sebagai file JSON.',
      tone: 'primary',
      bodyHtml: `
        <div class="backup-info-list">
          <div>
            <strong>Ikut dibackup</strong>
            <ul>
              <li>Data organisasi</li>
              <li>Pengaturan aplikasi</li>
              <li>Jenis/kategori transaksi</li>
              <li>Penandatangan</li>
              <li>Data transaksi</li>
              <li>Item transaksi jika ada</li>
              <li>Metadata foto nota</li>
              <li>Data dokumen PDF dan link Google Drive</li>
              <li>Profil user</li>
              <li>Log aktivitas terbaru</li>
            </ul>
          </div>

          <div>
            <strong>Belum ikut sebagai file fisik</strong>
            <ul>
              <li>Foto nota asli dari Supabase Storage</li>
              <li>File PDF asli dari Google Drive</li>
            </ul>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-primary" type="button" data-modal-close>
          Mengerti
        </button>
      `
    });
  }

  function renderBackupStatus() {
    const root = page.querySelector('#backup-status');
    if (!root || !state.lastBackup) return;

    const backup = state.lastBackup;

    root.innerHTML = `
      <div class="backup-status-grid">
        <article class="backup-status-item backup-status-wide">
          <span>Nama File</span>
          <strong>${escapeHtml(backup.fileName)}</strong>
        </article>

        <article class="backup-status-item backup-status-wide">
          <span>Waktu Backup</span>
          <strong>${formatDateTime(backup.generatedAt)}</strong>
        </article>

        <article class="backup-status-item">
          <span>Transaksi</span>
          <strong>${backup.totals.transactions}</strong>
        </article>

        <article class="backup-status-item">
          <span>Metadata Nota</span>
          <strong>${backup.totals.attachments}</strong>
        </article>

        <article class="backup-status-item">
          <span>Dokumen PDF</span>
          <strong>${backup.totals.documents}</strong>
        </article>

        <article class="backup-status-item">
          <span>Log Aktivitas</span>
          <strong>${backup.totals.logs}</strong>
        </article>
      </div>
    `;
  }

  function getBackupTotals(backup) {
    return {
      transactions: backup.data.transactions.length,
      attachments: backup.data.transactionAttachments.length,
      documents: backup.data.generatedDocuments.length,
      logs: backup.data.activityLogs.length
    };
  }

  function setMessage(message, type = 'info') {
    const messageBox = page.querySelector('#message-box');
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message-box message-${type}`;
  }
}