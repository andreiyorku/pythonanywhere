import logging
logger = logging.getLogger(__name__)

import sqlite3
import random
from django.shortcuts import render, redirect
from django.conf import settings
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.template.loader import render_to_string
import json

DB_PATH = settings.DATABASES['default']['NAME']

def get_keypoints_in_chapter(chapter_number, course_name):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT ch.id FROM chapter ch
            JOIN courses c ON ch.course_id = c.id
            WHERE ch.chapter_number = ? AND c.name = ?
        ''', (chapter_number, course_name))
        chapter_row = cursor.fetchone()
        if not chapter_row:
            return [], None
        chapter_id = chapter_row[0]
        cursor.execute('''
            SELECT id, chapter_id, number_of_correct
            FROM keypoint
            WHERE chapter_id = ?
            ORDER BY id ASC
        ''', (chapter_id,))
        keypoints = cursor.fetchall()
    return keypoints, chapter_id

def get_random_key_point_context(selected_chapters=None, weight_mode="early", course_chapter_map=None, course_weights=None):
    logger.debug("[get_random_key_point_context] Called with filters:", selected_chapters, weight_mode)

    all_keypoints = []

    if not course_chapter_map:
        return None

    num_courses = len(course_chapter_map)
    if num_courses == 0:
        return None

    for course_name, chapter_list in course_chapter_map.items():
        total_chapters = len(chapter_list)
        if total_chapters == 0:
            continue

        if course_weights:
            course_weight = course_weights.get(course_name, 1 / num_courses)
        else:
            course_weight = 1 / num_courses

        chapter_weights = {}
        total_chapter_weight = 0

        for idx, chapter_number in enumerate(chapter_list):
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
            elif weight_mode == "custom_split_middle_range":
                range_a_chapters = [ch for ch in chapter_list if 1 <= ch <= 5]
                range_b_chapters = [ch for ch in chapter_list if ch not in range_a_chapters]

                range_a_weight = 0.3
                range_b_weight = 0.7

                if len(chapter_list) == 1:
                    chapter_weight = 1.0
                elif chapter_number in range_a_chapters:
                    if len(range_a_chapters) == 1:
                        chapter_weight = range_a_weight
                    else:
                        mid = (range_a_chapters[0] + range_a_chapters[-1]) / 2
                        dist = abs(chapter_number - mid)
                        chapter_weight = (1 / (dist + 1)) * range_a_weight
                elif chapter_number in range_b_chapters:
                    if len(range_b_chapters) == 1:
                        chapter_weight = range_b_weight
                    else:
                        mid = (min(range_b_chapters) + max(range_b_chapters)) / 2
                        dist = abs(chapter_number - mid)
                        chapter_weight = (1 / (dist + 1)) * range_b_weight
                else:
                    chapter_weight = 1.0
            else:
                chapter_weight = 1

            chapter_weights[chapter_number] = chapter_weight
            total_chapter_weight += chapter_weight

        for chapter_number in chapter_list:
            keypoints, chapter_id = get_keypoints_in_chapter(chapter_number, course_name)
            if not keypoints:
                continue

            normalized_chapter_weight = chapter_weights[chapter_number] / total_chapter_weight
            base_weight = course_weight * normalized_chapter_weight

            for kp_id, kp_chapter_id, correct_count in keypoints:
                adj_weight = base_weight / (2 ** correct_count)
                all_keypoints.append({
                    "chapter_number": chapter_number,
                    "chapter_id": kp_chapter_id,
                    "key_point_id": kp_id,
                    "course_name": course_name,
                    "adjusted_weight": adj_weight
                })

    if not all_keypoints:
        logger.debug("No keypoints found after applying filters.")
        return None

    weights = [kp['adjusted_weight'] for kp in all_keypoints]
    selected = random.choices(all_keypoints, weights=weights, k=1)[0]

    logger.debug("[get_random_key_point_context] Selected keypoint ID:", selected['key_point_id'])
    return selected


def render_key_point(request, chapter_number, key_point_id, chapter_id=None, course_name=None,
                     is_random_across_chapters=False, is_random_in_chapter=False,
                     force_show_answer=False):
    logger.debug("[render_key_point] Rendering keypoint ID:", key_point_id)

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT header, body, number_of_correct, chapter_id
            FROM keypoint
            WHERE id = ?
        ''', (key_point_id,))
        row = cursor.fetchone()

        if not row:
            logger.debug("Keypoint not found with ID:", key_point_id)
            return render(request, "error.html", {"message": "Key point not found."})

        header, body, correct_count, db_chapter_id = row

        if not course_name:
            cursor.execute('''
                SELECT c.name FROM courses c
                JOIN chapter ch ON ch.course_id = c.id
                WHERE ch.id = ?
            ''', (db_chapter_id,))
            course_row = cursor.fetchone()
            course_name = course_row[0] if course_row else ""

    show_answer = False
    if request.method == "POST":
        if request.POST.get("answer") == "show_answer":
            show_answer = force_show_answer or request.session.pop('show_answer', False)

    if chapter_id is None:
        chapter_id = db_chapter_id

    final_context = {
        "chapter_number": chapter_number,
        "key_point_number": key_point_id,
        "question_text": header,
        "content": body if body else "<p>No content available</p>",
        "correct_count": correct_count,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
        "is_random_in_chapter": is_random_in_chapter,
        "course_name": course_name,
    }

    logger.debug("[render_key_point] Final context includes key_point_number =", final_context['key_point_number'])
    return final_context

