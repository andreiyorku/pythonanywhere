from django.urls import path
from .views import *

urlpatterns = [

    path('github-webhook/', github_webhook, name='github_webhook'),

    path('editor/', chapter_editor_view, name='chapter_editor'),

    # ==========================
    # 1️⃣ HOMEPAGE / INDEX
    # ==========================
    path('', html_input_view, name='index'),

    # ==========================
    # 2️⃣ CHAPTER VIEWS
    # ==========================
    path('chapter/<int:chapter_number>/', chapter_detail_view, name='chapter_detail'),
    path('chapter/<int:chapter_number>/full/', full_chapter_view, name='full_chapter'),

    # ==========================
    # 3️⃣ KEY POINT VIEWS (WITHIN CHAPTER)
    # ==========================
    path('chapter/<int:chapter_number>/key-points/', key_points_view, name='key_points'),
    path('chapter/<int:chapter_number>/key-points/<int:point_number>/', single_key_point_view, name='single_key_point'),
    path('chapter/<int:chapter_number>/key-points/random/', random_key_point_view, name='random_key_point'),

    # ==========================
    # 4️⃣ RANDOMIZED ACROSS ALL CHAPTERS
    # ==========================
    path('random/', random_key_point_across_chapters_view, name='random_file'),

    # ==========================
    # 5️⃣ ADD / APPEND KEY POINTS
    # ==========================
    path('add-key-point/', add_key_point_view, name='add_key_point'),
    path('append-key-point/', append_to_key_point_view, name='append_key_point'),

    # ==========================
    # 6️⃣ ALL / SEQUENTIAL VIEWS
    # ==========================
    path('all-key-points/', all_key_points_combined_view, name='all_key_points_combined'),
    path('sequential-key-points/', sequential_key_points_view, name='sequential_key_points'),  # ✅ Sequential link
]
