export function formatRupiah(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(number);
}

export function formatDate(value) {
    if (!value) return '-';

    const date = new Date(`${value}T00:00:00`);

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

export function formatDateTime(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
}

export function getTodayInputDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${date}`;
}

export function getCurrentMonth() {
    return new Date().getMonth() + 1;
}

export function getCurrentYear() {
    return new Date().getFullYear();
}

export function getMonthName(month) {
    const date = new Date(2026, Number(month) - 1, 1);

    return new Intl.DateTimeFormat('id-ID', {
        month: 'long'
    }).format(date);
}

export function parseAmountInput(value) {
    const raw = String(value || '')
        .replaceAll('.', '')
        .replaceAll(',', '.')
        .replace(/[^\d.]/g, '');

    const number = Number(raw);

    if (!Number.isFinite(number) || number <= 0) {
        return 0;
    }

    return number;
}

export function formatTransactionType(type) {
    if (type === 'masuk') return 'Kas Masuk';
    if (type === 'keluar') return 'Kas Keluar';
    return '-';
}

export function formatTransactionStatus(status) {
    if (status === 'draft') return 'Draft';
    if (status === 'final') return 'Final';
    if (status === 'dibatalkan') return 'Dibatalkan';
    return '-';
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function parseRupiah(value) {
    if (typeof value === 'number') return value;
    const raw = String(value || '')
        .replace(/[^\d]/g, '');
    return Number(raw) || 0;
}