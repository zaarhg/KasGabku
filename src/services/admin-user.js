import { supabase } from './supabase.js';
import { logActivity } from './activity-log.js';

export async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    if (!data.user) {
        throw new Error('User belum login.');
    }

    return data.user.id;
}

export async function getUserProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
      id,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    `)
        .order('is_active', { ascending: false })
        .order('role', { ascending: true })
        .order('email', { ascending: true });

    if (error) throw error;

    return data || [];
}

export async function updateUserProfile(userId, payload) {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            full_name: cleanText(payload.full_name) || null,
            role: payload.role,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'update_user_profile',
        entityTable: 'profiles',
        entityId: data.id,
        description: `Data user diperbarui: ${data.email}`
    });

    return data;
}

export async function setUserActive(userId, isActive) {
    const currentUserId = await getCurrentUserId();

    if (userId === currentUserId && !isActive) {
        throw new Error('Kamu tidak bisa menonaktifkan akun yang sedang dipakai.');
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({
            is_active: Boolean(isActive),
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;

    await logActivity({
        action: 'toggle_user',
        entityTable: 'profiles',
        entityId: data.id,
        description: `Status user diubah: ${data.email}`
    });

    return data;
}

function cleanText(value) {
    return String(value || '').trim();
}