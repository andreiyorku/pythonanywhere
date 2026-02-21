import sqlite3
import os

db_path = 'myapp_db.sqlite3'
if os.path.exists(db_path):
    os.remove(db_path) # Delete the old one to be 100% sure

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("""
    CREATE TABLE fretmap_transition (
        id TEXT PRIMARY KEY, 
        avg REAL, min REAL, max REAL, 
        count INTEGER, mastery INTEGER, isCalibrated INTEGER DEFAULT 0
    )
""")
cur.execute("""
    CREATE TABLE fretmap_usersettings (
        id INTEGER PRIMARY KEY, 
        zone_index INTEGER DEFAULT 0, 
        strictness INTEGER DEFAULT 50, 
        attack INTEGER DEFAULT 50, 
        stability INTEGER DEFAULT 50
    )
""")
cur.execute("INSERT INTO fretmap_usersettings (id) VALUES (1)")
conn.commit()
conn.close()
print("Database Rebuilt with isCalibrated support.")