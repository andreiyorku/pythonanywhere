from django.urls import path
from . import views

app_name = 'fretmapOPP'

urlpatterns = [
    path('', views.index, name='index'),
    path('get_user_data/', views.get_user_data, name='get_user_data'),
    path('save_transition/', views.save_transition, name='save_transition'),
    path('save_settings/', views.save_settings, name='save_settings'),
]