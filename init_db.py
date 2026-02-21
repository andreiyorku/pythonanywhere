import sqlite3
import os


def reset_db():
    db_path = 'myapp_db.sqlite3'
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print("Checking database structure...")
    # 1. Ensure tables exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fretmap_transition (
            id TEXT PRIMARY KEY, 
            avg REAL, min REAL, max REAL, 
            count INTEGER, mastery INTEGER, isCalibrated INTEGER DEFAULT 0
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fretmap_usersettings (
            id INTEGER PRIMARY KEY, 
            zone_index INTEGER DEFAULT 0, 
            strictness INTEGER DEFAULT 50, 
            attack INTEGER DEFAULT 50, 
            stability INTEGER DEFAULT 50
        )
    """)

    # 2. Add missing columns if they don't exist (Alter)
    cols = [
        ('fretmap_transition', 'isCalibrated', 'INTEGER DEFAULT 0'),
        ('fretmap_usersettings', 'attack', 'INTEGER DEFAULT 50'),
        ('fretmap_usersettings', 'stability', 'INTEGER DEFAULT 50')
    ]
    for table, col, definition in cols:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
        except sqlite3.OperationalError:
            pass  # Already exists

    # 3. ERASE AND REPOPULATE (Clean Slate)
    print("Cleaning old practice data...")
    cur.execute("DELETE FROM fretmap_transition")

    # Reset User Settings row
    cur.execute("DELETE FROM fretmap_usersettings")
    cur.execute(
        "INSERT INTO fretmap_usersettings (id, zone_index, strictness, attack, stability) VALUES (1, 0, 50, 50, 50)")

    conn.commit()
    conn.close()
    print("[SUCCESS] Database wiped and repopulated with defaults.")


if __name__ == "__main__":
    reset_db()