// State
let currentUser = null;
let expenses = [];
let goals = {};
let charts = {};

// DOM Elements
const els = {
    // Nav & Layout
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    navItems: document.querySelectorAll('.nav-item[data-view]'),
    viewSections: document.querySelectorAll('.view-section'),
    themeToggle: document.getElementById('themeToggle'),
    currencySelector: document.getElementById('currencySelector'),
    
    // Auth
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    
    // Header
    userName: document.getElementById('userName'),
    currentDate: document.getElementById('currentDate'),
    
    // Summary
    totalSpent: document.getElementById('totalSpent'),
    budgetLeft: document.getElementById('budgetLeft'),
    monthlyBudgetDesc: document.getElementById('monthlyBudgetDesc'),
    dailyAverage: document.getElementById('dailyAverage'),
    daysPassed: document.getElementById('daysPassed'),
    
    // Transactions Table
    txTableBody: document.getElementById('txTableBody'),
    noDataMsg: document.getElementById('noDataMsg'),
    searchTransactions: document.getElementById('searchTransactions'),
    
    // Expense Modal
    addExpenseBtn: document.getElementById('addExpenseBtn'),
    expenseModal: document.getElementById('expenseModal'),
    closeExpenseModal: document.getElementById('closeExpenseModal'),
    expenseForm: document.getElementById('expenseForm'),
    expSplitToggle: document.getElementById('expSplit'),
    splitGroup: document.getElementById('splitGroup'),
    
    // Goals
    goalsForm: document.getElementById('goalsForm'),
    inputMonthlyBudget: document.getElementById('inputMonthlyBudget'),
    inputSavingsTarget: document.getElementById('inputSavingsTarget'),
    budgetProgressBar: document.getElementById('budgetProgressBar'),
    progSpent: document.getElementById('progSpent'),
    progLimit: document.getElementById('progLimit'),
    
    // Insights
    insightAlert: document.getElementById('insightAlert'),
    insightText: document.getElementById('insightText'),
    
    // Split
    splitList: document.getElementById('splitList')
};

// --- Utilities ---
const getCurrency = () => currentUser?.currency || '₹';
const formatMoney = (amount) => `${getCurrency()}${parseFloat(amount).toFixed(2)}`;
const showToast = (msg, type='success') => {
    const container = document.getElementById('toast-container');
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

// --- App Initialization ---
async function init() {
    // Check if on dashbaord
    if(!els.userName) return; 
    
    // Setup date
    const today = new Date();
    els.currentDate.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    els.daysPassed.textContent = today.getDate();
    
    // Fetch data
    await fetchUser();
    await fetchGoals();
    await fetchExpenses();
    
    setupEventListeners();
    updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Auth listeners
    if(els.loginForm) {
        els.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('/login', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: e.target.email.value, password: e.target.password.value})
            });
            const data = await res.json();
            if(data.success) window.location.href = '/dashboard';
            else showToast(data.message || 'Login failed', 'error');
        });
    }
    if(els.signupForm) {
        els.signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('/signup', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: e.target.email.value, password: e.target.password.value, name: e.target.name.value})
            });
            const data = await res.json();
            if(data.success) window.location.href = '/dashboard';
            else showToast(data.message || 'Signup failed', 'error');
        });
    }
});

// --- API Calls ---
async function fetchUser() {
    const res = await fetch('/api/user');
    if(res.ok) {
        currentUser = await res.json();
        els.userName.textContent = currentUser.name.split(' ')[0];
        if(currentUser.theme === 'dark') document.body.classList.add('dark-theme');
        if(els.currencySelector) els.currencySelector.value = currentUser.currency;
    } else {
        window.location.href = '/login';
    }
}

async function fetchExpenses() {
    const res = await fetch('/api/expenses');
    expenses = await res.json();
    // sort new to old
    expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
}

async function fetchGoals() {
    const res = await fetch('/api/goals');
    goals = await res.json();
    els.inputMonthlyBudget.value = goals.monthly_budget || '';
    els.inputSavingsTarget.value = goals.savings_target || '';
}

// --- Updates & Rendering ---
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
            showToast('You have exceeded your monthly budget limit!', 'error');
        } else els.budgetLeft.classList.remove('text-danger');
        
        // Progress bar
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
            <div class="split-card">
                <div>
                    <h4>${e.description} (${e.date})</h4>
                    <p class="text-sm text-muted">Total: ${formatMoney(e.amount)} • Split among ${names.length+1} people</p>
                    <p class="text-sm mt-2"><strong>${perPerson}</strong> each (You, ${names.join(', ')})</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="showToast('Reminder sent!')">Remind</button>
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
    
    let maxCat = '';
    let maxAmt = 0;
    for(const [c, a] of Object.entries(catTotals)) {
        if(a > maxAmt) { maxAmt = a; maxCat = c; }
    }
    
    if(maxCat) {
        els.insightAlert.style.display = 'flex';
        els.insightText.innerHTML = `<strong>Insight:</strong> Your highest spending category this month is <strong>${maxCat}</strong> (${formatMoney(maxAmt)}).`;
    }
}

