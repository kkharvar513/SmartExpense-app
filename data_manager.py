import json
import os
from datetime import datetime

DATA_DIR = '/tmp/data' if os.environ.get('VERCEL') == '1' else 'data'
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
EXPENSES_FILE = os.path.join(DATA_DIR, 'expenses.json')
GOALS_FILE = os.path.join(DATA_DIR, 'goals.json')

def ensure_data_files():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    for file_path, default_data in [(USERS_FILE, {}), (EXPENSES_FILE, []), (GOALS_FILE, {})]:
        if not os.path.exists(file_path):
            with open(file_path, 'w') as f:
                json.dump(default_data, f)

def load_data(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

# User operations
def get_user(email):
    users = load_data(USERS_FILE)
    return users.get(email)

def create_user(email, password, name):
    users = load_data(USERS_FILE)
    if email in users:
        return False
    users[email] = {
        'password': password,
        'name': name,
        'currency': '₹',
        'theme': 'light'
    }
    save_data(USERS_FILE, users)
    return True

def update_user_settings(email, currency, theme):
    users = load_data(USERS_FILE)
    if email in users:
        if currency: users[email]['currency'] = currency
        if theme: users[email]['theme'] = theme
        save_data(USERS_FILE, users)

# Expense operations
def get_user_expenses(email):
    expenses = load_data(EXPENSES_FILE)
    return [e for e in expenses if e.get('user') == email]

def add_expense(email, amount, category, date, description, is_recurring=False, split_with=[]):
    expenses = load_data(EXPENSES_FILE)
    # Generate a simple unique ID
    new_id = str(int(datetime.now().timestamp() * 1000))
    expense = {
        'id': new_id,
        'user': email,
        'amount': float(amount),
        'category': category,
        'date': date,
        'description': description,
        'is_recurring': is_recurring,
        'split_with': split_with
    }
    expenses.append(expense)
    save_data(EXPENSES_FILE, expenses)
    return expense

def update_expense(email, exp_id, amount, category, date, description):
    expenses = load_data(EXPENSES_FILE)
    for e in expenses:
        if e['id'] == exp_id and e['user'] == email:
            e['amount'] = float(amount)
            e['category'] = category
            e['date'] = date
            e['description'] = description
            save_data(EXPENSES_FILE, expenses)
            return True
    return False

def delete_expense(email, exp_id):
    expenses = load_data(EXPENSES_FILE)
    initial_len = len(expenses)
    expenses = [e for e in expenses if not (e['id'] == exp_id and e['user'] == email)]
    if len(expenses) < initial_len:
        save_data(EXPENSES_FILE, expenses)
        return True
    return False

# Goals & Budgets
def get_user_goals(email):
    goals = load_data(GOALS_FILE)
    return goals.get(email, {'monthly_budget': 0, 'savings_target': 0})

def update_user_goals(email, monthly_budget, savings_target):
    goals = load_data(GOALS_FILE)
    goals[email] = {
        'monthly_budget': float(monthly_budget),
        'savings_target': float(savings_target)
    }
    save_data(GOALS_FILE, goals)

ensure_data_files()
