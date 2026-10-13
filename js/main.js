// ===================================================================
// SpendSmart - Full Real-time App Engine (Supabase + Local Fallback)
// ===================================================================

let currentUser = null;
let currentProfile = {
    full_name: 'User',
    currency: '₹',
    monthly_budget: 30000,
    theme: 'light'
};

let transactions = [];
let goals = [];
let charts = {};
let activeTxType = 'expense';

// Default categories
const EXPENSE_CATEGORIES = [
    'Food & Dining', 'Groceries', 'Rent & Housing', 'Utilities', 
    'Transportation', 'Shopping', 'Entertainment', 'Health & Fitness', 
    'Travel', 'Education', 'Personal Care', 'Other Expense'
];

const INCOME_CATEGORIES = [
    'Salary', 'Freelance & Projects', 'Investments & Dividends', 
    'Business', 'Rental Income', 'Gifts & Grants', 'Refunds', 'Other Income'
];

// Helper: Toast Notifications
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Currency helpers
function getCurrency() {
    return currentProfile.currency || '₹';
}

function formatMoney(amount) {
    const val = parseFloat(amount || 0);
    return `${getCurrency()}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Realtime Pulse animation
function pulseSyncIndicator() {
    const ind = document.getElementById('syncStatusIndicator');
    if (ind) {
        ind.classList.add('sync-pulsing');
        setTimeout(() => ind.classList.remove('sync-pulsing'), 1000);
    }
}

// ===================================================================
// AUTHENTICATION & INITIALIZATION
// ===================================================================

// Global Supabase Client instance
let sb = null;
function getSb() {
    if (sb) return sb;
    if (window.supabaseClient) {
        sb = window.supabaseClient;
        return sb;
    }
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
        const url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://fivnpfqsawuhdrawvaiu.supabase.co';
        const key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdm5wZnFzYXd1aGRyYXd2YWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTExMzYsImV4cCI6MjEwNzQ2NzEzNn0.JvEvE3ExhpeWWXoG9aTebYf2ngtWLXJZVjVLXSenQ08';
        window.supabaseClient = supabase.createClient(url, key);
        sb = window.supabaseClient;
        return sb;
    }
    return null;
}
sb = getSb();

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initEventListeners();

    // Check Supabase session
    const sb = getSb();
    if (!sb) {
        console.warn('Supabase client not found. Falling back to local demo mode.');
        setupLocalFallbackUser();
        initDashboard();
        return;
    }

    try {
        const { data: { session }, error } = await sb.auth.getSession();
        if (error || !session) {
            // Not authenticated, redirect to login
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;
        
        // Listen to auth changes
        sb.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                window.location.href = 'login.html';
            }
        });

        // Load profile and user data
        await loadUserProfile();
        await loadTransactions();
        await loadGoals();
        
        // Setup real-time listeners
        setupRealtimeSubscriptions();

        // Render everything
        renderApp();

    } catch (err) {
        console.error('Initialization error:', err);
        setupLocalFallbackUser();
        renderApp();
    }
});

function setupLocalFallbackUser() {
    currentUser = { id: 'local-user', email: 'user@example.com' };
    currentProfile = {
        full_name: 'Demo User',
        currency: '₹',
        monthly_budget: 35000,
        theme: localStorage.getItem('theme') || 'light'
    };
    transactions = JSON.parse(localStorage.getItem('ss_local_transactions')) || [];
    goals = JSON.parse(localStorage.getItem('ss_local_goals')) || [];
}

// Load Profile from Supabase
async function loadUserProfile() {
    try {
        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (data) {
            currentProfile = {
                full_name: data.full_name || currentUser.user_metadata?.full_name || 'User',
                currency: data.currency || '₹',
                monthly_budget: parseFloat(data.monthly_budget || 0),
                theme: data.theme || 'light'
            };
        } else {
            // Create default profile if missing
            const fallbackName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            currentProfile.full_name = fallbackName;
            await sb.from('profiles').upsert({
                id: currentUser.id,
                full_name: fallbackName,
                currency: '₹',
                monthly_budget: 35000,
                theme: 'light'
            });
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }

    // Apply currency selector
    const currSelect = document.getElementById('currencySelector');
    if (currSelect) currSelect.value = currentProfile.currency || '₹';

    // Apply User info in UI
    updateUserDisplay();
}

function updateUserDisplay() {
    const userNameEl = document.getElementById('userName');
    const sideNameEl = document.getElementById('sidebarUserName');
    const sideEmailEl = document.getElementById('sidebarUserEmail');
    const sideAvatarEl = document.getElementById('sidebarAvatar');

    const name = currentProfile.full_name || 'User';
    if (userNameEl) userNameEl.textContent = name;
    if (sideNameEl) sideNameEl.textContent = name;
    if (sideEmailEl) sideEmailEl.textContent = currentUser?.email || 'user@example.com';
    if (sideAvatarEl) sideAvatarEl.textContent = name.charAt(0).toUpperCase();

    // Update currency symbols across forms
    document.querySelectorAll('.curr-symbol').forEach(el => el.textContent = getCurrency());
}

// Load Transactions from Supabase
async function loadTransactions() {
    if (!getSb() || currentUser.id === 'local-user') {
        transactions = JSON.parse(localStorage.getItem('ss_local_transactions')) || [];
        return;
    }

    try {
        const { data, error } = await sb
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        transactions = data || [];
    } catch (err) {
        console.error('Failed to load transactions:', err);
        showToast('Could not sync transactions from cloud.', 'error');
    }
}

// Load Goals from Supabase
async function loadGoals() {
    if (!getSb() || currentUser.id === 'local-user') {
        goals = JSON.parse(localStorage.getItem('ss_local_goals')) || [];
        return;
    }

    try {
        const { data, error } = await sb
            .from('goals')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        goals = data || [];
    } catch (err) {
        console.error('Failed to load goals:', err);
    }
}

// Real-time Subscriptions (Live sync across tabs & devices)
function setupRealtimeSubscriptions() {
    if (!getSb() || currentUser.id === 'local-user') return;

    try {
        // Transactions real-time channel
        getSb()
            .channel('public:transactions:' + currentUser.id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'transactions',
                filter: `user_id=eq.${currentUser.id}`
            }, (payload) => {
                pulseSyncIndicator();
                if (payload.eventType === 'INSERT') {
                    if (!transactions.some(t => t.id === payload.new.id)) {
                        transactions.unshift(payload.new);
                        showToast(`New ${payload.new.type} added in real-time!`, 'info');
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const idx = transactions.findIndex(t => t.id === payload.new.id);
                    if (idx !== -1) transactions[idx] = payload.new;
                } else if (payload.eventType === 'DELETE') {
                    transactions = transactions.filter(t => t.id === payload.old.id);
                }
                renderApp();
            })
            .subscribe();

        // Goals real-time channel
        getSb()
            .channel('public:goals:' + currentUser.id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'goals',
                filter: `user_id=eq.${currentUser.id}`
            }, (payload) => {
                pulseSyncIndicator();
                if (payload.eventType === 'INSERT') {
                    if (!goals.some(g => g.id === payload.new.id)) goals.push(payload.new);
                } else if (payload.eventType === 'UPDATE') {
                    const idx = goals.findIndex(g => g.id === payload.new.id);
                    if (idx !== -1) goals[idx] = payload.new;
                } else if (payload.eventType === 'DELETE') {
                    goals = goals.filter(g => g.id === payload.old.id);
                }
                renderGoals();
            })
            .subscribe();

        // Profiles real-time channel
        getSb()
            .channel('public:profiles:' + currentUser.id)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${currentUser.id}`
            }, (payload) => {
                currentProfile.currency = payload.new.currency;
                currentProfile.monthly_budget = parseFloat(payload.new.monthly_budget || 0);
                currentProfile.full_name = payload.new.full_name;
                updateUserDisplay();
                renderOverview();
            })
            .subscribe();

    } catch (err) {
        console.error('Realtime subscription error:', err);
    }
}

