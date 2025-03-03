import os
import json
import re
from django.shortcuts import render, redirect
from django.contrib import messages

from .utils import (
    CHAPTERS_DIR,
    get_generated_chapters,
    get_qa_file_path,
    shift_chapters_up,
    shift_key_points_up,
    load_key_point,
)

# =========================
# Path Helpers
# =========================
# This gives the folder path for a chapter (like chapters/3/).
def get_chapter_path(chapter_number):
    return os.path.join(CHAPTERS_DIR, str(chapter_number))


# This gives two paths for a key point:
# 1. HTML content file (chapters/3/2.html)
# 2. QA file with the key point's question (chapters/3/2.qa.json)
def get_key_point_paths(chapter_number, key_point_number):
    chapter_path = get_chapter_path(chapter_number)
    html_path = os.path.join(chapter_path, f"{key_point_number}.html")
    qa_path = get_qa_file_path(chapter_number, key_point_number)
    return html_path, qa_path


# =========================
# Main Editor View
# =========================
# This is the main page where editing happens.
# It handles all button actions like:
# - Next/Prev Chapter
# - Adding/Removing chapters
# - Saving key points
# - Bulk importing content
def chapter_editor_view(request):
    chapter_number = int(request.GET.get("chapter", 1))
    key_point_number = int(request.GET.get("keypoint", 1))

    if request.method == "POST":
        action = request.POST.get("action")
        chapter_number = int(request.POST.get("chapter_number", 1))
        key_point_number = int(request.POST.get("key_point_number", 1))

        if action in ["prev_chapter", "next_chapter"]:
            chapter_number += -1 if action == "prev_chapter" else 1
            key_point_number = 1

        elif action == "add_chapter_between":
            shift_chapters_up(chapter_number + 1)
            chapter_number += 1
            key_point_number = 1

        elif action in ["prev_keypoint", "next_keypoint"]:
            key_point_number += -1 if action == "prev_keypoint" else 1

        elif action == "add_keypoint_between":
            shift_key_points_up(chapter_number, key_point_number + 1)
            key_point_number += 1

        elif action == "save_keypoint":
            save_key_point_from_request(request, chapter_number, key_point_number)

        elif action == "bulk_import":
            process_bulk_import(request)

        return load_key_point(request, chapter_number, key_point_number)

    return load_key_point(request, chapter_number, key_point_number)


# =========================
# Saving Key Points
# =========================
# This takes the text you type (title, content, question) and saves it.
# - Content goes into an HTML file.
# - Question goes into a QA JSON file.
def save_key_point_from_request(request, chapter_number, key_point_number):
    chapter_path = get_chapter_path(chapter_number)
    os.makedirs(chapter_path, exist_ok=True)

    title = request.POST.get("title", "").strip()
    content = request.POST.get("content", "").strip()
    content = re.sub(r'^<h1>.*?</h1>\s*', '', content, flags=re.IGNORECASE)

    html_path, qa_path = get_key_point_paths(chapter_number, key_point_number)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(f"<h1>{title}</h1>\n{content}\n")

    with open(qa_path, "w", encoding="utf-8") as f:
        json.dump({"question": request.POST.get("question", title).strip(), "weight": 1.0}, f, indent=4)


# =========================
# Append Content to Existing Key Point
# =========================
# This adds more content (new section or images) to a key point.
# It does NOT replace the key point, it adds to the bottom.
def append_to_key_point_view(request):
    chapter_number = int(request.POST.get("chapter_number"))
    key_point_number = int(request.POST.get("starting_point"))

    html_path, _ = get_key_point_paths(chapter_number, key_point_number)
    if not os.path.exists(html_path):
        return render(request, "error.html", {
            "message": f"Key Point {key_point_number} does not exist in Chapter {chapter_number}."
        })

    content = build_append_content(request)
    with open(html_path, "a", encoding="utf-8") as f:
        f.write("\n" + content)

    return redirect('index')


# This combines title, paragraph, and images into one big chunk of HTML to append.
def build_append_content(request):
    parts = []
    title = request.POST.get("title", "").strip()
    content = request.POST.get("content", "").strip()
    images = request.FILES.getlist("images")

    if title:
        parts.append(f"<h2>{title}</h2>")
    if content:
        parts.append(f"<p>{content}</p>")
    if images:
        parts.append(save_uploaded_images(
            int(request.POST.get("chapter_number")),
            int(request.POST.get("starting_point")),
            images
        ))
    return "\n".join(parts)


# =========================
# Bulk Import (Big Paste)
# =========================
# This handles pasting a big HTML block into the editor.
# It automatically breaks the block into chapters & key points based on headings.
def process_bulk_import(request):
    bulk_content = request.POST.get("bulk_content", "").strip()
    if not bulk_content:
        return

    success, message = process_bulk_chapter_content(bulk_content)
    if success:
        messages.success(request, message)
    else:
        messages.error(request, message)
    return redirect('chapter_editor')


# =========================
# Image Upload Handling
# =========================
# This saves uploaded images into the right chapter folder.
# It also generates <img> tags to show those images.
def save_uploaded_images(chapter_number, key_point_number, images):
    images_dir = os.path.join(get_chapter_path(chapter_number), "images")
    os.makedirs(images_dir, exist_ok=True)

    img_tags = []
    for index, img in enumerate(images, start=1):
        ext = os.path.splitext(img.name)[1]
        img_filename = f"img_{key_point_number}_{index}{ext}"
        img_path = os.path.join(images_dir, img_filename)

        with open(img_path, "wb") as f:
            for chunk in img.chunks():
                f.write(chunk)

        img_tags.append(f'<img src="/static/generated/chapters/{chapter_number}/images/{img_filename}" alt="Image {index}">')

    return "\n".join(img_tags)


# =========================
# Moving Chapters and Key Points (Inserting in the Middle)
# =========================
# This pushes all chapters forward to make room for a new one.
def shift_chapters_up(starting_chapter):
    for chapter in reversed(get_generated_chapters()):
        if chapter >= starting_chapter:
            os.rename(get_chapter_path(chapter), get_chapter_path(chapter + 1))


# This pushes all key points forward within a chapter.
# Used when inserting a key point between existing ones.
def shift_key_points_up(chapter_number, starting_point):
    chapter_path = get_chapter_path(chapter_number)
    for point in reversed(get_files_in_chapter(chapter_number)):
        if point >= starting_point:
            old_html, old_qa = get_key_point_paths(chapter_number, point)
            new_html, new_qa = get_key_point_paths(chapter_number, point + 1)
            os.rename(old_html, new_html)
            if os.path.exists(old_qa):
                os.rename(old_qa, new_qa)

