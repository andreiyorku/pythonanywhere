from django.urls import path
from .views import *

#from django.conf.urls.static import static

urlpatterns = [
    path('', dashboard_view, name='MyManager'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('api/courses_menu/', menu_courses_api, name='courses_menu_api'),
    path('api/random_keypoint/', random_keypoint_api, name='random_keypoint_api'),
    path('api/chapters_by_course/', chapters_by_course_api, name='chapters_by_course_api'),
    path('api/filter_options/', filter_options_api, name='filter_options_api'),
    path('api/save_filters/', save_filter_settings_api),
]