@csrf_exempt
def random_keypoint_api(request):
    if request.method == "POST":
        key_point_id = int(request.POST.get("key_point_number", 0))
        answer_type = request.POST.get("answer")

        logger.debug("[random_keypoint_api] POST received with key_point_number =", key_point_id)

        if answer_type == "show_answer" and key_point_id:
            logger.debug("Show Answer triggered for keypoint ID:", key_point_id)
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT ch.chapter_number, c.name
                    FROM chapter ch
                    JOIN courses c ON ch.course_id = c.id
                    JOIN keypoint kp ON kp.chapter_id = ch.id
                    WHERE kp.id = ?
                ''', (key_point_id,))
                chapter_row = cursor.fetchone()

            if not chapter_row:
                return JsonResponse({'html': '<p>Error: Chapter not found for keypoint.</p>'})

            chapter_number, course_name = chapter_row

            context = render_key_point(
                request,
                chapter_number=chapter_number,
                key_point_id=key_point_id,
                is_random_across_chapters=True,
                force_show_answer=True,
                course_name=course_name
            )
            html = render_to_string("MyManager/components/keypoint_display.html", context, request=request)
            return JsonResponse({'html': html})

        if answer_type == "correct" and key_point_id:
            logger.debug("Processing answer:", answer_type, "for KP:", key_point_id)
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE keypoint
                    SET number_of_correct = number_of_correct + 1
                    WHERE id = ?
                ''', (key_point_id,))
                conn.commit()

        weight_mode = request.POST.get("weight_mode", "early")
        selected_chapters = request.POST.getlist("selected_chapters[]")
        selected_chapters = list(map(int, selected_chapters))

        user_id = request.user.id if request.user.is_authenticated else 0
        course_chapter_map = {}
        course_weights = {}

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT selected_courses FROM filter_settings WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()

            if row:
                selected_courses = json.loads(row[0])
                for course in selected_courses:
                    cursor.execute('''
                        SELECT ch.chapter_number
                        FROM chapter ch
                        JOIN courses c ON ch.course_id = c.id
                        WHERE c.name = ? AND ch.chapter_number IN ({})
                    '''.format(','.join('?' * len(selected_chapters))), [course] + selected_chapters)

                    chapters = [r[0] for r in cursor.fetchall()]
                    if chapters:
                        course_chapter_map[course] = chapters

                if selected_courses:
                    main_course = selected_courses[0]
                    other_courses = [c for c in selected_courses if c != main_course]
                    course_weights[main_course] = 0.5
                    if other_courses:
                        remaining_weight = 0.5 / len(other_courses)
                        for c in other_courses:
                            course_weights[c] = remaining_weight
                    else:
                        course_weights[main_course] = 1.0

        selected = get_random_key_point_context(
            selected_chapters=selected_chapters,
            weight_mode=weight_mode,
            course_chapter_map=course_chapter_map,
            course_weights=course_weights
        )

        if not selected:
            return JsonResponse({'html': '<p>No key points found.</p>'})

        context = render_key_point(
            request,
            selected['chapter_number'],
            selected['key_point_id'],
            chapter_id=selected['chapter_id'],
            is_random_across_chapters=True,
            course_name=selected['course_name']
        )

        if hasattr(context, 'status_code'):
            return JsonResponse({'html': '<p>Error rendering key point.</p>'})

        html = render_to_string("MyManager/components/keypoint_display.html", context, request=request)
        logger.debug("[random_keypoint_api] Sending rendered keypoint:", context['key_point_number'])
        return JsonResponse({'html': html})

    return JsonResponse({"error": "Invalid method"}, status=405)