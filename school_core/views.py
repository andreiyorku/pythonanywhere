import json
from django.db import connection
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render


def spa_shell(request):
    # Returns the Single HTML file
    return render(request, 'school_core/index.html')

@csrf_exempt  # Disabling CSRF for simplicity in this specific dev context
def api_handler(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=400)

    data = json.loads(request.body)
    action = data.get('action')

    with connection.cursor() as cursor:

        # --- A. School Hub ---
        if action == 'get_courses':
            cursor.execute("SELECT id, name FROM school_course")
            rows = cursor.fetchall()
            return JsonResponse({'courses': [{'id': r[0], 'name': r[1]} for r in rows]})

        elif action == 'add_course':
            cursor.execute("INSERT INTO school_course (name) VALUES (%s)", [data['name']])
            return JsonResponse({'status': 'success'})

        # --- B. Course Dashboard ---
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

        # --- C. Chapter View & Content ---
        elif action == 'get_notes':
            cursor.execute("SELECT id, header, body, weight FROM school_note WHERE chapter_id = %s",
                           [data['chapter_id']])
            rows = cursor.fetchall()
            return JsonResponse({'notes': [{'id': r[0], 'header': r[1], 'body': r[2], 'weight': r[3]} for r in rows]})

        elif action == 'add_note':
            # Default weight is 10
            cursor.execute("INSERT INTO school_note (chapter_id, header, body, weight) VALUES (%s, %s, %s, 10)",
                           [data['chapter_id'], data['header'], data['body']])
            return JsonResponse({'status': 'success'})

        elif action == 'delete_note':
            cursor.execute("DELETE FROM school_note WHERE id = %s", [data['note_id']])
            return JsonResponse({'status': 'success'})

        # --- D. Adaptive Quiz Engine ---
        elif action == 'generate_quiz':
            # 1. Get notes from selected chapters
            chapter_ids = data['chapter_ids']  # List of IDs like [1, 2]
            placeholders = ','.join(['%s'] * len(chapter_ids))

            # SQL: Join Note and Chapter to access Chapter Index for the formula
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
                # THE FORMULA: Priority = Chapter Index * Note Weight
                priority_score = ch_index * weight

                # If priority is positive, add it to the pool
                if priority_score > 0:
                    quiz_set.append({
                        'id': note_id,
                        'question': question,
                        'answer': answer,
                        'score': priority_score
                    })

            # Sort by Priority Score (Highest first) to prioritize hard/important content
            quiz_set.sort(key=lambda x: x['score'], reverse=True)

            # Return top 10 questions (or all if less than 10)
            return JsonResponse({'quiz': quiz_set[:10]})

        elif action == 'submit_answer':
            # Update Logic: Decrease weight by 2 if correct
            note_id = data['note_id']
            is_correct = data['is_correct']

            if is_correct:
                cursor.execute(
                    "UPDATE school_note SET weight = MAX(1, weight - 2), correct_count = correct_count + 1 WHERE id = %s",
                    [note_id])
            else:
                # Optional: Increase weight if wrong? For now just track count.
                cursor.execute("UPDATE school_note SET wrong_count = wrong_count + 1 WHERE id = %s", [note_id])

            return JsonResponse({'status': 'updated'})

    return JsonResponse({'error': 'Invalid Action'}, status=400)