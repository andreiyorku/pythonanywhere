import sqlite3
import json
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Point exactly to your new prepopulated database
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'myapp_db.sqlite3'))


def get_user_data(request):
    """Loads ALL 19,000 combinations + settings into JS at startup"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Get settings
    c.execute("SELECT zone_index, strictness, attack FROM user_progress WHERE id=1")
    user_row = c.fetchone()
    settings = dict(user_row) if user_row else {'zone_index': 0, 'strictness': 70, 'attack': 80}

    # Get all transitions
    c.execute("SELECT id, avg_time, min_time, max_time, total_attempts, mastery_status FROM transitions")
    transitions = {}
    for row in c.fetchall():
        transitions[row['id']] = {
            'avg': row['avg_time'],
            'min': row['min_time'],
            'max': row['max_time'],
            'count': row['total_attempts'],
            'mastery': row['mastery_status']
        }
    conn.close()

    return JsonResponse({'settings': settings, 'transitions': transitions})


@csrf_exempt
def save_transition(request):
    """Instantly updates min, max, avg for a single note strike"""
    if request.method == 'POST':
        data = json.loads(request.body)
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Because we pre-populated 100% of the rows, we only need UPDATE, never INSERT.
        c.execute('''UPDATE transitions 
                     SET avg_time = ?, min_time = ?, max_time = ?, total_attempts = ?, mastery_status = ?
                     WHERE id = ?''',
                  (data['avg'], data['min'], data['max'], data['count'], data['mastery'], data['id']))

        conn.commit()
        conn.close()
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'invalid request'}, status=400)