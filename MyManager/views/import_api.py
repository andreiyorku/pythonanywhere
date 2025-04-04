import os
import re
import sqlite3
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

DB_PATH = settings.DATABASES['default']['NAME']

@csrf_exempt
def get_courses_api(request):
    project = request.GET.get("project")

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        if project == "school":
            cursor.execute("SELECT name FROM courses")
        else:
            cursor.execute("""
                SELECT c.name
                FROM courses c
                JOIN projects p ON c.project_id = p.id
                WHERE p.name = ?
            """, (project,))
        
        courses = [row[0] for row in cursor.fetchall()]

    return JsonResponse({"courses": courses})



@csrf_exempt
def get_chapters_api(request):
    course_name = request.GET.get("course", "")
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT chapter.title
            FROM chapter
            JOIN courses ON chapter.course_id = courses.id
            WHERE courses.name = ?
        ''', (course_name,))
        chapters = [{"title": row[0]} for row in cursor.fetchall()]
    return JsonResponse({"chapters": chapters})


@csrf_exempt
def submit_import_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid method"}, status=405)

    context = request.POST.get("content_context")
    new_project = request.POST.get("new_project", "").strip()
    course_name = request.POST.get("course")
    new_course = request.POST.get("new_course", "").strip()
    chapter = request.POST.get("chapter")
    new_chapter = request.POST.get("new_chapter", "").strip()
    html = request.POST.get("bulk_html", "")

    # Determine actual context
    context = new_project if context == "new" else context
    course_name = new_course if course_name == "new" else course_name
    chapter_name = new_chapter if chapter == "new" else chapter

    if not all([context, course_name, chapter_name, html]):
        return JsonResponse({"error": "Missing required fields."}, status=400)

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON")

            # Insert project if needed
            cursor.execute("INSERT OR IGNORE INTO project (name) VALUES (?)", (context,))

            # Get or insert course
            cursor.execute("SELECT id FROM courses WHERE name = ?", (course_name,))
            row = cursor.fetchone()
            if not row:
                cursor.execute("INSERT INTO courses (name) VALUES (?)", (course_name,))
                course_id = cursor.lastrowid
            else:
                course_id = row[0]

            # Get or insert chapter
            cursor.execute("""
                SELECT id FROM chapter WHERE title = ? AND course_id = ?
            """, (chapter_name, course_id))
            row = cursor.fetchone()
            if not row:
                cursor.execute("""
                    INSERT INTO chapter (title, course_id, chapter_number, project_context)
                    VALUES (?, ?, ?, ?)
                """, (chapter_name, course_id, int(re.findall(r'\d+', chapter_name)[0]), context))
                chapter_id = cursor.lastrowid
            else:
                chapter_id = row[0]

            # Extract keypoints
            keypoints = re.findall(r"<h1>(.*?)</h1>\s*<p>(.*?)</p>", html, re.DOTALL)
            for header, body in keypoints:
                cursor.execute("""
                    INSERT INTO keypoint (chapter_id, header, body, number_of_correct)
                    VALUES (?, ?, ?, 0)
                """, (chapter_id, header.strip(), body.strip()))

            conn.commit()
        return JsonResponse({"status": "success", "message": f"{len(keypoints)} keypoints imported into {chapter_name}."})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

