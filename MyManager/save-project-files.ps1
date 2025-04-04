# Set output file path
$outputFile = "project_dump.txt"

# Start with a clean file
"" | Out-File -FilePath $outputFile -Encoding UTF8

# 🔁 Function to read file content with infinite retry until success
function SafeReadFile($filePath, $delayMs = 300) {
    while ($true) {
        try {
            return Get-Content -Path $filePath -ErrorAction Stop
        } catch {
            Write-Host "Retrying to read locked file: $filePath..."
            Start-Sleep -Milliseconds $delayMs
        }
    }
}

# 📄 Function to append file content with headers to output file
function Append-FileContentToOutput($filePath) {
    Add-Content -Path $outputFile -Value "`n========================="
    Add-Content -Path $outputFile -Value ">>> $filePath"
    Add-Content -Path $outputFile -Value "========================="

    $lines = SafeReadFile $filePath
    $lines | ForEach-Object { Add-Content -Path $outputFile -Value $_ }
}

# 1. Append urls.py if it exists
if (Test-Path ".\urls.py") {
    Append-FileContentToOutput ".\urls.py"
} else {
    Add-Content -Path $outputFile -Value "urls.py not found in current directory."
}

# 2. Append all Python files in 'views' directory and subdirectories
if (Test-Path ".\views") {
    Get-ChildItem -Path .\views -Recurse -Filter *.py | ForEach-Object {
        Append-FileContentToOutput $_.FullName
    }
} else {
    Add-Content -Path $outputFile -Value "`nviews directory not found."
}

# 3. Append all files in 'templates' directory and subdirectories
if (Test-Path ".\templates") {
    Get-ChildItem -Path .\templates -Recurse -File | ForEach-Object {
        Append-FileContentToOutput $_.FullName
    }
} else {
    Add-Content -Path $outputFile -Value "`ntemplates directory not found."
}

# 4. Append all files in 'static' directory and subdirectories
if (Test-Path ".\static") {
    Get-ChildItem -Path .\static -Recurse -File | ForEach-Object {
        Append-FileContentToOutput $_.FullName
    }
} else {
    Add-Content -Path $outputFile -Value "`nstatic directory not found."
}

Write-Host ""
Write-Host "Output written to $outputFile"

