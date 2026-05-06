import { escapeHtml } from './format.js';

let activeModal = null;
let pageLockCount = 0;

export function showConfirmModal({
    title = 'Konfirmasi',
    message = 'Apakah kamu yakin?',
    confirmText = 'Ya, lanjutkan',
    cancelText = 'Batal',
    tone = 'primary'
} = {}) {
    return new Promise((resolve) => {
        closeActiveModal();

        const modal = createModalShell({
            title,
            message,
            tone,
            bodyHtml: '',
            footerHtml: `
        <button class="btn btn-light" type="button" data-modal-cancel>
          ${escapeHtml(cancelText)}
        </button>
        <button class="btn ${getButtonClass(tone)}" type="button" data-modal-confirm>
          ${escapeHtml(confirmText)}
        </button>
      `
        });

        activeModal = modal;

        modal.querySelector('[data-modal-cancel]').addEventListener('click', () => {
            closeModal(modal);
            resolve(false);
        });

        modal.querySelector('[data-modal-confirm]').addEventListener('click', () => {
            closeModal(modal);
            resolve(true);
        });

        setupModalCloseEvents(modal, () => resolve(false));
        document.body.appendChild(modal);
        lockPage();
        focusFirstButton(modal);
    });
}

export function showPromptModal({
    title = 'Masukkan Data',
    message = '',
    label = 'Keterangan',
    placeholder = '',
    defaultValue = '',
    confirmText = 'Simpan',
    cancelText = 'Batal',
    tone = 'primary',
    required = false
} = {}) {
    return new Promise((resolve) => {
        closeActiveModal();

        const modal = createModalShell({
            title,
            message,
            tone,
            bodyHtml: `
        <div class="modal-field">
          <label for="modal-prompt-input">${escapeHtml(label)}</label>
          <textarea
            id="modal-prompt-input"
            class="form-control"
            rows="4"
            placeholder="${escapeHtml(placeholder)}"
          >${escapeHtml(defaultValue)}</textarea>
          <p class="modal-field-error is-hidden" data-modal-error>
            Kolom ini wajib diisi.
          </p>
        </div>
      `,
            footerHtml: `
        <button class="btn btn-light" type="button" data-modal-cancel>
          ${escapeHtml(cancelText)}
        </button>
        <button class="btn ${getButtonClass(tone)}" type="button" data-modal-confirm>
          ${escapeHtml(confirmText)}
        </button>
      `
        });

        activeModal = modal;

        const input = modal.querySelector('#modal-prompt-input');
        const errorText = modal.querySelector('[data-modal-error]');

        modal.querySelector('[data-modal-cancel]').addEventListener('click', () => {
            closeModal(modal);
            resolve(null);
        });

        modal.querySelector('[data-modal-confirm]').addEventListener('click', () => {
            const value = input.value.trim();

            if (required && !value) {
                errorText.classList.remove('is-hidden');
                input.focus();
                return;
            }

            closeModal(modal);
            resolve(value);
        });

        setupModalCloseEvents(modal, () => resolve(null));
        document.body.appendChild(modal);
        lockPage();

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
    });
}

export function showContentModal({
    title = 'Detail',
    message = '',
    bodyHtml = '',
    footerHtml = '',
    tone = 'primary',
    onMount
} = {}) {
    return new Promise((resolve) => {
        closeActiveModal();

        const modal = createModalShell({
            title,
            message,
            tone,
            bodyHtml,
            footerHtml:
                footerHtml ||
                `
          <button class="btn btn-primary" type="button" data-modal-close>
            Tutup
          </button>
        `
        });

        activeModal = modal;

        const close = (value = null) => {
            closeModal(modal);
            resolve(value);
        };

        modal.querySelectorAll('[data-modal-close]').forEach((button) => {
            button.addEventListener('click', () => close(null));
        });

        setupModalCloseEvents(modal, () => resolve(null));
        document.body.appendChild(modal);
        lockPage();

        if (typeof onMount === 'function') {
            onMount(modal, { close });
        }

        focusFirstButton(modal);
    });
}

