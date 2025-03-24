from django.shortcuts import render

def html_index_view(request):
    return render(request, "index.html",)

