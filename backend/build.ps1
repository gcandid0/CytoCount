# PowerShell script para compilar o backend no Windows
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Localiza o executável do Python
$pythonExe = $null
if (Test-Path "..\.venv\Scripts\python.exe") {
    $pythonExe = (Resolve-Path "..\.venv\Scripts\python.exe").Path
} elseif (Test-Path ".\.venv\Scripts\python.exe") {
    $pythonExe = (Resolve-Path ".\.venv\Scripts\python.exe").Path
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
} else {
    Write-Error "Python não foi encontrado! Instale o Python ou ative um ambiente virtual."
}

Write-Host "Usando Python em: $pythonExe"

# 2. Instala / valida dependências
Write-Host "Verificando dependências..."
& $pythonExe -m pip install -r requirements.txt

# 3. Compila com PyInstaller usando a spec
Write-Host "Compilando backend com PyInstaller..."
& $pythonExe -m PyInstaller --noconfirm viacell-backend.spec

# 4. Descobre o target triple do Rust
$rustcVv = rustc -Vv
$triple = ($rustcVv | Select-String "host:").Line.Split(":")[1].Trim()
Write-Host "Rust target triple identificado: $triple"

$destDir = "..\src-tauri\binaries"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$destExe = Join-Path $destDir "viacell-backend-$triple.exe"
Copy-Item "dist\viacell-backend.exe" $destExe -Force

$fileInfo = Get-Item $destExe
$sizeMb = [math]::Round($fileInfo.Length / 1MB, 2)
Write-Host "Sucesso! Sidecar gerado em: $destExe ($sizeMb MB)" -ForegroundColor Green
