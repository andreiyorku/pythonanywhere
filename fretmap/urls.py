from django.urls import path
from . import views

app_name = 'fretmap'

urlpatterns = [
    path('', views.index, name='index'),
    path('get_user_data/', views.get_user_data, name='get_user_data'),
    path('save/', views.save_transition, name='save_transition'),

    # NEW: Add this line to handle the settings slider saves
    path('save_settings/', views.save_settings, name='save_settings'),
]