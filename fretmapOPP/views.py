import sqlite3, json, os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

def get_db_conn():
    # Points to the new database created by the setup script
    db_path = os.path.join(settings.BASE_DIR, 'fretmapOPP.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def index(request):
    return render(request, 'fretmapOPP/index.html')

def get_user_data(request):
    conn = get_db_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM transitions")
    trans = {row['id']: dict(row) for row in cur.fetchall()}
    cur.execute("SELECT * FROM settings WHERE id = 1")
    set_row = dict(cur.fetchone())
    conn.close()
    return JsonResponse({'transitions': trans, 'settings': set_row})

@csrf_exempt
def save_transition(request):
    data = json.loads(request.body)
    conn = get_db_conn(); cur = conn.cursor()
    sql = """INSERT OR REPLACE INTO transitions 
             (id, avg_ms, min_ms, max_ms, count, mastery, is_calibrated) 
             VALUES (?,?,?,?,?,?,?)"""
    cur.execute(sql, (
        data['id'], data['avg'], data['min'],
        data.get('max', data['avg']), data['count'],
        data['mastery'], data['is_calibrated']
    ))
    conn.commit(); conn.close()
    return JsonResponse({'status': 'ok'})

@csrf_exempt
def save_settings(request):
    data = json.loads(request.body)
    conn = get_db_conn(); cur = conn.cursor()
    if 'zone_index' in data:
        cur.execute("UPDATE settings SET zone_index = ? WHERE id = 1", (data['zone_index'],))
    conn.commit(); conn.close()
    return JsonResponse({'status': 'ok'})