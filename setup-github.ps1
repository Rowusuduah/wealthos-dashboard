# WealthOS — GitHub Setup Script
# Run once: Right-click → "Run with PowerShell"  (or: pwsh setup-github.ps1)

$ErrorActionPreference = "Stop"

Write-Host "`n=== WealthOS GitHub Setup ===" -ForegroundColor Cyan

# ── 1. Check prerequisites ──────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: git not found. Install from https://git-scm.com" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: gh CLI not found. Install from https://cli.github.com" -ForegroundColor Red
  exit 1
}

# ── 2. Check gh auth ────────────────────────────────────────────────────────
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nNot logged in to GitHub. Starting login..." -ForegroundColor Yellow
  gh auth login
}

# ── 3. Init git repo ────────────────────────────────────────────────────────
Write-Host "`n[1/5] Initialising git repository..." -ForegroundColor Green
git init
git config core.autocrlf true

# ── 4. Set author (update these if needed) ──────────────────────────────────
$name  = git config --global user.name  2>$null
$email = git config --global user.email 2>$null
if (-not $name) {
  $name = Read-Host "Enter your name for git commits"
  git config --global user.name $name
}
if (-not $email) {
  $email = Read-Host "Enter your email for git commits"
  git config --global user.email $email
}

# ── 5. Initial commit ───────────────────────────────────────────────────────
Write-Host "`n[2/5] Staging files..." -ForegroundColor Green
git add index.html manifest.json sw.js .gitignore
git add css/styles.css css/print.css
git add js/data.js js/tracker.js js/app.js
git add icons/
git add CLAUDE.md

Write-Host "`n[3/5] Creating initial commit..." -ForegroundColor Green
git commit -m "Initial commit: WealthOS personal finance dashboard

- 9-tab SPA: Overview, Budget, Full Table, Wealth, Relationship, Ghana, Roadmap, Checklist, Tracker
- Real-time transaction tracking vs planned budget
- Biweekly pay period math anchored to June 5 2026 first payday
- PWA with service worker offline support
- ARIA accessible, WCAG AA colour contrast
- LocalStorage persistence for checklist, health insurance, transactions
- CSV export for budget and transactions
- Backup/restore all data as JSON
- Responsive: phone, tablet, laptop"

# ── 6. Create GitHub repo ────────────────────────────────────────────────────
Write-Host "`n[4/5] Creating GitHub repository..." -ForegroundColor Green
gh repo create wealthos-dashboard `
  --private `
  --description "Personal finance & wealth management dashboard — Tampa 2026" `
  --source . `
  --remote origin `
  --push

# ── 7. Done ──────────────────────────────────────────────────────────────────
Write-Host "`n[5/5] Done!" -ForegroundColor Green
$repoUrl = gh repo view --json url -q ".url" 2>$null
Write-Host "`nRepository: $repoUrl" -ForegroundColor Cyan
Write-Host "To commit future changes, run: .\commit.ps1 `"your message`"" -ForegroundColor Yellow
Write-Host ""
