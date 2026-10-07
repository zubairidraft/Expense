<#
.SYNOPSIS
    Ralph Loop Autonomous Execution Runner for Expense Tracking
.DESCRIPTION
    Runs iterations over PROMPT.md and TODO.md, validating build integrity
    and maintaining fresh context until target objectives are completed.
#>

param (
    [int]$MaxIterations = 10,
    [string]$TargetPrompt = "PROMPT.md",
    [switch]$AutoCommit
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Starting Ralph Loop (Wiggum Persistence Runner)         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Max Iterations: $MaxIterations" -ForegroundColor Yellow
Write-Host "Prompt File: $TargetPrompt" -ForegroundColor Yellow

if (-not (Test-Path $TargetPrompt)) {
    Write-Error "Target prompt file '$TargetPrompt' not found!"
    exit 1
}

$iteration = 1

while ($iteration -le $MaxIterations) {
    Write-Host "`n[Ralph Loop] Iteration $iteration / $MaxIterations starting..." -ForegroundColor Magenta

    # 1. Check pending tasks in TODO.md
    if (Test-Path "TODO.md") {
        $todoContent = Get-Content "TODO.md" -Raw
        $pendingCount = ([regex]::Matches($todoContent, "- \[ \]")).Count
        Write-Host "[Ralph Loop] Outstanding tasks detected: $pendingCount" -ForegroundColor White
        
        if ($pendingCount -eq 0) {
            Write-Host "`n[Ralph Loop] SUCCESS: All tasks in TODO.md are completed!" -ForegroundColor Green
            break
        }
    }

    # 2. Verify project build health
    Write-Host "[Ralph Loop] Verifying build integrity..." -ForegroundColor Gray
    cmd.exe /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Ralph Loop] Build failure detected! Halting loop for intervention." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[Ralph Loop] Build check passed." -ForegroundColor Green
    }

    # 3. Optional Git checkpoint
    if ($AutoCommit) {
        Write-Host "[Ralph Loop] Checkpointing git state..." -ForegroundColor Gray
        git add .
        git commit -m "chore(ralph): completed iteration $iteration" --quiet 2>$null
    }

    Write-Host "[Ralph Loop] Iteration $iteration cycle finished cleanly." -ForegroundColor Cyan
    $iteration++
    Start-Sleep -Seconds 1
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   Ralph Loop Execution Finished.                          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
