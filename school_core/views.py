from django.shortcuts import render

def index_view(request):
    """
    Renders the main SPA shell.
    This is the only full page load the app will do.
    """
    return render(request, 'school_core/index.html')

