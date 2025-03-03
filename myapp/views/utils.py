import os
import json
import re
from bs4 import BeautifulSoup
from django.conf import settings

CHAPTERS_DIR = os.path.join(settings.BASE_DIR, 'myapp', 'generated', 'chapters')

def get_generated_chapters():
    return sorted([int(d) for d in os.listdir(CHAPTERS_DIR) if os.path.isdir(os.path.join(CHAPTERS_DIR, d))])

def get_files_in_chapter(chapter_number):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    return sorted([int(f.replace(".html", "")) for f in os.listdir(chapter_path) if f.endswith(".html")])

def get_qa_file_path(chapter_number, key_point_number):
    return os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.qa.json")

def get_key_point_title(chapter_number, key_point_number):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")
    if not os.path.exists(file_path):
        return f"Key Point {key_point_number}"
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        heading = soup.find("h1") or soup.find("h2")
        title = heading.get_text(strip=True) if heading else f"Key Point {key_point_number}"
        title = re.sub(r'^Chapter\s*\d+:\s*', '', title).strip()
        return title

def move_to_next_key_point(request, chapter_number, key_point_number, is_random_across_chapters):
    if is_random_across_chapters:
        # Fully random across all chapters
        all_points = [
            (ch, kp) for ch in get_generated_chapters()
            for kp in get_files_in_chapter(ch)
        ]
        if not all_points:
            return redirect('index')

        next_chapter, next_point = random.choice(all_points)
        return redirect('single_key_point', chapter_number=next_chapter, point_number=next_point)

    else:
        # Sequential within current chapter
        next_point = key_point_number + 1
        chapter_points = get_files_in_chapter(chapter_number)

        if next_point > len(chapter_points):
            return redirect('chapter_detail', chapter_number=chapter_number)

        return redirect('single_key_point', chapter_number=chapter_number, point_number=next_point)

def process_bulk_chapter_content(bulk_content):
    """
    Parses the bulk content, creates chapter directory, and splits content into individual keypoint files.
    """

    # Find chapter number from <h1>
    chapter_match = re.search(r'<h1>Chapter (\d+)</h1>', bulk_content)
    if not chapter_match:
        return False, "Could not find chapter number in content."

    chapter_number = int(chapter_match.group(1))

    # Set directory path
    base_folder = os.path.join(settings.BASE_DIR, 'myapp', 'generated', 'chapters')
    chapter_folder = os.path.join(base_folder, str(chapter_number))
    os.makedirs(chapter_folder, exist_ok=True)

    # Find all key points
    key_points = re.findall(r'<h2>(\d+)\. (.*?)</h2>\s*<p>(.*?)</p>', bulk_content, re.DOTALL)

    if not key_points:
        return False, "No key points found in content."

    for key_point in key_points:
        key_point_number, title, content = key_point

        file_path = os.path.join(chapter_folder, f'{key_point_number}.html')
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(f"<h2>{key_point_number}. {title}</h2>\n<p>{content}</p>")

    return True, f"Chapter {chapter_number} imported successfully with {len(key_points)} key points."
