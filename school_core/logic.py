import uuid
import json
import subprocess
import os
import sys
from django.db import connection
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.hashers import make_password, check_password


# ==========================================
# --- GIT SYNCHRONOUS ENGINE ---
# ==========================================
def log_to_server(message):
    """Forces print statements directly into the PythonAnywhere Error Log instantly."""
    print(message, file=sys.stderr, flush=True)


def _run_git_sync(commit_message):
    """Runs Git synchronously so PythonAnywhere doesn't kill the thread."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

        subprocess.run(["git", "add", "."], cwd=repo_root, capture_output=True, text=True)
        subprocess.run(["git", "commit", "-m", f"Auto-Sync: {commit_message}"], cwd=repo_root, capture_output=True,
                       text=True)
        push_res = subprocess.run(["git", "push"], cwd=repo_root, capture_output=True, text=True, check=True)

        log_to_server(f"✅ GIT PUSH SUCCESS: {commit_message}")
        return {'success': True, 'message': 'Successfully synced'}

    except subprocess.CalledProcessError as e:
        log_to_server(f"❌ GIT PUSH FAILED: {e.stderr}")
        return {'success': False, 'message': e.stderr}
    except Exception as e:
        log_to_server(f"❌ GIT PUSH SYSTEM ERROR: {str(e)}")
        return {'success': False, 'message': str(e)}


def _run_git_pull():
    """Synchronous pull to grab latest changes from GitHub, skipping editor prompts."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

        subprocess.run(["git", "config", "pull.rebase", "false"], cwd=repo_root)
        pull_res = subprocess.run(["git", "pull", "--no-edit"], cwd=repo_root, capture_output=True, text=True,
                                  check=True)

        log_to_server("\n========================================")
        log_to_server("✅ GIT PULL SUCCESS")
        log_to_server(f"OUTPUT:\n{pull_res.stdout}")
        log_to_server("========================================\n")

        return {'success': True, 'message': pull_res.stdout}

    except subprocess.CalledProcessError as e:
        log_to_server("\n========================================")
        log_to_server("❌ GIT PULL FAILED")
        log_to_server(f"ERROR OUTPUT:\n{e.stderr}")
        log_to_server("========================================\n")
        return {'success': False, 'message': e.stderr}
    except Exception as e:
        log_to_server(f"\n❌ GIT PULL SYSTEM ERROR: {str(e)}\n")
        return {'success': False, 'message': str(e)}


# ==========================================


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
                return {'id': user_id, 'username': username, 'is_admin': (username == 'admin')}
        return {'id': None, 'username': None, 'is_admin': False}
    return None


