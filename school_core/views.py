import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from . import logic


# ==========================================
# --- PAGE & PARTIAL RENDERING VIEWS ---
# ==========================================

def index(request):
    """Renders the main single-page application skeleton."""
    return render(request, 'school_core/index.html')


def partial_auth(request):
    return render(request, 'school_core/partials/auth.html')


def partial_hub(request):
    return render(request, 'school_core/partials/hub.html')


def partial_course(request):
    return render(request, 'school_core/partials/course.html')


def partial_chapter(request):
    return render(request, 'school_core/partials/chapter.html')


def partial_quiz(request):
    return render(request, 'school_core/partials/quiz.html')


# ==========================================
# --- CENTRAL API GATEWAY ---
# ==========================================

@csrf_exempt
def api_handler(request):
    """
    Acts as the single endpoint for all AJAX/Fetch requests from app.js.
    Routes the request to the appropriate function in logic.py based on the 'action' string.
    """
    if request.method == 'POST':

        # 1. Parse incoming data (Handle both JSON and Multipart-Form for image uploads)
        if request.content_type.startswith('multipart/form-data'):
            data = request.POST.dict()
            files = request.FILES
        else:
            try:
                data = json.loads(request.body)
                files = None
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON format'}, status=400)

        action = data.get('action')
        if not action:
            return JsonResponse({'error': 'No action provided'}, status=400)

        response_data = None

        # 2. Security Routing: Only allow known actions to hit the logic.py backend
        if action in ['login', 'register', 'logout', 'get_current_user']:
            response_data = logic.handle_auth(action, data, request)

        elif action in ['sync_pull', 'get_courses', 'add_course', 'edit_course', 'delete_course']:
            response_data = logic.handle_hub(action, data, request)

        elif action in ['get_chapters', 'add_chapter', 'edit_chapter', 'delete_chapter']:
            response_data = logic.handle_course(action, data, request)

        elif action in ['get_notes', 'add_note', 'edit_note', 'delete_note', 'reset_note', 'reset_chapter',
                        'reset_course']:
            # Note endpoints require file handling for images
            if files is not None:
                response_data = logic.handle_note(action, data, files, request)
            else:
                response_data = logic.handle_note(action, data, {}, request)

        # UPDATED: 'trigger_git_sync' added to the allowed quiz actions
        elif action in ['init_quiz', 'get_content', 'submit_answer', 'trigger_git_sync']:
            response_data = logic.handle_quiz(action, data, request)

        else:
            return JsonResponse({'error': f'Unknown action: {action}'}, status=400)

        # 3. Return the processed logic back to app.js
        if response_data is not None:
            return JsonResponse(response_data)
        else:
            return JsonResponse({'error': 'Server logic returned no response'}, status=500)

    return JsonResponse({'error': 'Method not allowed. Use POST.'}, status=405)