// ===================================================================
// EVENT LISTENERS & NAVIGATION
// ===================================================================

function initEventListeners() {
    // Current date label
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = item.getAttribute('data-view');
            switchView(viewName);
        });
    });

    // Mobile sidebar toggle
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const sidebar = document.getElementById('sidebar');

    if (openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Currency selector
    const currSelect = document.getElementById('currencySelector');
    if (currSelect) {
        currSelect.addEventListener('change', async (e) => {
            currentProfile.currency = e.target.value;
            updateUserDisplay();
            renderApp();

            if (getSb() && currentUser?.id !== 'local-user') {
                await sb.from('profiles').update({ currency: currentProfile.currency }).eq('id', currentUser.id);
            }
            showToast(`Currency changed to ${currentProfile.currency}`);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (getSb()) await sb.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    // Modal Triggers
    const addTxBtn = document.getElementById('openAddTxModalBtn');
    if (addTxBtn) addTxBtn.addEventListener('click', () => openTransactionModal('expense'));

    const quickExpBtn = document.getElementById('quickAddExpenseBtn');
    if (quickExpBtn) quickExpBtn.addEventListener('click', () => openTransactionModal('expense'));

    const quickIncBtn = document.getElementById('quickAddIncomeBtn');
    if (quickIncBtn) quickIncBtn.addEventListener('click', () => openTransactionModal('income'));

    const quickGoalBtn = document.getElementById('quickAddGoalBtn');
    if (quickGoalBtn) quickGoalBtn.addEventListener('click', () => openGoalModal());

    const openAddGoalModalBtn = document.getElementById('openAddGoalModalBtn');
    if (openAddGoalModalBtn) openAddGoalModalBtn.addEventListener('click', () => openGoalModal());

    const closeTxModal = document.getElementById('closeExpenseModal');
    if (closeTxModal) closeTxModal.addEventListener('click', () => closeTransactionModal());

    // Transaction Form Submit
    const txForm = document.getElementById('expenseForm');
    if (txForm) txForm.addEventListener('submit', handleTransactionSubmit);

    // Goal Form Submit
    const goalForm = document.getElementById('saveGoalForm');
    if (goalForm) goalForm.addEventListener('submit', handleGoalSubmit);

    // Deposit Form Submit
    const depForm = document.getElementById('depositForm');
    if (depForm) depForm.addEventListener('submit', handleDepositSubmit);

    // Profile Settings
    const profBtn = document.getElementById('profileSettingsBtn');
    if (profBtn) profBtn.addEventListener('click', openProfileModal);

    const profForm = document.getElementById('profileForm');
    if (profForm) profForm.addEventListener('submit', handleProfileSubmit);

    // Budget Limits Form
    const budgetForm = document.getElementById('goalsForm');
    if (budgetForm) budgetForm.addEventListener('submit', handleBudgetSubmit);

    // Split Checkbox toggle
    const splitCb = document.getElementById('expSplit');
    if (splitCb) {
        splitCb.addEventListener('change', (e) => {
            const group = document.getElementById('splitGroup');
            if (group) group.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // Search & Filter listeners
    const searchTx = document.getElementById('searchTransactions');
    if (searchTx) searchTx.addEventListener('input', () => renderRecentTransactions());

    const filterType = document.getElementById('filterType');
    if (filterType) filterType.addEventListener('change', () => renderRecentTransactions());

    const fullTxSearch = document.getElementById('fullTxSearch');
    if (fullTxSearch) fullTxSearch.addEventListener('input', () => renderFullTransactions());

    const fullTxCatFilter = document.getElementById('fullTxCategoryFilter');
    if (fullTxCatFilter) fullTxCatFilter.addEventListener('change', () => renderFullTransactions());

    const fullTxTypeFilter = document.getElementById('fullTxTypeFilter');
    if (fullTxTypeFilter) fullTxTypeFilter.addEventListener('change', () => renderFullTransactions());

    const fullTxDateFilter = document.getElementById('fullTxDateFilter');
    if (fullTxDateFilter) fullTxDateFilter.addEventListener('change', () => renderFullTransactions());

    // Analytics Time Filter
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) timeFilter.addEventListener('change', () => renderAnalytics());

    // Export Buttons
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', openExportModal);

    const quickExportBtn = document.getElementById('quickExportBtn');
    if (quickExportBtn) quickExportBtn.addEventListener('click', openExportModal);

    // Demo Data Loader
    const loadSampleBtn = document.getElementById('loadSampleDataBtn');
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', loadSampleData);

    const loadSampleEmptyBtn = document.getElementById('loadSampleDataEmptyBtn');
    if (loadSampleEmptyBtn) loadSampleEmptyBtn.addEventListener('click', loadSampleData);
}

// Switch View Sections
function switchView(viewName) {
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
        if (item.getAttribute('data-view') === viewName) item.classList.add('active');
        else item.classList.remove('active');
    });

    document.querySelectorAll('.view-section').forEach(sec => {
        if (sec.id === `view-${viewName}`) sec.classList.add('active');
        else sec.classList.remove('active');
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Trigger re-renders
    if (viewName === 'overview') renderOverview();
    else if (viewName === 'transactions') renderFullTransactions();
    else if (viewName === 'analytics') renderAnalytics();
    else if (viewName === 'goals') renderGoals();
    else if (viewName === 'recurring') renderRecurring();
    else if (viewName === 'split') renderSplitBills();
    else if (viewName === 'budget') renderBudgetView();
}

// Theme handling
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.className = `${saved}-theme`;
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.className = `${next}-theme`;
    localStorage.setItem('theme', next);
    currentProfile.theme = next;
    updateThemeIcon(next);

    if (getSb() && currentUser?.id !== 'local-user') {
        getSb().from('profiles').update({ theme: next }).eq('id', currentUser.id);
    }
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' 
            ? '<i class="fa-solid fa-sun"></i> Light Mode' 
            : '<i class="fa-solid fa-moon"></i> Dark Mode';
    }
}

// ===================================================================
// CORE DATA RENDERING
// ===================================================================

function renderApp() {
    renderOverview();
    renderFullTransactions();
    renderAnalytics();
    renderGoals();
    renderRecurring();
    renderSplitBills();
    renderBudgetView();
}

// Render Overview Dashboard
function renderOverview() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter this month's transactions
    const thisMonthTxs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let totalInc = 0;
    let totalExp = 0;

    thisMonthTxs.forEach(t => {
        const amt = parseFloat(t.amount || 0);
        if (t.type === 'income') totalInc += amt;
        else totalExp += amt;
    });

    const netBal = totalInc - totalExp;
    const monthlyBudget = currentProfile.monthly_budget || 0;
    const budgetLeft = monthlyBudget > 0 ? (monthlyBudget - totalExp) : 0;

    // KPI Elements
    const netEl = document.getElementById('netBalance');
    const netSub = document.getElementById('netBalanceSub');
    const incEl = document.getElementById('totalIncome');
    const expEl = document.getElementById('totalSpent');
    const bgtLeftEl = document.getElementById('budgetLeft');
    const bgtDescEl = document.getElementById('monthlyBudgetDesc');

    if (netEl) {
        netEl.textContent = formatMoney(netBal);
        netEl.style.color = netBal >= 0 ? 'var(--text-main)' : 'var(--danger)';
    }
    if (netSub) {
        const savingsRate = totalInc > 0 ? ((netBal / totalInc) * 100).toFixed(0) : 0;
        netSub.textContent = totalInc > 0 ? `${savingsRate}% savings rate` : 'Cashflow this month';
    }
    if (incEl) incEl.textContent = formatMoney(totalInc);
    if (expEl) expEl.textContent = formatMoney(totalExp);
    if (bgtLeftEl) {
        bgtLeftEl.textContent = formatMoney(budgetLeft);
        bgtLeftEl.style.color = budgetLeft < 0 ? 'var(--danger)' : 'var(--text-main)';
    }
    if (bgtDescEl) bgtDescEl.textContent = formatMoney(monthlyBudget);

    // Insights Banner
    renderInsightBanner(totalInc, totalExp, monthlyBudget, budgetLeft);

    // Render Overview Charts
    renderOverviewCharts(thisMonthTxs);

    // Render Recent Transactions Table
    renderRecentTransactions();
}

function renderInsightBanner(income, spent, budget, budgetLeft) {
    const alertEl = document.getElementById('insightAlert');
    const textEl = document.getElementById('insightText');
    if (!alertEl || !textEl) return;

    if (transactions.length === 0) {
        textEl.innerHTML = `Welcome to SpendSmart! Click <strong>"Load Demo Data"</strong> or <strong>"+ Add Entry"</strong> to start tracking your finances in real-time.`;
        return;
    }

    if (budget > 0) {
        const pctUsed = ((spent / budget) * 100).toFixed(1);
        if (pctUsed > 100) {
            textEl.innerHTML = `<span class="text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation"></i> Budget Exceeded:</span> You have spent ${pctUsed}% of your ${formatMoney(budget)} limit. Consider cutting down on discretionary expenses.`;
            alertEl.style.borderLeftColor = 'var(--danger)';
            return;
        } else if (pctUsed > 80) {
            textEl.innerHTML = `<span class="text-warning fw-bold"><i class="fa-solid fa-bell"></i> Budget Alert:</span> You have used ${pctUsed}% of your budget with ${formatMoney(budgetLeft)} remaining for this month.`;
            alertEl.style.borderLeftColor = 'var(--warning)';
            return;
        }
    }

    if (income > spent) {
        const saved = income - spent;
        textEl.innerHTML = `<span class="text-success fw-bold"><i class="fa-solid fa-circle-check"></i> Great job!</span> You have a positive cashflow of <strong>${formatMoney(saved)}</strong> this month. Keep building your savings!`;
        alertEl.style.borderLeftColor = 'var(--success)';
    } else {
        textEl.innerHTML = `<i class="fa-solid fa-lightbulb text-primary"></i> <strong>Tip:</strong> Keep tracking every daily expense to identify spending leaks and boost your savings rate!`;
        alertEl.style.borderLeftColor = 'var(--primary)';
    }
}

// Charts for Overview
function renderOverviewCharts(thisMonthTxs) {
    // 1. Category Pie Chart
    const expenseTxs = thisMonthTxs.filter(t => t.type === 'expense');
    const catMap = {};
    expenseTxs.forEach(t => {
        catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount);
    });

    const categories = Object.keys(catMap);
    const amounts = Object.values(catMap);
    const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316'];

    const pieCanvas = document.getElementById('categoryPieChart');
    if (pieCanvas) {
        if (charts.categoryPie) charts.categoryPie.destroy();

        if (categories.length === 0) {
            charts.categoryPie = new Chart(pieCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['No Expenses'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { tooltip: { enabled: false }, legend: { position: 'bottom' } }
                }
            });
        } else {
            charts.categoryPie = new Chart(pieCanvas, {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: amounts,
                        backgroundColor: colors.slice(0, categories.length),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }

    // 2. Cashflow Comparison (Bar Chart)
    const barCanvas = document.getElementById('cashflowBarChart');
    if (barCanvas) {
        if (charts.cashflowBar) charts.cashflowBar.destroy();

        // Calculate past 4 months cashflow
        const monthLabels = [];
        const incData = [];
        const expData = [];

        for (let i = 3; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.getMonth();
            const y = d.getFullYear();
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            monthLabels.push(label);

            let mInc = 0;
            let mExp = 0;
            transactions.forEach(t => {
                const td = new Date(t.date);
                if (td.getMonth() === m && td.getFullYear() === y) {
                    if (t.type === 'income') mInc += parseFloat(t.amount);
                    else mExp += parseFloat(t.amount);
                }
            });
            incData.push(mInc);
            expData.push(mExp);
        }

        charts.cashflowBar = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Income',
                        data: incData,
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    },
                    {
                        label: 'Expense',
                        data: expData,
                        backgroundColor: '#ef4444',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12 } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (v) => `${getCurrency()}${v}`
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// Render Recent Transactions
function renderRecentTransactions() {
    const tbody = document.getElementById('txTableBody');
    const noData = document.getElementById('noDataMsg');
    const searchVal = (document.getElementById('searchTransactions')?.value || '').toLowerCase();
    const typeVal = document.getElementById('filterType')?.value || 'all';

    if (!tbody) return;

    let filtered = transactions.filter(t => {
        const matchesSearch = (t.description || '').toLowerCase().includes(searchVal) || 
                              (t.category || '').toLowerCase().includes(searchVal);
        const matchesType = typeVal === 'all' || t.type === typeVal;
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (noData) noData.style.display = 'block';
        return;
    }

    if (noData) noData.style.display = 'none';

    // Show recent 10 transactions
    const slice = filtered.slice(0, 10);
    tbody.innerHTML = slice.map(t => {
        const isExp = t.type === 'expense';
        const typeBadge = isExp 
            ? `<span class="badge badge-danger text-xs"><i class="fa-solid fa-arrow-down"></i> Expense</span>`
            : `<span class="badge badge-success text-xs"><i class="fa-solid fa-arrow-up"></i> Income</span>`;

        const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const amtStr = `${isExp ? '-' : '+'}${formatMoney(t.amount)}`;
        const amtColor = isExp ? 'var(--danger)' : 'var(--success)';

        let extraTags = '';
        if (t.is_recurring) extraTags += `<span class="badge badge-primary text-xs me-1"><i class="fa-solid fa-repeat"></i> Recurring</span>`;
        if (t.split_with) extraTags += `<span class="badge badge-warning text-xs me-1"><i class="fa-solid fa-user-group"></i> Split: ${escapeHtml(t.split_with)}</span>`;
        if (t.receipt_url) extraTags += `<span class="text-xs text-muted" title="${escapeHtml(t.receipt_url)}"><i class="fa-solid fa-paperclip"></i></span>`;

        return `
            <tr>
                <td>${dateStr}</td>
                <td>${typeBadge}</td>
                <td><strong>${escapeHtml(t.category)}</strong></td>
                <td>${escapeHtml(t.description || '-')}</td>
                <td>${extraTags || '<span class="text-muted text-xs">-</span>'}</td>
                <td class="text-right fw-bold" style="color: ${amtColor};">${amtStr}</td>
                <td class="text-center">
                    <button class="btn-icon text-muted me-1" onclick="editTransaction('${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon text-danger" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Full Transactions View
function renderFullTransactions() {
    const tbody = document.getElementById('fullTxTableBody');
    if (!tbody) return;

    // Populate category dropdown in filters if empty
    const catSelect = document.getElementById('fullTxCategoryFilter');
    if (catSelect && catSelect.options.length <= 1) {
        const allCats = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            catSelect.appendChild(opt);
        });
    }

    const searchVal = (document.getElementById('fullTxSearch')?.value || '').toLowerCase();
    const catVal = document.getElementById('fullTxCategoryFilter')?.value || 'all';
    const typeVal = document.getElementById('fullTxTypeFilter')?.value || 'all';
    const dateVal = document.getElementById('fullTxDateFilter')?.value || 'all';

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    let filtered = transactions.filter(t => {
        const matchesSearch = (t.description || '').toLowerCase().includes(searchVal) ||
                              (t.category || '').toLowerCase().includes(searchVal) ||
                              (t.split_with || '').toLowerCase().includes(searchVal);
        const matchesCat = catVal === 'all' || t.category === catVal;
        const matchesType = typeVal === 'all' || t.type === typeVal;

        let matchesDate = true;
        const td = new Date(t.date);
        if (dateVal === 'this_month') {
            matchesDate = td.getMonth() === curMonth && td.getFullYear() === curYear;
        } else if (dateVal === 'last_month') {
            const lastM = curMonth === 0 ? 11 : curMonth - 1;
            const lastY = curMonth === 0 ? curYear - 1 : curYear;
            matchesDate = td.getMonth() === lastM && td.getFullYear() === lastY;
        } else if (dateVal === 'this_year') {
            matchesDate = td.getFullYear() === curYear;
        }

        return matchesSearch && matchesCat && matchesType && matchesDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted">No transactions match your filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const isExp = t.type === 'expense';
        const typeBadge = isExp 
            ? `<span class="badge badge-danger text-xs">Expense</span>`
            : `<span class="badge badge-success text-xs">Income</span>`;

        const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const amtStr = `${isExp ? '-' : '+'}${formatMoney(t.amount)}`;
        const amtColor = isExp ? 'var(--danger)' : 'var(--success)';

        let extraTags = [];
        if (t.is_recurring) extraTags.push(`<span class="badge badge-primary text-xs">Monthly</span>`);
        if (t.split_with) extraTags.push(`<span class="badge badge-warning text-xs">Split: ${escapeHtml(t.split_with)}</span>`);

        return `
            <tr>
                <td>${dateStr}</td>
                <td>${typeBadge}</td>
                <td><strong>${escapeHtml(t.category)}</strong></td>
                <td>${escapeHtml(t.description || '-')}</td>
                <td>${extraTags.join(' ') || '<span class="text-muted text-xs">-</span>'}</td>
                <td class="text-right fw-bold" style="color: ${amtColor};">${amtStr}</td>
                <td class="text-center">
                    <button class="btn-icon text-muted me-1" onclick="editTransaction('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon text-danger" onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Analytics View
function renderAnalytics() {
    const filter = document.getElementById('timeFilter')?.value || 'this_month';
    const now = new Date();

    // Determine cutoff date
    let cutoff = new Date();
    if (filter === 'this_month') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'last_month') {
        cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (filter === '3_months') {
        cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (filter === '6_months') {
        cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (filter === '1_year') {
        cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }

    const filtered = transactions.filter(t => new Date(t.date) >= cutoff);

    // 1. Monthly Trend Line Chart
    const trendCanvas = document.getElementById('trendLineChart');
    if (trendCanvas) {
        if (charts.trendLine) charts.trendLine.destroy();

        // Group by month
        const monthlyMap = {};
        filtered.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) };
            if (t.type === 'income') monthlyMap[key].income += parseFloat(t.amount);
            else monthlyMap[key].expense += parseFloat(t.amount);
        });

        const sortedKeys = Object.keys(monthlyMap).sort();
        const labels = sortedKeys.map(k => monthlyMap[k].label);
        const incData = sortedKeys.map(k => monthlyMap[k].income);
        const expData = sortedKeys.map(k => monthlyMap[k].expense);

        charts.trendLine = new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Current'],
                datasets: [
                    {
                        label: 'Income',
                        data: incData.length ? incData : [0],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Expenses',
                        data: expData.length ? expData : [0],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}` }
                    }
                },
                scales: {
                    y: {
                        ticks: { callback: (v) => `${getCurrency()}${v}` },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
    }

    // 2. Category Pie Chart in Analytics
    const pieCanvas = document.getElementById('analyticsPieChart');
    if (pieCanvas) {
        if (charts.analyticsPie) charts.analyticsPie.destroy();

        const catMap = {};
        filtered.filter(t => t.type === 'expense').forEach(t => {
            catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount);
        });

        const labels = Object.keys(catMap);
        const data = Object.values(catMap);
        const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6'];

        charts.analyticsPie = new Chart(pieCanvas, {
            type: 'pie',
            data: {
                labels: labels.length ? labels : ['No Expenses'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: colors.slice(0, labels.length || 1)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12 } },
                    tooltip: {
                        callbacks: { label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw)}` }
                    }
                }
            }
        });
    }

    // 3. Top Spending Horizontal Bar Chart
    const barCanvas = document.getElementById('analyticsBarChart');
    if (barCanvas) {
        if (charts.analyticsBar) charts.analyticsBar.destroy();

        const catMap = {};
        filtered.filter(t => t.type === 'expense').forEach(t => {
            catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount);
        });

        const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        charts.analyticsBar = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['None'],
                datasets: [{
                    label: 'Amount Spent',
                    data: data.length ? data : [0],
                    backgroundColor: '#7c3aed',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: (ctx) => ` Spent: ${formatMoney(ctx.raw)}` }
                    }
                },
                scales: {
                    x: { ticks: { callback: (v) => `${getCurrency()}${v}` } }
                }
            }
        });
    }
}

