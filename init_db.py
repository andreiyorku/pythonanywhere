import sqlite3
import os

# We put the DB in your root folder
DB_PATH = os.path.abspath('myapp_db.sqlite3')


def init_database():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    print("Dropping old tables...")
    c.execute("DROP TABLE IF EXISTS transitions")
    c.execute("DROP TABLE IF EXISTS user_progress")

    print("Building fresh schema...")
    # Table for Global Settings
    c.execute('''CREATE TABLE user_progress (
        id INTEGER PRIMARY KEY,
        zone_index INTEGER DEFAULT 0,
        strictness INTEGER DEFAULT 70,
        attack INTEGER DEFAULT 80
    )''')

    # Table for ALL possible fret transitions
    c.execute('''CREATE TABLE transitions (
        id TEXT PRIMARY KEY,
        avg_time REAL DEFAULT 99999.0,
        min_time REAL DEFAULT 99999.0,
        max_time REAL DEFAULT 0.0,
        total_attempts INTEGER DEFAULT 0,
        mastery_status INTEGER DEFAULT 0
    )''')

    # Insert Default Settings
    c.execute("INSERT INTO user_progress (id, zone_index, strictness, attack) VALUES (1, 0, 70, 80)")

    print("Pre-populating 19,044 combinations for Frets 0-22...")
    notes = [(s, f) for s in range(1, 7) for f in range(23)]  # 6 strings, frets 0-22
    transitions = []

    for n1 in notes:
        for n2 in notes:
            # Format: String-Fret_String-Fret (e.g., "6-9_5-11")
            t_id = f"{n1[0]}-{n1[1]}_{n2[0]}-{n2[1]}"
            # (id, avg_time, min_time, max_time, total_attempts, mastery_status)
            transitions.append((t_id, 99999.0, 99999.0, 0.0, 0, 0))

    # Fast bulk insert
    c.executemany("INSERT INTO transitions VALUES (?, ?, ?, ?, ?, ?)", transitions)
    conn.commit()
    conn.close()

    print(f"✅ Success! Database fully primed at: {DB_PATH}")


if __name__ == "__main__":
    init_database()