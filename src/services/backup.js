import { supabase } from './supabase.js';
import { getDefaultOrganizationId } from './transaksi.js';
import { logActivity } from './activity-log.js';

export async function createBackupData() {
    const organizationId = await getDefaultOrganizationId();

    const [
        organizationResult,
        appSettingsResult,
        categoriesResult,
        signatoriesResult,
        transactionsResult,
        transactionItemsResult,
        attachmentsResult,
        documentsResult,
        profilesResult,
        logsResult
    ] = await Promise.all([
        supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .maybeSingle(),

        supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle(),

        supabase
            .from('spending_categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true }),

        supabase
            .from('signatories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('signer_position', { ascending: true })
            .order('full_name', { ascending: true }),

        supabase
            .from('transactions')
            .select('*')
            .eq('organization_id', organizationId)
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true }),

        supabase
            .from('transaction_items')
            .select(`
        *,
        transactions!inner (
          organization_id
        )
      `)
            .eq('transactions.organization_id', organizationId)
            .order('created_at', { ascending: true }),

        supabase
            .from('transaction_attachments')
            .select(`
        *,
        transactions!inner (
          organization_id,
          proof_number,
          transaction_date,
          description
        )
      `)
            .eq('transactions.organization_id', organizationId)
            .order('created_at', { ascending: true }),

        supabase
            .from('generated_documents')
            .select('*')
            .eq('organization_id', organizationId)
            .order('generated_at', { ascending: true }),

        supabase
            .from('profiles')
            .select('id, email, full_name, role, is_active, created_at, updated_at')
            .order('email', { ascending: true }),

        supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000)
    ]);

    assertNoError(organizationResult.error);
    assertNoError(appSettingsResult.error);
    assertNoError(categoriesResult.error);
    assertNoError(signatoriesResult.error);
    assertNoError(transactionsResult.error);
    assertNoError(transactionItemsResult.error);
    assertNoError(attachmentsResult.error);
    assertNoError(documentsResult.error);
    assertNoError(profilesResult.error);
    assertNoError(logsResult.error);

    const backup = {
        meta: {
            appName: 'Kas Gabku',
            backupType: 'simple-json',
            backupVersion: 1,
            generatedAt: new Date().toISOString(),
            note: 'Backup ini berisi data aplikasi dan metadata file. File foto nota fisik tidak ikut diunduh.'
        },
        data: {
            organization: organizationResult.data,
            appSettings: appSettingsResult.data,
            spendingCategories: categoriesResult.data || [],
            signatories: signatoriesResult.data || [],
            transactions: transactionsResult.data || [],
            transactionItems: stripJoinedTransaction(transactionItemsResult.data || []),
            transactionAttachments: stripJoinedTransaction(attachmentsResult.data || []),
            generatedDocuments: documentsResult.data || [],
            profiles: profilesResult.data || [],
            activityLogs: logsResult.data || []
        }
    };

    await logActivity({
        action: 'export_backup',
        entityTable: 'organizations',
        entityId: organizationId,
        description: 'Backup data sederhana dibuat dan diunduh.'
    });

    return backup;
}

export function buildBackupFileName(backup) {
    const organizationShortName =
        backup?.data?.organization?.short_name ||
        backup?.data?.organization?.name ||
        'kas-gabku';

    const date = new Date();
    const stamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0')
    ].join('-');

    const safeName = String(organizationShortName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${safeName || 'kas-gabku'}-backup-${stamp}.json`;
}

export function downloadJsonBackup(backup) {
    const fileName = buildBackupFileName(backup);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {
        type: 'application/json;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    return fileName;
}

function assertNoError(error) {
    if (error) {
        throw error;
    }
}

function stripJoinedTransaction(rows) {
    return rows.map((row) => {
        const clone = { ...row };
        delete clone.transactions;
        return clone;
    });
}