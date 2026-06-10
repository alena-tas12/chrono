const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from root directory .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

try {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase cloud settings are not configured.');
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: true
        }
    });
    console.log("⚡ Supabase Cloud Client initialized successfully.");
} catch (e) {
    console.error("⚠️ Failed to initialize Supabase Client:", e.message);
}

let currentClient = supabase;

const proxy = new Proxy({}, {
    get(target, prop) {
        if (prop === '_switchToSandbox') {
            return (mockClient) => {
                currentClient = mockClient;
            };
        }
        if (prop === '_isSandboxMock') {
            return (currentClient && currentClient._isSandboxMock) || false;
        }
        return currentClient ? currentClient[prop] : null;
    },
    set(target, prop, value) {
        if (currentClient) {
            currentClient[prop] = value;
        }
        return true;
    }
});

module.exports = proxy;
