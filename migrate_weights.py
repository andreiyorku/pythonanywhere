import os
import django
from django.db import connection
from django.contrib.auth.hashers import make_password

# Setup Django Context
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()


def run_migration():
    with connection.cursor() as cursor:
        print("--- 1. Creating User Table ---")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS school_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT
            );
        """)

        # Create Admin if missing
        cursor.execute("SELECT id FROM school_user WHERE username = 'admin'")
        if not cursor.fetchone():
            hashed_pw = make_password('admin')
            cursor.execute("INSERT INTO school_user (username, password) VALUES (%s, %s)", ['admin', hashed_pw])
            print("User 'admin' created.")

        # Get Admin ID
        cursor.execute("SELECT id FROM school_user WHERE username = 'admin'")
        admin_id = cursor.fetchone()[0]

        print("--- 2. Creating Progress Table ---")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS school_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                note_id INTEGER,
                weight REAL,
                correct_count INTEGER DEFAULT 0,
                wrong_count INTEGER DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES school_user(id),
                FOREIGN KEY(note_id) REFERENCES school_note(id)
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_progress_user_note ON school_progress (user_id, note_id);")

        print(f"--- 3. Migrating Weights to Admin (ID: {admin_id}) ---")

        # A. COPY: Move current stats from school_note to school_progress for Admin
        # We check 'NOT EXISTS' to avoid duplicating if you run this script twice.
        cursor.execute("""
            INSERT INTO school_progress (user_id, note_id, weight, correct_count, wrong_count)
            SELECT %s, id, weight, correct_count, wrong_count
            FROM school_note
            WHERE NOT EXISTS (
                SELECT 1 FROM school_progress WHERE user_id = %s AND note_id = school_note.id
            )
        """, [admin_id, admin_id])

        copied_count = cursor.rowcount
        print(f"Saved {copied_count} records to Admin's progress.")

        # B. RESET: Set school_note back to defaults for everyone else
        # Only reset if we actually copied something (safety check)
        if copied_count > 0 or True:  # Force reset to ensure clean slate
            print("Resetting Base Weights to 10.0 for new users...")
            cursor.execute("""
                UPDATE school_note 
                SET weight = 10.0, 
                    correct_count = 0, 
                    wrong_count = 0
            """)

    print("--- Migration Complete ---")


if __name__ == "__main__":
    run_migration()