// Render Savings Goals View
function renderGoals() {
    const container = document.getElementById('goalsCardsContainer');
    const noGoals = document.getElementById('noGoalsMsg');
    if (!container) return;

    if (goals.length === 0) {
        container.innerHTML = '';
        if (noGoals) noGoals.style.display = 'block';
        return;
    }

    if (noGoals) noGoals.style.display = 'none';

    container.innerHTML = goals.map(g => {
        const target = parseFloat(g.target_amount || 1);
        const current = parseFloat(g.current_amount || 0);
        const pct = Math.min(100, Math.round((current / target) * 100));
        const color = g.color || '#7c3aed';
        const isComplete = current >= target;

        const deadlineStr = g.deadline 
            ? `<div class="text-xs text-muted mt-2"><i class="fa-regular fa-calendar"></i> Target: ${new Date(g.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>` 
            : '';

        return `
            <div class="card goal-card-item p-4" style="border-top: 4px solid ${color}; position: relative;">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="fw-bold mb-0">${escapeHtml(g.name)}</h3>
                    <div class="d-flex gap-1">
                        <button class="btn-icon text-muted" onclick="openDepositModal('${g.id}')" title="Deposit Money"><i class="fa-solid fa-plus text-success"></i></button>
                        <button class="btn-icon text-muted" onclick="editGoal('${g.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon text-danger" onclick="deleteGoal('${g.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>

                <div class="d-flex justify-content-between align-items-baseline mb-2">
                    <span class="fs-4 fw-bold" style="color: ${color};">${formatMoney(current)}</span>
                    <span class="text-muted text-sm">of ${formatMoney(target)}</span>
                </div>

                <div class="progress-bar-container" style="height: 10px; background: var(--bg-subtle); border-radius: 999px; overflow: hidden;">
                    <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: ${color}; transition: width 0.6s ease;"></div>
                </div>

                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="text-xs fw-bold" style="color: ${isComplete ? 'var(--success)' : 'inherit'};">
                        ${isComplete ? '<i class="fa-solid fa-circle-check text-success"></i> Goal Reached!' : `${pct}% achieved`}
                    </span>
                    <button class="btn btn-sm btn-outline" onclick="openDepositModal('${g.id}')">Deposit</button>
                </div>

                ${deadlineStr}
            </div>
        `;
    }).join('');
}

