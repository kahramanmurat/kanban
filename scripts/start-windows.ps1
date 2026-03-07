$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

if ([string]::IsNullOrWhiteSpace($env:SESSION_SECRET)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $env:SESSION_SECRET = [Convert]::ToHexString($bytes).ToLower()
}

Set-Location $projectRoot
docker compose up --build -d

Write-Host "App started at http://localhost:8001"
