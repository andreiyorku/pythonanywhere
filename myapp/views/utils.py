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

def get_key_point_title(chapter_number, key_point_number):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        heading = soup.find("h1") or soup.find("h2")
        return heading.get_text(strip=True) if heading else f"Key Point {key_point_number}"

def get_qa_file_path(chapter_number, key_point_number):
    return os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.qa.json")
