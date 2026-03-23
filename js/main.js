// JS Logic - Pure Client-Side localStorage
let currentUser = null;
let expenses = [];
let goals = {};
let charts = {};

// DOM Elements Initialization
const els = {
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    navItems: document.querySelectorAll('.nav-item[data-view]'),
    viewSections: document.querySelectorAll('.view-section'),
    themeToggle: document.getElementById('themeToggle'),
    currencySelector: document.getElementById('currencySelector'),
    
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    
    userName: document.getElementById('userName'),
    currentDate: document.getElementById('currentDate'),
    
    totalSpent: document.getElementById('totalSpent'),
    budgetLeft: document.getElementById('budgetLeft'),
    monthlyBudgetDesc: document.getElementById('monthlyBudgetDesc'),
    dailyAverage: document.getElementById('dailyAverage'),
    daysPassed: document.getElementById('daysPassed'),
    
    txTableBody: document.getElementById('txTableBody'),
    noDataMsg: document.getElementById('noDataMsg'),
    searchTransactions: document.getElementById('searchTransactions'),
    
    addExpenseBtn: document.getElementById('addExpenseBtn'),
    expenseModal: document.getElementById('expenseModal'),
    closeExpenseModal: document.getElementById('closeExpenseModal'),
    expenseForm: document.getElementById('expenseForm'),
    expSplitToggle: document.getElementById('expSplit'),
    splitGroup: document.getElementById('splitGroup'),
    
    goalsForm: document.getElementById('goalsForm'),
    inputMonthlyBudget: document.getElementById('inputMonthlyBudget'),
    inputSavingsTarget: document.getElementById('inputSavingsTarget'),
    budgetProgressBar: document.getElementById('budgetProgressBar'),
    progSpent: document.getElementById('progSpent'),
    progLimit: document.getElementById('progLimit'),
    
    insightAlert: document.getElementById('insightAlert'),
    insightText: document.getElementById('insightText'),
    splitList: document.getElementById('splitList'),
    mainDashboardView: document.getElementById('mainDashboardView')
};

// Utilities
const getCurrency = () => currentUser?.currency || '₹';
const formatMoney = (amount) => `${getCurrency()}${parseFloat(amount).toFixed(2)}`;
const showToast = (msg, type='success') => {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
};

function togglePassword(id) {
    const input = document.getElementById(id);
    if(input.type === 'password') input.type = 'text'; else input.type = 'password';
}

// Database / Storage abstraction
const DB = {
    getUsers: () => JSON.parse(localStorage.getItem('ss_users')) || {},
    setUsers: (users) => localStorage.setItem('ss_users', JSON.stringify(users)),
    getExpenses: (email) => JSON.parse(localStorage.getItem(`ss_exps_${email}`)) || [],
    setExpenses: (email, exps) => localStorage.setItem(`ss_exps_${email}`, JSON.stringify(exps)),
    getGoals: (email) => JSON.parse(localStorage.getItem(`ss_goals_${email}`)) || { monthly_budget: 0, savings_target: 0 },
    setGoals: (email, g) => localStorage.setItem(`ss_goals_${email}`, JSON.stringify(g))
};

// Auth Guard
function initAuth() {
    const sessionEmail = sessionStorage.getItem('currentUserEmail');
    const isDashboard = window.location.pathname.includes('dashboard');
    
    if(isDashboard && !sessionEmail) {
        window.location.href = 'login.html';
        return false;
    }
    if(!isDashboard && sessionEmail) {
        if(window.location.pathname.includes('login') || window.location.pathname.includes('signup') || window.location.pathname.endsWith('/') || window.location.pathname.includes('index')) {
            window.location.href = 'dashboard.html';
            return false;
        }
    }
    
    if(isDashboard) {
        const users = DB.getUsers();
        currentUser = users[sessionEmail];
        currentUser.email = sessionEmail;
        
        if(els.mainDashboardView) els.mainDashboardView.style.display = 'flex';
        
        if(currentUser.theme === 'dark') document.body.classList.add('dark-theme');
        if(els.currencySelector) els.currencySelector.value = currentUser.currency;
        if(els.userName) els.userName.textContent = currentUser.name.split(' ')[0];
        
        // Load data
        goals = DB.getGoals(sessionEmail);
        expenses = DB.getExpenses(sessionEmail);
        expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        const today = new Date();
        if(els.currentDate) els.currentDate.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        if(els.daysPassed) els.daysPassed.textContent = today.getDate();
        if(els.inputMonthlyBudget) els.inputMonthlyBudget.value = goals.monthly_budget || '';
        if(els.inputSavingsTarget) els.inputSavingsTarget.value = goals.savings_target || '';
        
        updateUI();
    }
    return true;
}

