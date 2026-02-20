from django.urls import path
from . import views

#app_name = 'fretmap'

urlpatterns = [
    path('', views.index, name='fretmap'),
    path('get_user_data/', views.get_user_data, name='get_user_data'),
    path('save_transition/', views.save_transition, name='save_transition'),
    path('save_settings/', views.save_settings, name='save_settings'),

    # Fallback to prevent crashes if old JS code tries to hit the old URL
    path('save/', views.save_transition, name='save'),
]