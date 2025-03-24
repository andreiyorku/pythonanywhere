import os
import sqlite3
from bs4 import BeautifulSoup

# Connect to SQLite database
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('PRAGMA foreign_keys = ON')

# Directory where your chapters and keypoints live
root_dir = 'myappv0/generated/chapters/'

# Create a new course entry
cursor.execute('INSERT INTO course (name, description) VALUES (?, ?)', 
               ('Generated Course', 'Imported from HTML and QA data'))
course_id = cursor.lastrowid

for chapter_folder in sorted(os.listdir(root_dir)):
    chapter_path = os.path.join(root_dir, chapter_folder)
    if os.path.isdir(chapter_path) and chapter_folder.isdigit():
        chapter_num = int(chapter_folder)

        # Insert chapter
        cursor.execute('INSERT INTO chapter (course_id, title, week_number) VALUES (?, ?, ?)',
                       (course_id, f"Chapter {chapter_num}", chapter_num))
        chapter_id = cursor.lastrowid

        # Process keypoints (HTML + QA pair)
        keypoint_files = [f for f in os.listdir(chapter_path) if f.endswith('.html')]
        for keypoint_file in sorted(keypoint_files, key=lambda x: int(os.path.splitext(x)[0])):
            file_num = os.path.splitext(keypoint_file)[0]
            html_path = os.path.join(chapter_path, keypoint_file)
            qa_path = os.path.join(chapter_path, f"{file_num}.qa")

            # Parse HTML for header and body
            with open(html_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f, 'html.parser')
                header_tag = soup.find('h1')
                body_tag = soup.find('p')

                header = header_tag.text.strip() if header_tag else 'No Title'

                # Improved fallback logic for missing <p>
                if body_tag and body_tag.get_text(strip=True):
                    body = str(body_tag)
                else:
                    # Try to capture everything after <h1> if <p> is missing
                    h1_tag = soup.find('h1')
                    body = ''
                    if h1_tag:
                        next_node = h1_tag.find_next_sibling()
                        while next_node:
                            body += str(next_node)
                            next_node = next_node.find_next_sibling()
                    if not body.strip():
                        body = "<p>No content available</p>"

            # Read .qa file for the number_of_correct
            number_of_correct = 0  # Default if .qa missing or bad
            if os.path.exists(qa_path):
                try:
                    with open(qa_path, 'r', encoding='utf-8-sig') as qa_file:
                        qa_content = qa_file.read().strip()
                        if qa_content.isdigit():
                            number_of_correct = int(qa_content)
                        else:
                            print(f"⚠ Invalid number in {qa_path}, defaulting to 0")
                except Exception as e:
                    print(f"⚠ Failed to read {qa_path}: {e}")

            # Insert keypoint with correct count
            cursor.execute('''
                INSERT INTO keypoint (chapter_id, header, body, number_of_correct)
                VALUES (?, ?, ?, ?)
            ''', (chapter_id, header, body, number_of_correct))

            print(f"✅ Inserted {file_num}.html with correct count: {number_of_correct}")

conn.commit()
conn.close()

print("✅ All data imported successfully into db.sqlite3")
