from django.urls import path
from .views import *

#from django.conf.urls.static import static

urlpatterns = [
    path('', dashboard_view, name='MyManager'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('api/courses_menu/', menu_courses_api, name='courses_menu_api'),
    path('api/random_keypoint/', random_keypoint_api, name='random_keypoint_api'),

]

from .views.filter_api import (
    filter_options_api,
    chapters_by_course_api,
    save_filter_settings_api,
)

urlpatterns += [
    path("api/filter_options/", filter_options_api),
    path("api/chapters_by_course/", chapters_by_course_api),
    path("api/save_filters/", save_filter_settings_api),
]

from .views import import_views

urlpatterns += [
    path('api/import/fetch_contexts/', import_views.import_fetch_contexts, name='import_fetch_contexts'),
    path('api/import/bulk_submit/', import_views.import_bulk_content, name='import_bulk_content'),
]

from MyManager.views.import_api import get_courses_api, get_chapters_api, submit_import_api

urlpatterns += [
    path("api/import/get_courses/", get_courses_api),
    path("api/import/get_chapters/", get_chapters_api),
    path("api/import/submit/", submit_import_api),
]

