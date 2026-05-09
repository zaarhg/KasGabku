import { supabase } from './supabase.js';
import { logActivity } from './activity-log.js';

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    return data.session;
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw error;
    }

    // Catat log login
    await logActivity({
        action: 'login',
        description: `Pengguna ${email} masuk ke sistem.`
    });

    return data;
}

export async function signOut() {
    try {
        const user = await getCurrentUser();
        if (user) {
            // Catat log logout sebelum sesi dihapus
            await logActivity({
                action: 'logout',
                description: `Pengguna ${user.email} keluar dari sistem.`
            });
        }
    } catch (e) {
        // Abaikan jika gagal ambil user saat logout
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    return data.user;
}

export async function getCurrentProfile() {
    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', user.id)
        .single();

    if (error) {
        throw error;
    }

    if (!data || !data.is_active) {
        throw new Error('Akun tidak aktif. Hubungi admin Kas Gabku.');
    }

    return data;
}