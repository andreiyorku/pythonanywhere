
import sqlite3
import os

# Locate the database file in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'fretmap.db')

def reset_database():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}. It will be created fresh on next launch.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    try:
        # Drop the tables completely.
        # views.py will automatically rebuild them on the next page load.
        c.execute('DROP TABLE IF EXISTS transitions')
        c.execute('DROP TABLE IF EXISTS user_progress')
        conn.commit()
        print("✅ Successfully cleared all FretMap history.")
        print("✅ Pendulum reset to Zone 0 (Frets 9-12).")
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    reset_database()