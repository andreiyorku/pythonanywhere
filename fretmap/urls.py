from django.urls import path
from . import views

urlpatterns = [
    path('', views.fretmap_home, name='fretmap_home'),
    path('save/', views.save_transition, name='save_transition'),
]