// Render Recurring / Subscriptions View
function renderRecurring() {
    const listEl = document.getElementById('recurringList');
    const totalEl = document.getElementById('recurringMonthlyTotal');
    const countEl = document.getElementById('recurringCount');
    if (!listEl) return;

    const recurringTxs = transactions.filter(t => t.is_recurring);
    let total = 0;
    recurringTxs.forEach(t => total += parseFloat(t.amount || 0));

    if (totalEl) totalEl.textContent = `${formatMoney(total)} / month`;
    if (countEl) countEl.textContent = recurringTxs.length;

    if (recurringTxs.length === 0) {
        listEl.innerHTML = `
            <div class="card text-center p-5">
                <i class="fa-solid fa-arrows-rotate fa-3x text-muted mb-3" style="opacity: 0.3;"></i>
                <h4>No Subscriptions Found</h4>
                <p class="text-muted">When adding a transaction like Netflix, Gym, or Rent, check "Recurring Monthly" to track it here!</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = recurringTxs.map(t => {
        const isExp = t.type === 'expense';
        return `
            <div class="card p-3 mb-2 d-flex justify-content-between align-items-center flex-row flex-wrap gap-2">
                <div class="d-flex align-items-center gap-3">
                    <div class="card-icon" style="width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; background: rgba(124, 58, 237, 0.1); color: #7c3aed;">
                        <i class="fa-solid fa-repeat"></i>
                    </div>
                    <div>
                        <h4 class="mb-0 fw-bold">${escapeHtml(t.description || t.category)}</h4>
                        <span class="text-xs text-muted">${escapeHtml(t.category)} • Recurring Monthly</span>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span class="fw-bold fs-5" style="color: ${isExp ? 'var(--danger)' : 'var(--success)'};">${isExp ? '-' : '+'}${formatMoney(t.amount)}</span>
                    <button class="btn-icon text-danger" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// Render Split Bills View
function renderSplitBills() {
    const listEl = document.getElementById('splitList');
    if (!listEl) return;

    const splitTxs = transactions.filter(t => t.split_with && t.split_with.trim() !== '');

    if (splitTxs.length === 0) {
        listEl.innerHTML = `
            <div class="card text-center p-5">
                <i class="fa-solid fa-money-bill-transfer fa-3x text-muted mb-3" style="opacity: 0.3;"></i>
                <h4>No Split Bills Recorded</h4>
                <p class="text-muted">When adding an expense shared with friends, check "Split Bill" and add their names to calculate per-person shares.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = splitTxs.map(t => {
        const names = t.split_with.split(',').map(n => n.trim()).filter(Boolean);
        const totalPeople = names.length + 1; // friends + user
        const totalAmt = parseFloat(t.amount || 0);
        const perPerson = totalAmt / totalPeople;

        return `
            <div class="card p-4 mb-3">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <div>
                        <h3 class="mb-0 fw-bold">${escapeHtml(t.description || t.category)}</h3>
                        <span class="text-muted text-xs">Total Bill: <strong>${formatMoney(totalAmt)}</strong></span>
                    </div>
                    <span class="badge badge-warning">Split across ${totalPeople} people</span>
                </div>
                <p class="text-sm mb-3">
                    Each person pays: <strong class="text-primary">${formatMoney(perPerson)}</strong>
                </p>
                <div class="d-flex flex-wrap gap-2">
                    <span class="badge badge-success">You: Paid ${formatMoney(totalAmt)}</span>
                    ${names.map(name => `
                        <span class="badge badge-primary">
                            <i class="fa-solid fa-user"></i> ${escapeHtml(name)} owes ${formatMoney(perPerson)}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Render Budget View
function renderBudgetView() {
    const budgetInput = document.getElementById('inputMonthlyBudget');
    const spentEl = document.getElementById('progSpent');
    const limitEl = document.getElementById('progLimit');
    const barEl = document.getElementById('budgetProgressBar');
    const statusText = document.getElementById('budgetStatusText');

    const monthlyBudget = currentProfile.monthly_budget || 0;
    if (budgetInput) budgetInput.value = monthlyBudget;

    // Calculate this month's spending
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    let spent = 0;
    transactions.forEach(t => {
        const td = new Date(t.date);
        if (t.type === 'expense' && td.getMonth() === curMonth && td.getFullYear() === curYear) {
            spent += parseFloat(t.amount || 0);
        }
    });

    if (spentEl) spentEl.textContent = `Spent: ${formatMoney(spent)}`;
    if (limitEl) limitEl.textContent = `Limit: ${formatMoney(monthlyBudget)}`;

    const pct = monthlyBudget > 0 ? Math.min(100, Math.round((spent / monthlyBudget) * 100)) : 0;
    if (barEl) {
        barEl.style.width = `${pct}%`;
        barEl.style.background = pct > 90 ? 'var(--danger)' : pct > 75 ? 'var(--warning)' : 'var(--primary)';
    }

    if (statusText) {
        if (monthlyBudget === 0) {
            statusText.textContent = 'Set a monthly spending limit above to enable alerts.';
        } else if (spent > monthlyBudget) {
            statusText.innerHTML = `<span class="text-danger fw-bold"><i class="fa-solid fa-circle-exclamation"></i> Over budget by ${formatMoney(spent - monthlyBudget)}!</span>`;
        } else {
            statusText.textContent = `${pct}% of monthly budget utilized. ${formatMoney(monthlyBudget - spent)} remaining.`;
        }
    }
}

// ===================================================================
// TRANSACTION MODAL & ACTIONS
// ===================================================================

function openTransactionModal(type = 'expense', isRecurring = false) {
    activeTxType = type;
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    const title = document.getElementById('modalTxTitle');
    const idInput = document.getElementById('editingTxId');
    const recurringInput = document.getElementById('expRecurring');
    const dateInput = document.getElementById('expDate');

    if (!modal || !form) return;

    form.reset();
    idInput.value = '';
    title.textContent = type === 'expense' ? 'Add Expense' : 'Add Income';
    dateInput.value = new Date().toISOString().split('T')[0];
    if (recurringInput) recurringInput.checked = isRecurring;

    switchTxType(type);
    modal.classList.add('show');
}

function switchTxType(type) {
    activeTxType = type;
    document.getElementById('txType').value = type;

    const expBtn = document.getElementById('typeExpenseBtn');
    const incBtn = document.getElementById('typeIncomeBtn');
    const splitWrapper = document.getElementById('splitBillToggleWrapper');

    if (type === 'expense') {
        expBtn.classList.add('active');
        incBtn.classList.remove('active');
        if (splitWrapper) splitWrapper.style.display = 'flex';
        loadCategoryOptions(EXPENSE_CATEGORIES);
    } else {
        incBtn.classList.add('active');
        expBtn.classList.remove('active');
        if (splitWrapper) splitWrapper.style.display = 'none';
        document.getElementById('splitGroup').style.display = 'none';
        loadCategoryOptions(INCOME_CATEGORIES);
    }
}

function loadCategoryOptions(catList, selectedCat = '') {
    const select = document.getElementById('expCategory');
    if (!select) return;
    select.innerHTML = catList.map(c => `
        <option value="${c}" ${c === selectedCat ? 'selected' : ''}>${c}</option>
    `).join('');
}

function closeTransactionModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) modal.classList.remove('show');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveTxBtn');
    btn.disabled = true;

    const id = document.getElementById('editingTxId').value;
    const type = document.getElementById('txType').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const date = document.getElementById('expDate').value;
    const category = document.getElementById('expCategory').value;
    const description = document.getElementById('expDescription').value.trim();
    const isRecurring = document.getElementById('expRecurring').checked;
    const isSplit = document.getElementById('expSplit').checked;
    const splitWith = isSplit ? document.getElementById('expSplitWith').value.trim() : null;
    const receiptUrl = document.getElementById('expReceiptUrl').value.trim() || null;

    const txData = {
        user_id: currentUser.id,
        type,
        amount,
        date,
        category,
        description,
        is_recurring: isRecurring,
        split_with: splitWith,
        receipt_url: receiptUrl
    };

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            if (id) {
                // Update
                const { error } = await sb.from('transactions').update(txData).eq('id', id);
                if (error) throw error;
                const idx = transactions.findIndex(t => t.id === id);
                if (idx !== -1) transactions[idx] = { ...transactions[idx], ...txData };
                showToast('Transaction updated successfully!');
            } else {
                // Insert
                const { data, error } = await sb.from('transactions').insert(txData).select().single();
                if (error) throw error;
                transactions.unshift(data);
                showToast(`${type === 'expense' ? 'Expense' : 'Income'} added successfully!`);
            }
        } else {
            // Local fallback
            if (id) {
                const idx = transactions.findIndex(t => t.id === id);
                if (idx !== -1) transactions[idx] = { ...transactions[idx], ...txData };
            } else {
                txData.id = 'loc_' + Date.now();
                transactions.unshift(txData);
            }
            localStorage.setItem('ss_local_transactions', JSON.stringify(transactions));
            showToast('Saved locally!');
        }

        closeTransactionModal();
        renderApp();
    } catch (err) {
        console.error('Error saving transaction:', err);
        showToast('Error saving transaction: ' + (err.message || 'Please try again'), 'error');
    } finally {
        btn.disabled = false;
    }
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    openTransactionModal(tx.type);
    document.getElementById('modalTxTitle').textContent = `Edit ${tx.type === 'expense' ? 'Expense' : 'Income'}`;
    document.getElementById('editingTxId').value = tx.id;
    document.getElementById('expAmount').value = tx.amount;
    document.getElementById('expDate').value = tx.date;
    document.getElementById('expDescription').value = tx.description || '';
    document.getElementById('expRecurring').checked = !!tx.is_recurring;
    
    if (tx.type === 'expense') {
        loadCategoryOptions(EXPENSE_CATEGORIES, tx.category);
        if (tx.split_with) {
            document.getElementById('expSplit').checked = true;
            document.getElementById('splitGroup').style.display = 'block';
            document.getElementById('expSplitWith').value = tx.split_with;
        }
    } else {
        loadCategoryOptions(INCOME_CATEGORIES, tx.category);
    }

    if (tx.receipt_url) document.getElementById('expReceiptUrl').value = tx.receipt_url;
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            const { error } = await sb.from('transactions').delete().eq('id', id);
            if (error) throw error;
        }
        transactions = transactions.filter(t => t.id !== id);
        if (currentUser.id === 'local-user') {
            localStorage.setItem('ss_local_transactions', JSON.stringify(transactions));
        }
        showToast('Transaction removed.');
        renderApp();
    } catch (err) {
        console.error('Failed to delete transaction:', err);
        showToast('Failed to delete: ' + err.message, 'error');
    }
}

// ===================================================================
// GOALS MODAL & ACTIONS
// ===================================================================

function openGoalModal() {
    const modal = document.getElementById('goalModal');
    const form = document.getElementById('saveGoalForm');
    if (!modal || !form) return;
    form.reset();
    document.getElementById('editingGoalId').value = '';
    document.getElementById('goalModalTitle').textContent = 'New Savings Goal';
    modal.classList.add('show');
}

function closeGoalModal() {
    const modal = document.getElementById('goalModal');
    if (modal) modal.classList.remove('show');
}

async function handleGoalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editingGoalId').value;
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value || 0);
    const deadline = document.getElementById('goalDeadline').value || null;
    const color = document.getElementById('goalColor').value;

    const goalData = {
        user_id: currentUser.id,
        name,
        target_amount: target,
        current_amount: current,
        deadline,
        color
    };

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            if (id) {
                const { error } = await sb.from('goals').update(goalData).eq('id', id);
                if (error) throw error;
                const idx = goals.findIndex(g => g.id === id);
                if (idx !== -1) goals[idx] = { ...goals[idx], ...goalData };
                showToast('Goal updated!');
            } else {
                const { data, error } = await sb.from('goals').insert(goalData).select().single();
                if (error) throw error;
                goals.push(data);
                showToast('Savings goal created!');
            }
        } else {
            if (id) {
                const idx = goals.findIndex(g => g.id === id);
                if (idx !== -1) goals[idx] = { ...goals[idx], ...goalData };
            } else {
                goalData.id = 'goal_' + Date.now();
                goals.push(goalData);
            }
            localStorage.setItem('ss_local_goals', JSON.stringify(goals));
            showToast('Goal saved!');
        }

        closeGoalModal();
        renderGoals();
    } catch (err) {
        showToast('Error saving goal: ' + err.message, 'error');
    }
}

function editGoal(id) {
    const g = goals.find(item => item.id === id);
    if (!g) return;

    openGoalModal();
    document.getElementById('goalModalTitle').textContent = 'Edit Goal';
    document.getElementById('editingGoalId').value = g.id;
    document.getElementById('goalName').value = g.name;
    document.getElementById('goalTarget').value = g.target_amount;
    document.getElementById('goalCurrent').value = g.current_amount;
    if (g.deadline) document.getElementById('goalDeadline').value = g.deadline;
    if (g.color) document.getElementById('goalColor').value = g.color;
}

async function deleteGoal(id) {
    if (!confirm('Are you sure you want to remove this goal?')) return;
    try {
        if (getSb() && currentUser.id !== 'local-user') {
            await sb.from('goals').delete().eq('id', id);
        }
        goals = goals.filter(g => g.id !== id);
        if (currentUser.id === 'local-user') {
            localStorage.setItem('ss_local_goals', JSON.stringify(goals));
        }
        showToast('Goal deleted.');
        renderGoals();
    } catch (err) {
        showToast('Error deleting goal: ' + err.message, 'error');
    }
}

// Deposit to Goal
function openDepositModal(goalId) {
    const g = goals.find(item => item.id === goalId);
    if (!g) return;
    document.getElementById('depositGoalId').value = g.id;
    document.getElementById('depositGoalNameLabel').textContent = `Adding funds to: ${g.name}`;
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositModal').classList.add('show');
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.remove('show');
}

async function handleDepositSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('depositGoalId').value;
    const addAmt = parseFloat(document.getElementById('depositAmount').value);
    const g = goals.find(item => item.id === id);
    if (!g || !addAmt) return;

    const newAmt = parseFloat(g.current_amount || 0) + addAmt;
    g.current_amount = newAmt;

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            await sb.from('goals').update({ current_amount: newAmt }).eq('id', id);
        } else {
            localStorage.setItem('ss_local_goals', JSON.stringify(goals));
        }

        closeDepositModal();
        renderGoals();
        showToast(`Deposited ${formatMoney(addAmt)} into ${g.name}!`);

        // Check if milestone completed
        if (newAmt >= parseFloat(g.target_amount)) {
            triggerConfetti();
            showToast(`🎉 Congratulations! You have achieved your goal: "${g.name}"!`, 'success');
        }
    } catch (err) {
        showToast('Error updating deposit: ' + err.message, 'error');
    }
}

function triggerConfetti() {
    if (window.confetti) {
        window.confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
        });
    }
}

// ===================================================================
// PROFILE & BUDGET SETTINGS
// ===================================================================

function openProfileModal() {
    document.getElementById('profFullName').value = currentProfile.full_name || '';
    document.getElementById('profCurrency').value = currentProfile.currency || '₹';
    document.getElementById('profBudget').value = currentProfile.monthly_budget || 0;
    document.getElementById('profileModal').classList.add('show');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('show');
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('profFullName').value.trim();
    const curr = document.getElementById('profCurrency').value;
    const budget = parseFloat(document.getElementById('profBudget').value || 0);

    currentProfile.full_name = name;
    currentProfile.currency = curr;
    currentProfile.monthly_budget = budget;

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            await sb.from('profiles').update({
                full_name: name,
                currency: curr,
                monthly_budget: budget
            }).eq('id', currentUser.id);
        }

        updateUserDisplay();
        renderApp();
        closeProfileModal();
        showToast('Profile updated successfully!');
    } catch (err) {
        showToast('Error updating profile: ' + err.message, 'error');
    }
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    const budget = parseFloat(document.getElementById('inputMonthlyBudget').value || 0);
    currentProfile.monthly_budget = budget;

    try {
        if (getSb() && currentUser.id !== 'local-user') {
            await sb.from('profiles').update({ monthly_budget: budget }).eq('id', currentUser.id);
        }
        renderOverview();
        renderBudgetView();
        showToast('Budget target saved!');
    } catch (err) {
        showToast('Error saving budget: ' + err.message, 'error');
    }
}

// ===================================================================
// DEMO / SAMPLE DATA LOADER
// ===================================================================

async function loadSampleData() {
    if (!confirm('Load realistic sample data (Salary, Groceries, Dining, Rent, and Goals) to explore the dashboard?')) return;

    const today = new Date().toISOString().split('T')[0];
    const prevDate = (daysAgo) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
    };

    const sampleTransactions = [
        { user_id: currentUser.id, type: 'income', amount: 85000, category: 'Salary', description: 'Monthly Tech Salary', date: prevDate(1), is_recurring: true },
        { user_id: currentUser.id, type: 'income', amount: 15000, category: 'Freelance & Projects', description: 'UI Design Freelance Project', date: prevDate(5), is_recurring: false },
        { user_id: currentUser.id, type: 'expense', amount: 22000, category: 'Rent & Housing', description: 'Apartment Monthly Rent', date: prevDate(2), is_recurring: true },
        { user_id: currentUser.id, type: 'expense', amount: 6500, category: 'Groceries', description: 'Supermarket Weekly Restock', date: prevDate(4), is_recurring: false },
        { user_id: currentUser.id, type: 'expense', amount: 2400, category: 'Food & Dining', description: 'Weekend Dinner with Friends', date: prevDate(6), split_with: 'Rohan, Priya' },
        { user_id: currentUser.id, type: 'expense', amount: 999, category: 'Entertainment', description: 'Netflix & Spotify Premium', date: prevDate(8), is_recurring: true },
        { user_id: currentUser.id, type: 'expense', amount: 3500, category: 'Transportation', description: 'Fuel & Metro Recharge', date: prevDate(10), is_recurring: false },
        { user_id: currentUser.id, type: 'expense', amount: 4800, category: 'Shopping', description: 'Ergonomic Keyboard & Mouse', date: prevDate(12), is_recurring: false }
    ];

    const sampleGoals = [
        { user_id: currentUser.id, name: 'Emergency Fund', target_amount: 150000, current_amount: 95000, color: '#10b981' },
        { user_id: currentUser.id, name: 'Japan Travel Trip', target_amount: 200000, current_amount: 45000, color: '#7c3aed' }
    ];

    try {
        const client = getSb();
        if (client && currentUser?.id !== 'local-user') {
            await client.from('transactions').insert(sampleTransactions);
            await client.from('goals').insert(sampleGoals);
            await client.from('profiles').update({ monthly_budget: 45000 }).eq('id', currentUser.id);
            currentProfile.monthly_budget = 45000;
            
            await loadTransactions();
            await loadGoals();
        } else {
            transactions = sampleTransactions.map((t, idx) => ({ ...t, id: 'demo_tx_' + idx }));
            goals = sampleGoals.map((g, idx) => ({ ...g, id: 'demo_goal_' + idx }));
            localStorage.setItem('ss_local_transactions', JSON.stringify(transactions));
            localStorage.setItem('ss_local_goals', JSON.stringify(goals));
        }

        renderApp();
        showToast('Demo data loaded successfully! Explore all tabs.');
    } catch (err) {
        console.error('Error loading sample data:', err);
        showToast('Error loading sample data: ' + err.message, 'error');
    }
}

// ===================================================================
// DATA EXPORT (CSV, EXCEL, PDF)
// ===================================================================

function openExportModal() {
    document.getElementById('exportModal').classList.add('show');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('show');
}

function exportData(format) {
    if (transactions.length === 0) {
        showToast('No transactions to export.', 'warning');
        return;
    }

    const data = transactions.map(t => ({
        Date: t.date,
        Type: t.type.toUpperCase(),
        Category: t.category,
        Description: t.description || '',
        Amount: t.amount,
        Recurring: t.is_recurring ? 'Yes' : 'No',
        SplitWith: t.split_with || 'N/A'
    }));

    if (format === 'csv') {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `spendsmart_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV downloaded successfully!');
    } else if (format === 'excel') {
        if (window.XLSX) {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            XLSX.writeFile(wb, `spendsmart_report_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Excel file downloaded!');
        } else {
            showToast('Excel generator not loaded.', 'error');
        }
    } else if (format === 'pdf') {
        if (window.jspdf) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('SpendSmart - Financial Transactions Report', 14, 20);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleDateString()} | User: ${currentProfile.full_name}`, 14, 28);

            const tableRows = data.map(d => [d.Date, d.Type, d.Category, d.Description, `${getCurrency()}${d.Amount}`]);
            doc.autoTable({
                head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
                body: tableRows,
                startY: 35,
                theme: 'striped',
                headStyles: { fillColor: [124, 58, 237] }
            });

            doc.save(`spendsmart_report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('PDF Report generated!');
        } else {
            showToast('PDF generator not available.', 'error');
        }
    }

    closeExportModal();
}

// Utility: escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}
