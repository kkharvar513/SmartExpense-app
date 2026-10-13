// Auth.js - Supabase Authentication Logic
// Handles login, signup, forgot password, and auth state

// Toast notification
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function togglePassword(id) {
    const input = document.getElementById(id);
    const icon = input.parentElement.querySelector('.password-toggle i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-regular fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fa-regular fa-eye';
    }
}

// Check if user is already logged in
async function checkAuthState() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // User is logged in, redirect to dashboard
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
            const btn = document.getElementById('loginBtn');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            btn.classList.add('btn-loading');
            btn.disabled = true;

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    showToast(error.message || 'Invalid credentials', 'error');
                    btn.classList.remove('btn-loading');
                    btn.disabled = false;
                    return;
                }

                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } catch (err) {
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
                const resetEmail = document.getElementById('resetEmail').value.trim();
                const btn = forgotForm.querySelector('button[type="submit"]');
                btn.classList.add('btn-loading');
                btn.disabled = true;

                try {
                    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
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
                const { data, error } = await supabase.auth.signUp({
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
                        const { error: signInErr } = await supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        if (!signInErr) {
                            setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
                            return;
                        } else {
                            showToast('User already registered. Please go to Log In.', 'error');
                            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
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
                const { error: loginErr } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (!loginErr) {
                    // Update profile now that user is authenticated
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        full_name: name,
                        currency: '₹',
                        monthly_budget: 35000,
                        theme: 'light'
                    }).catch(console.warn);

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
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
