import uuid
import json
from django.db import connection
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.hashers import make_password, check_password
import random


# --- HELPER: Execute SQL ---
def db_query(query, params=[]):
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        if query.strip().upper().startswith("SELECT"):
            return cursor.fetchall()
        return None


# --- AUTHENTICATION ---
def handle_auth(action, data, request):
    if action == 'login':
        username = data.get('username')
        password = data.get('password')

        rows = db_query("SELECT id, password FROM school_user WHERE username = %s", [username])
        if not rows: return {'error': 'User not found'}

        user_id, hashed_pw = rows[0]
        if check_password(password, hashed_pw):
            request.session['user_id'] = user_id
            return {'status': 'success', 'username': username}
        return {'error': 'Invalid password'}

    elif action == 'register':
        username = data.get('username')
        password = data.get('password')

        # Check duplicate
        if db_query("SELECT id FROM school_user WHERE username = %s", [username]):
            return {'error': 'Username taken'}

        hashed_pw = make_password(password)
        db_query("INSERT INTO school_user (username, password) VALUES (%s, %s)", [username, hashed_pw])

        # Auto-login
        new_user = db_query("SELECT id FROM school_user WHERE username = %s", [username])
        request.session['user_id'] = new_user[0][0]
        return {'status': 'success', 'username': username}

    elif action == 'logout':
        request.session.flush()
        return {'status': 'logged_out'}

    elif action == 'get_current_user':
        user_id = request.session.get('user_id')
        if user_id:
            rows = db_query("SELECT username FROM school_user WHERE id = %s", [user_id])
            if rows: return {'username': rows[0][0]}
        return {'username': None}

    return None


# --- PUBLIC CONTENT (Shared by Everyone) ---
# We REMOVED the user_id check so everyone sees all courses.

def handle_hub(action, data, request):
    if action == 'get_courses':
        rows = db_query("SELECT id, name FROM school_course")
        return {'courses': [{'id': r[0], 'name': r[1]} for r in rows]}

    elif action == 'add_course':
        db_query("INSERT INTO school_course (name) VALUES (%s)", [data['name']])
        return {'status': 'success'}

    elif action == 'delete_course':
        db_query("DELETE FROM school_course WHERE id = %s", [data['course_id']])
        return {'status': 'success'}

    return None


def handle_course(action, data, request):
    if action == 'get_chapters':
        rows = db_query(
            "SELECT id, name, chapter_index FROM school_chapter WHERE course_id = %s ORDER BY chapter_index",
            [data['course_id']])
        return {'chapters': [{'id': r[0], 'name': r[1], 'index': r[2]} for r in rows]}

    elif action == 'add_chapter':
        db_query("INSERT INTO school_chapter (course_id, name, chapter_index) VALUES (%s, %s, %s)",
                 [data['course_id'], data['name'], data['index']])
        return {'status': 'success'}

    elif action == 'delete_chapter':
        db_query("DELETE FROM school_chapter WHERE id = %s", [data['chapter_id']])
        return {'status': 'success'}

    return None


def handle_note(action, data, files, request):
    if action == 'get_notes':
        # NOTE: We show the GLOBAL DEFAULT weight here for reference
        rows = db_query("SELECT id, header, body, weight FROM school_note WHERE chapter_id = %s", [data['chapter_id']])
        return {'notes': [{'id': r[0], 'header': r[1], 'body': r[2], 'weight': r[3]} for r in rows]}

    elif action == 'add_note':
        header = data.get('header')
        body = data.get('body', '')

        if 'image_file' in files:
            image = files['image_file']
            ext = image.name.split('.')[-1]
            filename = f"{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, ContentFile(image.read()))
            body = f"IMG:/media/{saved_path}"

        # Insert with default weight 10
        db_query("INSERT INTO school_note (chapter_id, header, body, weight) VALUES (%s, %s, %s, 10)",
                 [data['chapter_id'], header, body])
        return {'status': 'success'}

    elif action == 'delete_note':
        db_query("DELETE FROM school_note WHERE id = %s", [data['note_id']])
        return {'status': 'success'}

    return None


# --- PERSONALIZED QUIZ LOGIC ---
def handle_quiz(action, data, request):
    user_id = request.session.get('user_id')

    # 1. INIT: Fetch Personal Weights OR Default Weights
    if action == 'init_quiz':
        chapter_ids = data.get('chapter_ids')
        if isinstance(chapter_ids, str): chapter_ids = json.loads(chapter_ids)
        if not chapter_ids: return {'deck': []}

        placeholders = ','.join(['%s'] * len(chapter_ids))

        # SQL LOGIC:
        # Join school_note (n) with school_progress (p).
        # IF p.weight exists (User has seen it), use it.
        # ELSE use n.weight (Default).

        params = [user_id] + chapter_ids  # [user_id, id1, id2...]

        query = f"""
            SELECT n.id, 
                   COALESCE(p.weight, n.weight) as effective_weight
            FROM school_note n
            LEFT JOIN school_progress p 
                   ON n.id = p.note_id AND p.user_id = %s
            WHERE n.chapter_id IN ({placeholders})
        """

        # If user is not logged in, just use defaults (handled by COALESCE if user_id is None)
        rows = db_query(query, params)
        return {'deck': [{'id': r[0], 'w': float(r[1])} for r in rows]}

    elif action == 'get_content':
        # Content is public, no change
        note_id = data.get('note_id')
        rows = db_query("SELECT header, body FROM school_note WHERE id = %s", [note_id])
        if rows: return {'header': rows[0][0], 'body': rows[0][1]}
        return {'error': 'Note not found'}

    # 2. SUBMIT: Save to PERSONAL Progress Table
    elif action == 'submit_answer':
        if not user_id: return {'error': 'Must be logged in'}

        note_id = data['note_id']
        is_correct = data['is_correct']
        if isinstance(is_correct, str): is_correct = (is_correct.lower() == 'true')

        # A. Check if user already has a row for this note
        existing = db_query("SELECT weight FROM school_progress WHERE user_id = %s AND note_id = %s",
                            [user_id, note_id])

        current_weight = 10.0  # Default fallback

        if existing:
            current_weight = existing[0][0]
            # Calculate new weight
            new_weight = max(2.23e-308, current_weight / 2.0) if is_correct else (current_weight * 1.5)

            # Update Existing
            db_query("""
                UPDATE school_progress 
                SET weight = %s, 
                    correct_count = correct_count + %s, 
                    wrong_count = wrong_count + %s 
                WHERE user_id = %s AND note_id = %s
            """, [new_weight, 1 if is_correct else 0, 0 if is_correct else 1, user_id, note_id])

        else:
            # First time seeing this note? Fetch global default first
            global_row = db_query("SELECT weight FROM school_note WHERE id = %s", [note_id])
            if global_row: current_weight = global_row[0][0]

            # Calculate new weight
            new_weight = max(2.23e-308, current_weight / 2.0) if is_correct else (current_weight * 1.5)

            # Insert New Record
            db_query("""
                INSERT INTO school_progress (user_id, note_id, weight, correct_count, wrong_count)
                VALUES (%s, %s, %s, %s, %s)
            """, [user_id, note_id, new_weight, 1 if is_correct else 0, 0 if is_correct else 1])

        return {'status': 'saved'}

    return None