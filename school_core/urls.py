from django.urls import path
from . import views

urlpatterns = [
    path('', views.spa_shell, name='spa_shell'),
    path('api/', views.api_handler, name='api_handler'),
]