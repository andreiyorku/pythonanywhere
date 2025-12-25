import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Import our new logic module
from . import logic


def school_core(request):
    return render(request, 'school_core/index.html')


def get_partial(request, filename):
    return render(request, f'school_core/partials/{filename}.html')


@csrf_exempt
def api_handler(request):
    # 1. PARSE DATA
    data = {}
    if request.content_type.startswith('multipart/form-data'):
        data = request.POST.dict()
    elif request.body:
        try:
            data = json.loads(request.body)
        except:
            data = {}

    action = data.get('action')
    response_data = None

    # 2. ROUTE TO LOGIC
    # UPDATED: We now pass 'request' to every function so logic.py can check sessions

    if action in ['login', 'register', 'logout', 'get_current_user']:
        response_data = logic.handle_auth(action, data, request)

    elif action in ['get_courses', 'add_course', 'delete_course']:
        response_data = logic.handle_hub(action, data, request)

    elif action in ['get_chapters', 'add_chapter', 'delete_chapter']:
        response_data = logic.handle_course(action, data, request)

    elif action in ['get_notes', 'add_note', 'delete_note']:
        # Note logic needs 'request.FILES' for images AND 'request' for user ID
        response_data = logic.handle_note(action, data, request.FILES, request)

    elif action in ['init_quiz', 'get_content', 'submit_answer']:
        response_data = logic.handle_quiz(action, data, request)

    # 3. RETURN RESPONSE
    if response_data is not None:
        return JsonResponse(response_data)

    return JsonResponse({'error': 'Invalid Action'}, status=400)