# --- HUB (Courses & Sync) ---
def handle_hub(action, data, request):
    user_id = request.session.get('user_id')

    if action == 'sync_pull':
        result = _run_git_pull()
        if result['success']:
            return {'status': 'success'}
        return {'error': result['message']}

    elif action == 'get_courses':
        rows = db_query("SELECT id, name, owner_id FROM school_course")
        return {'courses': [{'id': r[0], 'name': r[1], 'owner_id': r[2]} for r in rows]}

    elif action == 'add_course':
        if not user_id: return {'error': 'Must be logged in'}
        db_query("INSERT INTO school_course (name, owner_id) VALUES (%s, %s)", [data['name'], user_id])
        git_res = _run_git_sync(f"Added course: {data['name']}")
        return {'status': 'success', 'git': git_res}

    elif action == 'edit_course':
        if not user_id: return {'error': 'Must be logged in'}
        course = db_query("SELECT owner_id FROM school_course WHERE id = %s", [data['course_id']])
        if not course: return {'error': 'Not found'}
        if is_admin(user_id) or user_id == course[0][0]:
            db_query("UPDATE school_course SET name = %s WHERE id = %s", [data['name'], data['course_id']])
            git_res = _run_git_sync(f"Renamed course ID {data['course_id']} to {data['name']}")
            return {'status': 'success', 'git': git_res}
        return {'error': 'Permission Denied'}

    elif action == 'delete_course':
        course = db_query("SELECT owner_id FROM school_course WHERE id = %s", [data['course_id']])
        if not course: return {'error': 'Not found'}
        if is_admin(user_id) or user_id == course[0][0]:
            db_query("DELETE FROM school_course WHERE id = %s", [data['course_id']])
            git_res = _run_git_sync(f"Deleted course ID {data['course_id']}")
            return {'status': 'success', 'git': git_res}
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
        git_res = _run_git_sync(f"Added chapter '{data['name']}' to course ID {data['course_id']}")
        return {'status': 'success', 'git': git_res}

    elif action == 'edit_chapter':
        if not user_id: return {'error': 'Must be logged in'}
        chapter = db_query("SELECT owner_id FROM school_chapter WHERE id = %s", [data['chapter_id']])
        if not chapter: return {'error': 'Not found'}
        if is_admin(user_id) or user_id == chapter[0][0]:
            db_query("UPDATE school_chapter SET name = %s, chapter_index = %s WHERE id = %s",
                     [data['name'], data['index'], data['chapter_id']])
            git_res = _run_git_sync(f"Edited chapter ID {data['chapter_id']}")
            return {'status': 'success', 'git': git_res}
        return {'error': 'Permission Denied'}

    elif action == 'delete_chapter':
        chapter = db_query("SELECT owner_id FROM school_chapter WHERE id = %s", [data['chapter_id']])
        if not chapter: return {'error': 'Not found'}
        if is_admin(user_id) or user_id == chapter[0][0]:
            db_query("DELETE FROM school_chapter WHERE id = %s", [data['chapter_id']])
            git_res = _run_git_sync(f"Deleted chapter ID {data['chapter_id']}")
            return {'status': 'success', 'git': git_res}
        return {'error': 'Permission Denied'}

    return None


