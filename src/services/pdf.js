import { supabase } from './supabase.js';
import { logActivity } from './activity-log.js';
import { getDefaultOrganizationId } from './transaksi.js';
import { getAttachmentSignedUrl } from './storage.js';
import { terbilangRupiah } from '../utils/terbilang.js';

const GAS_WEB_APP_URL =
    import.meta.env.VITE_GAS_WEB_APP_URL ||
    import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL;

export async function getActiveSignatories() {
    const organizationId = await getDefaultOrganizationId();

    const { data, error } = await supabase
        .from('signatories')
        .select(`
      id,
      organization_id,
      full_name,
      position_title,
      identity_type,
      identity_number,
      signer_position,
      is_default,
      is_active
    `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('signer_position', { ascending: true })
        .order('is_default', { ascending: false })
        .order('full_name', { ascending: true });

    if (error) throw error;

    return data || [];
}

export async function generateBend26Pdf({
    transaction,
    signerMengetahuiId,
    signerBendaharaId
}) {
    if (!GAS_WEB_APP_URL) {
        throw new Error('URL Apps Script belum tersedia di file .env.');
    }

    if (!transaction?.id) {
        throw new Error('Data transaksi tidak valid.');
    }

    if (transaction.type !== 'keluar') {
        throw new Error('Bend 26 hanya bisa dibuat untuk transaksi kas keluar.');
    }

    if (transaction.status !== 'final') {
        throw new Error('Transaksi harus berstatus final sebelum generate Bend 26.');
    }

    if (!transaction.proof_number) {
        throw new Error('Nomor bukti belum tersedia. Finalkan transaksi dulu.');
    }

    if (!signerMengetahuiId || !signerBendaharaId) {
        throw new Error('Penandatangan Bend 26 (Mengetahui & Bendahara) belum dipilih.');
    }

    const signerPenerimaId = transaction.signer_penerima_id;

    const organizationId = transaction.organization_id || await getDefaultOrganizationId();

    const [organization, signers, currentUser, noteImageUrl] = await Promise.all([
        getOrganization(organizationId),
        getSigners([signerMengetahuiId, signerBendaharaId, signerPenerimaId]),
        getCurrentUser(),
        getFirstNoteSignedUrl(transaction)
    ]);

    const signerMengetahui = signers.find((item) => item.id === signerMengetahuiId);
    const signerBendahara = signers.find((item) => item.id === signerBendaharaId);
    let signerPenerima = signers.find((item) => item.id === signerPenerimaId);

    if (!signerPenerima && transaction.penerima_name_manual) {
        signerPenerima = {
            full_name: transaction.penerima_name_manual,
            position_title: transaction.penerima_title_manual,
            identity_type: transaction.penerima_identity_type_manual,
            identity_number: transaction.penerima_identity_number_manual
        };
    }

    if (!signerMengetahui) {
        throw new Error('Penandatangan mengetahui/menerima tidak ditemukan.');
    }

    if (!signerBendahara) {
        throw new Error('Penandatangan bendahara tidak ditemukan.');
    }

    if (!signerPenerima) {
        throw new Error('Penerima transaksi (Yang Menerima) belum ditentukan saat transaksi dibuat.');
    }

    const payload = {
        proofNumber: transaction.proof_number,
        organizationName: organization.name,
        receivedFrom: organization.name,
        amountNumber: Number(transaction.amount || 0),
        amountWords: terbilangRupiah(transaction.amount),
        paymentFor: transaction.notes
            ? `${transaction.description}\n(Catatan: ${transaction.notes})`
            : transaction.description,
        notes: transaction.notes || '',
        transactionDate: transaction.transaction_date,
        city: organization.city || 'Kulon Progo',
        noteImageUrl,
        signerMengetahui: mapSignerForGas(signerMengetahui),
        signerBendahara: mapSignerForGas(signerBendahara),
        signerPenerima: mapSignerForGas(signerPenerima)
    };

    const result = await callGasPdfGenerator('generate_bend26', payload);

    return saveGeneratedDocument({
        organizationId,
        transactionId: transaction.id,
        documentType: result.documentType || 'bend_26',
        periodMonth: transaction.period_month || null,
        periodYear: transaction.period_year || null,
        fileName: result.fileName || null,
        fileUrl: result.fileUrl || null,
        driveFileId: result.fileId || null,
        signerMengetahuiId,
        signerBendaharaId,
        signerPenerimaId,
        signerPenerimaNameManual: transaction.penerima_name_manual || null,
        signerPenerimaTitleManual: transaction.penerima_title_manual || null,
        userId: currentUser.id
    });
}

export async function getBukuKasPreview({ month, year }) {
    const organizationId = await getDefaultOrganizationId();
    const periodMonth = Number(month);
    const periodYear = Number(year);
    const range = getMonthDateRange(periodMonth, periodYear);

    const [organization, previousTransactions, monthlyTransactions, documents] =
        await Promise.all([
            getOrganization(organizationId),
            getFinalTransactionsBefore(organizationId, range.startDate),
            getFinalTransactionsInPeriod(organizationId, range.startDate, range.endDate),
            getBukuKasDocuments(organizationId, periodMonth, periodYear)
        ]);

    const openingBalance = calculateBalance(previousTransactions);
    const rows = buildBukuKasRows(monthlyTransactions, openingBalance);

    const totalIncome = rows.reduce((sum, row) => sum + Number(row.income || 0), 0);
    const totalExpense = rows.reduce((sum, row) => sum + Number(row.expense || 0), 0);
    const endingBalance = openingBalance + totalIncome - totalExpense;

    return {
        organization,
        month: periodMonth,
        year: periodYear,
        periodLabel: formatPeriodLabel(periodMonth, periodYear),
        generatedDate: getTodayDate(),
        openingBalance,
        totalIncome,
        totalExpense,
        endingBalance,
        transactions: monthlyTransactions,
        rows,
        documents
    };
}

export async function generateBukuKasPdf({ month, year, bookSignerId }) {
    if (!GAS_WEB_APP_URL) {
        throw new Error('URL Apps Script belum tersedia di file .env.');
    }

    if (!bookSignerId) {
        throw new Error('Penandatangan buku kas belum dipilih.');
    }

    const organizationId = await getDefaultOrganizationId();

    const [preview, signers, currentUser] = await Promise.all([
        getBukuKasPreview({ month, year }),
        getSigners([bookSignerId]),
        getCurrentUser()
    ]);

    const bookSigner = signers.find((item) => item.id === bookSignerId);

    if (!bookSigner) {
        throw new Error('Penandatangan buku kas tidak ditemukan.');
    }

    if (!preview.rows.length) {
        throw new Error('Belum ada transaksi final pada bulan ini.');
    }

    const payload = {
        organizationName: preview.organization.name,
        periodLabel: preview.periodLabel,
        city: preview.organization.city || 'Kulon Progo',
        generatedDate: preview.generatedDate,
        openingBalance: preview.openingBalance,
        totalIncome: preview.totalIncome,
        totalExpense: preview.totalExpense,
        endingBalance: preview.endingBalance,
        rows: preview.rows,
        bookSigner: mapSignerForGas(bookSigner)
    };

    const result = await callGasPdfGenerator('generate_buku_kas', payload);

    return saveGeneratedDocument({
        organizationId,
        transactionId: null,
        documentType: result.documentType || 'buku_kas_bulanan',
        periodMonth: Number(month),
        periodYear: Number(year),
        fileName: result.fileName || null,
        fileUrl: result.fileUrl || null,
        driveFileId: result.fileId || null,
        signerMengetahuiId: null,
        signerBendaharaId: bookSignerId,
        userId: currentUser.id
    });
}

async function getOrganization(organizationId) {
    const { data, error } = await supabase
        .from('organizations')
        .select('id, name, short_name, city')
        .eq('id', organizationId)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error('Data organisasi tidak ditemukan.');
    }

    return data;
}

