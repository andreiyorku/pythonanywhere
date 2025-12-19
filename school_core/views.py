import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Import our new logic module rr
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
    # We check which "Module" handles this action

    if action in ['get_courses', 'add_course']:
        response_data = logic.handle_hub(action, data)

    elif action in ['get_chapters', 'add_chapter']:
        response_data = logic.handle_course(action, data)

    elif action in ['get_notes', 'add_note', 'delete_note']:
        # Note logic needs files for uploads
        response_data = logic.handle_note(action, data, request.FILES)

    elif action in ['generate_quiz', 'submit_answer']:
        response_data = logic.handle_quiz(action, data)

    # 3. RETURN RESPONSE
    if response_data is not None:
        return JsonResponse(response_data)

    return JsonResponse({'error': 'Invalid Action'}, status=400)