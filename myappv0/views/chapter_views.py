import sqlite3
from django.shortcuts import render
from django.conf import settings
from django.core.cache import cache

DB_PATH = settings.DATABASES['default']['NAME']

# ===========================================================
# FUNCTION: Get the title of a specific key point from DB
# ===========================================================
def get_key_point_title(chapter_id, keypoint_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT header FROM keypoint
        WHERE chapter_id = ? AND id = ?
    ''', (chapter_id, keypoint_id))

    result = cursor.fetchone()
    conn.close()

    return result[0] if result else f"Key Point {keypoint_id}"

# ===========================================================
# FUNCTION: Get list of key point IDs in a chapter from DB
# ===========================================================
def get_chapter_files(chapter_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id FROM keypoint
        WHERE chapter_id = ?
        ORDER BY id ASC
    ''', (chapter_id,))

    keypoints = [row[0] for row in cursor.fetchall()]
    conn.close()
    return keypoints

# ===========================================================
# FUNCTION: Render full chapter content from DB
# ===========================================================
def full_chapter_view(request, chapter_number):
    cache_key = f"chapter_{chapter_number}_full_content"
    full_content = cache.get(cache_key)

    if full_content:
        return render(request, "myappv0/chapter_full.html", {
            "chapter_number": chapter_number,
            "full_content": full_content
        })

    # Connect to DB and find the chapter by week_number (or use id if preferred)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('SELECT id, title FROM chapter WHERE chapter_number = ?', (chapter_number,))
    chapter = cursor.fetchone()
    if not chapter:
        conn.close()
        return render(request, "myappv0/chapter_full.html", {
            "chapter_number": chapter_number,
            "error": "Chapter not found."
        })
    chapter_id, chapter_title = chapter

    # Fetch all keypoints for the chapter
    cursor.execute('''
        SELECT id, header, body, number_of_correct
        FROM keypoint
        WHERE chapter_id = ?
        ORDER BY id ASC
    ''', (chapter_id,))
    keypoints = cursor.fetchall()
    conn.close()

    # Build the full content
    content_list = []
    for kp_id, header, body, correct in keypoints:
        content_list.append(f"<h2>Key Point {kp_id}: {header}</h2>")
        content_list.append(body if body else "<p>No content available</p>")
        content_list.append(f"<p><em>Correct count: {correct}</em></p>")
        content_list.append("<hr>")

    full_content = "\n".join(content_list)

    # Cache the rendered content for 24 hours
    cache.set(cache_key, full_content, timeout=60 * 60 * 24)

    # Render final output
    return render(request, "myappv0/chapter_full.html", {
        "chapter_number": chapter_number,
        "full_content": full_content
    })
