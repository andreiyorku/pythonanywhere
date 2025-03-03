import os
import json
import re
import random
from bs4 import BeautifulSoup
from django.conf import settings
from django.shortcuts import redirect

# ====================================
# Constants
# ====================================
# Base directory where chapters are stored
CHAPTERS_DIR = os.path.join(settings.BASE_DIR, 'myapp', 'generated', 'chapters')

# ====================================
# get_generated_chapters
# ====================================
# Lists all chapter folders (1, 2, 3, ...) inside CHAPTERS_DIR.
# Each folder represents one chapter.
# Converts folder names to integers.
# Returns a sorted list of chapter numbers.

def get_generated_chapters():
    return sorted([
        int(d) for d in os.listdir(CHAPTERS_DIR)
        if os.path.isdir(os.path.join(CHAPTERS_DIR, d))
    ])


# ====================================
# get_files_in_chapter
# ====================================
# Lists all key point files inside a given chapter folder.
# Each file represents one key point (e.g., "1.html", "2.html").
# Returns a sorted list of key point numbers as integers.

def get_files_in_chapter(chapter_number):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    return sorted([
        int(f.replace(".html", ""))
        for f in os.listdir(chapter_path)
        if f.endswith(".html")
    ])


# ====================================
# get_qa_file_path
# ====================================
# Constructs and returns the file path for the QA file for a given key point.
# Example: "chapters/3/2.qa.json"

def get_qa_file_path(chapter_number, key_point_number):
    return os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.qa.json")


# ====================================
# get_key_point_title
# ====================================
# Reads a key point HTML file and extracts its title.
# Title comes from the first <h1> or <h2> in the file.
# If no title is found, returns "Key Point {number}".
# Also removes any "Chapter X:" prefix if present.

def get_key_point_title(chapter_number, key_point_number):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")

    if not os.path.exists(file_path):
        return f"Key Point {key_point_number}"

    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        heading = soup.find("h1") or soup.find("h2")

        if heading:
            title = heading.get_text(strip=True)
            title = re.sub(r'^Chapter\s*\d+:\s*', '', title).strip()
            return title

        return f"Key Point {key_point_number}"


# ====================================
# move_to_next_key_point
# ====================================
# Handles moving the user to the next key point.
#
# Mode 1: Random Across All Chapters
# - Collect all (chapter, key_point) pairs across all chapters.
# - Redirect to a randomly selected key point.
#
# Mode 2: Sequential Within Current Chapter
# - Moves to the next key point within the current chapter.
# - If the chapter ends, redirects to the chapter overview.

def move_to_next_key_point(request, chapter_number, key_point_number, is_random_across_chapters):
    if is_random_across_chapters:
        all_points = [
            (ch, kp)
            for ch in get_generated_chapters()
            for kp in get_files_in_chapter(ch)
        ]
        if not all_points:
            return redirect('index')

        next_chapter, next_point = random.choice(all_points)
        return redirect('single_key_point', chapter_number=next_chapter, point_number=next_point)

    else:
        next_point = key_point_number + 1
        chapter_points = get_files_in_chapter(chapter_number)

        if next_point > len(chapter_points):
            return redirect('chapter_detail', chapter_number=chapter_number)

        return redirect('single_key_point', chapter_number=chapter_number, point_number=next_point)


# ====================================
# ensure_chapter_folder_exists
# ====================================
# Ensures the folder for a given chapter exists.
# If not, it creates the folder.
# Returns the path to the chapter folder.

def ensure_chapter_folder_exists(chapter_number):
    chapter_folder = os.path.join(CHAPTERS_DIR, str(chapter_number))
    os.makedirs(chapter_folder, exist_ok=True)
    return chapter_folder


# ====================================
# save_key_point_html
# ====================================
# Saves the content for a key point into an HTML file.
# This ensures consistent file format across manual saves and bulk import.

def save_key_point_html(chapter_number, key_point_number, title, content):
    chapter_folder = ensure_chapter_folder_exists(chapter_number)
    file_path = os.path.join(chapter_folder, f'{key_point_number}.html')

    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(f"<h1>{title}</h1>\n{content}\n")

    return file_path


# ====================================
# save_key_point_qa
# ====================================
# Saves the QA question for a key point into a QA JSON file.
# This ensures consistent QA handling across manual saves and bulk import.

def save_key_point_qa(chapter_number, key_point_number, question):
    qa_path = get_qa_file_path(chapter_number, key_point_number)

    with open(qa_path, 'w', encoding='utf-8') as file:
        json.dump({"question": question, "weight": 1.0}, file, indent=4)

    return qa_path


# ====================================
# process_bulk_chapter_content
# ====================================
# Processes bulk HTML content pasted into the editor.
# Splits the content into individual key points and saves:
# - HTML content file.
# - Matching QA file (question based on title).

def process_bulk_chapter_content(bulk_content):
    chapter_match = re.search(r'<h1>Chapter (\d+)</h1>', bulk_content)
    if not chapter_match:
        return False, "Could not find chapter number in content."

    chapter_number = int(chapter_match.group(1))
    ensure_chapter_folder_exists(chapter_number)

    key_points = re.findall(r'<h2>(\d+)\. (.*?)</h2>\s*<p>(.*?)</p>', bulk_content, re.DOTALL)

    if not key_points:
        return False, "No key points found in content."

    for key_point in key_points:
        key_point_number, title, content = key_point

        # Save both HTML and QA files using the new helpers
        save_key_point_html(chapter_number, key_point_number, title, content)
        save_key_point_qa(chapter_number, key_point_number, title)

    return True, f"Chapter {chapter_number} imported successfully with {len(key_points)} key points."


# ====================================
# Folder and File Structure Summary (Reference)
# ====================================
# chapters/
# ├── 1/
# │   ├── 1.html          # Key Point 1 content
# │   ├── 1.qa.json       # Key Point 1 question
# │   ├── 2.html
# │   ├── 2.qa.json
# ├── 2/
# │   ├── ...

# ====================================
# Example Content
# ====================================
# Key Point HTML:
# <h2>1. Introduction</h2>
# <p>This is the introduction text.</p>

# Key Point QA JSON:
# {
#     "question": "What is the introduction about?",
#     "weight": 1.0
# }

# ====================================
# Summary of Logic Flow
# ====================================
# 1. Chapters are folders.
# 2. Each key point gets:
#    - One HTML file (content)
#    - One JSON file (question)
# 3. Bulk import creates many key points at once.
# 4. Titles are extracted from content.
# 5. User navigation can be sequential within a chapter, or random across all.

