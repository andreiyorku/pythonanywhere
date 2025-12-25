import os
import django
from django.db import connection

# Setup Django to find your database
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()


def run():
    with connection.cursor() as cursor:
        # 1. Find Admin ID
        cursor.execute("SELECT id FROM school_user WHERE username = 'admin'")
        admin = cursor.fetchone()

        if not admin:
            print("Error: User 'admin' does not exist.")
            return

        admin_id = admin[0]
        print(f"--- Finding Weights for Admin (User ID: {admin_id}) ---")
        print(f"{'Note ID':<8} | {'Weight':<20} | {'Header (Preview)'}")
        print("-" * 60)

        # 2. Get Weights from Progress Table
        # We join with school_note to show you the title (header) too
        query = """
            SELECT p.note_id, p.weight, n.header
            FROM school_progress p
            JOIN school_note n ON p.note_id = n.id
            WHERE p.user_id = %s
            ORDER BY p.weight ASC
        """
        cursor.execute(query, [admin_id])
        rows = cursor.fetchall()

        if not rows:
            print("No custom weights found. Admin is using all default weights (10.0).")

        for r in rows:
            # r[0]=id, r[1]=weight, r[2]=header
            header_preview = (r[2][:30] + '..') if len(r[2]) > 30 else r[2]
            print(f"{r[0]:<8} | {r[1]:<20} | {header_preview}")


if __name__ == "__main__":
    run()