# school_core/views.py
from django.shortcuts import render
from django.http import JsonResponse
import sqlite3
import os
from django.views.decorators.csrf import csrf_exempt

def index_view(request):
    """
    Renders the main SPA shell.
    This is the only full page load the app will do.
    """
    return render(request, 'school_core/index.html')


def get_school_data(request):
    """
    Manual SQL API to fetch subjects, chapters, or notes.
    """
    data_type = request.GET.get('type')
    item_id = request.GET.get('id')
    results = []

    # Path to your SQLite database
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'myapp_db.sqlite3')

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if data_type == 'main_hub':
            cursor.execute("SELECT id, name FROM school_course")
            results = [dict(row) for row in cursor.fetchall()]

        elif data_type == 'course_dashboard':
            cursor.execute("SELECT id, title, chapter_number FROM school_chapter WHERE course_id = ?", (item_id,))
            results = [dict(row) for row in cursor.fetchall()]

        conn.close()
    except sqlite3.Error as e:
        return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'data': results})


@csrf_exempt  # Simplifies manual JS POST requests
def manage_school_data(request):
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        action = data.get('action')

        conn = get_db_connection()
        cursor = conn.cursor()

        if action == 'create_course':
            name = data.get('name')
            try:
                cursor.execute("INSERT INTO school_course (name) VALUES (?)", (name,))
                conn.commit()
                return JsonResponse({'status': 'success'})
            except sqlite3.IntegrityError:
                return JsonResponse({'status': 'error', 'message': 'Subject already exists'}, status=400)
            finally:
                conn.close()

    return JsonResponse({'status': 'invalid_request'}, status=400)