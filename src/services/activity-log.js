import { supabase } from './supabase.js';

export async function listActivityLogs(filters = {}) {
    let query = supabase
        .from('activity_logs')
        .select(`
      id,
      user_id,
      action,
      entity_table,
      entity_id,
      description,
      created_at,
      profiles (
        id,
        email,
        full_name,
        role
      )
    `)
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

    if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
    }

    if (filters.entity_table && filters.entity_table !== 'all') {
        query = query.eq('entity_table', filters.entity_table);
    }

    if (filters.startDate) {
        query = query.gte('created_at', `${filters.startDate}T00:00:00`);
    }

    if (filters.endDate) {
        query = query.lt('created_at', getNextDate(filters.endDate));
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
}

export async function getActivityLogOptions() {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('action, entity_table')
        .order('action', { ascending: true });

    if (error) throw error;

    const actions = uniqueSorted((data || []).map((item) => item.action).filter(Boolean));
    const entityTables = uniqueSorted(
        (data || []).map((item) => item.entity_table).filter(Boolean)
    );

    return {
        actions,
        entityTables
    };
}

export async function logActivity({
    action,
    entityTable = null,
    entityId = null,
    description = ''
}) {
    try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userResult.user;

        if (!user) return null;

        const { data, error } = await supabase
            .from('activity_logs')
            .insert({
                user_id: user.id,
                action,
                entity_table: entityTable,
                entity_id: entityId,
                description
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.warn('Gagal mencatat log aktivitas:', error);
        return null;
    }
}

function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => {
        return String(a).localeCompare(String(b), 'id-ID');
    });
}

function getNextDate(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);
    date.setDate(date.getDate() + 1);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-') + 'T00:00:00';
}