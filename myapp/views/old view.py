import os
import re
import json
import random
from django.shortcuts import render, redirect
from django.conf import settings
from django.core.files.storage import default_storage
from bs4 import BeautifulSoup
from .forms import HTMLInputForm
from django.contrib import messages

 homepage_views.py
 def html_input_view(request):
    form = HTMLInputForm(request.POST or None)
    chapters = get_generated_chapters()
    return render(request, "input.html", {"form": form, "chapters": chapters})

chapter_views.py
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

keypoint_view.py
def key_points_view(request, chapter_number):
    return single_key_point_view(request, chapter_number, 1)

def single_key_point_view(request, chapter_number, point_number):
    key_points = get_files_in_chapter(chapter_number)
    if point_number < 1 or point_number > len(key_points):
        return redirect('chapter_detail', chapter_number=chapter_number)
    return render_key_point(request, chapter_number, point_number)

def random_key_point_view(request, chapter_number):
    return single_key_point_view(request, chapter_number, random.choice(get_files_in_chapter(chapter_number)))

def random_key_point_across_chapters_view(request):
    all_points = [
        (ch, kp) for ch in get_generated_chapters()
        for kp in get_files_in_chapter(ch)
    ]
    if not all_points:
        return render(request, "error.html", {"message": "No key points found."})

    chapter_number, key_point_number = random.choice(all_points)

    # ✅ Pass is_random_across_chapters=True
    return render_key_point(request, chapter_number, key_point_number, is_random_across_chapters=True)

def all_key_points_combined_view(request):
    all_content = []
    chapters = get_generated_chapters()

    for chapter_number in chapters:
        all_content.append(f"<h1>Chapter {chapter_number}</h1>")

        key_points = get_files_in_chapter(chapter_number)

        for point_number in key_points:
            file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{point_number}.html")
            with open(file_path, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f.read(), "html.parser")

            title = get_key_point_title(chapter_number, point_number)

            all_content.append(f"<h2>Key Point {point_number}: {title}</h2>")
            all_content.append(str(soup.body) if soup.body else str(soup))
            all_content.append("<hr>")

    return render(request, "all_key_points_combined.html", {
        "combined_content": "\n".join(all_content)
    })

def sequential_key_points_view(request):
    return redirect('single_key_point', chapter_number=1, point_number=1)

def render_key_point(request, chapter_number, key_point_number, is_random_across_chapters=False):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        content = str(soup.body) if soup.body else str(soup)

    question_data = None
    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8") as f:
            question_data = json.load(f)

    show_answer = request.session.pop('show_answer', False)

    if request.method == "POST":
        if "show_answer" in request.POST:
            show_answer = True  # ✅ Directly set, no redirect needed.

        elif "submit_question" in request.POST:
            question_data = {
                "question": request.POST.get("question").strip(),
                "weight": 1.0
            }
            with open(qa_file_path, "w", encoding="utf-8") as f:
                json.dump(question_data, f, indent=4)
            return redirect(request.path)

        elif "answer_correct" in request.POST or "answer_incorrect" in request.POST:
            if question_data:
                if "answer_correct" in request.POST:
                    question_data["weight"] = question_data["weight"]
                elif "answer_incorrect" in request.POST:
                    question_data["weight"] *= 2

                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump(question_data, f, indent=4)

            if is_random_across_chapters:
                return redirect('random_file')
            else:
                return move_to_next_key_point(request, chapter_number, key_point_number, is_random_across_chapters)

    return render(request, "chapter_key_point.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "question_data": question_data,
        "content": content,
        "show_answer": show_answer,  # ✅ This gets passed directly.
        "is_random_across_chapters": is_random_across_chapters,
    })

def next_random_in_chapter(request, chapter_number):
    """Pick another random point within the same chapter."""
    key_points = get_files_in_chapter(chapter_number)

    if not key_points:
        return redirect('chapter_detail', chapter_number=chapter_number)

    next_point_number = random.choice(key_points)

    # ✅ Redirect to the new random point in the same chapter
    return redirect('single_key_point', chapter_number=chapter_number, point_number=next_point_number)

def next_random_across_chapters(request):
    """Pick another random point across all chapters."""
    all_points = [
        (ch, kp) for ch in get_generated_chapters()
        for kp in get_files_in_chapter(ch)
    ]

    if not all_points:
        return redirect('index')

    next_chapter, next_point = random.choices(
        all_points,
        weights=[get_point_weight(ch, kp) for ch, kp in all_points]
    )[0]

    return redirect('single_key_point', chapter_number=next_chapter, point_number=next_point)

def get_point_weight(chapter_number, key_point_number):
    """Get weight for a point, defaulting to 1 if no QA file exists."""
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("weight", 1.0)

    return 1.0  # Default weight

