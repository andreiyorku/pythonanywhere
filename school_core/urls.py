from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', views.spa_shell, name='spa_shell'),
    path('api/', views.api_handler, name='api_handler'),

    # NEW: Route for fetching HTML fragments
    #path('partial/<str:filename>/', views.get_partial, name='get_partial'),
]

# This allows the browser to load images from the media folder
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)