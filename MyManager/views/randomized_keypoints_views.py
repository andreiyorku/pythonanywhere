import sqlite3
import random
from django.shortcuts import render, redirect
from django.conf import settings
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
import json


DB_PATH = settings.DATABASES['default']['NAME']

EXCLUDED_CHAPTERS = []
INCLUDED_CHAPTERS = [12, 13]

def get_chapters_ordered():
    chapters = cache.get('chapters_ordered')
    if not chapters:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT chapter_number FROM chapter ORDER BY chapter_number ASC')
            chapters = [row[0] for row in cursor.fetchall()]
            cache.set('chapters_ordered', chapters, 60 * 60)
    return chapters

def get_keypoints_in_chapter(chapter_number):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM chapter WHERE chapter_number = ?', (chapter_number,))
        chapter_row = cursor.fetchone()
        if not chapter_row:
            return []
        chapter_id = chapter_row[0]
        cursor.execute('''
            SELECT id, chapter_id, number_of_correct
            FROM keypoint
            WHERE chapter_id = ?
            ORDER BY id ASC
        ''', (chapter_id,))
        keypoints = cursor.fetchall()
    return keypoints, chapter_id

# ✅ Used by dashboard and random view
def get_random_key_point_context(selected_chapters=None, weight_mode="early"):
    chapters = get_chapters_ordered()
    all_keypoints = []

    # ✅ Apply filters
    filtered_chapters = [ch for ch in chapters if ch not in EXCLUDED_CHAPTERS]
    if selected_chapters:
        filtered_chapters = [ch for ch in filtered_chapters if ch in selected_chapters]
    elif INCLUDED_CHAPTERS:
        filtered_chapters = [ch for ch in filtered_chapters if ch in INCLUDED_CHAPTERS]

    total_chapters = len(filtered_chapters)

    for idx, chapter_number in enumerate(filtered_chapters):
        keypoints, chapter_id = get_keypoints_in_chapter(chapter_number)
        num_keypoints = len(keypoints)
        if num_keypoints == 0:
            continue

        # ✅ Weighted logic based on position and mode
        if weight_mode == "early":
            chapter_weight = 2 ** (total_chapters - idx - 1)
        elif weight_mode == "late":
            chapter_weight = 2 ** idx
        elif weight_mode == "middle":
            mid = (total_chapters - 1) / 2
            dist = abs(idx - mid)
            chapter_weight = 1 / (dist + 1)
        elif weight_mode == "edges":
            mid = (total_chapters - 1) / 2
            dist = abs(idx - mid)
            chapter_weight = dist + 1
        else:
            chapter_weight = 1  # default if mode unrecognized

        base_weight = chapter_weight / num_keypoints

        for kp_id, kp_chapter_id, correct_count in keypoints:
            adj_weight = base_weight / (2 ** correct_count)
            all_keypoints.append({
                "chapter_number": chapter_number,
                "chapter_id": kp_chapter_id,
                "key_point_id": kp_id,
                "adjusted_weight": adj_weight
            })

    if not all_keypoints:
        return None

    weights = [kp['adjusted_weight'] for kp in all_keypoints]
    return random.choices(all_keypoints, weights=weights, k=1)[0]


# Optional standalone route
def random_key_point_across_chapters_view(request):
    from .randomized_keypoints_views import render_key_point
    selected = get_random_key_point_context()
    if not selected:
        return render(request, "error.html", {"message": "No key points found."})

    return render_key_point(
        request,
        selected['chapter_number'],
        selected['key_point_id'],
        chapter_id=selected['chapter_id'],
        is_random_across_chapters=True
    )

