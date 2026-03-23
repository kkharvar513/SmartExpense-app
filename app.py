from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import data_manager
import os

app = Flask(__name__)
app.secret_key = 'super_secret_spendsmart_key'

@app.route('/')
def index():
    if 'user' in session:
        return redirect(url_for('dashboard'))
    return render_template('welcome.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    user = data_manager.get_user(email)
    if user and user['password'] == password:
        session['user'] = email
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html')
    
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if data_manager.create_user(email, password, name):
        session['user'] = email
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Email already exists'}), 400

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect(url_for('login'))
    user = data_manager.get_user(session['user'])
    return render_template('dashboard.html', user=user)

# API Routes
@app.route('/api/user', methods=['GET', 'POST'])
def api_user():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        user = data_manager.get_user(session['user'])
        # Never send password back
        user_copy = dict(user)
        user_copy.pop('password', None)
        return jsonify({'email': session['user'], **user_copy})
    
    if request.method == 'POST':
        data = request.json
        data_manager.update_user_settings(session['user'], data.get('currency'), data.get('theme'))
        return jsonify({'success': True})

@app.route('/api/expenses', methods=['GET', 'POST'])
def api_expenses():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        expenses = data_manager.get_user_expenses(session['user'])
        return jsonify(expenses)
    
    if request.method == 'POST':
        data = request.json
        expense = data_manager.add_expense(
            session['user'],
            data['amount'],
            data['category'],
            data['date'],
            data['description'],
            data.get('is_recurring', False),
            data.get('split_with', [])
        )
        return jsonify({'success': True, 'expense': expense})

@app.route('/api/expenses/<exp_id>', methods=['PUT', 'DELETE'])
def api_expense_action(exp_id):
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'PUT':
        data = request.json
        success = data_manager.update_expense(
            session['user'], 
            exp_id,
            data['amount'],
            data['category'],
            data['date'],
            data['description']
        )
        return jsonify({'success': success})
    
    if request.method == 'DELETE':
        success = data_manager.delete_expense(session['user'], exp_id)
        return jsonify({'success': success})

@app.route('/api/goals', methods=['GET', 'POST'])
def api_goals():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        goals = data_manager.get_user_goals(session['user'])
        return jsonify(goals)
    
    if request.method == 'POST':
        data = request.json
        data_manager.update_user_goals(session['user'], data.get('monthly_budget', 0), data.get('savings_target', 0))
        return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
