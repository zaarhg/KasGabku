import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env from root
const env = fs.readFileSync('.env', 'utf8');
const config = Object.fromEntries(env.split('\n').map(line => line.split('=')));

const supabaseUrl = config.VITE_SUPABASE_URL;
const supabaseKey = config.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Running migration...');
    const { error } = await supabase.rpc('execute_sql', { 
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ;' 
    });
    
    if (error) {
        if (error.message.includes('function execute_sql(text) does not exist')) {
            console.log('execute_sql RPC not available. Trying direct update check.');
            // Fallback: try to update a non-existent column to see if it exists
            const { error: checkError } = await supabase.from('transactions').select('notes_updated_at').limit(1);
            if (checkError) {
                console.log('Column notes_updated_at does not exist or access denied.');
            } else {
                console.log('Column notes_updated_at already exists.');
            }
        } else {
            console.error('Migration error:', error);
        }
    } else {
        console.log('Migration successful.');
    }
}

migrate();
