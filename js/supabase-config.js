// Supabase Configuration
const SUPABASE_URL = 'https://fivnpfqsawuhdrawvaiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdm5wZnFzYXd1aGRyYXd2YWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTExMzYsImV4cCI6MjEwNzQ2NzEzNn0.JvEvE3ExhpeWWXoG9aTebYf2ngtWLXJZVjVLXSenQ08';

// Initialize Supabase Client Instance (avoiding global variable collision with UMD library)
try {
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error('Error initializing Supabase client:', e);
}

// Global accessor
function getSupabase() {
    return window.supabaseClient;
}

// Connection test
async function checkSupabaseConnection() {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
        return !error;
    } catch (err) {
        console.error('Supabase connection check failed:', err);
        return false;
    }
}