# Shared rendering logic (used by dashboard)
def render_key_point(request, chapter_number, key_point_id, chapter_id=None,
                     is_random_across_chapters=False, is_random_in_chapter=False):
    #print("📌 Rendering KeyPoint ID:", key_point_id)

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT header, body, number_of_correct, chapter_id
            FROM keypoint
            WHERE id = ?
        ''', (key_point_id,))
        row = cursor.fetchone()

    if not row:
        return render(request, "error.html", {"message": "Key point not found."})

    header, body, correct_count, db_chapter_id = row
    show_answer = request.session.pop('show_answer', False)

    if chapter_id is None:
        chapter_id = db_chapter_id

    if request.method == "POST":
        key_point_id = int(request.POST.get("key_point_number", key_point_id))
        chapter_number = int(request.POST.get("chapter_number", chapter_number))

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            if "answer_correct" in request.POST:
                cursor.execute('''
                    UPDATE keypoint
                    SET number_of_correct = number_of_correct + 1
                    WHERE id = ?
                ''', (key_point_id,))
                conn.commit()

                if is_random_across_chapters:
                    return redirect('random_file')
                else:
                    return redirect(request.path)

            elif "answer_incorrect" in request.POST and is_random_across_chapters:
                return redirect('random_file')

            elif "show_answer" in request.POST:
                show_answer = True

    return {
        "chapter_number": chapter_number,
        "key_point_number": key_point_id,
        "question_text": header,
        "content": body if body else "<p>No content available</p>",
        "correct_count": correct_count,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
        "is_random_in_chapter": is_random_in_chapter,
    }

from django.http import JsonResponse
from django.template.loader import render_to_string

def random_keypoint_api(request):
    

    if request.method == "POST":
        key_point_id = int(request.POST.get("key_point_number", 0))
        answer_type = request.POST.get("answer")

        # Update correct count if answered
        if answer_type == "correct" and key_point_id:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE keypoint
                    SET number_of_correct = number_of_correct + 1
                    WHERE id = ?
                ''', (key_point_id,))
                conn.commit()

        # ✅ Extract filters from request
        weight_mode = request.POST.get("weight_mode", "early")
        selected_chapters = request.POST.getlist("selected_chapters")
        selected_chapters = [int(ch) for ch in selected_chapters] if selected_chapters else []

        # ✅ Use filters when generating the keypoint
        selected = get_random_key_point_context(
            selected_chapters=selected_chapters,
            weight_mode=weight_mode
        )

        if not selected:
            return JsonResponse({'html': '<p>No key points found.</p>'})

        context = render_key_point(
            request,
            selected['chapter_number'],
            selected['key_point_id'],
            chapter_id=selected['chapter_id'],
            is_random_across_chapters=True
        )

        if hasattr(context, 'status_code'):
            return JsonResponse({'html': '<p>Error loading key point.</p>'})
        #print("🧠 Sending keypoint:", context["key_point_number"])
        html = render_to_string("MyManager/components/keypoint_display.html", context, request=request)
        return JsonResponse({'html': html})

from django.http import JsonResponse
import sqlite3

def chapters_by_course_api(request):
    selected_courses = request.GET.getlist('courses[]')  # JS will send courses[] as list
    chapter_numbers = []

    if not selected_courses:
        return JsonResponse({"chapters": []})

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        placeholders = ",".join(["?"] * len(selected_courses))
        cursor.execute(f"""
            SELECT DISTINCT c.chapter_number
            FROM chapter c
            JOIN courses cr ON c.course_id = cr.id
            WHERE cr.name IN ({placeholders})
            ORDER BY c.chapter_number ASC
        """, selected_courses)
        chapter_numbers = [row[0] for row in cursor.fetchall()]

    return JsonResponse({"chapters": chapter_numbers})

def filter_options_api(request):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM courses")
        courses = [row[0] for row in cursor.fetchall()]
        cursor.execute("SELECT chapter_number FROM chapter ORDER BY chapter_number ASC")
        chapters = [row[0] for row in cursor.fetchall()]
    return JsonResponse({"courses": courses, "chapters": chapters})

@csrf_exempt
def save_filter_settings_api(request):
    if request.method == "POST":
        user_id = request.user.id if request.user.is_authenticated else 0  # 0 = anonymous fallback

        courses = request.POST.getlist("selected_courses[]")
        chapters = request.POST.getlist("selected_chapters[]")
        mode = request.POST.get("weight_mode", "early")

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT user_id FROM filter_settings WHERE user_id = ?", (user_id,))
            exists = cursor.fetchone()

            if exists:
                cursor.execute("""
                    UPDATE filter_settings
                    SET selected_courses = ?, selected_chapters = ?, weight_mode = ?
                    WHERE user_id = ?
                """, (json.dumps(courses), json.dumps(chapters), mode, user_id))
            else:
                cursor.execute("""
                    INSERT INTO filter_settings (user_id, selected_courses, selected_chapters, weight_mode)
                    VALUES (?, ?, ?, ?)
                """, (user_id, json.dumps(courses), json.dumps(chapters), mode))

            conn.commit()

        return JsonResponse({"status": "saved"})

    return JsonResponse({"error": "bad request"}, status=400)

