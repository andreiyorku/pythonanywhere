import os
import re
import json
import random
from django.shortcuts import render
from django.conf import settings
from .forms import HTMLInputForm
from bs4 import BeautifulSoup

GENERATED_DIR = os.path.join(settings.BASE_DIR, 'myapp', 'generated')
os.makedirs(GENERATED_DIR, exist_ok=True)

def get_generated_chapters():
    """Retrieve the list of generated chapter directories."""
    if not os.path.exists(GENERATED_DIR):
        return []
    return sorted([d for d in os.listdir(GENERATED_DIR) if os.path.isdir(os.path.join(GENERATED_DIR, d))])

def get_files_in_chapter(chapter):
    """Retrieve all files inside a chapter directory."""
    chapter_path = os.path.join(GENERATED_DIR, chapter)
    if not os.path.exists(chapter_path):
        return []
    return sorted([f for f in os.listdir(chapter_path) if f.endswith(".html")])

def get_key_points_in_chapter(chapter):
    """Retrieve all key points (files) inside a chapter directory."""
    return get_files_in_chapter(chapter)

def get_qa_file_path(chapter_name, key_point_file):
    """Path to the QA file corresponding to a key point."""
    return os.path.join(GENERATED_DIR, chapter_name, key_point_file.replace('.html', '.qa.json'))

def process_html_content(html_content):
    """Parse HTML and create structured directories and files."""
    soup = BeautifulSoup(html_content, "html.parser")

    chapter_count = 0
    current_chapter = None

    for tag in soup.find_all(["h1", "h2"]):
        if tag.name == "h1":
            chapter_count += 1
            current_chapter = f"Ch_{chapter_count}"
            chapter_path = os.path.join(GENERATED_DIR, current_chapter)
            os.makedirs(chapter_path, exist_ok=True)

        elif tag.name == "h2" and current_chapter:
            filename = re.sub(r"[^\w\s]", "", tag.get_text()).strip().replace(" ", "_") + ".html"
            filepath = os.path.join(GENERATED_DIR, current_chapter, filename)

            content = []
            for sibling in tag.next_siblings:
                if sibling.name in ["h1", "h2"]:
                    break
                content.append(str(sibling))

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(f"<html><body>{str(tag)}{''.join(content)}</body></html>")

    return get_generated_chapters()

def html_input_view(request):
    """Handles HTML input and displays generated chapters."""
    if request.method == "POST":
        form = HTMLInputForm(request.POST)
        if form.is_valid():
            html_content = form.cleaned_data["html_content"]
            chapters = process_html_content(html_content)
            return render(request, "input.html", {"form": form, "chapters": chapters})

    else:
        form = HTMLInputForm()
        chapters = get_generated_chapters()

    return render(request, "input.html", {"form": form, "chapters": chapters})

def chapter_detail_view(request, chapter_name):
    """Display the files inside a chapter with correct links."""
    files = get_files_in_chapter(chapter_name)
    file_links = [f"{settings.MEDIA_URL}{chapter_name}/{file}" for file in files]
    return render(request, "chapter.html", {"chapter_name": chapter_name, "files": zip(files, file_links)})

def get_all_files():
    """Retrieve all HTML files from all chapter folders."""
    all_files = []
    if not os.path.exists(GENERATED_DIR):
        return all_files

    for chapter in os.listdir(GENERATED_DIR):
        chapter_path = os.path.join(GENERATED_DIR, chapter)
        if os.path.isdir(chapter_path):
            files = [f for f in os.listdir(chapter_path) if f.endswith(".html")]
            for file in files:
                all_files.append(os.path.join(chapter, file))

    return all_files

def random_file_view(request):
    """Pick a random HTML file, display content."""
    all_files = get_all_files()

    if not all_files:
        return render(request, "random.html", {"error": "No generated files found."})

    random_file = random.choice(all_files)
    file_path = os.path.join(GENERATED_DIR, random_file)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return render(request, "random.html", {
        "content": content,
        "random_url": request.build_absolute_uri(),
    })

