import os
import django
from django.db import connection

# Setup Django Context
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()


def run_migration():
    with connection.cursor() as cursor:
        print("--- Finding Admin User ---")
        cursor.execute("SELECT id FROM school_user WHERE username = 'admin'")
        row = cursor.fetchone()
        if not row:
            print("Error: Admin user not found. Please create one first.")
            return
        admin_id = row[0]
        print(f"Assigning legacy content to Admin (ID: {admin_id})")

        # 1. Update COURSES
        print("--- Migrating Courses ---")
        try:
            # Try adding the column (might fail if exists, which is fine)
            cursor.execute("ALTER TABLE school_course ADD COLUMN owner_id INTEGER REFERENCES school_user(id)")
        except:
            print("Column 'owner_id' might already exist in school_course.")

        # Set default owner
        cursor.execute("UPDATE school_course SET owner_id = %s WHERE owner_id IS NULL", [admin_id])

        # 2. Update CHAPTERS
        print("--- Migrating Chapters ---")
        try:
            cursor.execute("ALTER TABLE school_chapter ADD COLUMN owner_id INTEGER REFERENCES school_user(id)")
        except:
            pass
        cursor.execute("UPDATE school_chapter SET owner_id = %s WHERE owner_id IS NULL", [admin_id])

        # 3. Update NOTES
        print("--- Migrating Notes ---")
        try:
            cursor.execute("ALTER TABLE school_note ADD COLUMN owner_id INTEGER REFERENCES school_user(id)")
        except:
            pass
        cursor.execute("UPDATE school_note SET owner_id = %s WHERE owner_id IS NULL", [admin_id])

    print("--- Ownership Migration Complete ---")


if __name__ == "__main__":
    run_migration()