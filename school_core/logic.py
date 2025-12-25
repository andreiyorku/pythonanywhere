import uuid
import json
from django.db import connection
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.hashers import make_password, check_password
import random


def db_query(query, params=[]):
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        if query.strip().upper().startswith("SELECT"):
            return cursor.fetchall()
        return None


def is_admin(user_id):
    if not user_id: return False
    rows = db_query("SELECT username FROM school_user WHERE id = %s", [user_id])
    return rows and rows[0][0] == 'admin'


# --- AUTH ---
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
        if db_query("SELECT id FROM school_user WHERE username = %s", [username]):
            return {'error': 'Username taken'}
        hashed_pw = make_password(password)
        db_query("INSERT INTO school_user (username, password) VALUES (%s, %s)", [username, hashed_pw])
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
            if rows:
                username = rows[0][0]
                # Return ID, Username, and Admin Status
                return {'id': user_id, 'username': username, 'is_admin': (username == 'admin')}
        return {'id': None, 'username': None, 'is_admin': False}

    return None


# --- HUB (Courses) ---
def handle_hub(action, data, request):
    user_id = request.session.get('user_id')

    if action == 'get_courses':
        # Return owner_id so frontend knows who owns it
        rows = db_query("SELECT id, name, owner_id FROM school_course")
        return {'courses': [{'id': r[0], 'name': r[1], 'owner_id': r[2]} for r in rows]}

    elif action == 'add_course':
        if not user_id: return {'error': 'Must be logged in'}
        db_query("INSERT INTO school_course (name, owner_id) VALUES (%s, %s)", [data['name'], user_id])
        return {'status': 'success'}

    elif action == 'delete_course':
        # Check permissions
        course = db_query("SELECT owner_id FROM school_course WHERE id = %s", [data['course_id']])
        if not course: return {'error': 'Not found'}

        owner_id = course[0][0]
        if is_admin(user_id) or user_id == owner_id:
            db_query("DELETE FROM school_course WHERE id = %s", [data['course_id']])
            return {'status': 'success'}
        return {'error': 'Permission Denied: You do not own this course.'}

    return None


# --- COURSE (Chapters) ---
def handle_course(action, data, request):
    user_id = request.session.get('user_id')

    if action == 'get_chapters':
        rows = db_query(
            "SELECT id, name, chapter_index, owner_id FROM school_chapter WHERE course_id = %s ORDER BY chapter_index",
            [data['course_id']])
        return {'chapters': [{'id': r[0], 'name': r[1], 'index': r[2], 'owner_id': r[3]} for r in rows]}

    elif action == 'add_chapter':
        if not user_id: return {'error': 'Must be logged in'}
        db_query("INSERT INTO school_chapter (course_id, name, chapter_index, owner_id) VALUES (%s, %s, %s, %s)",
                 [data['course_id'], data['name'], data['index'], user_id])
        return {'status': 'success'}

    elif action == 'delete_chapter':
        chapter = db_query("SELECT owner_id FROM school_chapter WHERE id = %s", [data['chapter_id']])
        if not chapter: return {'error': 'Not found'}

        owner_id = chapter[0][0]
        if is_admin(user_id) or user_id == owner_id:
            db_query("DELETE FROM school_chapter WHERE id = %s", [data['chapter_id']])
            return {'status': 'success'}
        return {'error': 'Permission Denied'}

    return None


# --- NOTES ---
def handle_note(action, data, files, request):
    user_id = request.session.get('user_id')

    if action == 'get_notes':
        # Fetch Personal Weight + Owner ID
        query = """
            SELECT n.id, n.header, n.body, 
                   COALESCE(p.weight, n.weight) as user_weight,
                   n.owner_id
            FROM school_note n
            LEFT JOIN school_progress p ON n.id = p.note_id AND p.user_id = %s
            WHERE n.chapter_id = %s
        """
        rows = db_query(query, [user_id, data['chapter_id']])
        return {'notes': [{'id': r[0], 'header': r[1], 'body': r[2], 'weight': r[3], 'owner_id': r[4]} for r in rows]}

    elif action == 'add_note':
        if not user_id: return {'error': 'Must be logged in'}
        header = data.get('header')
        body = data.get('body', '')

        if 'image_file' in files:
            image = files['image_file']
            ext = image.name.split('.')[-1]
            filename = f"{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, ContentFile(image.read()))
            body = f"IMG:/media/{saved_path}"

        db_query("INSERT INTO school_note (chapter_id, header, body, weight, owner_id) VALUES (%s, %s, %s, 10, %s)",
                 [data['chapter_id'], header, body, user_id])
        return {'status': 'success'}

    elif action == 'delete_note':
        note = db_query("SELECT owner_id FROM school_note WHERE id = %s", [data['note_id']])
        if not note: return {'error': 'Not found'}

        owner_id = note[0][0]
        if is_admin(user_id) or user_id == owner_id:
            db_query("DELETE FROM school_note WHERE id = %s", [data['note_id']])
            return {'status': 'success'}
        return {'error': 'Permission Denied'}

    return None


# --- QUIZ (Unchanged) ---
def handle_quiz(action, data, request):
    user_id = request.session.get('user_id')
    if action == 'init_quiz':
        chapter_ids = data.get('chapter_ids')
        if isinstance(chapter_ids, str): chapter_ids = json.loads(chapter_ids)
        if not chapter_ids: return {'deck': []}
        placeholders = ','.join(['%s'] * len(chapter_ids))
        params = [user_id] + chapter_ids
        query = f"""
            SELECT n.id, COALESCE(p.weight, n.weight)
            FROM school_note n
            LEFT JOIN school_progress p ON n.id = p.note_id AND p.user_id = %s
            WHERE n.chapter_id IN ({placeholders})
        """
        rows = db_query(query, params)
        return {'deck': [{'id': r[0], 'w': float(r[1])} for r in rows]}

    elif action == 'get_content':
        note_id = data.get('note_id')
        rows = db_query("SELECT header, body FROM school_note WHERE id = %s", [note_id])
        if rows: return {'header': rows[0][0], 'body': rows[0][1]}
        return {'error': 'Note not found'}

    elif action == 'submit_answer':
        if not user_id: return {'error': 'Must be logged in'}
        note_id = data['note_id']
        is_correct = data['is_correct']
        if isinstance(is_correct, str): is_correct = (is_correct.lower() == 'true')

        existing = db_query("SELECT weight FROM school_progress WHERE user_id = %s AND note_id = %s",
                            [user_id, note_id])
        current_weight = existing[0][0] if existing else 10.0
        if not existing:
            global_row = db_query("SELECT weight FROM school_note WHERE id = %s", [note_id])
            if global_row: current_weight = global_row[0][0]

        new_weight = max(2.23e-308, current_weight / 2.0) if is_correct else (current_weight * 1.5)

        if existing:
            db_query("UPDATE school_progress SET weight=%s WHERE user_id=%s AND note_id=%s",
                     [new_weight, user_id, note_id])
        else:
            db_query("INSERT INTO school_progress (user_id, note_id, weight) VALUES (%s, %s, %s)",
                     [user_id, note_id, new_weight])
        return {'status': 'saved'}

    return None