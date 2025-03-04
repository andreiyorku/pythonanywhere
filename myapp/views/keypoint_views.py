import os
import json
import random
from django.shortcuts import render, redirect
from bs4 import BeautifulSoup
from .utils import (
    CHAPTERS_DIR,
    get_generated_chapters,
    get_files_in_chapter,
    get_key_point_title,
    get_qa_file_path,
    move_to_next_key_point
)

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

def render_key_point(request, chapter_number, key_point_number, is_random_across_chapters=False, is_random_in_chapter=False):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        content = str(soup.body) if soup.body else str(soup)

    question_data = None
    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8", errors='replace') as f:
            question_data = json.load(f)

    show_answer = request.session.pop('show_answer', False)

    if request.method == "POST":
        if "show_answer" in request.POST:
            show_answer = True

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
                    question_data["weight"] = question_data["weight"]  # Optional: adjust weight logic
                elif "answer_incorrect" in request.POST:
                    question_data["weight"] *= 2

                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump(question_data, f, indent=4)

            if is_random_in_chapter:
                return move_to_next_random_in_chapter(request, chapter_number)

            elif is_random_across_chapters:
                return redirect('random_file')

            else:
                return move_to_next_key_point(request, chapter_number, key_point_number)

    return render(request, "chapter_key_point.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "question_data": question_data,
        "content": content,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
        "is_random_in_chapter": is_random_in_chapter,  # Add this line!
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

def random_in_chapter_view(request, chapter_number):
    key_points = get_files_in_chapter(chapter_number)

    if not key_points:
        return redirect('chapter_detail', chapter_number=chapter_number)

    # First time visiting the page (or reset if switching chapters), pick a random point
    if (
        'current_random_point' not in request.session or
        request.session.get('current_random_chapter') != chapter_number
    ):
        next_point = weighted_random_point_in_chapter(chapter_number)
        request.session['current_random_point'] = next_point
        request.session['current_random_chapter'] = chapter_number
    else:
        next_point = request.session['current_random_point']

    # Render the selected key point
    return render_key_point(request, chapter_number, next_point, is_random_in_chapter=True)


def move_to_next_random_in_chapter(request, chapter_number):
    """After answering a question, move to the next random weighted point within this chapter."""
    next_point = weighted_random_point_in_chapter(chapter_number)
    request.session['current_random_point'] = next_point
    request.session['current_random_chapter'] = chapter_number

    return redirect('random_in_chapter', chapter_number=chapter_number)


def weighted_random_point_in_chapter(chapter_number):
    """Get a weighted random key point from a chapter."""
    key_points = get_files_in_chapter(chapter_number)
    weights = [get_point_weight(chapter_number, kp) for kp in key_points]
    return random.choices(key_points, weights=weights)[0]
