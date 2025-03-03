import os
from django.shortcuts import render, redirect
from bs4 import BeautifulSoup
from .utils import get_files_in_chapter, get_key_point_title, CHAPTERS_DIR

def chapter_detail_view(request, chapter_number):
    key_points = get_files_in_chapter(chapter_number)
    files = [(kp, get_key_point_title(chapter_number, kp)) for kp in key_points]
    return render(request, "chapter.html", {"chapter_number": chapter_number, "files": files})

def full_chapter_view(request, chapter_number):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    if not os.path.exists(chapter_path):
        return render(request, "chapter_full.html", {
            "chapter_number": chapter_number,
            "error": "Chapter not found."
        })

    content_list = []
    key_points = get_files_in_chapter(chapter_number)

    for point_number in key_points:
        file_path = os.path.join(chapter_path, f"{point_number}.html")
        with open(file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        title = get_key_point_title(chapter_number, point_number)
        content_list.append(f"<h2>Key Point {point_number}: {title}</h2>")
        content_list.append(str(soup.body) if soup.body else str(soup))
        content_list.append("<hr>")

    return render(request, "chapter_full.html", {
        "chapter_number": chapter_number,
        "full_content": "\n".join(content_list)
    })
