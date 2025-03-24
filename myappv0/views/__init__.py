import sqlite3
from django.conf import settings
from django.shortcuts import render
from .randomized_keypoints_views import *
from .import_views import *
from .chapter_views import *
from myappv0.models import Chapter

DB_PATH = settings.DATABASES['default']['NAME']

# =======================================
# HTML index view, rendering all chapters
# =======================================
def html_index(request):
    chapters = get_generated_chapters()
    return render(request, "myappv0/index.html", {"chapters": chapters})

# =======================================
# Get all generated chapters using Django ORM (No raw SQLite)
# =======================================

def get_generated_chapters():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT chapter_number, title FROM chapter ORDER BY chapter_number ASC')
    chapters = cursor.fetchall()
    conn.close()
    return chapters

# =======================================
# Show the import page
# =======================================
def import_page_view(request):
    return render(request, 'myappv0/import.html')
