# fretmap/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('get_user_data/', views.get_user_data, name='get_user_data'),
    path('save_transition/', views.save_transition, name='save_transition'),
    path('save_settings/', views.save_settings, name='save_settings'), # This must match!
    path('clear_database/', views.clear_database, name='clear_database'),
]