editor_view.py
def chapter_editor_view(request):
    chapter_number = 1
    key_point_number = 1

    if request.method == "POST":
        action = request.POST.get("action")
        chapter_number = int(request.POST.get("chapter_number") or 1)
        key_point_number = int(request.POST.get("key_point_number") or 1)


        try:
            chapter_number = int(chapter_number)
            key_point_number = int(key_point_number)
        except ValueError:
            chapter_number = 1
            key_point_number = 1

        if action == "prev_chapter":
            chapter_number = max(1, chapter_number - 1)
            key_point_number = 1
        elif action == "next_chapter":
            chapter_number += 1
            key_point_number = 1
        elif action == "add_chapter_between":
            shift_chapters_up(chapter_number + 1)
            chapter_number += 1
            key_point_number = 1
        elif action == "prev_keypoint":
            key_point_number = max(1, key_point_number - 1)
        elif action == "next_keypoint":
            key_point_number += 1
        elif action == "add_keypoint_between":
            shift_key_points_up(chapter_number, key_point_number + 1)
            key_point_number += 1
        elif action == "save_keypoint":   # Match the button value exactly
            save_key_point_from_request(request, chapter_number, key_point_number)
        elif action == "bulk_import":
            bulk_content = request.POST.get("bulk_content", "").strip()
        
            if bulk_content:
                success, message = process_bulk_chapter_content(bulk_content)
                if success:
                    messages.success(request, message)
                else:
                    messages.error(request, message)
        
            return redirect('chapter_editor')



        return load_key_point(request, chapter_number, key_point_number)

    # Handle initial GET request or refresh
    if request.method == "GET":
        chapter_number = int(request.GET.get("chapter", 1))
        key_point_number = int(request.GET.get("keypoint", 1))
        return load_key_point(request, chapter_number, key_point_number)

    return render(request, "chapter_editor.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "title": "",
        "content": "",
        "question": "",
    })

def add_key_point_view(request):
    if request.method == "POST":
        chapter_number = int(request.POST.get("chapter_number"))
        starting_point = int(request.POST.get("starting_point"))
        title = request.POST.get("title").strip()
        content = request.POST.get("content").strip()
        images = request.FILES.getlist("images")

        chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
        os.makedirs(chapter_path, exist_ok=True)

        all_files = sorted(
            int(f.replace(".html", "")) for f in os.listdir(chapter_path) if f.endswith(".html")
        )

        # Shift existing files if adding at an existing position
        if starting_point in all_files:
            for old_number in reversed(all_files):
                if old_number >= starting_point:
                    os.rename(
                        os.path.join(chapter_path, f"{old_number}.html"),
                        os.path.join(chapter_path, f"{old_number+1}.html")
                    )
                    if os.path.exists(os.path.join(chapter_path, f"{old_number}.qa.json")):
                        os.rename(
                            os.path.join(chapter_path, f"{old_number}.qa.json"),
                            os.path.join(chapter_path, f"{old_number+1}.qa.json")
                        )

        # Create the new HTML file
        image_tags = save_uploaded_images(chapter_number, starting_point, images)

        file_path = os.path.join(chapter_path, f"{starting_point}.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"<h1>{title}</h1>\n<p>{content}</p>\n{image_tags}")

        # 🔔 Automatically create the matching QA JSON file
        qa_file_path = os.path.join(chapter_path, f"{starting_point}.qa.json")
        qa_data = {
            "question": title,  # Use the heading as the question
            "weight": 1.0
        }
        with open(qa_file_path, "w", encoding="utf-8") as f:
            json.dump(qa_data, f, indent=4)

        return redirect('index')

def append_to_key_point_view(request):
    if request.method == "POST":
        chapter_number = int(request.POST.get("chapter_number"))
        key_point_number = int(request.POST.get("starting_point"))
        title = request.POST.get("title", "").strip()
        content = request.POST.get("content", "").strip()
        images = request.FILES.getlist("images")

        file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")

        if not os.path.exists(file_path):
            return render(request, "error.html", {"message": f"Key Point {key_point_number} does not exist in Chapter {chapter_number}."})

        append_content = ""

        if title:
            append_content += f"\n<h2>{title}</h2>\n"
        if content:
            append_content += f"<p>{content}</p>\n"

        if images:
            append_content += save_uploaded_images(chapter_number, key_point_number, images)

        with open(file_path, "a", encoding="utf-8") as f:
            f.write("\n" + append_content)

        return redirect('index')

def save_key_point_from_request(request, chapter_number, key_point_number):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    os.makedirs(chapter_path, exist_ok=True)

    title = request.POST.get("title", "").strip()
    content = request.POST.get("content", "").strip()

    # Optional: Strip off <h1> if the content already has it
    content = re.sub(r'^<h1>.*?</h1>\s*', '', content, flags=re.IGNORECASE)

    file_path = os.path.join(chapter_path, f"{key_point_number}.html")
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"<h1>{title}</h1>\n{content}\n")

    question = request.POST.get("question", title).strip()
    with open(qa_file_path, "w", encoding="utf-8") as f:
        json.dump({"question": question, "weight": 1.0}, f, indent=4)

