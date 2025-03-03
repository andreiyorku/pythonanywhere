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
    load_key_point
)

def chapter_editor_view(request):
    chapter_number = int(request.POST.get("chapter_number", 1))
    key_point_number = int(request.POST.get("key_point_number", 1))

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "save_keypoint":
            save_key_point_from_request(request, chapter_number, key_point_number)
        elif action == "bulk_import":
            success, message = process_bulk_chapter_content(request.POST.get("bulk_content", "").strip())
            if success:
                messages.success(request, message)
            else:
                messages.error(request, message)
            return redirect('chapter_editor')

    return load_key_point(request, chapter_number, key_point_number)
