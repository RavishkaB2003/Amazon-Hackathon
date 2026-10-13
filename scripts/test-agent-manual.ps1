# Aura+ MOD-03 Manual Test Suite Runner (PowerShell Native)
# Verifies all 10 functional, non-functional, and edge cases against http://127.0.0.1:3000

param(
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Aura+ MOD-03: Dual-Mode Bedrock Agent Manual Test Suite  " -ForegroundColor Cyan
Write-Host " Target URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Pre-flight Server Health Check
Write-Host "[Pre-flight] Checking server connectivity..." -ForegroundColor Yellow
try {
    $probe = Invoke-RestMethod -Uri "$BaseUrl/agent/session/probe-check" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  [OK] Server is active and responding on $BaseUrl" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Cannot connect to $BaseUrl. Please ensure 'npm start' is running in another terminal." -ForegroundColor Red
    exit 1
}

$results = @()

function Record-Result {
    param(
        [string]$TestId,
        [string]$Description,
        [bool]$Passed,
        [string]$Details
    )
    $script:results += [PSCustomObject]@{
        TestId      = $TestId
        Description = $Description
        Status      = if ($Passed) { "PASS" } else { "FAIL" }
        Details     = $Details
    }
    if ($Passed) {
        Write-Host "  [$TestId] PASS - $Description" -ForegroundColor Green
        if ($Details) { Write-Host "    -> $Details" -ForegroundColor Gray }
    } else {
        Write-Host "  [$TestId] FAIL - $Description" -ForegroundColor Red
        if ($Details) { Write-Host "    -> $Details" -ForegroundColor Magenta }
    }
    Write-Host ""
}

# -------------------------------------------------------------------------------------------------
# Test Case 1: Alex Persona — ADHD Quick Meal & Autonomous Tool Loop
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 1] Alex Persona: ADHD Quick Meal & Multi-Tool Reasoning Loop" -ForegroundColor Yellow
try {
    $body1 = @{
        sessionId = 'session-alex-manual'
        message   = 'I am exhausted and need a quick dinner under $25 for two people. No dairy.'
    } | ConvertTo-Json -Compress

    $res1 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body1
    $toolsCalled = ($res1.toolCallsExecuted | ForEach-Object { $_.toolName }) -join ", "
    $passed1 = ($res1.wordCount -le 24) -and ($res1.toolCallsExecuted.Count -ge 3)
    Record-Result -TestId "TC-01" -Description "Alex ADHD meal suggestion and autonomous tool execution" `
        -Passed $passed1 `
        -Details "Spoken: '$($res1.spokenText)' ($($res1.wordCount) words). Tools executed: [$toolsCalled]"
} catch {
    Record-Result -TestId "TC-01" -Description "Alex ADHD meal suggestion" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 2: Elena Persona — Real-Time Streaming SSE Mode
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 2] Elena Persona: Streaming SSE Mode" -ForegroundColor Yellow
try {
    # Test using native curl.exe with stop-parsing operator (--%)
    $curlCmd = "curl.exe -s -N -X POST $BaseUrl/agent/chat -H `"Content-Type: application/json`" -H `"Accept: text/event-stream`" --% -d `"{\`"sessionId\`":\`"session-elena-manual\`",\`"message\`":\`"Find a healthy Mediterranean dinner for my family under $30 with no nuts.\`",\`"stream\`":true}`""
    $sseOutput = Invoke-Expression $curlCmd
    $hasToken = $sseOutput -match "event: token"
    $hasWidget = $sseOutput -match "event: widget"
    $hasDone = $sseOutput -match "event: done"
    $passed2 = $hasToken -and $hasDone
    Record-Result -TestId "TC-02" -Description "Elena streaming SSE chunk dispatch" `
        -Passed $passed2 `
        -Details "SSE Frames received: tokens=$hasToken, widget=$hasWidget, done=$hasDone"
} catch {
    Record-Result -TestId "TC-02" -Description "Elena streaming SSE chunk dispatch" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 3: Elena Persona — Multi-Turn Follow-Up (Ingredient Swap)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 3] Elena Persona: Multi-Turn Contextual Follow-Up (Ingredient Swap)" -ForegroundColor Yellow
