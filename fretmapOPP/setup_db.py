import sqlite3
import os

# Using a specific name for the new modular version
DB_NAME = 'fretmapOPP.db'


def setup():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    # Unified Transitions Table
    cur.execute("""CREATE TABLE IF NOT EXISTS transitions (
        id TEXT PRIMARY KEY, 
        avg_ms REAL, 
        min_ms REAL, 
        max_ms REAL, 
        count INTEGER DEFAULT 0, 
        mastery INTEGER DEFAULT 0, 
        is_calibrated INTEGER DEFAULT 0
    )""")

    # Settings Table
    cur.execute("""CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY, 
        zone_index INTEGER DEFAULT 0, 
        strictness REAL DEFAULT 0.5, 
        attack_thresh REAL DEFAULT 1.5, 
        hold_frames INTEGER DEFAULT 8
    )""")

    # Populate default settings if not exists
    cur.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)")

    conn.commit()
    conn.close()
    print(f"[SUCCESS] {DB_NAME} initialized with modular schema.")


if __name__ == "__main__":
    setup()