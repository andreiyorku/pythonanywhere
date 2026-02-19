from django.shortcuts import render
from django.http import JsonResponse
import sqlite3
import os

# Ensure path is relative to your Django project root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fretmap', 'fretmap.db')

def index(request):
    return render(request, 'fretmap/index.html')


import json


def get_user_data(request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Auto-build table with new schema if it doesn't exist
    conn.execute('''CREATE TABLE IF NOT EXISTS transitions (
        id TEXT PRIMARY KEY, avg_time REAL, best_time REAL, 
        total_attempts INTEGER, mastery_status INTEGER DEFAULT 0
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY, zone_index INTEGER DEFAULT 0
    )''')

    # Get Zone
    zone_row = conn.execute('SELECT zone_index FROM user_progress WHERE id=1').fetchone()
    zone_index = zone_row['zone_index'] if zone_row else 0

    # Get Stats
    rows = conn.execute('SELECT * FROM transitions').fetchall()
    history = {r['id']: {
        'avg': r['avg_time'], 'best': r['best_time'],
        'count': r['total_attempts'], 'mastery': r['mastery_status']
    } for r in rows}

    conn.close()
    return JsonResponse({'history': history, 'zone_index': zone_index})


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
            conn.execute('INSERT OR REPLACE INTO user_progress (id, zone_index) VALUES (1, ?)', (data['new_zone'],))

        conn.commit()
        conn.close()
        return JsonResponse({'status': 'saved'})