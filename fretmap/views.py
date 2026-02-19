from django.shortcuts import render
from django.http import JsonResponse
import json

def fretmap_home(request):
    return render(request, 'fretmap/index.html')

# This replaces your Flask save_transition route
def save_transition(request):
    if request.method == 'POST':
        # Logic to save to your .db file or Django models
        return JsonResponse({'status': 'saved'})