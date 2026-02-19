import os


def create_fretmap_structure():
    # Define the structure
    folders = [
        'static/css',
        'static/js',
        'templates'
    ]

    files = {
        'app.py': '# Flask Server Logic\n',
        'templates/index.html': '\n',
        'static/css/style.css': '/* Visual Styling */\n',
        'static/js/audio.js': '// Pitch & Attack Detection\n',
        'static/js/ui.js': '// Fretboard & Monitor Rendering\n',
        'static/js/game.js': '// Game Logic & Server Sync\n'
    }

    # Create folders
    for folder in folders:
        os.makedirs(folder, exist_ok=True)
        print(f"Created folder: {folder}")

    # Create files
    for filepath, content in files.items():
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Created file: {filepath}")

    print("\nProject structure complete! You can now populate the modular files.")


if __name__ == "__main__":
    create_fretmap_structure()