// --- Chart Generation ---
function updateCharts() {
    // Colors based on css variables
    const getVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
    const bgColors = [getVar('--chart-1'), getVar('--chart-2'), getVar('--chart-3'), getVar('--chart-4'), getVar('--chart-5'), getVar('--primary'), getVar('--success'), getVar('--danger')];
    
    // Process category data for current month
    const currentMonth = new Date().getMonth();
    const monthlyExpenses = expenses.filter(e => new Date(e.date).getMonth() === currentMonth);
    const catMap = {};
    monthlyExpenses.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
    
    // 1. Dashboard Pie Chart
    const ctx1 = document.getElementById('categoryPieChart');
    if(ctx1 && Object.keys(catMap).length > 0) {
        if(charts.pie) charts.pie.destroy();
        charts.pie = new Chart(ctx1, {
            type: 'doughnut',
            data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: bgColors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%'}
        });
    }

    // Process Analytics Data (Last 6 Months Trend)
    const ctxTrend = document.getElementById('trendLineChart');
    if(ctxTrend) {
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
        charts.trend = new Chart(ctxTrend, {
            type: 'line',
            data: { 
                labels: Object.keys(trendData), 
                datasets: [{ 
                    label: 'Spent Amount', data: Object.values(trendData), 
                    borderColor: getVar('--primary'), backgroundColor: getVar('--primary-light'), 
                    fill: true, tension: 0.4 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Secondary Analytics Charts
    const ctxA1 = document.getElementById('analyticsPieChart');
    if(ctxA1 && Object.keys(catMap).length > 0) {
        if(charts.a1) charts.a1.destroy();
        charts.a1 = new Chart(ctxA1, {
            type: 'pie', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: bgColors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const ctxA2 = document.getElementById('analyticsBarChart');
    if(ctxA2 && Object.keys(catMap).length > 0) {
        if(charts.a2) charts.a2.destroy();
        charts.a2 = new Chart(ctxA2, {
            type: 'bar', data: { labels: Object.keys(catMap), datasets: [{ label: 'Spending', data: Object.values(catMap), backgroundColor: bgColors }] }, options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// --- Action Listeners ---
function setupEventListeners() {
    if(!els.sidebar) return;

    // View Switching
    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            els.navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            els.viewSections.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${item.dataset.view}`).classList.add('active');
            if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
            updateCharts(); // redraw for container size fixes
        });
    });

    // Mobile Sidebar
    els.openSidebar.addEventListener('click', () => els.sidebar.classList.add('open'));
    els.closeSidebar.addEventListener('click', () => els.sidebar.classList.remove('open'));

    // Theme & Currency
    els.themeToggle.addEventListener('click', async (e) => {
        e.preventDefault();
        const body = document.body;
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');
        await fetch('/api/user', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({theme: isDark ? 'dark' : 'light'}) });
        updateCharts(); // Refresh chart colors
    });

    els.currencySelector.addEventListener('change', async (e) => {
        currentUser.currency = e.target.value;
        await fetch('/api/user', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({currency: currentUser.currency}) });
        updateUI();
    });

    // Expense Form Modal
    els.addExpenseBtn.addEventListener('click', () => {
        els.expenseForm.reset();
        document.getElementById('expId').value = '';
        els.splitGroup.style.display = 'none';
        document.getElementById('modalTitle').textContent = 'Add Expense';
        els.expenseModal.classList.add('active');
        document.getElementById('expDate').valueAsDate = new Date();
    });
    els.closeExpenseModal.addEventListener('click', () => els.expenseModal.classList.remove('active'));
    els.expSplitToggle.addEventListener('change', (e) => els.splitGroup.style.display = e.target.checked ? 'block' : 'none');

    els.expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('expId').value;
        const payload = {
            amount: document.getElementById('expAmount').value,
            category: document.getElementById('expCategory').value,
            date: document.getElementById('expDate').value,
            description: document.getElementById('expDescription').value,
            is_recurring: document.getElementById('expRecurring').checked,
            split_with: document.getElementById('expSplit').checked ? document.getElementById('expSplitWith').value : ''
        };
        
        const url = id ? `/api/expenses/${id}` : '/api/expenses';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            await fetchExpenses();
            updateUI();
            els.expenseModal.classList.remove('active');
            showToast(id ? 'Expense updated' : 'Expense added');
        }
    });

    // Search
    els.searchTransactions.addEventListener('input', (e) => renderTransactionsTable(e.target.value));

    // Goals Form
    els.goalsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mb = els.inputMonthlyBudget.value;
        const st = els.inputSavingsTarget.value;
        const res = await fetch('/api/goals', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({monthly_budget: mb, savings_target: st})
        });
        if(res.ok) {
            goals.monthly_budget = parseFloat(mb); goals.savings_target = parseFloat(st);
            updateUI();
            showToast('Goals updated successfully');
        }
    });
    
    // Export UI
    document.getElementById('exportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.add('active'));
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

// Global scope fns for inline handlers
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
        els.expenseModal.classList.add('active');
    }
}

window.deleteExpense = async function(id) {
    if(confirm('Are you sure you want to delete this expense?')) {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if(res.ok) {
            await fetchExpenses();
            updateUI();
            showToast('Expense deleted');
        }
    }
}

// Client-side Export Logic
window.exportData = function(type) {
    if(expenses.length === 0) return showToast('No data to export', 'error');
    closeExportModal();
    
    // Prepare Data Array
    let csvData = [["Date", "Category", "Description", "Amount", "Recurring", "Split With"]];
    expenses.forEach(e => csvData.push([e.date, e.category, e.description, formatMoney(e.amount), e.is_recurring?"Yes":"No", e.split_with]));
    
    if(type === 'csv') {
        let csvContent = "data:text/csv;charset=utf-8," + csvData.map(e => e.join(",")).join("\n");
        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "SpendSmart_Expenses.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('CSV downloaded');
    } 
    else if(type === 'excel') {
        let ws = XLSX.utils.aoa_to_sheet(csvData);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        XLSX.writeFile(wb, "SpendSmart_Expenses.xlsx");
        showToast('Excel downloaded');
    }
    else if(type === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("SpendSmart Expenses Report", 14, 15);
        doc.autoTable({
            head: [csvData[0]],
            body: csvData.slice(1),
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 10 }
        });
        doc.save("SpendSmart_Expenses.pdf");
        showToast('PDF downloaded');
    }
}
