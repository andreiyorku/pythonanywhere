from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='fretmap'),
    path('get_user_data/', views.get_user_data, name='get_user_data'),
    path('save/', views.save_transition, name='save_transition'),
]