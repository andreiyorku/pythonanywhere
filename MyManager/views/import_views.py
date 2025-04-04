import json
import sqlite3
import re
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

DB_PATH = settings.DATABASES['default']['NAME']


@csrf_exempt
def import_fetch_contexts(request):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Get projects
        cursor.execute("SELECT name FROM projects")
        projects = [row[0] for row in cursor.fetchall()]

        # Get courses
        cursor.execute("SELECT name FROM courses")
        courses = [row[0] for row in cursor.fetchall()]

        # Get chapters
        cursor.execute("SELECT title FROM chapter")
        chapters = [row[0] for row in cursor.fetchall()]

    return JsonResponse({
        "projects": projects,
        "courses": courses,
        "chapters": chapters
    })


@csrf_exempt
def import_bulk_content(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    project = request.POST.get("project_name", "").strip()
    course = request.POST.get("course_name", "").strip()
    chapter = request.POST.get("chapter_name", "").strip()
    raw_html = request.POST.get("bulk_html", "").strip()

    print("ðŸš¨ Received import POST:")
    print("  Project:", project)
    print("  Course:", course)
    print("  Chapter (title):", chapter)
    print("  Bulk HTML:", raw_html[:100], "..." if raw_html else "")

    if not all([project, course, raw_html]):
        return JsonResponse({"error": "Missing fields for school import"}, status=400)

    keypoints = re.findall(r'<h1>(.*?)</h1>\s*<p>(.*?)</p>', raw_html, re.DOTALL)
    if not keypoints:
        return JsonResponse({"error": "No valid keypoints found"}, status=400)

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            if project == "SCHOOL_CONTEXT":
                # âœ… School logic (not tied to project table)
                cursor.execute("SELECT id FROM courses WHERE name = ?", (course,))
                row = cursor.fetchone()
                if row:
                    course_id = row[0]
                    print("âœ… Found course:", course_id)
                else:
                    cursor.execute("INSERT INTO courses (name) VALUES (?)", (course,))
                    course_id = cursor.lastrowid
                    print("ðŸ†• Created course:", course_id)

                # Chapter title logic
                cursor.execute("SELECT id FROM chapter WHERE title = ? AND course_id = ?", (chapter, course_id))
                row = cursor.fetchone()
                if row:
                    chapter_id = row[0]
                    print("âœ… Appending to existing chapter:", chapter_id)
                else:
                    cursor.execute("INSERT INTO chapter (title, course_id, chapter_number) VALUES (?, ?, ?)", (chapter, course_id, 0))
                    chapter_id = cursor.lastrowid
                    print("ðŸ†• Created chapter:", chapter_id)

                for idx, (header, body) in enumerate(keypoints, start=1):
                    print(f"âž• Inserting Keypoint {idx} into Chapter {chapter_id}: {header.strip()}")
                    cursor.execute("""
                        INSERT INTO keypoint (chapter_id, header, body, number_of_correct)
                        VALUES (?, ?, ?, 0)
                    """, (chapter_id, header.strip(), body.strip()))

                conn.commit()
                return JsonResponse({
                    "success": True,
                    "message": f"âœ… {len(keypoints)} keypoints saved to chapter '{chapter}'."
                })

            else:
                # ðŸ—‚ï¸ Project context - no chapter/keypoint logic yet
                cursor.execute("SELECT id FROM projects WHERE name = ?", (project,))
                row = cursor.fetchone()
                if not row:
                    cursor.execute("INSERT INTO projects (name) VALUES (?)", (project,))
                    print("ðŸ†• Created standalone project:", project)

                return JsonResponse({
                    "success": True,
                    "message": f"âœ… Project '{project}' created or already exists (no keypoints added)."
                })

    except sqlite3.Error as e:
        print("âŒ SQLite error:", str(e))
        return JsonResponse({"error": f"Database error: {str(e)}"}, status=500)




