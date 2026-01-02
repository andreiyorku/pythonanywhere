import os
import json
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Define where to save the files (inside the static/library folder)
LIBRARY_DIR = os.path.join(settings.BASE_DIR, 'staticsmith', 'static', 'staticsmith', 'library')

# Ensure the directory exists when the server starts
if not os.path.exists(LIBRARY_DIR):
    os.makedirs(LIBRARY_DIR)

def index(request):
    """Renders the StaticSmith tool."""
    return render(request, 'staticsmith/index.html')

@csrf_exempt
def api_save_song(request):
    """Saves the XML string to a file in the library folder."""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            title = data.get('title', 'Unknown').strip()
            artist = data.get('artist', 'Unknown').strip()
            xml_data = data.get('xml_data', '')

            # Create a clean filename (e.g., "Outkast - Hey Ya.xml")
            safe_title = f"{artist} - {title}".replace("/", "-").replace("\\", "-")
            filename = f"{safe_title}.xml"
            filepath = os.path.join(LIBRARY_DIR, filename)

            # Write to file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(xml_data)

            return JsonResponse({'status': 'success', 'filename': filename})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'invalid method'}, status=405)

def api_get_library(request):
    """Scans the library folder and returns a list of .xml files."""
    songs = []
    if os.path.exists(LIBRARY_DIR):
        for f in os.listdir(LIBRARY_DIR):
            if f.endswith('.xml'):
                # Send the filename as the ID and the display name
                songs.append({
                    'id': f,
                    'name': f.replace('.xml', '')
                })
    return JsonResponse({'songs': songs})

def api_load_song(request, filename):
    """Reads a specific XML file from the library."""
    filepath = os.path.join(LIBRARY_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return JsonResponse({'xml_data': content})
    return JsonResponse({'error': 'File not found'}, status=404)