try {
    $body3 = @{
        sessionId = 'session-elena-manual'
        message   = 'Can we swap the salmon for chicken to save money?'
    } | ConvertTo-Json -Compress

    $res3 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body3
    $passed3 = ($res3.spokenText -match "chicken") -and ($res3.wordCount -le 24)
    Record-Result -TestId "TC-03" -Description "Contextual memory & recipe ingredient swap" `
        -Passed $passed3 `
        -Details "Turn: $($res3.turnCount). Spoken: '$($res3.spokenText)' ($($res3.wordCount) words)"
} catch {
    Record-Result -TestId "TC-03" -Description "Contextual memory & recipe ingredient swap" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 4: Inspect Ephemeral In-Memory Session History
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 4] Ephemeral In-Memory Session Inspection (PRIV-001)" -ForegroundColor Yellow
try {
    $res4 = Invoke-RestMethod -Uri "$BaseUrl/agent/session/session-elena-manual" -Method Get
    $passed4 = ($res4.sessionId -eq 'session-elena-manual') -and ($res4.messageCount -ge 4)
    Record-Result -TestId "TC-04" -Description "In-memory sliding window history retrieval" `
        -Passed $passed4 `
        -Details "Session ID: $($res4.sessionId), Total messages stored in RAM: $($res4.messageCount)"
} catch {
    Record-Result -TestId "TC-04" -Description "In-memory sliding window history retrieval" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 5: Voice Purge & Cart Reset (PRIV-002)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 5] Instant Voice Purge & Cart Wipe (PRIV-002)" -ForegroundColor Yellow
try {
    $body5 = @{
        sessionId = 'session-elena-manual'
        message   = 'Clear my session history'
    } | ConvertTo-Json -Compress

    $res5 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body5
    
    # Verify memory is cleared
    $check5 = Invoke-RestMethod -Uri "$BaseUrl/agent/session/session-elena-manual" -Method Get
    $passed5 = ($check5.messageCount -eq 0) -and ($res5.wordCount -le 15)
    Record-Result -TestId "TC-05" -Description "Session memory wipe and staged cart reset" `
        -Passed $passed5 `
        -Details "Purge confirmation: '$($res5.spokenText)'. Post-purge message count: $($check5.messageCount)"
} catch {
    Record-Result -TestId "TC-05" -Description "Session memory wipe and staged cart reset" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 6: Marcus Persona — High-Protein Workout Recovery
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 6] Marcus Persona: High-Protein Workout Recovery" -ForegroundColor Yellow
try {
    $body6 = @{
        sessionId = 'session-marcus-manual'
        message   = 'I need a high-protein dinner with over 35g protein for post-workout recovery.'
    } | ConvertTo-Json -Compress

    $res6 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body6
    $passed6 = ($res6.spokenText -match "protein") -and ($res6.widgetsDispatched.Count -ge 1)
    Record-Result -TestId "TC-06" -Description "Marcus fitness constraint decomposition" `
        -Passed $passed6 `
        -Details "Spoken: '$($res6.spokenText)'. Dispatched widgets: $($res6.widgetsDispatched.title -join ', ')"
} catch {
    Record-Result -TestId "TC-06" -Description "Marcus fitness constraint decomposition" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 7: Spoken Voice Brevity Enforcement Check (FR-011)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 7] Spoken Voice Brevity Enforcement Check (< 25 words)" -ForegroundColor Yellow
