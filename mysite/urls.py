"""mysite URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))rr
"""
from django.contrib import admin
from django.urls import path, include
from .views import html_index_view
from django.views.generic import RedirectView

urlpatterns = [

    path('', html_index_view, name='index'),
    path('school_core/', include('school_core.urls')),
    path('js_playgrounds/', include('js_playgrounds.urls')),
    path('staticsmith/', include('staticsmith.urls')),
    path('fretmap/', include('fretmap.urls')), # Add this line
]

from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)