from django.urls import path
from .views import (
    html_input_view,
    chapter_detail_view,
    random_file_view,
    full_chapter_view,
    all_chapters_view,
    key_points_view,             # New view for viewing key points one at a time
    random_key_point_view,       # New view for random key point from a chapter
    single_key_point_view        # New view for viewing a specific key point in a chapter
)

urlpatterns = [
    path('', html_input_view, name='index'),
    path('all-chapters/', all_chapters_view, name='all_chapters'),
    
    # Chapter detail, already exists
    path('chapter/<str:chapter_name>/', chapter_detail_view, name='chapter_detail'),
    path('chapter/<str:chapter_name>/full/', full_chapter_view, name='full_chapter'),

    # New routes for key points inside a chapter
    path('chapter/<str:chapter_name>/key-points/', key_points_view, name='key_points'),
    path('chapter/<str:chapter_name>/key-points/<int:point_number>/', single_key_point_view, name='single_key_point'),
    path('chapter/<str:chapter_name>/key-points/random/', random_key_point_view, name='random_key_point'),

    # Your existing random file page (global random file across all chapters)
    path('random/', random_file_view, name='random_file'),
]
