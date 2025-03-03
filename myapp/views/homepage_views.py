from django.shortcuts import render
from ..forms import HTMLInputForm
from .utils import get_generated_chapters

def html_input_view(request):
    form = HTMLInputForm(request.POST or None)
    chapters = get_generated_chapters()
    return render(request, "input.html", {"form": form, "chapters": chapters})
