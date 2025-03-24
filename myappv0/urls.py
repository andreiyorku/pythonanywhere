from django.urls import path
from .views import *

urlpatterns = [

    path('', html_index, name='myapp'),  # URL name must be 'myapp'
    
    path('random/', random_key_point_across_chapters_view, name='random_file'),
    
    path('import/', import_page_view, name='import_page'),  # ✅ Page that shows form
    
    path('process_import/', process_bulk_import, name='process_import'),  # ✅ Page that processes POST
    
    #path('chapter/<int:chapter_number>/', chapter_detail_view, name='chapter_detail'),
    
    path('chapter/<int:chapter_number>/full/', full_chapter_view, name='full_chapter'),
]
