import { supabase } from './supabase.js';
import { logActivity } from './activity-log.js';

let cachedOrganizationId = null;

export async function getDefaultOrganizationId() {
    if (cachedOrganizationId) {
        return cachedOrganizationId;
    }

    const { data: setting, error: settingError } = await supabase
        .from('app_settings')
        .select('organization_id')
        .eq('id', 1)
        .maybeSingle();

    if (settingError) {
        throw settingError;
    }

    if (setting?.organization_id) {
        cachedOrganizationId = setting.organization_id;
        return cachedOrganizationId;
    }

    const { data: organizations, error: organizationError } = await supabase
        .from('organizations')
        .select('id')
        .eq('is_active', true)
        .limit(1);

    if (organizationError) {
        throw organizationError;
    }

    if (!organizations?.length) {
        throw new Error('Organisasi aktif belum tersedia.');
    }

    cachedOrganizationId = organizations[0].id;
    return cachedOrganizationId;
}

export async function getActiveCategories() {
    const organizationId = await getDefaultOrganizationId();

    const { data, error } = await supabase
        .from('spending_categories')
        .select('id, name, applies_to, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function listTransactions(filters = {}) {
    const organizationId = await getDefaultOrganizationId();

    let query = supabase
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
      signer_penerima_id,
      penerima_name_manual,
      penerima_title_manual,
      penerima_identity_type_manual,
      penerima_identity_number_manual,
      finalized_at,
      created_at,
      updated_at,
      transaction_attachments (
        id,
        file_name,
        file_path,
        file_size,
        mime_type,
        created_at
      ),
      generated_documents (
        id,
        document_type,
        file_name,
        file_url,
        drive_file_id,
        generated_at
      )
    `)
        .eq('organization_id', organizationId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (filters.year && filters.year !== 'all') {
        query = query.eq('period_year', Number(filters.year));
    }

    if (filters.month && filters.month !== 'all') {
        query = query.eq('period_month', Number(filters.month));
    }

    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }

    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map((transaction) => ({
        ...transaction,
        transaction_attachments: sortAttachments(
            transaction.transaction_attachments || []
        ),
        generated_documents: sortGeneratedDocuments(
            transaction.generated_documents || []
        )
    }));
}

export async function createTransaction(payload) {
    const organizationId = await getDefaultOrganizationId();

    const { data: userResult, error: userError } = await supabase.auth.getUser();

    if (userError) {
        throw userError;
    }

    const user = userResult.user;

    if (!user) {
        throw new Error('User belum login.');
    }

    const record = {
        organization_id: organizationId,
        transaction_date: payload.transaction_date,
        type: payload.type,
        description: payload.description,
        category_id: payload.category_id || null,
        party_name: payload.party_name || null,
        amount: payload.amount,
        status: 'draft',
        notes: payload.notes || null,
        signer_penerima_id: payload.signer_penerima_id || null,
        penerima_name_manual: payload.penerima_name_manual || null,
        penerima_title_manual: payload.penerima_title_manual || null,
        penerima_identity_type_manual: payload.penerima_identity_type_manual || null,
        penerima_identity_number_manual: payload.penerima_identity_number_manual || null,
        created_by: user.id,
        updated_by: user.id
    };

    const { data, error } = await supabase
        .from('transactions')
        .insert(record)
        .select()
        .single();

    if (error) {
        throw error;
    }

    await logActivity({
        action: 'create_transaction',
        entityTable: 'transactions',
        entityId: data.id,
        description: `Transaksi draft dibuat: ${data.description}`
    });

    return data;
}

export async function updateTransaction(transactionId, payload) {
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;

    if (!user) {
        throw new Error('User belum login.');
    }

    const { data, error } = await supabase
        .from('transactions')
        .update({
            ...payload,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    await logActivity({
        action: 'update_transaction',
        entityTable: 'transactions',
        entityId: transactionId,
        description: `Transaksi diperbarui: ${data.description}`
    });

    return data;
}

export async function deleteTransactionAdmin(transactionId) {
    const { data: transaction, error: getError } = await supabase
        .from('transactions')
        .select(`
            id,
            description,
            transaction_attachments (id, file_path)
        `)
        .eq('id', transactionId)
        .single();

    if (getError) throw getError;

    const attachments = transaction.transaction_attachments || [];
    if (attachments.length > 0) {
        const filePaths = attachments.map(a => a.file_path);
        const { error: storageError } = await supabase.storage
            .from(import.meta.env.VITE_SUPABASE_BUCKET_NOTES || 'transaction-notes')
            .remove(filePaths);
        
        if (storageError) {
            throw new Error('Gagal membersihkan file nota di Storage: ' + storageError.message);
        }
    }

    const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

    if (deleteError) throw deleteError;

    await logActivity({
        action: 'admin_delete_transaction',
        entityTable: 'transactions',
        entityId: transactionId,
        description: `Transaksi dihapus permanen oleh admin: ${transaction.description}`
    });

    return true;
}


export async function finalizeTransaction(transactionId) {
    const { data, error } = await supabase.rpc('finalize_transaction', {
        p_transaction_id: transactionId
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function cancelTransaction(transactionId, reason) {
    const { data, error } = await supabase.rpc('cancel_transaction', {
        p_transaction_id: transactionId,
        p_reason: reason || null
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function deleteDraftTransaction(transactionId) {
    const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('status', 'draft')
        .select();

    if (error) {
        throw error;
    }

    await logActivity({
        action: 'delete_draft_transaction',
        entityTable: 'transactions',
        entityId: transactionId,
        description: 'Transaksi draft dihapus.'
    });

    return data;
}

export async function getTransactionDetail(transactionId) {
    const organizationId = await getDefaultOrganizationId();

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
      signer_penerima_id,
      penerima_name_manual,
      penerima_title_manual,
      penerima_identity_type_manual,
      penerima_identity_number_manual,
      finalized_at,
      created_at,
      updated_at,
      spending_categories (
        id,
        name,
        applies_to
      ),
      transaction_attachments (
        id,
        file_name,
        file_path,
        file_size,
        mime_type,
        created_at
      ),
      generated_documents (
        id,
        document_type,
        file_name,
        file_url,
        drive_file_id,
        generated_at
      )
    `)
        .eq('id', transactionId)
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error('Transaksi tidak ditemukan.');
    }

    return {
        ...data,
        transaction_attachments: sortAttachments(data.transaction_attachments || []),
        generated_documents: sortGeneratedDocuments(data.generated_documents || [])
    };
}

function sortAttachments(attachments) {
    return [...attachments].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

function sortGeneratedDocuments(documents) {
    return [...documents].sort((a, b) => {
        const dateA = a.generated_at || a.created_at;
        const dateB = b.generated_at || b.created_at;

        return new Date(dateB) - new Date(dateA);
    });
}