try {
    $body7 = @{
        sessionId = 'session-brevity-test'
        message   = 'Give me the full recipe instructions, grocery list, ingredients, calories, and cooking details.'
    } | ConvertTo-Json -Compress

    $res7 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body7
    $passed7 = ($res7.wordCount -le 24)
    Record-Result -TestId "TC-07" -Description "Spoken voice brevity enforcement" `
        -Passed $passed7 `
        -Details "Enforced word count: $($res7.wordCount) words (< 25 words target). Spoken: '$($res7.spokenText)'"
} catch {
    Record-Result -TestId "TC-07" -Description "Spoken voice brevity enforcement" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 8: Malformed Request / Schema Gating (SEC-004)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 8] Malformed Request Schema Gating (SEC-004)" -ForegroundColor Yellow
try {
    $body8 = @{
        sessionId = 'session-invalid'
        message   = ''
    } | ConvertTo-Json -Compress

    $res8 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body8
    Record-Result -TestId "TC-08" -Description "Empty message schema rejection" -Passed $false -Details "Expected 400 Bad Request, but received success"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message
    $passed8 = ($statusCode -eq 400)
    Record-Result -TestId "TC-08" -Description "Empty message schema rejection (HTTP 400)" `
        -Passed $passed8 `
        -Details "Received HTTP $statusCode Bad Request: $errorBody"
}

# -------------------------------------------------------------------------------------------------
# Test Case 9: Resilient Fallback Header Verification (NFR-006)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 9] Resilient Fallback Header Verification (NFR-006)" -ForegroundColor Yellow
try {
    $body9 = @{
        sessionId = 'header-check'
        message   = 'Quick meal under $20'
    } | ConvertTo-Json -Compress

    $res9 = Invoke-WebRequest -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body9 -UseBasicParsing
    $fallbackHeader = $res9.Headers['X-Bedrock-Fallback']
    $responseTime = $res9.Headers['X-Response-Time']
    $passed9 = ($res9.StatusCode -eq 200) -and ($fallbackHeader -ne $null)
    Record-Result -TestId "TC-09" -Description "Diagnostic wire header inspection (X-Bedrock-Fallback)" `
        -Passed $passed9 `
        -Details "HTTP Status: $($res9.StatusCode), X-Bedrock-Fallback: '$fallbackHeader', X-Response-Time: '$responseTime'"
} catch {
    Record-Result -TestId "TC-09" -Description "Diagnostic wire header inspection" -Passed $false -Details $_.Exception.Message
}

# -------------------------------------------------------------------------------------------------
# Test Case 10: 1MB Payload Ceiling Rejection (SEC-004)
# -------------------------------------------------------------------------------------------------
Write-Host "[Test Case 10] 1MB Payload Ceiling Rejection (SEC-004)" -ForegroundColor Yellow
try {
    $bigString = "a" * (1024 * 1024 + 100)
    $body10 = @{
        sessionId = 'size-test'
        message   = $bigString
    } | ConvertTo-Json -Compress

    $res10 = Invoke-RestMethod -Uri "$BaseUrl/agent/chat" -Method Post -ContentType "application/json" -Body $body10
    Record-Result -TestId "TC-10" -Description "Oversized payload rejection" -Passed $false -Details "Expected 413 Payload Too Large, but request succeeded"
} catch {
    $statusCode10 = $_.Exception.Response.StatusCode.value__
    $errorBody10 = $_.ErrorDetails.Message
    $passed10 = ($statusCode10 -eq 413)
    Record-Result -TestId "TC-10" -Description "Oversized payload rejection (HTTP 413)" `
        -Passed $passed10 `
        -Details "Received HTTP $statusCode10 Payload Too Large: $errorBody10"
}

# -------------------------------------------------------------------------------------------------
# Summary Table
# -------------------------------------------------------------------------------------------------
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                TEST EXECUTION SUMMARY                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
$results | Format-Table -Property TestId, Status, Description -AutoSize
$passedCount = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$totalCount = $results.Count
Write-Host "Total Tests: $totalCount | Passed: $passedCount | Failed: ($totalCount - $passedCount)" -ForegroundColor $(if ($passedCount -eq $totalCount) { "Green" } else { "Red" })
