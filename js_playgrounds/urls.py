from django.contrib import admin
from django.urls import path
from js_playgrounds import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('page-2-content/', views.page2, name='page2'),
]