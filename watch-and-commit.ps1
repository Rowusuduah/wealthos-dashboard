# WealthOS — Auto-commit watcher
# Watches for file changes and commits + pushes automatically every 5 minutes
# Run in a separate PowerShell window: .\watch-and-commit.ps1
# Press Ctrl+C to stop.

$ErrorActionPreference = "SilentlyContinue"
$watchPath   = $PSScriptRoot
$intervalSec = 300  # commit every 5 minutes if there are changes
$lastCommit  = [DateTime]::Now

Write-Host "WealthOS auto-commit watcher started." -ForegroundColor Cyan
Write-Host "Watching: $watchPath" -ForegroundColor Gray
Write-Host "Interval: every $intervalSec seconds — press Ctrl+C to stop`n" -ForegroundColor Gray

# Set up FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher $watchPath
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

$pending = $false

$onChange = {
  $name = $Event.SourceEventArgs.Name
  # Ignore git internals, scripts, and backup files
  if ($name -match '(\.git|\.ps1|WealthOS_Backup)') { return }
  $script:pending = $true
}

Register-ObjectEvent $watcher Changed -Action $onChange | Out-Null
Register-ObjectEvent $watcher Created -Action $onChange | Out-Null
$watcher.EnableRaisingEvents = $true

try {
  while ($true) {
    Start-Sleep -Seconds 10

    $now = [DateTime]::Now
    $elapsed = ($now - $lastCommit).TotalSeconds

    if ($pending -and $elapsed -ge $intervalSec) {
      $pending = $false
      $lastCommit = $now

      Set-Location $watchPath
      $changed = git diff --name-only HEAD 2>$null
      $untrack = git ls-files --others --exclude-standard 2>$null
      $all = ($changed + $untrack) | Where-Object { $_ } | Select-Object -Unique

      if ($all) {
        $ts      = $now.ToString("yyyy-MM-dd HH:mm")
        $files   = ($all | Select-Object -First 3) -join ", "
        $more    = if ($all.Count -gt 3) { " +$($all.Count - 3) more" } else { "" }
        $msg     = "Auto: update $files$more — $ts"

        git add index.html manifest.json sw.js .gitignore 2>$null
        git add css/ js/ icons/ CLAUDE.md 2>$null
        git add -u 2>$null

        $status = git status --short
        if ($status) {
          Write-Host "[$ts] Committing: $msg" -ForegroundColor Green
          git commit -m $msg 2>&1 | Out-Null
          git push origin main 2>$null || git push origin master 2>$null
          Write-Host "[$ts] Pushed." -ForegroundColor Gray
        }
      }
    }
  }
} finally {
  $watcher.EnableRaisingEvents = $false
  $watcher.Dispose()
  Write-Host "`nWatcher stopped." -ForegroundColor Yellow
}