# --- NOTE LOGIC ---
def handle_note(action, data, files, request):
    user_id = request.session.get('user_id')

    if action == 'get_notes':
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
        header_text = data.get('header', '').strip()
        body_text = data.get('body', '').strip()

        header_final = header_text
        if 'header_image' in files:
            image = files['header_image']
            ext = image.name.split('.')[-1]
            filename = f"{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, ContentFile(image.read()))
            header_final = f"{header_text}|||IMG:/media/{saved_path}"

        body_final = body_text
        body_files = files.getlist('body_image')
        for img in body_files:
            ext = img.name.split('.')[-1]
            filename = f"{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, ContentFile(img.read()))
            body_final += f"|||IMG:/media/{saved_path}"

        if not header_final: return {'error': 'Question cannot be empty'}

        db_query("INSERT INTO school_note (chapter_id, header, body, weight, owner_id) VALUES (%s, %s, %s, 10, %s)",
                 [data['chapter_id'], header_final, body_final, user_id])

        git_res = _run_git_sync(f"Added note to chapter ID {data['chapter_id']}")
        return {'status': 'success', 'git': git_res}

    elif action == 'edit_note':
        if not user_id: return {'error': 'Must be logged in'}
        note_id = data.get('note_id')
        new_header_text = data.get('header', '').strip()
        new_body_text = data.get('body', '').strip()

        current = db_query("SELECT header, body, owner_id FROM school_note WHERE id = %s", [note_id])
        if not current: return {'error': 'Note not found'}
        cur_header, cur_body, owner_id = current[0]

        if not (is_admin(user_id) or user_id == owner_id):
            return {'error': 'Permission Denied'}

        remove_header_img = data.get('remove_header_img') == 'true'
        header_img_part = ""
        if 'header_image' in files:
            image = files['header_image']
            ext = image.name.split('.')[-1]
            saved_path = default_storage.save(f"{uuid.uuid4()}.{ext}", ContentFile(image.read()))
            header_img_part = f"IMG:/media/{saved_path}"
        elif not remove_header_img and "IMG:" in cur_header:
            if "|||" in cur_header:
                header_img_part = cur_header.split("|||")[1]
            elif cur_header.startswith("IMG:"):
                header_img_part = cur_header

        header_final = f"{new_header_text}|||{header_img_part}" if header_img_part else new_header_text

        kept_body_images_str = data.get('kept_body_images', '[]')
        try:
            kept_body_images = json.loads(kept_body_images_str)
        except:
            kept_body_images = []

        body_final = new_body_text
        for img_path in kept_body_images:
            body_final += f"|||IMG:{img_path}"

        body_files = files.getlist('body_image')
        for img in body_files:
            ext = img.name.split('.')[-1]
            saved_path = default_storage.save(f"{uuid.uuid4()}.{ext}", ContentFile(img.read()))
            body_final += f"|||IMG:/media/{saved_path}"

        db_query("UPDATE school_note SET header = %s, body = %s WHERE id = %s", [header_final, body_final, note_id])

        new_weight = data.get('weight')
        if new_weight is not None:
            try:
                weight_val = float(new_weight)
                existing = db_query("SELECT id FROM school_progress WHERE user_id=%s AND note_id=%s",
                                    [user_id, note_id])
                if existing:
                    db_query("UPDATE school_progress SET weight=%s WHERE user_id=%s AND note_id=%s",
                             [weight_val, user_id, note_id])
                else:
                    db_query("INSERT INTO school_progress (user_id, note_id, weight) VALUES (%s, %s, %s)",
                             [user_id, note_id, weight_val])
            except ValueError:
                pass

        git_res = _run_git_sync(f"Edited note ID {note_id}")
        return {'status': 'success', 'git': git_res}

    elif action == 'delete_note':
        note = db_query("SELECT owner_id FROM school_note WHERE id = %s", [data['note_id']])
        if not note: return {'error': 'Not found'}
        if is_admin(user_id) or user_id == note[0][0]:
            db_query("DELETE FROM school_note WHERE id = %s", [data['note_id']])
            git_res = _run_git_sync(f"Deleted note ID {data['note_id']}")
            return {'status': 'success', 'git': git_res}
        return {'error': 'Permission Denied'}

    elif action == 'reset_note':
        if not user_id: return {'error': 'Must be logged in'}
        db_query("DELETE FROM school_progress WHERE user_id = %s AND note_id = %s", [user_id, data['note_id']])
        git_res = _run_git_sync(f"Reset progress for note ID {data['note_id']}")
        return {'status': 'success', 'git': git_res}

    elif action == 'reset_chapter':
        if not user_id: return {'error': 'Must be logged in'}
        query = """
            DELETE FROM school_progress 
            WHERE user_id = %s 
            AND note_id IN (SELECT id FROM school_note WHERE chapter_id = %s)
        """
        db_query(query, [user_id, data['chapter_id']])
        git_res = _run_git_sync(f"Reset progress for chapter ID {data['chapter_id']}")
        return {'status': 'success', 'git': git_res}

    elif action == 'reset_course':
        if not user_id: return {'error': 'Must be logged in'}
        course = db_query("SELECT owner_id FROM school_course WHERE id = %s", [data['course_id']])
        if not course: return {'error': 'Course not found'}

        if is_admin(user_id) or user_id == course[0][0]:
            query = """
                DELETE FROM school_progress 
                WHERE user_id = %s 
                AND note_id IN (
                    SELECT n.id FROM school_note n 
                    JOIN school_chapter c ON n.chapter_id = c.id 
                    WHERE c.course_id = %s
                )
            """
            db_query(query, [user_id, data['course_id']])
            git_res = _run_git_sync(f"Reset progress for ENTIRE course ID {data['course_id']}")
            return {'status': 'success', 'git': git_res}
        return {'error': 'Permission Denied'}

    return None


