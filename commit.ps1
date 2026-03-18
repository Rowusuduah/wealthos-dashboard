# WealthOS — Quick Commit & Push
# Usage: .\commit.ps1 "your message"
# Usage: .\commit.ps1          (uses auto-generated message with timestamp)

param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

# Auto-generate message if none provided
if (-not $Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  # Detect what changed
  $changed = git diff --name-only HEAD 2>$null
  $staged  = git diff --cached --name-only 2>$null
  $untrack = git ls-files --others --exclude-standard 2>$null
  $all     = ($changed + $staged + $untrack) | Select-Object -Unique
  if ($all) {
    $files   = ($all | Select-Object -First 3) -join ", "
    $more    = if ($all.Count -gt 3) { " +$($all.Count - 3) more" } else { "" }
    $Message = "Update $files$more — $timestamp"
  } else {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
    exit 0
  }
}

# Stage all tracked + new files (excludes .gitignore'd)
git add index.html manifest.json sw.js .gitignore 2>$null
git add css/ js/ icons/ CLAUDE.md 2>$null
git add -u 2>$null  # stage deletions of tracked files

$status = git status --short
if (-not $status) {
  Write-Host "Nothing to commit." -ForegroundColor Yellow
  exit 0
}

Write-Host "Committing: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main 2>$null || git push origin master 2>$null

Write-Host "Done." -ForegroundColor Green
