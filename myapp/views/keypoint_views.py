import os
import json
import random
import math
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
    """
    Weighted random selection of a keypoint across all chapters, using only 'weight' field.
    """

    chapters = [
        get_files_in_chapter(ch)
        for ch in get_generated_chapters()
    ]

    initial_relation = 4  # Later chapter points are 4x stronger initially
    max_protection = 3    # Controlled degradation rounds

    keypoints = []
    for idx, chapter_keypoints in enumerate(chapters):
        num_points = len(chapter_keypoints)
        if num_points == 0:
            continue
        chapter_multiplier = 2 ** idx
        base_weight = chapter_multiplier / num_points

        for kp in chapter_keypoints:
            qa_file_path = get_qa_file_path(idx, kp)
            current_weight = base_weight  # Default starting weight

            if os.path.exists(qa_file_path):
                with open(qa_file_path, "r", encoding="utf-8-sig", errors='replace') as f:
                    try:
                        qa_data = json.load(f)
                        current_weight = qa_data.get("weight", base_weight)
                    except json.JSONDecodeError:
                        pass

            keypoints.append({
                "text": kp,
                "base_weight": base_weight,
                "chapter_index": idx,
                "weight": current_weight
            })

    if not keypoints:
        return render(request, "error.html", {"message": "No key points found."})

    adjusted_weights = []
    for kp in keypoints:
        R = (initial_relation / 2) ** (1 / max_protection)

        # Estimate correct count from weight:
        try:
            correct_count = math.log(kp['base_weight'] / kp['weight'], R)
        except (ValueError, ZeroDivisionError):
            correct_count = 0

        if correct_count <= max_protection:
            reduction_factor = R ** correct_count
        else:
            reduction_factor = (R ** max_protection) * (2 ** (correct_count - max_protection))

        adjusted_weight = kp['base_weight'] / reduction_factor
        adjusted_weights.append(adjusted_weight)

    sampled_keypoint = random.choices(keypoints, weights=adjusted_weights, k=1)[0]
    chapter_number = sampled_keypoint['chapter_index']
    key_point_number = sampled_keypoint['text']

    return render_key_point(request, chapter_number, key_point_number, is_random_across_chapters=True)

    
def render_key_point(request, chapter_number, key_point_number, is_random_across_chapters=False, is_random_in_chapter=False):
    file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{key_point_number}.html")
    qa_file_path = get_qa_file_path(chapter_number, key_point_number)

    with open(file_path, "r", encoding="utf-8-sig") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
        content = str(soup.body) if soup.body else str(soup)

    question_data = None
    if os.path.exists(qa_file_path):
        with open(qa_file_path, "r", encoding="utf-8-sig", errors='replace') as f:
            question_data = json.load(f)

    show_answer = request.session.pop('show_answer', False)

    if request.method == "POST":
        if "show_answer" in request.POST:
            show_answer = True

        elif "submit_question" in request.POST:
            question_data = {
                "question": request.POST.get("question").strip(),
                "weight": 1.0  # Initial weight, no 'correct_count'
            }
            with open(qa_file_path, "w", encoding="utf-8-sig") as f:
                json.dump(question_data, f, indent=4)
            return redirect(request.path)

        elif "answer_correct" in request.POST or "answer_incorrect" in request.POST:
            if question_data:
                if "answer_correct" in request.POST:
                    # Halve the weight when answered correctly
                    question_data["weight"] = max(0.01, question_data["weight"] / 2)

                with open(qa_file_path, "w", encoding="utf-8-sig") as f:
                    json.dump(question_data, f, indent=4)

            # Handle navigation
            if is_random_in_chapter:
                return move_to_next_random_in_chapter(request, chapter_number)
            elif is_random_across_chapters:
                return redirect('random_file')
            else:
                return move_to_next_key_point(request, chapter_number, key_point_number)

    return render(request, "myapp/chapter_key_point.html", {
        "chapter_number": chapter_number,
        "key_point_number": key_point_number,
        "question_data": question_data,
        "content": content,
        "show_answer": show_answer,
        "is_random_across_chapters": is_random_across_chapters,
        "is_random_in_chapter": is_random_in_chapter,
    })


    
def move_to_next_random_in_chapter(request, chapter_number):
    """After answering a question, move to the next random weighted point within this chapter."""
    next_point = weighted_random_point_in_chapter(chapter_number)
    request.session['current_random_point'] = next_point
    request.session['current_random_chapter'] = chapter_number

    return redirect('random_in_chapter', chapter_number=chapter_number)


def weighted_random_point_in_chapter(chapter_number):
    """Get a weighted random key point within a chapter."""
    key_points = get_files_in_chapter(chapter_number)
    weights = []
    for kp in key_points:
        qa_file_path = get_qa_file_path(chapter_number, kp)
        correct_count = 0
        if os.path.exists(qa_file_path):
            with open(qa_file_path, "r", encoding="utf-8-sig", errors='replace') as f:
                try:
                    qa_data = json.load(f)
                    correct_count = qa_data.get("correct_count", 0)
                except json.JSONDecodeError:
                    pass

        base_weight = 1.0  # In-chapter equal weighting (adjust as needed)
        R = (4 / 2) ** (1 / 3)  # Assuming same relation as cross-chapter
        if correct_count <= 3:
            reduction_factor = R ** correct_count
        else:
            reduction_factor = (R ** 3) * (2 ** (correct_count - 3))

        weight = base_weight / reduction_factor
        weights.append(weight)

    return random.choices(key_points, weights=weights)[0]


def all_key_points_combined_view(request):
    all_content = []
    chapters = get_generated_chapters()

    for chapter_number in chapters:
        all_content.append(f"<h1>Chapter {chapter_number}</h1>")

        key_points = get_files_in_chapter(chapter_number)

        for point_number in key_points:
            file_path = os.path.join(CHAPTERS_DIR, str(chapter_number), f"{point_number}.html")
            with open(file_path, "r", encoding="utf-8-sig") as f:
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
        with open(qa_file_path, "r", encoding="utf-8-sig") as f:
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



