from django import forms

class HTMLInputForm(forms.Form):
    html_content = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 20, "cols": 100, "style": "width:100%; height:500px;"}),
        label="Paste your HTML content"
    )