def full_chapter_view(request, chapter_name):
    """Combine all HTML files in a chapter and display as one page."""
    chapter_path = os.path.join(GENERATED_DIR, chapter_name)
    if not os.path.exists(chapter_path):
        return render(request, "chapter_full.html", {"chapter_name": chapter_name, "error": "Chapter not found."})

    content_list = []
    for file in sorted(os.listdir(chapter_path)):
        if file.endswith(".html"):
            file_path = os.path.join(chapter_path, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content_list.append(f.read())

    full_content = "\n".join(content_list)

    return render(request, "chapter_full.html", {"chapter_name": chapter_name, "full_content": full_content})

def all_chapters_view(request):
    """Display all chapters combined."""
    all_content = []

    for chapter in sorted(os.listdir(GENERATED_DIR)):
        chapter_path = os.path.join(GENERATED_DIR, chapter)
        if os.path.isdir(chapter_path):
            chapter_content = [f"<h1>{chapter}</h1>"]
            for file in sorted(os.listdir(chapter_path)):
                if file.endswith(".html"):
                    file_path = os.path.join(chapter_path, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        chapter_content.append(f.read())

            all_content.append("\n".join(chapter_content))

    full_content = "\n".join(all_content)

    return render(request, "all_chapters.html", {"full_content": full_content})

def key_points_view(request, chapter_name):
    """Start at the first key point."""
    return single_key_point_view(request, chapter_name, 0)

from django.shortcuts import redirect

from django.shortcuts import redirect

from django.shortcuts import redirect

def single_key_point_view(request, chapter_name, point_number):
    key_points = get_key_points_in_chapter(chapter_name)

    # If user tries to go past the last point, redirect to the input (index) page
    if point_number < 0:
        return redirect('key_points', chapter_name=chapter_name)
    elif point_number >= len(key_points):
        return redirect('index')  # ✅ This sends the user back to the main input page

    key_point_file = key_points[point_number]
    file_path = os.path.join(GENERATED_DIR, chapter_name, key_point_file)
    qa_file_path = get_qa_file_path(chapter_name, key_point_file)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    question_data = None
    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8") as f:
            question_data = json.load(f)

    show_answer = False

    if request.method == "POST":
        if "submit_question" in request.POST:
            question_data = {
                "question": request.POST.get("question").strip(),
                "answer": request.POST.get("answer").strip(),
                "weight": 1.0
            }
            with open(qa_file_path, "w", encoding="utf-8") as f:
                json.dump(question_data, f, indent=4)
            return redirect('single_key_point', chapter_name=chapter_name, point_number=point_number + 1)

        elif "answer_correct" in request.POST or "answer_incorrect" in request.POST:
            if question_data:
                if "answer_correct" in request.POST:
                    question_data["weight"] /= 2
                elif "answer_incorrect" in request.POST:
                    question_data["weight"] *= 2
                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump(question_data, f, indent=4)
            return redirect('single_key_point', chapter_name=chapter_name, point_number=point_number + 1)

        elif "show_answer" in request.POST:
            show_answer = True

    return render(request, "chapter_key_point.html", {
        "chapter_name": chapter_name,
        "content": content,
        "current": point_number,
        "total": len(key_points),
        "question_data": question_data,
        "show_answer": show_answer
    })



def random_key_point_view(request, chapter_name):
    key_points = get_key_points_in_chapter(chapter_name)

    if not key_points:
        return render(request, 'error.html', {'message': 'No key points found in this chapter.'})

    chosen_key_point = random.choice(key_points)

    file_path = os.path.join(GENERATED_DIR, chapter_name, chosen_key_point)
    qa_file_path = get_qa_file_path(chapter_name, chosen_key_point)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    question_data = None
    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8") as f:
            question_data = json.load(f)

    show_answer = False

    if request.method == "POST":
        if "submit_question" in request.POST:
            question_data = {
                "question": request.POST.get("question").strip(),
                "answer": request.POST.get("answer").strip(),
                "weight": 1.0
            }
            with open(qa_file_path, "w", encoding="utf-8") as f:
                json.dump(question_data, f, indent=4)
            return redirect('random_key_point', chapter_name=chapter_name)

        elif "answer_correct" in request.POST or "answer_incorrect" in request.POST:
            if question_data:
                if "answer_correct" in request.POST:
                    question_data["weight"] /= 2
                elif "answer_incorrect" in request.POST:
                    question_data["weight"] *= 2
                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump(question_data, f, indent=4)
            return redirect('random_key_point', chapter_name=chapter_name)

        elif "show_answer" in request.POST:
            show_answer = True

    return render(request, "chapter_key_point.html", {
        "chapter_name": chapter_name,
        "content": content,
        "question_data": question_data,
        "show_answer": show_answer,
        "is_random": True
    })

