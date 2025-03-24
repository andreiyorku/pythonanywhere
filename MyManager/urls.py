from django.urls import path
from .views import *

#from django.conf.urls.static import static

urlpatterns = [
    path('', dashboard_view, name='MyManager'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('api/courses_menu/', menu_courses_api, name='courses_menu_api'),
]