import sqlite3
from django.conf import settings
from django.shortcuts import render as django_render
from . import *

from django.http import JsonResponse
from django.db import connection

from .randomized_keypoints_views import *  # âœ… added

DB_PATH = settings.DATABASES['default']['NAME']

# âœ… Keeps your wrapper
def render(request, html_file, context=None):
    return django_render(request, 'MyManager/' + html_file, context=context)


# âœ… Updated dashboard view, adds keypoint logic
import sqlite3
import json
from django.conf import settings
from .randomized_keypoints_views import get_random_key_point_context, render_key_point
from django.shortcuts import render as django_render

DB_PATH = settings.DATABASES['default']['NAME']

def dashboard_view(request):
    user_id = request.user.id if request.user.is_authenticated else 0

    # Load filters from DB
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT selected_chapters, weight_mode FROM filter_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

    if row:
        selected_chapters = json.loads(row[0])
        weight_mode = row[1]
    else:
        selected_chapters = []
        weight_mode = "early"

    # Fetch a random keypoint based on filters
    selected = get_random_key_point_context(selected_chapters, weight_mode)

    if not selected:
        return django_render(request, "MyManager/dashboard.html", {
            "key_point_error": "No key points found."
        })

    keypoint_context = render_key_point(
        request,
        selected['chapter_number'],
        selected['key_point_id'],
        chapter_id=selected['chapter_id'],
        is_random_across_chapters=True
    )

    # If a redirect or error occurred
    if hasattr(keypoint_context, 'status_code'):
        return keypoint_context

    return django_render(request, "MyManager/dashboard.html", keypoint_context)



# âœ… untouched
def menu_courses_api(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT name, url FROM courses")
        rows = cursor.fetchall()

    data = [{"title": row[0], "url": row[1]} for row in rows]
    return JsonResponse(data, safe=False)
    
import json
import sqlite3

def get_user_filter_settings(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT selected_courses, selected_chapters, weight_mode FROM filter_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

    if row:
        return {
            "selected_courses": json.loads(row[0]) if row[0] else [],
            "selected_chapters": json.loads(row[1]) if row[1] else [],
            "weight_mode": row[2] or "early"
        }
    return {}

