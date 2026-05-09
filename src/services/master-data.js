import { supabase } from './supabase.js';
import { getDefaultOrganizationId } from './transaksi.js';
import { logActivity } from './activity-log.js';

export async function getMasterData() {
    const organizationId = await getDefaultOrganizationId();

    const [organizationResult, categoriesResult, signatoriesResult] =
        await Promise.all([
            supabase
                .from('organizations')
                .select('id, name, short_name, address, city, is_active, updated_at')
                .eq('id', organizationId)
                .maybeSingle(),

            supabase
                .from('spending_categories')
                .select('id, name, applies_to, is_active, created_at, updated_at')
                .eq('organization_id', organizationId)
                .order('is_active', { ascending: false })
                .order('name', { ascending: true }),

            supabase
                .from('signatories')
                .select(`
          id,
          full_name,
          position_title,
          identity_type,
          identity_number,
          signer_position,
          is_default,
          is_active,
          created_at,
          updated_at
        `)
                .eq('organization_id', organizationId)
                .order('is_active', { ascending: false })
                .order('signer_position', { ascending: true })
                .order('is_default', { ascending: false })
                .order('full_name', { ascending: true })
        ]);

    if (organizationResult.error) throw organizationResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (signatoriesResult.error) throw signatoriesResult.error;

    return {
        organization: organizationResult.data,
        categories: categoriesResult.data || [],
        signatories: signatoriesResult.data || []
    };
}

export async function updateOrganization(payload) {
    const organizationId = await getDefaultOrganizationId();

    const { data, error } = await supabase
        .from('organizations')
        .update({
            name: cleanText(payload.name),
            short_name: cleanText(payload.short_name),
            address: cleanText(payload.address) || null,
            city: cleanText(payload.city) || 'Kulon Progo',
            updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'update_organization',
        entityTable: 'organizations',
        entityId: data.id,
        description: `Data organisasi diperbarui: ${data.name}`
    });

    return data;
}

export async function createCategory(payload) {
    const organizationId = await getDefaultOrganizationId();

    const { data, error } = await supabase
        .from('spending_categories')
        .insert({
            organization_id: organizationId,
            name: cleanText(payload.name),
            applies_to: normalizeAppliesTo(payload.applies_to),
            is_active: true
        })
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'create_category',
        entityTable: 'spending_categories',
        entityId: data.id,
        description: `Kategori dibuat: ${data.name}`
    });

    return data;
}

export async function updateCategory(categoryId, payload) {
    const { data, error } = await supabase
        .from('spending_categories')
        .update({
            name: cleanText(payload.name),
            applies_to: normalizeAppliesTo(payload.applies_to),
            updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'update_category',
        entityTable: 'spending_categories',
        entityId: data.id,
        description: `Kategori diperbarui: ${data.name}`
    });

    return data;
}

export async function setCategoryActive(categoryId, isActive) {
    const { data, error } = await supabase
        .from('spending_categories')
        .update({
            is_active: Boolean(isActive),
            updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'toggle_category',
        entityTable: 'spending_categories',
        entityId: data.id,
        description: `Status kategori diubah: ${data.name}`
    });

    return data;
}

export async function deleteCategory(categoryId) {
    const { count, error: countError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);

    if (countError) throw countError;

    if (count > 0) {
        throw new Error('Kategori tidak bisa dihapus karena sudah digunakan dalam transaksi. Silakan nonaktifkan saja kategori ini.');
    }

    const { error } = await supabase
        .from('spending_categories')
        .delete()
        .eq('id', categoryId);

    if (error) throw error;

    await logActivity({
        action: 'delete_category',
        entityTable: 'spending_categories',
        entityId: categoryId,
        description: `Kategori dihapus (ID: ${categoryId})`
    });
}

