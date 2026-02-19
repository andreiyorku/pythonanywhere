import json
import sqlite3
import os
from django.shortcuts import render
from django.http import JsonResponse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'fretmap.db')


def index(request):
    return render(request, 'fretmap/index.html')


def get_user_data(request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Auto-build table with new schema if it doesn't exist
    conn.execute('''CREATE TABLE IF NOT EXISTS transitions (
        id TEXT PRIMARY KEY, avg_time REAL, best_time REAL, 
        total_attempts INTEGER, mastery_status INTEGER DEFAULT 0
    )''')

    # Updated user_progress to include strictness and attack memory
    conn.execute('''CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY, zone_index INTEGER DEFAULT 0,
        strictness INTEGER DEFAULT 70, attack INTEGER DEFAULT 80
    )''')

    # Ensure a user row exists so we never hit a null error
    conn.execute('INSERT OR IGNORE INTO user_progress (id) VALUES (1)')
    conn.commit()

    # Get User Progress & Settings
    user_row = conn.execute('SELECT * FROM user_progress WHERE id=1').fetchone()

    # Get Stats
    rows = conn.execute('SELECT * FROM transitions').fetchall()
    history = {r['id']: {
        'avg': r['avg_time'], 'best': r['best_time'],
        'count': r['total_attempts'], 'mastery': r['mastery_status']
    } for r in rows}

    conn.close()

    return JsonResponse({
        'history': history,
        'zone_index': user_row['zone_index'],
        'strictness': user_row['strictness'],
        'attack': user_row['attack']
    })


def save_transition(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = sqlite3.connect(DB_PATH)

        # Upsert logic for stats
        conn.execute('''
            INSERT INTO transitions (id, avg_time, best_time, total_attempts, mastery_status) 
            VALUES (?, ?, ?, 1, ?) 
            ON CONFLICT(id) DO UPDATE SET 
                avg_time = ((avg_time * total_attempts) + ?) / (total_attempts + 1),
                best_time = MIN(best_time, ?),
                total_attempts = total_attempts + 1,
                mastery_status = ?
        ''', (data['id'], data['time'], data['time'], data['mastery'], data['time'], data['time'], data['mastery']))

        # If level up occurred, save new zone
        if 'new_zone' in data:
            conn.execute('UPDATE user_progress SET zone_index = ? WHERE id = 1', (data['new_zone'],))

        conn.commit()
        conn.close()
        return JsonResponse({'status': 'saved'})


def save_settings(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = sqlite3.connect(DB_PATH)
        # Save the slider positions to the database
        conn.execute('''
            UPDATE user_progress 
            SET strictness = ?, attack = ? 
            WHERE id = 1
        ''', (data['strictness'], data['attack']))
        conn.commit()
        conn.close()
        return JsonResponse({'status': 'settings saved'})