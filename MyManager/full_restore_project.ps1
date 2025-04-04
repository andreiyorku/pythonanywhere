# --- Enhanced rebuild script without separators ---
$dumpPath = Join-Path -Path $PSScriptRoot -ChildPath "project_dump.txt"

if (!(Test-Path $dumpPath)) {
    Write-Host "❌ Error: project_dump.txt not found at $dumpPath"
    exit 1
}

$allLines = Get-Content -Path $dumpPath -Encoding UTF8

$currentPath = $null
$contentBuffer = @()

$projectRoot = Get-Location
Write-Host "Project root:" $projectRoot

foreach ($line in $allLines) {

    # Detect start of a new file (indicated by '>>>')
    if ($line.StartsWith(">>>")) {
        if ($currentPath -ne $null -and $contentBuffer.Count -gt 0) {
            $relativePath = $currentPath -replace "^[A-Za-z]:\\.*?pythonanywhere\\MyManager\\", ""
            $absPath = Join-Path $projectRoot $relativePath
            $parentDir = Split-Path -Path $absPath
            if (!(Test-Path $parentDir)) {
                Write-Host "Creating folder:" $parentDir
                New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
            }
            Write-Host "Writing $($contentBuffer.Count) lines to:" $absPath
            $contentBuffer | Set-Content -Path $absPath -Encoding UTF8
            Write-Host "✅ Created:" $absPath
        }
        $currentPath = $line.Substring(3).Trim()
        Write-Host "`nProcessing file:" $currentPath
        $contentBuffer = @()
    }
    # Explicitly skip separator lines
    elseif ($line -like "*=========================*") {
        continue
    }
    else {
        # Collect regular lines into buffer
        $contentBuffer += $line
    }
}

# Write the final buffered content after loop completes
if ($currentPath -ne $null -and $contentBuffer.Count -gt 0) {
    $relativePath = $currentPath -replace "^[A-Za-z]:\\.*?pythonanywhere\\MyManager\\", ""
    $absPath = Join-Path $projectRoot $relativePath
    $parentDir = Split-Path -Path $absPath
    if (!(Test-Path $parentDir)) {
        Write-Host "Creating folder:" $parentDir
        New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
    }
    Write-Host "Writing $($contentBuffer.Count) lines to:" $absPath
    $contentBuffer | Set-Content -Path $absPath -Encoding UTF8
    Write-Host "✅ Created:" $absPath
}

Write-Host "`n🎉 Project restoration complete (without separators)."
