import sqlite3
from django.conf import settings
from django.shortcuts import render as django_render
from . import *

def render(request, html_file): return django_render(request, 'MyManager/' + html_file)

DB_PATH = settings.DATABASES['default']['NAME']

def dashboard_view(request):
    return render(request, 'dashboard.html')
    
    
from django.http import JsonResponse
from django.db import connection

def menu_courses_api(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT name, url FROM courses")
        rows = cursor.fetchall()
    
    # Convert to list of dicts
    data = [{"title": row[0], "url": row[1]} for row in rows]
    return JsonResponse(data, safe=False)



