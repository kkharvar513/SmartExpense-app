// Supabase Configuration
const SUPABASE_URL = 'https://fivnpfqsawuhdrawvaiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdm5wZnFzYXd1aGRyYXd2YWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTExMzYsImV4cCI6MjEwNzQ2NzEzNn0.JvEvE3ExhpeWWXoG9aTebYf2ngtWLXJZVjVLXSenQ08';

// Initialize Supabase Client
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Database connection check
async function checkSupabaseConnection() {
    if (!supabase) return false;
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        return !error;
    } catch (err) {
        console.error('Supabase connection check failed:', err);
        return false;
    }
}
