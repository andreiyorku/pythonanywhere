# 1. Navigate to the root of your repository 
# (This ensures it grabs 'mysite', 'school_core', 'media', and everything else)
cd ~/andreiyorku/pythonanywhere/pythonanywhere-main

# 2. Tell Git to track EVERYTHING (the dot means "all files in this folder and subfolders")
git add .

# 3. Commit all the changes
git commit -m "Syncing all server files, apps, databases, and media"

# 4. Push the massive update to GitHub
git push