export function showLoadingModal({
    title = 'Memproses...',
    message = 'Mohon tunggu sebentar.',
    detail = '',
    tone = 'primary'
} = {}) {
    closeActiveModal();

    const modal = createModalShell({
        title,
        message,
        tone,
        bodyHtml: `
      <div class="modal-loading-block" aria-live="polite">
        <div class="modal-spinner" aria-hidden="true"></div>
        <div>
          <strong data-loading-title>${escapeHtml(title)}</strong>
          <span data-loading-detail>
            ${escapeHtml(detail || 'Proses sedang berjalan. Jangan tutup halaman ini.')}
          </span>
        </div>
      </div>
    `,
        footerHtml: ''
    });

    modal.classList.add('modal-backdrop-blocking');
    modal.querySelector('[data-modal-card]')?.setAttribute('aria-busy', 'true');

    activeModal = modal;
    document.body.appendChild(modal);
    lockPage();

    return {
        update(next = {}) {
            const titleElement = modal.querySelector('[data-loading-title]');
            const detailElement = modal.querySelector('[data-loading-detail]');

            if (next.title && titleElement) {
                titleElement.textContent = next.title;
            }

            if (next.detail && detailElement) {
                detailElement.textContent = next.detail;
            }
        },

        async close() {
            await closeModalAsync(modal);
        }
    };
}

function createModalShell({ title, message, tone, bodyHtml, footerHtml }) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
    <div class="modal-card ${getToneClass(tone)}" data-modal-card>
      <div class="modal-icon" aria-hidden="true">
        ${getToneIcon(tone)}
      </div>

      <div class="modal-content">
        <h2>${escapeHtml(title)}</h2>
        ${message
            ? `<p class="modal-message">${escapeHtml(message)}</p>`
            : ''
        }

        ${bodyHtml || ''}

        ${footerHtml
            ? `
              <div class="modal-actions">
                ${footerHtml}
              </div>
            `
            : ''
        }
      </div>
    </div>
  `;

    return modal;
}

function setupModalCloseEvents(modal, onCancel) {
    const handleKeydown = (event) => {
        if (event.key === 'Escape') {
            closeModal(modal);
            onCancel();
        }
    };

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal(modal);
            onCancel();
        }
    });

    document.addEventListener('keydown', handleKeydown);

    modal.cleanup = () => {
        document.removeEventListener('keydown', handleKeydown);
    };
}

function closeActiveModal() {
    if (activeModal) {
        closeModal(activeModal);
    }
}

function closeModal(modal) {
    closeModalAsync(modal);
}

function closeModalAsync(modal) {
    return new Promise((resolve) => {
        if (!modal || modal.dataset.closing === 'true') {
            resolve();
            return;
        }

        modal.dataset.closing = 'true';
        modal.classList.add('modal-closing');

        setTimeout(() => {
            modal.cleanup?.();
            modal.remove();

            if (activeModal === modal) {
                activeModal = null;
            }

            unlockPage();
            resolve();
        }, 140);
    });
}

function focusFirstButton(modal) {
    setTimeout(() => {
        const button = modal.querySelector('[data-modal-confirm], [data-modal-close], button, a');
        button?.focus();
    }, 50);
}

function lockPage() {
    pageLockCount += 1;
    document.body.classList.add('modal-open');
}

function unlockPage() {
    pageLockCount = Math.max(0, pageLockCount - 1);

    if (pageLockCount === 0) {
        document.body.classList.remove('modal-open');
    }
}

function getButtonClass(tone) {
    if (tone === 'danger') return 'btn-danger';
    if (tone === 'warning') return 'btn-warning';
    return 'btn-primary';
}

function getToneClass(tone) {
    if (tone === 'danger') return 'modal-danger';
    if (tone === 'warning') return 'modal-warning';
    return 'modal-primary';
}

function getToneIcon(tone) {
    if (tone === 'danger') return '!';
    if (tone === 'warning') return '!';
    return '✓';
}