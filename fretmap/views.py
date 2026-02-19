from django.shortcuts import render
from django.http import JsonResponse
import sqlite3
import os

# Ensure path is relative to your Django project root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fretmap', 'fretmap.db')

def index(request):
    return render(request, 'fretmap/index.html')

def get_user_data(request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM transitions').fetchall()
    history = {r['id']: {'avg': r['avg_time'], 'count': r['total_attempts']} for r in rows}
    conn.close()
    return JsonResponse({'history': history})

def save_transition(request):
    # Port your save logic here using JsonResponse
    return JsonResponse({'status': 'ok'})