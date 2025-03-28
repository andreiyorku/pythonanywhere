# views/filter_api.py (or inside randomized_keypoints_views.py)

import sqlite3
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

DB_PATH = settings.DATABASES['default']['NAME']

# ✅ Get available courses
@csrf_exempt
def filter_options_api(request):
    user_id = request.user.id if request.user.is_authenticated else 0
    saved_filters = {
        "selected_courses": [],
        "selected_chapters": [],
        "weight_mode": "early"
    }

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT name FROM courses ORDER BY name ASC")
        courses = [row[0] for row in cursor.fetchall()]

        # Load saved filter if exists
        cursor.execute("SELECT selected_courses, selected_chapters, weight_mode FROM filter_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            saved_filters = {
                "selected_courses": json.loads(row[0]),
                "selected_chapters": json.loads(row[1]),
                "weight_mode": row[2]
            }

    return JsonResponse({"courses": courses, "saved_filters": saved_filters})

# ✅ Get chapters grouped by course name
@csrf_exempt
def chapters_by_course_api(request):
    selected = request.GET.getlist("courses[]")
    result = {}

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        for course_name in selected:
            cursor.execute("""
                SELECT ch.chapter_number
                FROM chapter ch
                JOIN courses c ON ch.course_id = c.id
                WHERE c.name = ?
                ORDER BY ch.chapter_number
            """, (course_name,))
            result[course_name] = [row[0] for row in cursor.fetchall()]

    return JsonResponse({"chapters_by_course": result})

# ✅ Save filter state
@csrf_exempt
def save_filter_settings_api(request):
    if request.method == "POST":
        user_id = request.user.id if request.user.is_authenticated else 0  # 0 = anonymous
        selected_courses = request.POST.getlist("selected_courses[]")
        selected_chapters = request.POST.getlist("selected_chapters[]")
        weight_mode = request.POST.get("weight_mode", "early")

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM filter_settings WHERE user_id = ?", (user_id,))
            exists = cursor.fetchone()

            if exists:
                cursor.execute("""
                    UPDATE filter_settings
                    SET selected_courses = ?, selected_chapters = ?, weight_mode = ?
                    WHERE user_id = ?
                """, (json.dumps(selected_courses), json.dumps(selected_chapters), weight_mode, user_id))
            else:
                cursor.execute("""
                    INSERT INTO filter_settings (user_id, selected_courses, selected_chapters, weight_mode)
                    VALUES (?, ?, ?, ?)
                """, (user_id, json.dumps(selected_courses), json.dumps(selected_chapters), weight_mode))

            conn.commit()

        return JsonResponse({"status": "saved"})

    return JsonResponse({"error": "invalid request"}, status=400)
