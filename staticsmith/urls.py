from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='staticsmith'),

    # API Endpoints
    path('api/save/', views.api_save_song, name='api_save_song'),
    path('api/library/', views.api_get_library, name='api_get_library'),
    # Use <str:filename> to match filenames like "Outkast - Hey Ya.xml"
    path('api/load/<str:filename>/', views.api_load_song, name='api_load_song'),
]