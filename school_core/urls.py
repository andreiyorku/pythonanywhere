from django.urls import path
from . import views

#from django.conf.urls.static import static

app_name = 'school_core'

urlpatterns = [
    path('', views.index_view, name='index'),
]