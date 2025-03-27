import os
import re
import sqlite3
from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings

# =============================================
# DATABASE PATH: Grabs the SQLite DB path from Django settings
# =============================================
DB_PATH = settings.DATABASES['default']['NAME']


# ===========================================================
# FUNCTION: Handles the POST request to bulk import chapters
# ===========================================================
def process_bulk_import(request):
    bulk_content = request.POST.get("bulk_content", "").strip()

    if not bulk_content:
        messages.error(request, "No content provided for import.")
        return redirect('import_page')

    success, message = process_bulk_chapter_content(bulk_content)

    if success:
        messages.success(request, message)
    else:
        messages.error(request, message)

    return redirect('import_page')


# =======================================================================
# FUNCTION: Parses bulk chapter content and inserts data into SQLite DB
# =======================================================================
def process_bulk_chapter_content(bulk_content):
    # Extract chapter number from the first <h1> tag like <h1>Chapter 10</h1>
    chapter_match = re.search(r'<h1>Chapter (\d+)</h1>', bulk_content)
    if not chapter_match:
        print("Could not find chapter number in the provided content. Expected format: <h1>Chapter [number]</h1>.")
        return False, "Could not find chapter number. Expected format: <h1>Chapter [number]</h1>."

    # Extracted chapter number for naming, but we won't force it as DB id
    chapter_number = int(chapter_match.group(1))
    print(f"Processing content for Chapter {chapter_number}")

    bulk_content_without_chapter = re.sub(r'<h1>Chapter \d+</h1>', '', bulk_content, count=1).strip()

    # Extract all <h1>Title</h1> and <p>Body</p> pairs for keypoints
    sections = re.findall(r'<h1>(.*?)</h1>\s*<p>(.*?)</p>', bulk_content_without_chapter, re.DOTALL)
    if not sections:
        print(f"No key points found for Chapter {chapter_number}. Expected <h1>Header</h1> followed by <p>Body</p>.")
        return False, f"No key points found for Chapter {chapter_number}. Expected <h1>Header</h1> followed by <p>Body</p>."

    conn = None
    try:
        print(f"ABSOLUTE DB PATH: {os.path.abspath(DB_PATH)}")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")

        # Get any existing course_id to satisfy NOT NULL constraint
        cursor.execute("SELECT id FROM courses LIMIT 1")
        course_row = cursor.fetchone()
        if not course_row:
            print("No course found in database. Cannot create chapter.")
            return False, "No course found. Cannot create chapter."
        course_id = course_row[0]
        print(f"Using Course ID {course_id} for Chapter")

        # Insert new chapter (auto-increment ID) with course_id
        print(f"Creating new Chapter titled 'Chapter {chapter_number}'")
        cursor.execute("""
            INSERT INTO chapter (title, course_id, chapter_number)
            VALUES (?, ?, ?)
        """, (f"Chapter {chapter_number}", course_id, chapter_number))

        # Fetch auto-generated chapter ID
        new_chapter_id = cursor.lastrowid
        print(f"Chapter created with ID {new_chapter_id}")

        # Insert keypoints
        for idx, (header, body) in enumerate(sections, start=1):
            print(f"Inserting Keypoint {idx} into Chapter {new_chapter_id}: {header.strip()}")
            cursor.execute("""
                INSERT INTO keypoint (chapter_id, header, body, number_of_correct)
                VALUES (?, ?, ?, 0)
            """, (new_chapter_id, header.strip(), body.strip()))
            print(f"Inserted Keypoint {idx} into Chapter {new_chapter_id}: {header.strip()}")

        conn.commit()

        return True, f"{len(sections)} key points created for Chapter {chapter_number} (DB ID {new_chapter_id})."

    except sqlite3.IntegrityError as e:
        print(f"Integrity Error while processing Chapter {chapter_number}: {str(e)}")
        return False, f"Integrity Error while processing Chapter {chapter_number}: {str(e)}"
    except sqlite3.Error as e:
        print(f"Database Error while processing Chapter {chapter_number}: {str(e)}")
        return False, f"Database error while processing Chapter {chapter_number}: {str(e)}"

    finally:
        if conn:
            conn.close()
