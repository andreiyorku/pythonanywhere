from django.shortcuts import render

# 1. The Main Page
def home(request):
    return render(request, 'js_playgrounds/home.html')

# 2. The Content Fragment (Uses the new template)
def page2(request):
    return render(request, 'js_playgrounds/page2.html')