window.logout = function() {
    sessionStorage.removeItem('currentUserEmail');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    if(!initAuth()) return;
    
    // Auth Forms
    if(els.loginForm) {
        els.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const users = DB.getUsers();
            const email = e.target.email.value;
            const pwd = e.target.password.value;
            if(users[email] && users[email].password === pwd) {
                sessionStorage.setItem('currentUserEmail', email);
                window.location.href = 'dashboard.html';
            } else {
                showToast('Invalid credentials', 'error');
            }
        });
    }
    if(els.signupForm) {
        els.signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const users = DB.getUsers();
            const email = e.target.email.value;
            if(users[email]) return showToast('Email already exists', 'error');
            
            users[email] = {
                name: e.target.name.value,
                password: e.target.password.value,
                theme: 'light',
                currency: '₹'
            };
            DB.setUsers(users);
            sessionStorage.setItem('currentUserEmail', email);
            window.location.href = 'dashboard.html';
        });
    }
    
    if(els.sidebar) setupDashboardListeners();
});

// UI Rendering
function updateUI() {
    renderSummary();
    renderTransactionsTable();
    updateCharts();
    renderSplitBills();
    generateInsights();
}

function renderSummary() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = expenses.filter(e => {
        const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    els.totalSpent.textContent = formatMoney(total);
    
    if(goals.monthly_budget > 0) {
        els.monthlyBudgetDesc.textContent = formatMoney(goals.monthly_budget);
        const left = goals.monthly_budget - total;
        els.budgetLeft.textContent = formatMoney(left);
        if(left < 0) {
            els.budgetLeft.classList.add('text-danger');
        } else els.budgetLeft.classList.remove('text-danger');
        
        els.progSpent.textContent = `Spent: ${formatMoney(total)}`;
        els.progLimit.textContent = `Limit: ${formatMoney(goals.monthly_budget)}`;
        const perc = Math.min((total / goals.monthly_budget) * 100, 100);
        els.budgetProgressBar.style.width = `${perc}%`;
        if(perc > 90) els.budgetProgressBar.style.backgroundColor = 'var(--danger)';
        else els.budgetProgressBar.style.backgroundColor = 'var(--chart-2)';
    }
    
    const days = new Date().getDate();
    els.dailyAverage.textContent = formatMoney(total / days);
}

function renderTransactionsTable(searchTerm = "") {
    els.txTableBody.innerHTML = '';
    const catIcons = { Food: '🍽️', Travel: '🚗', Shopping: '🛍️', Housing: '🏠', Bills: '🧾', Entertainment: '🎬', Health: '⚕️', Other: '📦' };
    
    const filtered = expenses.filter(e => 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if(filtered.length === 0) els.noDataMsg.style.display = 'block';
    else els.noDataMsg.style.display = 'none';
    
    filtered.slice(0, 15).forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td><span class="cat-badge">${catIcons[e.category] || '📦'} ${e.category}</span></td>
            <td>${e.description} ${e.is_recurring ? '<i class="fa-solid fa-arrows-rotate text-primary" title="Recurring"></i>' : ''}</td>
            <td class="text-right font-bold">${formatMoney(e.amount)}</td>
            <td class="text-center table-actions" style="justify-content:center;">
                <button class="btn-icon" onclick="editExpense('${e.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon danger" onclick="deleteExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        els.txTableBody.appendChild(tr);
    });
}

function renderSplitBills() {
    const splits = expenses.filter(e => e.split_with && e.split_with.length > 0);
    els.splitList.innerHTML = '';
    if(splits.length === 0) return;
    splits.forEach(e => {
        const names = e.split_with.split(',').map(n => n.trim()).filter(n=>n);
        const perPerson = formatMoney(e.amount / (names.length + 1));
        els.splitList.innerHTML += `
            <div class="split-card card">
                <div>
                    <h4>${e.description} (${e.date})</h4>
                    <p class="text-sm text-muted">Total: ${formatMoney(e.amount)} • Split among ${names.length+1} people</p>
                    <p class="text-sm mt-2"><strong>${perPerson}</strong> each (You, ${names.join(', ')})</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="showToast('Reminder marked sent!')">Remind</button>
            </div>
        `;
    });
}

