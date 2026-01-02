from django.shortcuts import render

def index(request):
    """Renders the StaticSmith tool."""
    # Notice we use 'staticsmith/index.html', not just 'index.html'
    return render(request, 'staticsmith/index.html')