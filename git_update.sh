#!/bin/bash

echo "--- Starting Force Pull ---"

# 1. Download latest updates from GitHub (doesn't touch files yet)
git fetch --all

# 2. Get current branch name (e.g., 'main' or 'master')
BRANCH=$(git branch --show-current)

# 3. Force overwrite local files to match GitHub exactly
git reset --hard origin/$BRANCH

git update-index --chmod=+x git_update.sh

echo "--- Pulled successfully on branch: $BRANCH ---"

# Optional: Reload the web app automatically (uncomment if you want this)
# touch /var/www/your_username_pythonanywhere_com_wsgi.py