function generateInsights() {
    if(expenses.length === 0) return;
    const currentMonth = new Date().getMonth();
    const monthlyExpenses = expenses.filter(e => new Date(e.date).getMonth() === currentMonth);
    const catTotals = {};
    monthlyExpenses.forEach(e => catTotals[e.category] = (catTotals[e.category] || 0) + e.amount);
    
    let maxCat = ''; let maxAmt = 0;
    for(const [c, a] of Object.entries(catTotals)) {
        if(a > maxAmt) { maxAmt = a; maxCat = c; }
    }
    if(maxCat) {
        els.insightAlert.style.display = 'flex';
        els.insightText.innerHTML = `<strong>Insight:</strong> Your highest spending category this month is <strong>${maxCat}</strong> (${formatMoney(maxAmt)}).`;
    }
}

function updateCharts() {
    const getVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
    const bgColors = [getVar('--chart-1'), getVar('--chart-2'), getVar('--chart-3'), getVar('--chart-4'), getVar('--chart-5'), getVar('--primary'), getVar('--success'), getVar('--danger')];
    
    const currentMonth = new Date().getMonth();
    const monthlyExpenses = expenses.filter(e => new Date(e.date).getMonth() === currentMonth);
    const catMap = {};
    monthlyExpenses.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
    
    if(document.getElementById('categoryPieChart') && Object.keys(catMap).length > 0) {
        if(charts.pie) charts.pie.destroy();
        charts.pie = new Chart(document.getElementById('categoryPieChart'), {
            type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: bgColors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%'}
        });
    }

    if(document.getElementById('trendLineChart')) {
        const trendData = {};
        for(let i=5; i>=0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            trendData[`${d.toLocaleString('default', { month: 'short' })}`] = 0;
        }
        expenses.forEach(e => {
            const d = new Date(e.date);
            const m = d.toLocaleString('default', { month: 'short' });
            if(trendData[m] !== undefined) trendData[m] += e.amount;
        });
        if(charts.trend) charts.trend.destroy();
        charts.trend = new Chart(document.getElementById('trendLineChart'), {
            type: 'line', data: { labels: Object.keys(trendData), datasets: [{ label: 'Spent', data: Object.values(trendData), borderColor: getVar('--primary'), backgroundColor: getVar('--primary-light'), fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    if(document.getElementById('analyticsPieChart') && Object.keys(catMap).length > 0) {
        if(charts.a1) charts.a1.destroy();
        charts.a1 = new Chart(document.getElementById('analyticsPieChart'), { type: 'pie', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: bgColors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
    if(document.getElementById('analyticsBarChart') && Object.keys(catMap).length > 0) {
        if(charts.a2) charts.a2.destroy();
        charts.a2 = new Chart(document.getElementById('analyticsBarChart'), { type: 'bar', data: { labels: Object.keys(catMap), datasets: [{ label: 'Spending', data: Object.values(catMap), backgroundColor: bgColors }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
}

function setupDashboardListeners() {
    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            els.navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            els.viewSections.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${item.dataset.view}`).classList.add('active');
            if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
            updateCharts(); 
        });
    });

    els.openSidebar.addEventListener('click', () => els.sidebar.classList.add('open'));
    els.closeSidebar.addEventListener('click', () => els.sidebar.classList.remove('open'));

    els.themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const body = document.body;
        body.classList.toggle('dark-theme');
        currentUser.theme = body.classList.contains('dark-theme') ? 'dark' : 'light';
        const users = DB.getUsers();
        users[currentUser.email].theme = currentUser.theme;
        DB.setUsers(users);
        updateCharts();
    });

    els.currencySelector.addEventListener('change', (e) => {
        currentUser.currency = e.target.value;
        const users = DB.getUsers();
        users[currentUser.email].currency = currentUser.currency;
        DB.setUsers(users);
        document.getElementById('modalCurrency').textContent = currentUser.currency;
        updateUI();
    });

    els.addExpenseBtn.addEventListener('click', () => {
        els.expenseForm.reset();
        document.getElementById('expId').value = '';
        els.splitGroup.style.display = 'none';
        document.getElementById('modalTitle').textContent = 'Add Expense';
        els.expenseModal.classList.add('active');
        document.getElementById('expDate').valueAsDate = new Date();
        document.getElementById('modalCurrency').textContent = currentUser.currency;
    });
    els.closeExpenseModal.addEventListener('click', () => els.expenseModal.classList.remove('active'));
    els.expSplitToggle.addEventListener('change', (e) => els.splitGroup.style.display = e.target.checked ? 'block' : 'none');

    els.expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('expId').value || new Date().getTime().toString();
        const payload = {
            id: id,
            amount: parseFloat(document.getElementById('expAmount').value),
            category: document.getElementById('expCategory').value,
            date: document.getElementById('expDate').value,
            description: document.getElementById('expDescription').value,
            is_recurring: document.getElementById('expRecurring').checked,
            split_with: document.getElementById('expSplit').checked ? document.getElementById('expSplitWith').value : ''
        };
        
        if(!document.getElementById('expId').value) expenses.push(payload);
        else {
            const idx = expenses.findIndex(ex => ex.id === id);
            expenses[idx] = payload;
        }
        
        expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
        DB.setExpenses(currentUser.email, expenses);
        
        updateUI();
        els.expenseModal.classList.remove('active');
        showToast(document.getElementById('expId').value ? 'Expense updated' : 'Expense added');
    });

    els.searchTransactions.addEventListener('input', (e) => renderTransactionsTable(e.target.value));

    els.goalsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goals.monthly_budget = parseFloat(els.inputMonthlyBudget.value);
        goals.savings_target = parseFloat(els.inputSavingsTarget.value);
        DB.setGoals(currentUser.email, goals);
        updateUI();
        showToast('Goals updated successfully');
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.add('active'));
}

window.closeExportModal = function() {
    document.getElementById('exportModal').classList.remove('active');
}

window.editExpense = function(id) {
    const exp = expenses.find(e => e.id === id);
    if(exp) {
        document.getElementById('expId').value = exp.id;
        document.getElementById('expAmount').value = exp.amount;
        document.getElementById('expCategory').value = exp.category;
        document.getElementById('expDate').value = exp.date;
        document.getElementById('expDescription').value = exp.description;
        document.getElementById('expRecurring').checked = exp.is_recurring;
        document.getElementById('expSplit').checked = exp.split_with ? true : false;
        if(exp.split_with) {
            document.getElementById('expSplitWith').value = exp.split_with;
            els.splitGroup.style.display = 'block';
        } else els.splitGroup.style.display = 'none';
        
        document.getElementById('modalTitle').textContent = 'Edit Expense';
        document.getElementById('modalCurrency').textContent = currentUser.currency;
        els.expenseModal.classList.add('active');
    }
}

window.deleteExpense = function(id) {
    if(confirm('Are you sure you want to delete this expense?')) {
        expenses = expenses.filter(e => e.id !== id);
        DB.setExpenses(currentUser.email, expenses);
        updateUI();
        showToast('Expense deleted');
    }
}

window.exportData = function(type) {
    if(expenses.length === 0) return showToast('No data to export', 'error');
    window.closeExportModal();
    let csvData = [["Date", "Category", "Description", "Amount", "Recurring", "Split With"]];
    expenses.forEach(e => csvData.push([e.date, e.category, e.description, formatMoney(e.amount), e.is_recurring?"Yes":"No", e.split_with]));
    
    if(type === 'csv') {
        let sc = "data:text/csv;charset=utf-8," + csvData.map(e => e.join(",")).join("\n");
        let a = document.createElement("a"); a.href = encodeURI(sc); a.download = "SpendSmart.csv"; document.body.appendChild(a); a.click(); a.remove();
        showToast('CSV downloaded');
    } else if(type === 'excel') {
        let ws = XLSX.utils.aoa_to_sheet(csvData); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Expenses"); XLSX.writeFile(wb, "SpendSmart.xlsx");
        showToast('Excel downloaded');
    } else if(type === 'pdf') {
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.text("SpendSmart Expenses Report", 14, 15);
        doc.autoTable({ head: [csvData[0]], body: csvData.slice(1), startY: 20, theme: 'grid' });
        doc.save("SpendSmart.pdf");
        showToast('PDF downloaded');
    }
}
