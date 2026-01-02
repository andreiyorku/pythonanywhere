from django.urls import path
from . import views

urlpatterns = [
    # This matches the empty path inside the app (e.g., /staticsmith/)
    path('', views.staticsmith, name='staticsmith'),
]