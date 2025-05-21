# Get-MyManagerFiles.ps1
# This script lists all file URLs from the MyManager folder and its subdirectories in a GitHub repo

# Get all file entries from the GitHub repository tree (recursive)
$tree = (Invoke-RestMethod -Uri "https://api.github.com/repos/andreiyorku/pythonanywhere/git/trees/main?recursive=1").tree

# Filter for files (type = blob) under 'MyManager/' (including subdirectories)
$myManagerFiles = $tree |
    Where-Object { $_.type -eq "blob" -and $_.path -like "MyManager/*" }

# Output full raw URLs
$myManagerFiles |
    ForEach-Object {
        "https://raw.githubusercontent.com/andreiyorku/pythonanywhere/main/$($_.path)"
    }