async function getSigners(ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    const { data, error } = await supabase
        .from('signatories')
        .select(`
      id,
      full_name,
      position_title,
      identity_type,
      identity_number,
      signer_position,
      is_active
    `)
        .in('id', uniqueIds)
        .eq('is_active', true);

    if (error) throw error;

    return data || [];
}

async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    if (!data.user) {
        throw new Error('User belum login.');
    }

    return data.user;
}

async function getFirstNoteSignedUrl(transaction) {
    const attachments = transaction.transaction_attachments || [];

    if (!attachments.length) return '';

    const firstAttachment = attachments[0];

    if (!firstAttachment?.file_path) return '';

    return getAttachmentSignedUrl(firstAttachment.file_path, 30 * 60);
}

async function getFinalTransactionsBefore(organizationId, beforeDate) {
    const { data, error } = await supabase
        .from('transactions')
        .select('id, type, amount')
        .eq('organization_id', organizationId)
        .eq('status', 'final')
        .lt('transaction_date', beforeDate);

    if (error) throw error;

    return data || [];
}

async function getFinalTransactionsInPeriod(organizationId, startDate, endDate) {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
      id,
      organization_id,
      proof_number,
      transaction_date,
      period_month,
      period_year,
      type,
      description,
      category_id,
      party_name,
      amount,
      status,
      notes,
      created_at,
      spending_categories (
        id,
        name
      ),
      transaction_attachments (
        id
      )
    `)
        .eq('organization_id', organizationId)
        .eq('status', 'final')
        .gte('transaction_date', startDate)
        .lt('transaction_date', endDate)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;

    return data || [];
}

async function getBukuKasDocuments(organizationId, month, year) {
    const { data, error } = await supabase
        .from('generated_documents')
        .select(`
      id,
      document_type,
      file_name,
      file_url,
      drive_file_id,
      period_month,
      period_year,
      generated_at
    `)
        .eq('organization_id', organizationId)
        .eq('document_type', 'buku_kas_bulanan')
        .eq('period_month', Number(month))
        .eq('period_year', Number(year))
        .order('generated_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

async function callGasPdfGenerator(action, payload) {
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
            action,
            payload
        })
    });

    const text = await response.text();

    let json;

    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(
            'Response Apps Script tidak berupa JSON. Pastikan URL /exec benar dan deployment Web App sudah aktif.'
        );
    }

    if (!response.ok || !json.ok) {
        throw new Error(json.error || `Gagal generate PDF. Status: ${response.status}`);
    }

    const result =
        json.result ||
        json.data ||
        json.document ||
        (
            json.documentType || json.fileName || json.fileUrl || json.fileId
                ? json
                : null
        );

    if (!result) {
        throw new Error(
            `Apps Script berhasil dipanggil, tetapi tidak mengembalikan data dokumen. Response: ${JSON.stringify(json)}`
        );
    }

    return result;
}

async function saveGeneratedDocument({
    organizationId,
    transactionId,
    documentType,
    periodMonth,
    periodYear,
    fileName,
    fileUrl,
    driveFileId,
    signerMengetahuiId,
    signerBendaharaId,
    signerPenerimaId,
    signerPenerimaNameManual,
    signerPenerimaTitleManual,
    userId
}) {
    const { data, error } = await supabase
        .from('generated_documents')
        .insert({
            organization_id: organizationId,
            transaction_id: transactionId,
            document_type: documentType,
            period_month: periodMonth,
            period_year: periodYear,
            file_name: fileName,
            file_url: fileUrl,
            drive_file_id: driveFileId,
            signer_mengetahui_id: signerMengetahuiId,
            signer_bendahara_id: signerBendaharaId,
            signer_penerima_id: signerPenerimaId,
            signer_penerima_name_manual: signerPenerimaNameManual,
            signer_penerima_title_manual: signerPenerimaTitleManual,
            generated_by: userId
        })
        .select(`
      id,
      document_type,
      file_name,
      file_url,
      drive_file_id,
      period_month,
      period_year,
      generated_at
    `)
        .single();

    if (error) throw error;

    await logActivity({
        action: documentType === 'buku_kas_bulanan' ? 'generate_buku_kas' : 'generate_bend26',
        entityTable: 'generated_documents',
        entityId: data.id,
        description: `Dokumen PDF dibuat: ${fileName || documentType}`
    });

    return data;
}

export async function deleteGeneratedDocument(id) {
    const { error } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', id);

    if (error) throw error;

    await logActivity({
        action: 'delete_document',
        entityTable: 'generated_documents',
        entityId: id,
        description: `Dokumen PDF dihapus (ID: ${id})`
    });
}

function buildBukuKasRows(transactions, openingBalance) {
    let runningBalance = Number(openingBalance || 0);

    return transactions.map((transaction, index) => {
        const amount = Number(transaction.amount || 0);
        const income = transaction.type === 'masuk' ? amount : 0;
        const expense = transaction.type === 'keluar' ? amount : 0;

        runningBalance = runningBalance + income - expense;

        return {
            no: index + 1,
            date: transaction.transaction_date,
            proofNumber: transaction.proof_number || '-',
            description: transaction.description || '-',
            categoryName: transaction.spending_categories?.name || '-',
            income,
            expense,
            balance: runningBalance,
            noteStatus: (transaction.transaction_attachments || []).length
                ? 'Ada nota'
                : '-'
        };
    });
}

function calculateBalance(transactions) {
    return (transactions || []).reduce((balance, transaction) => {
        const amount = Number(transaction.amount || 0);

        if (transaction.type === 'masuk') {
            return balance + amount;
        }

        if (transaction.type === 'keluar') {
            return balance - amount;
        }

        return balance;
    }, 0);
}

function getMonthDateRange(month, year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

    const nextMonthDate = new Date(Number(year), Number(month), 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth() + 1;

    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    return {
        startDate,
        endDate
    };
}

function formatPeriodLabel(month, year) {
    const date = new Date(Number(year), Number(month) - 1, 1);

    const monthName = new Intl.DateTimeFormat('id-ID', {
        month: 'long'
    }).format(date);

    return `${monthName} ${year}`;
}

function getTodayDate() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
}

function mapSignerForGas(signer) {
    return {
        fullName: signer.full_name || '',
        positionTitle: signer.position_title || '',
        identityType: signer.identity_type || '',
        identityNumber: signer.identity_number || ''
    };
}