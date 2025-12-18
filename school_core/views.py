import json
import os
import uuid
from django.db import connection
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

# Add this new view function
# def get_partial(request, filename):
#     # This securely returns the requested HTML file from the partials folder
#     return render(request, f'school_core/partials/{filename}.html')

def spa_shell(request):
    return render(request, 'school_core/index.html')


@csrf_exempt
def api_handler(request):
    # 1. SETUP: Determine if this is a JSON request or a File Upload request
    data = {}

    # If it's a file upload, data is in request.POST
    if request.content_type.startswith('multipart/form-data'):
        data = request.POST.dict()  # Convert to standard dictionary

    # If it's normal JSON data
    elif request.body:
        try:
            data = json.loads(request.body)
        except:
            data = {}

    action = data.get('action')

    with connection.cursor() as cursor:

        # --- HUB ---
        if action == 'get_courses':
            cursor.execute("SELECT id, name FROM school_course")
            rows = cursor.fetchall()
            return JsonResponse({'courses': [{'id': r[0], 'name': r[1]} for r in rows]})

        elif action == 'add_course':
            cursor.execute("INSERT INTO school_course (name) VALUES (%s)", [data['name']])
            return JsonResponse({'status': 'success'})

        # --- DASHBOARD ---
        elif action == 'get_chapters':
            cursor.execute(
                "SELECT id, name, chapter_index FROM school_chapter WHERE course_id = %s ORDER BY chapter_index",
                [data['course_id']])
            rows = cursor.fetchall()
            return JsonResponse({'chapters': [{'id': r[0], 'name': r[1], 'index': r[2]} for r in rows]})

        elif action == 'add_chapter':
            cursor.execute("INSERT INTO school_chapter (course_id, name, chapter_index) VALUES (%s, %s, %s)",
                           [data['course_id'], data['name'], data['index']])
            return JsonResponse({'status': 'success'})

        # --- NOTES ( UPDATED FOR IMAGES ) ---
        elif action == 'get_notes':
            cursor.execute("SELECT id, header, body, weight FROM school_note WHERE chapter_id = %s",
                           [data['chapter_id']])
            rows = cursor.fetchall()
            # Logic handled in frontend to decide if body is text or image URL
            return JsonResponse({'notes': [{'id': r[0], 'header': r[1], 'body': r[2], 'weight': r[3]} for r in rows]})

        elif action == 'add_note':
            header = data.get('header')
            body = data.get('body', '')  # This is the text body

            # CHECK FOR FILE UPLOAD
            if 'image_file' in request.FILES:
                image = request.FILES['image_file']

                # 1. Generate unique filename
                ext = image.name.split('.')[-1]
                filename = f"{uuid.uuid4()}.{ext}"

                # 2. Save file to MEDIA_ROOT
                saved_path = default_storage.save(filename, ContentFile(image.read()))

                # 3. The Body becomes the URL path (e.g., /media/uuid.jpg)
                # We add a prefix 'IMG:' so the frontend knows it's an image
                body = f"IMG:/media/{saved_path}"

            cursor.execute("INSERT INTO school_note (chapter_id, header, body, weight) VALUES (%s, %s, %s, 10)",
                           [data['chapter_id'], header, body])
            return JsonResponse({'status': 'success'})

        elif action == 'delete_note':
            cursor.execute("DELETE FROM school_note WHERE id = %s", [data['note_id']])
            return JsonResponse({'status': 'success'})

        # --- QUIZ ---
        elif action == 'generate_quiz':
            # Handle list being passed as string in FormData or List in JSON
            chapter_ids = data.get('chapter_ids')
            if isinstance(chapter_ids, str):
                chapter_ids = json.loads(chapter_ids)

            placeholders = ','.join(['%s'] * len(chapter_ids))
            query = f"""
                SELECT n.id, n.header, n.body, n.weight, c.chapter_index 
                FROM school_note n
                JOIN school_chapter c ON n.chapter_id = c.id
                WHERE n.chapter_id IN ({placeholders})
            """
            cursor.execute(query, chapter_ids)
            rows = cursor.fetchall()

            quiz_set = []
            for r in rows:
                note_id, question, answer, weight, ch_index = r
                priority_score = ch_index * weight
                if priority_score > 0:
                    quiz_set.append({'id': note_id, 'question': question, 'answer': answer, 'score': priority_score})

            quiz_set.sort(key=lambda x: x['score'], reverse=True)
            return JsonResponse({'quiz': quiz_set[:10]})

        elif action == 'submit_answer':
            note_id = data['note_id']
            # Convert string 'true'/'false' to python boolean if coming from FormData
            is_correct = data['is_correct']
            if isinstance(is_correct, str):
                is_correct = (is_correct.lower() == 'true')

            if is_correct:
                cursor.execute(
                    "UPDATE school_note SET weight = MAX(0.123456789012345, weight / 2), correct_count = correct_count + 1 WHERE id = %s",
                    [note_id])
            else:
                cursor.execute("UPDATE school_note SET wrong_count = wrong_count + 1 WHERE id = %s", [note_id])
            return JsonResponse({'status': 'updated'})

    return JsonResponse({'error': 'Invalid Action'}, status=400)