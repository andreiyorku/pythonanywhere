import sqlite3

def rebuild():
    conn = sqlite3.connect('myapp_db.sqlite3')
    cur = conn.cursor()

    print("[DB] Dropping old tables...")
    cur.execute("DROP TABLE IF EXISTS fretmap_transition")
    cur.execute("DROP TABLE IF EXISTS fretmap_usersettings")

    print("[DB] Creating Transition table...")
    # This stores your performance for every jump
    cur.execute("""
        CREATE TABLE fretmap_transition (
            id TEXT PRIMARY KEY,
            avg REAL,
            min REAL,
            max REAL,
            count INTEGER,
            mastery INTEGER
        )
    """)

    print("[DB] Creating UserSettings table...")
    # This stores your current zone and sensitivity
    cur.execute("""
        CREATE TABLE fretmap_usersettings (
            id INTEGER PRIMARY KEY,
            zone_index INTEGER DEFAULT 0,
            strictness INTEGER DEFAULT 50,
            attack INTEGER DEFAULT 50,
            stability INTEGER DEFAULT 50
        )
    """)

    # Insert default settings so the app doesn't crash on first load
    cur.execute("INSERT INTO fretmap_usersettings (id, zone_index) VALUES (1, 0)")

    conn.commit()
    print("[DB] Database rebuilt successfully. Ready for Calibration.")
    conn.close()

if __name__ == "__main__":
    rebuild()