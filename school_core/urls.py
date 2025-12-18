from django.urls import path
#from django.conf.urls.static import static
from . import views

app_name = 'school_core'

urlpatterns = [
    path('', views.index_view, name='index'),
    path('api/data/', views.get_school_data, name='get_data'), # JS will call this
    path('api/manage/', views.manage_school_data, name='manage_data'),
]