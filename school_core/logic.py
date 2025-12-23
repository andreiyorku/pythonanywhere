import uuid
import json
from django.db import connection
from django.http import JsonResponse
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import random


# --- HELPER: Execute SQL ---
def db_query(query, params=[]):
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        if query.strip().upper().startswith("SELECT"):
            return cursor.fetchall()
        return None


# --- SECTION 1: HUB LOGIC ---
def handle_hub(action, data):
    if action == 'get_courses':
        rows = db_query("SELECT id, name FROM school_course")
        return {'courses': [{'id': r[0], 'name': r[1]} for r in rows]}

    elif action == 'add_course':
        db_query("INSERT INTO school_course (name) VALUES (%s)", [data['name']])
        return {'status': 'success'}

    # --- NEW: Delete Subject Logic ---
    elif action == 'delete_course':
        # Note: 'ON DELETE CASCADE' in your SQL schema ensures chapters/notes die with it
        db_query("DELETE FROM school_course WHERE id = %s", [data['course_id']])
        return {'status': 'success'}

    return None


# --- SECTION 2: COURSE LOGIC ---
def handle_course(action, data):
    if action == 'get_chapters':
        rows = db_query(
            "SELECT id, name, chapter_index FROM school_chapter WHERE course_id = %s ORDER BY chapter_index",
            [data['course_id']])
        return {'chapters': [{'id': r[0], 'name': r[1], 'index': r[2]} for r in rows]}

    elif action == 'add_chapter':
        db_query("INSERT INTO school_chapter (course_id, name, chapter_index) VALUES (%s, %s, %s)",
                 [data['course_id'], data['name'], data['index']])
        return {'status': 'success'}

    # --- NEW: Delete Chapter Logic ---
    elif action == 'delete_chapter':
        db_query("DELETE FROM school_chapter WHERE id = %s", [data['chapter_id']])
        return {'status': 'success'}

    return None


# --- SECTION 3: NOTE LOGIC ---
def handle_note(action, data, files):
    if action == 'get_notes':
        rows = db_query("SELECT id, header, body, weight FROM school_note WHERE chapter_id = %s", [data['chapter_id']])
        return {'notes': [{'id': r[0], 'header': r[1], 'body': r[2], 'weight': r[3]} for r in rows]}

    elif action == 'add_note':
        header = data.get('header')
        body = data.get('body', '')

        # Handle Image Upload Logic here
        if 'image_file' in files:
            image = files['image_file']
            ext = image.name.split('.')[-1]
            filename = f"{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, ContentFile(image.read()))
            body = f"IMG:/media/{saved_path}"

        db_query("INSERT INTO school_note (chapter_id, header, body, weight) VALUES (%s, %s, %s, 10)",
                 [data['chapter_id'], header, body])
        return {'status': 'success'}

    elif action == 'delete_note':
        db_query("DELETE FROM school_note WHERE id = %s", [data['note_id']])
        return {'status': 'success'}

    return None


# --- SECTION 4: QUIZ LOGIC ---
# --- SECTION 4: QUIZ LOGIC ---
def handle_quiz(action, data):
    # 1. INITIAL LOAD: Send ONLY IDs and Weights to the client
    if action == 'init_quiz':
        chapter_ids = data.get('chapter_ids')
        if isinstance(chapter_ids, str):
            chapter_ids = json.loads(chapter_ids)

        placeholders = ','.join(['%s'] * len(chapter_ids))

        # We only fetch ID and WEIGHT. No text. Super fast.
        query = f"""
            SELECT id, weight 
            FROM school_note 
            WHERE chapter_id IN ({placeholders})
        """
        rows = db_query(query, chapter_ids)

        # Send raw list to JS: [{'id': 12, 'w': 100.0}, ...]
        return {'deck': [{'id': r[0], 'w': float(r[1])} for r in rows]}

    # 2. CONTENT FETCH: Client picked a winner, now asks for text
    elif action == 'get_content':
        note_id = data.get('note_id')
        rows = db_query("SELECT header, body FROM school_note WHERE id = %s", [note_id])
        if rows:
            return {'header': rows[0][0], 'body': rows[0][1]}
        return {'error': 'Note not found'}

    # 3. SAVE RESULT: Client tells us to update DB (Background sync)
    elif action == 'submit_answer':
        note_id = data['note_id']
        is_correct = data['is_correct']

        if isinstance(is_correct, str):
            is_correct = (is_correct.lower() == 'true')

        if is_correct:
            # Server-side weight update (Source of Truth)
            db_query(
                "UPDATE school_note SET weight = MAX(2.23e-308, weight / 2.0), correct_count = correct_count + 1 WHERE id = %s",
                [note_id])
        else:
            db_query("UPDATE school_note SET wrong_count = wrong_count + 1 WHERE id = %s", [note_id])

        return {'status': 'saved'}

    return None