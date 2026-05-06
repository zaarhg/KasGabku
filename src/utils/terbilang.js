const SMALL_NUMBERS = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas'
];

export function terbilangRupiah(value) {
    const number = Math.round(Number(value || 0));

    if (!Number.isFinite(number) || number < 0) {
        return 'nol rupiah';
    }

    if (number === 0) {
        return 'nol rupiah';
    }

    return `${numberToWords(number)} rupiah`.replace(/\s+/g, ' ').trim();
}

function numberToWords(number) {
    if (number < 12) {
        return SMALL_NUMBERS[number];
    }

    if (number < 20) {
        return `${numberToWords(number - 10)} belas`;
    }

    if (number < 100) {
        const tens = Math.floor(number / 10);
        const rest = number % 10;

        return `${numberToWords(tens)} puluh ${numberToWords(rest)}`.trim();
    }

    if (number < 200) {
        return `seratus ${numberToWords(number - 100)}`.trim();
    }

    if (number < 1000) {
        const hundreds = Math.floor(number / 100);
        const rest = number % 100;

        return `${numberToWords(hundreds)} ratus ${numberToWords(rest)}`.trim();
    }

    if (number < 2000) {
        return `seribu ${numberToWords(number - 1000)}`.trim();
    }

    if (number < 1000000) {
        const thousands = Math.floor(number / 1000);
        const rest = number % 1000;

        return `${numberToWords(thousands)} ribu ${numberToWords(rest)}`.trim();
    }

    if (number < 1000000000) {
        const millions = Math.floor(number / 1000000);
        const rest = number % 1000000;

        return `${numberToWords(millions)} juta ${numberToWords(rest)}`.trim();
    }

    if (number < 1000000000000) {
        const billions = Math.floor(number / 1000000000);
        const rest = number % 1000000000;

        return `${numberToWords(billions)} miliar ${numberToWords(rest)}`.trim();
    }

    const trillions = Math.floor(number / 1000000000000);
    const rest = number % 1000000000000;

    return `${numberToWords(trillions)} triliun ${numberToWords(rest)}`.trim();
}