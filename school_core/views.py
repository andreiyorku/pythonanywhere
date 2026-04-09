import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Import our logic module
from . import logic

def school_core(request):
    """Renders the main single-page application wrapper."""
    return render(request, 'school_core/index.html')

def get_partial(request, filename):
    """Renders HTML fragments (partials) for the frontend router."""
    return render(request, f'school_core/partials/{filename}.html')

@csrf_exempt
def api_handler(request):
    """Main API Gateway that routes requests to logic.py"""
    data = {}
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.POST.dict()
    elif request.body:
        try:
            data = json.loads(request.body)
        except:
            data = {}

    action = data.get('action')
    response_data = None

    if action in ['login', 'register', 'logout', 'get_current_user']:
        response_data = logic.handle_auth(action, data, request)

    elif action in ['get_courses', 'add_course', 'delete_course', 'edit_course', 'sync_pull']:
        response_data = logic.handle_hub(action, data, request)

    elif action in ['get_chapters', 'add_chapter', 'delete_chapter', 'edit_chapter']:
        response_data = logic.handle_course(action, data, request)

    elif action in ['get_notes', 'add_note', 'delete_note', 'reset_note', 'reset_chapter', 'reset_course', 'edit_note']:
        response_data = logic.handle_note(action, data, request.FILES, request)

    elif action in ['init_quiz', 'get_content', 'submit_answer', 'trigger_git_sync']:
        response_data = logic.handle_quiz(action, data, request)

    if response_data is not None:
        return JsonResponse(response_data)

    return JsonResponse({'error': 'Invalid Action'}, status=400)