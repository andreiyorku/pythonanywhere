from django.shortcuts import render
from django.http import JsonResponse
import sqlite3
import os

# Ensure path is relative to your Django project root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fretmap', 'fretmap.db')

def index(request):
    return render(request, 'fretmap/index.html')

# This replaces your Flask save_transition route
def save_transition(request):
    if request.method == 'POST':
        # Logic to save to your .db file or Django models
        return JsonResponse({'status': 'saved'})