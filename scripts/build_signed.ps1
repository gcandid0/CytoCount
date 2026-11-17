$ErrorActionPreference = "Stop"
$keyFile = Join-Path $PSScriptRoot "..\cytocount.key"
if (Test-Path $keyFile) {
    $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $keyFile -Raw).Trim()
    Write-Host "Chave de assinatura privada carregada."
} else {
    Write-Warning "Arquivo de chave privada não encontrado em $keyFile"
}

$env:TEMP = "D:\tmp"
$env:TMP = "D:\tmp"

npx tauri build
