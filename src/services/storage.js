import { supabase } from './supabase.js';
import { logActivity } from './activity-log.js';
import { compressImageFile } from '../utils/image-compress.js';

const NOTES_BUCKET =
    import.meta.env.VITE_SUPABASE_BUCKET_NOTES || 'transaction-notes';

export async function uploadTransactionNote({ transaction, file }) {
    if (!transaction?.id) {
        throw new Error('Data transaksi tidak valid.');
    }

    if (!file) {
        throw new Error('File nota belum dipilih.');
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser();

    if (userError) {
        throw userError;
    }

    const user = userResult.user;

    if (!user) {
        throw new Error('User belum login.');
    }

    const compressed = await compressImageFile(file);
    const filePath = buildNotePath(transaction, compressed.file.name);

    const { error: uploadError } = await supabase.storage
        .from(NOTES_BUCKET)
        .upload(filePath, compressed.file, {
            cacheControl: '3600',
            contentType: compressed.file.type,
            upsert: false
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data, error: insertError } = await supabase
        .from('transaction_attachments')
        .insert({
            transaction_id: transaction.id,
            file_name: compressed.file.name,
            file_path: filePath,
            file_size: compressed.file.size,
            mime_type: compressed.file.type,
            uploaded_by: user.id
        })
        .select()
        .single();

    if (insertError) {
        await supabase.storage.from(NOTES_BUCKET).remove([filePath]);
        throw insertError;
    }

    await logActivity({
        action: 'upload_note',
        entityTable: 'transaction_attachments',
        entityId: data.id,
        description: `Foto nota diupload untuk transaksi: ${transaction.proof_number || transaction.id}`
    });

    return {
        attachment: data,
        compression: compressed
    };
}

export async function getAttachmentSignedUrl(filePath, expiresIn = 10 * 60) {
    if (!filePath) {
        throw new Error('Path file nota tidak tersedia.');
    }

    const { data, error } = await supabase.storage
        .from(NOTES_BUCKET)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        throw error;
    }

    return data.signedUrl;
}

export async function getSignedUrlsForAttachments(attachments = []) {
    const results = await Promise.all(
        attachments.map(async (attachment) => {
            const signedUrl = await getAttachmentSignedUrl(attachment.file_path);

            return {
                ...attachment,
                signedUrl
            };
        })
    );

    return results;
}

function buildNotePath(transaction, fileName) {
    const date = transaction.transaction_date
        ? new Date(`${transaction.transaction_date}T00:00:00`)
        : new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const transactionFolder = transaction.proof_number || transaction.id;
    const random = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return [
        transaction.organization_id,
        year,
        month,
        transactionFolder,
        `${Date.now()}-${random}-${sanitizeFileName(fileName)}`
    ].join('/');
}

function sanitizeFileName(fileName) {
    return String(fileName || 'nota.jpg')
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90);
}