# --- QUIZ LOGIC ---
def handle_quiz(action, data, request):
    user_id = request.session.get('user_id')

    if action == 'init_quiz':
        chapter_ids = data.get('chapter_ids')
        if isinstance(chapter_ids, str): chapter_ids = json.loads(chapter_ids)
        if not chapter_ids: return {'deck': []}

        mode = data.get('chapter_mode', 'standard')

        placeholders = ','.join(['%s'] * len(chapter_ids))
        params = [user_id] + chapter_ids

        query = f"""
            SELECT n.id, COALESCE(p.weight, n.weight), n.chapter_id, c.course_id, c.chapter_index
            FROM school_note n
            JOIN school_chapter c ON n.chapter_id = c.id
            LEFT JOIN school_progress p ON n.id = p.note_id AND p.user_id = %s
            WHERE n.chapter_id IN ({placeholders})
        """
        rows = db_query(query, params)

        course_percentages = data.get('course_percentages')
        if isinstance(course_percentages, str):
            try:
                course_percentages = json.loads(course_percentages)
            except:
                course_percentages = {}
        elif not isinstance(course_percentages, dict):
            course_percentages = {}

        if not course_percentages:
            return {'deck': [{'id': r[0], 'w': float(r[1]), 'chapter_id': r[2]} for r in rows]}

        # Group data into a dictionary tree for processing
        courses_data = {}
        for r in rows:
            nid, w, ch_id, c_id, ch_idx = r[0], float(r[1]), r[2], str(r[3]), r[4]
            if c_id not in courses_data:
                courses_data[c_id] = {}
            if ch_id not in courses_data[c_id]:
                courses_data[c_id][ch_id] = {'index': ch_idx, 'notes': [], 'total_raw_w': 0.0}

            courses_data[c_id][ch_id]['notes'].append({'id': nid, 'w': w})
            courses_data[c_id][ch_id]['total_raw_w'] += w

        final_deck = []

        # Calculate Pure Multipliers
        for c_id, chapters in courses_data.items():
            course_mult = float(course_percentages.get(c_id, 0))
            if course_mult <= 0: continue

            # Rank chapters by their assigned index
            sorted_chaps = sorted(chapters.items(), key=lambda x: x[1]['index'])
            N = len(sorted_chaps)

            for i, (ch_id, ch_data) in enumerate(sorted_chaps):
                rank = i + 1

                if mode == 'forward':
                    chap_mult = rank
                elif mode == 'reverse':
                    chap_mult = (N - rank + 1)
                elif mode == 'equal':
                    # Boost smaller chapters so they match the pool impact of massive chapters
                    chap_raw_sum = ch_data['total_raw_w']
                    chap_mult = (100.0 / chap_raw_sum) if chap_raw_sum > 0 else 1.0
                else:
                    # Standard mode: Chapters compete naturally based on size/weight
                    chap_mult = 1.0

                # Apply multipliers to the final question pool
                for note in ch_data['notes']:
                    final_w = note['w'] * course_mult * chap_mult
                    if final_w > 0:
                        final_deck.append({'id': note['id'], 'w': final_w, 'chapter_id': ch_id})

        return {'deck': final_deck}

    elif action == 'get_content':
        note_id = data.get('note_id')
        query = """
            SELECT n.header, n.body, c.name as chapter_name, c.chapter_index, co.name as course_name
            FROM school_note n
            JOIN school_chapter c ON n.chapter_id = c.id
            JOIN school_course co ON c.course_id = co.id
            WHERE n.id = %s
        """
        rows = db_query(query, [note_id])
        if rows:
            return {
                'header': rows[0][0],
                'body': rows[0][1],
                'chapter_name': rows[0][2],
                'chapter_index': rows[0][3],
                'course_name': rows[0][4]
            }
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

        new_weight = max(2.23e-308, current_weight / 2.0) if is_correct else (current_weight * 1)

        if existing:
            db_query("UPDATE school_progress SET weight=%s WHERE user_id=%s AND note_id=%s",
                     [new_weight, user_id, note_id])
        else:
            db_query("INSERT INTO school_progress (user_id, note_id, weight) VALUES (%s, %s, %s)",
                     [user_id, note_id, new_weight])

        # Git Sync is skipped here to prevent 502 Timeout crashes.
        # It is instead handled by the 'trigger_git_sync' batch action.
        return {'status': 'saved'}

    elif action == 'trigger_git_sync':
        if not user_id: return {'error': 'Must be logged in'}
        # This securely pushes all accumulated quiz changes to GitHub in one batched job
        git_res = _run_git_sync("Batched quiz progress auto-sync")
        return {'status': 'success', 'git': git_res}

    return None