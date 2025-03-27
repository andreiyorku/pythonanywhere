import sqlite3
import random
from django.shortcuts import render, redirect
from django.conf import settings
from django.core.cache import cache

DB_PATH = settings.DATABASES['default']['NAME']

# Chapters to exclude from random selection (e.g., Chapter 12)
EXCLUDED_CHAPTERS = []
INCLUDED_CHAPTERS = [12, 13]
# ======================================
# Fetch all chapters ordered by chapter_number (RAW SQL + caching)
# ======================================
def get_chapters_ordered():
    chapters = cache.get('chapters_ordered')
    if not chapters:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT chapter_number FROM chapter ORDER BY chapter_number ASC')
            chapters = [row[0] for row in cursor.fetchall()]
            cache.set('chapters_ordered', chapters, 60 * 60)  # Cache for 1 hour
    return chapters

# ======================================
# Get all keypoints for a chapter (RAW SQL)
# ======================================
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
    return keypoints, chapter_id  # ✅ Return chapter_id too

# ======================================
# Compute adjusted weights for keypoints (NO ORM needed)
# ======================================
def compute_keypoints_with_weights():
    pass  # Keeping your placeholder

# ======================================
# Random key point selection view (RAW SQL + logic)
# ======================================
def random_key_point_across_chapters_view(request):
    chapters = get_chapters_ordered()
    all_keypoints = []

    # ✅ Exclude chapters first
    filtered_chapters = [ch for ch in chapters if ch not in EXCLUDED_CHAPTERS]

    # ✅ Then apply included chapter filter, if any
    if INCLUDED_CHAPTERS:
        filtered_chapters = [ch for ch in filtered_chapters if ch in INCLUDED_CHAPTERS]

    for idx, chapter_number in enumerate(filtered_chapters):
        keypoints, chapter_id = get_keypoints_in_chapter(chapter_number)
        num_keypoints = len(keypoints)
        if num_keypoints == 0:
            continue

        chapter_weight = 2 ** (idx - 1)
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
        return render(request, "error.html", {"message": "No key points found."})

    weights = [kp['adjusted_weight'] for kp in all_keypoints]
    selected = random.choices(all_keypoints, weights=weights, k=1)[0]

    print("Working on " + str(selected['key_point_id']))

    return render_key_point(
        request,
        selected['chapter_number'],
        selected['key_point_id'],
        chapter_id=selected['chapter_id'],
        is_random_across_chapters=True
    )


# ======================================
# Render Key Point from DB (RAW SQL)
# ======================================
def render_key_point(request, chapter_number, key_point_id, chapter_id=None,
                     is_random_across_chapters=False, is_random_in_chapter=False):
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

    # ✅ Ensure chapter_id is always present for safe update
    if chapter_id is None:
        chapter_id = db_chapter_id

    if request.method == "POST":
        # ✅ Always get the actual IDs from POST to avoid updating random new keypoints
        key_point_id = int(request.POST.get("key_point_number", key_point_id))
        chapter_number = int(request.POST.get("chapter_number", chapter_number))

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            if "answer_correct" in request.POST:
                print("Updating: " + str(key_point_id))
                cursor.execute('''
                    UPDATE keypoint
                    SET number_of_correct = number_of_correct + 1
                    WHERE id = ?
                ''', (key_point_id,))
                conn.commit()
                print("Updated: " + str(key_point_id))

                if is_random_across_chapters:
                    return redirect('random_file')
                else:
                    return redirect(request.path)

            elif "answer_incorrect" in request.POST and is_random_across_chapters:
                return redirect('random_file')

            elif "show_answer" in request.POST:
                show_answer = True

    return render(request, "myappv0/chapter_key_point.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_id,
        "question_text": header,
        "content": body if body else "<p>No content available</p>",
        "correct_count": correct_count,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
        "is_random_in_chapter": is_random_in_chapter,
    })
