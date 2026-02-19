from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='fretmap'),
    path('save/', views.save_transition, name='save_transition'),
]