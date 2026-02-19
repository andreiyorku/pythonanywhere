from django.shortcuts import render
from django.http import JsonResponse
import json

def fretmap_home(request):
    return render(request, 'fretmap/index.html')

def save_transition(request):
    if request.method == 'POST':
        # Your logic to save to fretmap.db goes here
        return JsonResponse({'status': 'saved'})