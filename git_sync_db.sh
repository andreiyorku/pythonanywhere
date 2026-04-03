#!/bin/bash

# Define specific file paths
DB_FILE="myapp_db.sqlite3"
MEDIA_DIR="myapp/generated/"

echo "--- 🚀 Starting Backup Sync ---"

# 1. Force Add Database
if [ -f "$DB_FILE" ]; then
    echo "📦 Adding Database: $DB_FILE"
    git add -f "$DB_FILE"
else
    echo "⚠️ Warning: Database file '$DB_FILE' not found!"
fi

# 2. Force Add Media Folder
if [ -d "$MEDIA_DIR" ]; then
    echo "🖼️ Adding Media Folder: $MEDIA_DIR"
    git add -f "$MEDIA_DIR"
else
    echo "⚠️ Warning: Media directory '$MEDIA_DIR' not found!"
fi

# 3. Commit
echo "📝 Committing changes..."
git commit -m "Backup: Syncing actual Database and Images" || echo "Nothing new to commit."

# 4. Push
echo "uploading to GitHub..."
git push

echo "--- ✅ Sync Complete ---"