export async function createSignatory(payload) {
    const organizationId = await getDefaultOrganizationId();

    const { data, error } = await supabase
        .from('signatories')
        .insert({
            organization_id: organizationId,
            full_name: cleanText(payload.full_name),
            position_title: cleanText(payload.position_title) || null,
            identity_type: cleanText(payload.identity_type) || null,
            identity_number: cleanText(payload.identity_number) || null,
            signer_position: payload.signer_position,
            is_default: false,
            is_active: true
        })
        .select()
        .single();

    if (error) throw error;

    if (payload.is_default) {
        await setDefaultSignatory(data.id, data.signer_position);
    }

    await logActivity({
        action: 'create_signatory',
        entityTable: 'signatories',
        entityId: data.id,
        description: `Penandatangan dibuat: ${data.full_name}`
    });

    return data;
}

export async function updateSignatory(signatoryId, payload) {
    const { data, error } = await supabase
        .from('signatories')
        .update({
            full_name: cleanText(payload.full_name),
            position_title: cleanText(payload.position_title) || null,
            identity_type: cleanText(payload.identity_type) || null,
            identity_number: cleanText(payload.identity_number) || null,
            signer_position: payload.signer_position,
            is_default: false,
            updated_at: new Date().toISOString()
        })
        .eq('id', signatoryId)
        .select()
        .single();

    if (error) throw error;

    if (payload.is_default) {
        await setDefaultSignatory(signatoryId, payload.signer_position);
    }

    await logActivity({
        action: 'update_signatory',
        entityTable: 'signatories',
        entityId: data.id,
        description: `Penandatangan diperbarui: ${data.full_name}`
    });

    return data;
}

export async function setSignatoryActive(signatoryId, isActive) {
    const { data, error } = await supabase
        .from('signatories')
        .update({
            is_active: Boolean(isActive),
            updated_at: new Date().toISOString()
        })
        .eq('id', signatoryId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'toggle_signatory',
        entityTable: 'signatories',
        entityId: data.id,
        description: `Status penandatangan diubah: ${data.full_name}`
    });

    return data;
}

export async function deleteSignatory(signatoryId) {
    if (!signatoryId) throw new Error('ID penandatangan tidak valid.');

    const { count, error: countError } = await supabase
        .from('generated_documents')
        .select('id', { count: 'exact', head: true })
        .or(`signer_mengetahui_id.eq.${signatoryId},signer_bendahara_id.eq.${signatoryId}`);

    if (countError) {
        console.error('Check usage error:', countError);
        throw new Error('Gagal memeriksa penggunaan penandatangan: ' + countError.message);
    }

    if (count > 0) {
        throw new Error(`Penandatangan tidak bisa dihapus karena sudah tercatat dalam ${count} dokumen PDF yang pernah dibuat. Silakan nonaktifkan saja.`);
    }

    const { error } = await supabase
        .from('signatories')
        .delete()
        .eq('id', signatoryId);

    if (error) throw error;

    await logActivity({
        action: 'delete_signatory',
        entityTable: 'signatories',
        entityId: signatoryId,
        description: `Penandatangan dihapus (ID: ${signatoryId})`
    });
}

export async function setDefaultSignatory(signatoryId, signerPosition) {
    const organizationId = await getDefaultOrganizationId();

    const { error: resetError } = await supabase
        .from('signatories')
        .update({
            is_default: false,
            updated_at: new Date().toISOString()
        })
        .eq('organization_id', organizationId)
        .eq('signer_position', signerPosition);

    if (resetError) throw resetError;

    const { data, error } = await supabase
        .from('signatories')
        .update({
            is_default: true,
            is_active: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', signatoryId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'set_default_signatory',
        entityTable: 'signatories',
        entityId: data.id,
        description: `Default penandatangan diperbarui: ${data.full_name}`
    });

    return data;
}

function normalizeAppliesTo(value) {
    if (value === 'masuk') return 'masuk';
    if (value === 'keluar') return 'keluar';

    return null;
}

function cleanText(value) {
    return String(value || '').trim();
}
