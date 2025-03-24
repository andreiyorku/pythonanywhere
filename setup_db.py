import sqlite3

# Connect to Django's db.sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Optional: Enable foreign keys
cursor.execute('PRAGMA foreign_keys = ON')

# Create Courses table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS course (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT
    )
''')

# Create Chapters table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS chapter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        week_number INTEGER,
        FOREIGN KEY (course_id) REFERENCES course (id) ON DELETE CASCADE
    )
''')

# Create KeyPoints table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS keypoint (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chapter_id INTEGER NOT NULL,
        header TEXT NOT NULL,
        body TEXT,
        number_of_correct INTEGER DEFAULT 0,
        FOREIGN KEY (chapter_id) REFERENCES chapter (id) ON DELETE CASCADE
    )
''')

# Example Data Insert
cursor.execute('INSERT INTO course (name, description) VALUES (?, ?)', 
               ("Python Basics", "Learn Python programming."))

course_id = cursor.lastrowid  # Capture inserted course ID

cursor.execute('INSERT INTO chapter (course_id, title, week_number) VALUES (?, ?, ?)', 
               (course_id, "Introduction to Python", 1))

chapter_id = cursor.lastrowid

cursor.execute('INSERT INTO keypoint (chapter_id, header, body, number_of_correct) VALUES (?, ?, ?, ?)', 
               (chapter_id, "What is Python?", "Python is a widely-used programming language.", 0))

# Save changes
conn.commit()
conn.close()

print("Tables created and sample data inserted into db.sqlite3 successfully.")
