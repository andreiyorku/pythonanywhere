from django.shortcuts import render
from ..forms import HTMLInputForm
from .utils import get_generated_chapters
#now
def html_input_view(request):
    form = HTMLInputForm(request.POST or None)
    chapters = get_generated_chapters()
    return render(request, "myapp/input.html", {"form": form, "chapters": chapters})

