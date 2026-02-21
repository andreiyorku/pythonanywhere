import sqlite3, json, os
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

def get_db_conn():
    db_path = os.path.join(settings.BASE_DIR, 'myapp_db.sqlite3')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_conn(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS fretmap_transition (
        id TEXT PRIMARY KEY, avg REAL, min REAL, max REAL, 
        count INTEGER, mastery INTEGER, isCalibrated INTEGER DEFAULT 0)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS fretmap_usersettings (
        id INTEGER PRIMARY KEY, zone_index INTEGER DEFAULT 0, 
        strictness INTEGER DEFAULT 50, attack INTEGER DEFAULT 50, stability INTEGER DEFAULT 50)""")
    cur.execute("INSERT OR IGNORE INTO fretmap_usersettings (id) VALUES (1)")
    conn.commit(); conn.close()
    print("[SYSTEM] Database Ready.")

init_db()

def index(request): return render(request, 'fretmap/index.html')

def get_user_data(request):
    conn = get_db_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM fretmap_transition")
    trans = {row['id']: dict(row) for row in cur.fetchall()}
    cur.execute("SELECT * FROM fretmap_usersettings WHERE id = 1")
    set_row = dict(cur.fetchone())
    conn.close()
    return JsonResponse({'transitions': trans, 'settings': set_row})

@csrf_exempt
def save_transition(request):
    data = json.loads(request.body); conn = get_db_conn(); cur = conn.cursor()
    sql = "INSERT OR REPLACE INTO fretmap_transition (id, avg, min, max, count, mastery, isCalibrated) VALUES (?,?,?,?,?,?,?)"
    cur.execute(sql, (data['id'], data['avg'], data['min'], data.get('max', data['avg']), data['count'], data['mastery'], data['isCalibrated']))
    conn.commit(); conn.close(); return JsonResponse({'status': 'ok'})

@csrf_exempt
def save_settings(request):
    data = json.loads(request.body); conn = get_db_conn(); cur = conn.cursor()
    if 'zone_index' in data: cur.execute("UPDATE fretmap_usersettings SET zone_index = ? WHERE id = 1", (data['zone_index'],))
    conn.commit(); conn.close(); return JsonResponse({'status': 'ok'})

@csrf_exempt
def clear_database(request):
    conn = get_db_conn(); conn.execute("DELETE FROM fretmap_transition"); conn.commit(); conn.close()
    return JsonResponse({'status': 'ok'})