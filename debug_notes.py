import os
import django
from django.db import connection

# Setup Django to find your database
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()


def run():
    with connection.cursor() as cursor:
        print("\n--- 🔍 CHECKING SCHOOL_NOTE TABLE ---")

        # Select newest notes first
        cursor.execute("SELECT id, owner_id, header, body FROM school_note ORDER BY id DESC")
        rows = cursor.fetchall()

        if not rows:
            print("❌ No notes found in the database.")
            return

        print(f"{'ID':<5} | {'Owner':<5} | {'Header (Question)':<40} | {'Body (Answer)'}")
        print("-" * 100)

        for r in rows:
            nid = r[0]
            owner = r[1]
            header = r[2]
            body = r[3]

            # Clean up display for long text or images
            h_disp = header
            if len(h_disp) > 37: h_disp = h_disp[:37] + "..."

            b_disp = body
            if len(b_disp) > 40: b_disp = b_disp[:40] + "..."

            print(f"{nid:<5} | {owner:<5} | {h_disp:<40} | {b_disp}")

        print("-" * 100)
        print(f"✅ Total Notes: {len(rows)}\n")


if __name__ == "__main__":
    run()