// Auth.js - Supabase Authentication Logic
// Handles login, signup, forgot password, and auth state

// Get initialized Supabase Client safely
function getSb() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
        const url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://fivnpfqsawuhdrawvaiu.supabase.co';
        const key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdm5wZnFzYXd1aGRyYXd2YWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTExMzYsImV4cCI6MjEwNzQ2NzEzNn0.JvEvE3ExhpeWWXoG9aTebYf2ngtWLXJZVjVLXSenQ08';
        window.supabaseClient = supabase.createClient(url, key);
        return window.supabaseClient;
    }
    return null;
}

// Toast notification
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function togglePassword(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const icon = input.parentElement.querySelector('.password-toggle i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fa-regular fa-eye-slash';
    } else {
        input.type = 'password';
        if (icon) icon.className = 'fa-regular fa-eye';
    }
}

// Check if user is already logged in
async function checkAuthState() {
    const sb = getSb();
    if (!sb) return false;
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
            return true;
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    await checkAuthState();

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sb = getSb();
            if (!sb) {
                showToast('Authentication service unavailable. Please check your connection.', 'error');
                return;
            }

            const btn = document.getElementById('loginBtn');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                const { data, error } = await sb.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    showToast(error.message || 'Invalid email or password', 'error');
                    btn.classList.remove('btn-loading');
                    btn.disabled = false;
                    return;
                }

                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 400);
            } catch (err) {
                console.error('Login error:', err);
                showToast('Something went wrong. Please try again.', 'error');
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        });

        // Forgot Password
        const forgotLink = document.getElementById('forgotPasswordLink');
        const forgotForm = document.getElementById('forgotPasswordForm');
        const backToLogin = document.getElementById('backToLogin');

        if (forgotLink && forgotForm) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                loginForm.style.display = 'none';
                forgotForm.style.display = 'block';
                document.querySelector('.auth-header h2').textContent = 'Reset Password';
                document.querySelector('.auth-header p').textContent = 'Enter your email to receive a reset link';
            });

            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                forgotForm.style.display = 'none';
                loginForm.style.display = 'block';
                document.querySelector('.auth-header h2').textContent = 'Welcome Back';
                document.querySelector('.auth-header p').textContent = 'Log in to access your dashboard';
            });

            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const sb = getSb();
                if (!sb) return;

                const resetEmail = document.getElementById('resetEmail').value.trim();
                const btn = forgotForm.querySelector('button[type="submit"]');
                btn.classList.add('btn-loading');
                btn.disabled = true;

                try {
                    const { error } = await sb.auth.resetPasswordForEmail(resetEmail, {
                        redirectTo: window.location.origin + '/login.html'
                    });

                    if (error) {
                        showToast(error.message, 'error');
                    } else {
                        showToast('Password reset link sent to your email!', 'success');
                    }
                } catch (err) {
                    showToast('Something went wrong.', 'error');
                }

                btn.classList.remove('btn-loading');
                btn.disabled = false;
            });
        }
    }

    // Signup Form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sb = getSb();
            if (!sb) {
                showToast('Authentication service unavailable. Please check your connection.', 'error');
                return;
            }

            const btn = document.getElementById('signupBtn');
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }

            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                // Sign up with Supabase Auth
                const { data, error } = await sb.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });

                if (error) {
                    const msg = (error.message || '').toLowerCase();
                    if (msg.includes('already registered') || msg.includes('already exists')) {
                        showToast('Account already exists! Logging you in...', 'info');
                        const { error: signInErr } = await sb.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        if (!signInErr) {
                            setTimeout(() => { window.location.href = 'dashboard.html'; }, 400);
                            return;
                        } else {
                            showToast('User already registered. Please go to Log In.', 'error');
                            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
                            return;
                        }
                    }
                    showToast(error.message || 'Signup failed', 'error');
                    btn.classList.remove('btn-loading');
                    btn.disabled = false;
                    return;
                }

                // Sign in to establish session
                showToast('Account created! Welcome to SpendSmart.', 'success');
                const { error: loginErr } = await sb.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (!loginErr) {
                    // Update profile now that user is authenticated
                    if (data?.user) {
                        await sb.from('profiles').upsert({
                            id: data.user.id,
                            full_name: name,
                            currency: '₹',
                            monthly_budget: 35000,
                            theme: 'light'
                        }).catch(console.warn);
                    }

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 400);
                } else {
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 800);
                }
            } catch (err) {
                console.error('Signup error:', err);
                showToast(err.message || 'Something went wrong. Please try logging in.', 'error');
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        });
    }
});