def shift_chapters_up(starting_chapter):
    chapters = get_generated_chapters()
    for chapter in reversed(chapters):
        if chapter >= starting_chapter:
            os.rename(
                os.path.join(CHAPTERS_DIR, str(chapter)),
                os.path.join(CHAPTERS_DIR, str(chapter + 1))
            )

def shift_key_points_up(chapter_number, starting_point):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    key_points = get_files_in_chapter(chapter_number)

    for point in reversed(key_points):
        if point >= starting_point:
            os.rename(
                os.path.join(chapter_path, f"{point}.html"),
                os.path.join(chapter_path, f"{point+1}.html")
            )
            qa_file = get_qa_file_path(chapter_number, point)
            if os.path.exists(qa_file):
                os.rename(
                    qa_file,
                    get_qa_file_path(chapter_number, point+1)
                )

def insert_chapter_between(chapter_number):
    chapters = get_generated_chapters()
    insert_index = chapters.index(chapter_number) + 1
    for ch in reversed(chapters[insert_index:]):
        os.rename(
            os.path.join(CHAPTERS_DIR, str(ch)),
            os.path.join(CHAPTERS_DIR, str(ch+1))
        )
    os.makedirs(os.path.join(CHAPTERS_DIR, str(chapter_number+1)), exist_ok=True)

def insert_key_point_between(chapter, keypoint):
    keypoints = get_files_in_chapter(chapter)
    for kp in reversed(keypoints):
        if kp >= keypoint:
            os.rename(
                os.path.join(CHAPTERS_DIR, str(chapter), f"{kp}.html"),
                os.path.join(CHAPTERS_DIR, str(chapter), f"{kp+1}.html")
            )
            qa_path = get_qa_file_path(chapter, kp)
            if os.path.exists(qa_path):
                os.rename(qa_path, get_qa_file_path(chapter, kp+1))

def reorder_chapters(chapters):
    os.makedirs(CHAPTERS_DIR, exist_ok=True)
    for i, chapter_number in enumerate(chapters, start=1):
        old_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
        new_path = os.path.join(CHAPTERS_DIR, str(i))
        if old_path != new_path and os.path.exists(old_path):
            os.rename(old_path, new_path)

def load_key_point(request, chapter_number, key_point_number):
    chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
    file_path = os.path.join(chapter_path, f"{key_point_number}.html")
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    title, content, question = "", "", ""

    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
            heading = soup.find("h1")
            title = heading.get_text(strip=True) if heading else ""
            content = str(soup.body) if soup.body else str(soup)

    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8") as f:
            qa_data = json.load(f)
            question = qa_data.get("question", title)

    return render(request, "chapter_editor.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "title": title,
        "content": content,
        "question": question,
    })

def process_bulk_content(bulk_html):
    os.makedirs(CHAPTERS_DIR, exist_ok=True)

    soup = BeautifulSoup(bulk_html, "html.parser")

    chapters = soup.find_all("h1")

    if not chapters:
        return False, "⚠️ No chapters found! Expected <h1> for chapters."

    chapter_number = 0

    for chapter in chapters:
        chapter_number += 1
        chapter_title = chapter.get_text(strip=True)
        chapter_path = os.path.join(CHAPTERS_DIR, str(chapter_number))
        os.makedirs(chapter_path, exist_ok=True)

        key_point_number = 0

        element = chapter.find_next_sibling()
        while element:
            if element.name == "h1":
                # New chapter starts, break out of this chapter processing
                break

            if element.name == "h2":
                key_point_number += 1
                key_point_title = element.get_text(strip=True)

                # Collect <p> content until next <h2> or <h1>
                content_parts = []
                element = element.find_next_sibling()

                while element and element.name not in ["h2", "h1"]:
                    if element.name == "p":
                        content_parts.append(element.get_text(strip=True))
                    element = element.find_next_sibling()

                # Save HTML file for this key point
                file_path = os.path.join(chapter_path, f"{key_point_number}.html")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(f"<h1>{key_point_title}</h1>\n<p>{'</p><p>'.join(content_parts)}</p>\n")

                # Save QA file for this key point
                qa_file_path = get_qa_file_path(chapter_number, key_point_number)
                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump({"question": key_point_title, "weight": 1.0}, f, indent=4)

            else:
                element = element.find_next_sibling()

    return True, f"✅ Imported {chapter_number} chapters successfully!"
    
def save_uploaded_images(chapter_number, key_point_number, images):
    images_dir = os.path.join(CHAPTERS_DIR, str(chapter_number), "images")
    os.makedirs(images_dir, exist_ok=True)

    img_tags = []
    image_index = 1

    for img in images:
        extension = os.path.splitext(img.name)[1]
        img_filename = f"img_{key_point_number}_{image_index}{extension}"
        img_path = os.path.join(images_dir, img_filename)

        with open(img_path, "wb") as destination:
            for chunk in img.chunks():
                destination.write(chunk)

        img_tags.append(f'<img src="/static/generated/chapters/{chapter_number}/images/{img_filename}" alt="Appended Image {image_index}">')
        image_index += 1

    return "\n".join(img_tags)

Utility.py

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
