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

def single_key_point_view(request, chapter_number, point_number):
    key_points = get_files_in_chapter(chapter_number)
    if point_number < 1 or point_number > len(key_points):
        return redirect('chapter_detail', chapter_number=chapter_number)
    return render_key_point(request, chapter_number, point_number)

def random_key_point_view(request, chapter_number):
    return single_key_point_view(request, chapter_number, random.choice(get_files_in_chapter(chapter_number)))

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
            show_answer = True
        elif "submit_question" in request.POST:
            question_data = {"question": request.POST.get("question").strip(), "weight": 1.0}
            with open(qa_file_path, "w", encoding="utf-8") as f:
                json.dump(question_data, f, indent=4)
            return redirect(request.path)
        elif "answer_correct" in request.POST or "answer_incorrect" in request.POST:
            if question_data:
                question_data["weight"] *= 1 if "answer_correct" in request.POST else 2
                with open(qa_file_path, "w", encoding="utf-8") as f:
                    json.dump(question_data, f, indent=4)
            return move_to_next_key_point(request, chapter_number, key_point_number, is_random_across_chapters)

    return render(request, "chapter_key_point.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "question_data": question_data,
        "content": content,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
    })
