$ErrorActionPreference = "Stop"
$portDir = "src-tauri\target\release\bundle\portable"
if (!(Test-Path $portDir)) { New-Item -ItemType Directory -Path $portDir -Force }
$tempFolder = "D:\tmp\cytocount_portable_pkg"
if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

Copy-Item "src-tauri\target\release\viacell.exe" -Destination $tempFolder -Force
if (Test-Path "src-tauri\binaries\viacell-backend-x86_64-pc-windows-msvc.exe") {
    Copy-Item "src-tauri\binaries\viacell-backend-x86_64-pc-windows-msvc.exe" -Destination "$tempFolder\viacell-backend.exe" -Force
} else {
    Copy-Item "src-tauri\target\release\viacell-backend.exe" -Destination $tempFolder -Force
}

$zipPath = Join-Path $portDir "CytoCount_1.3.1_x64_Portable.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $tempFolder

$item = Get-Item $zipPath
[PSCustomObject]@{
    Name = $item.Name
    SizeMB = [math]::Round($item.Length / 1MB, 2)
    LastWriteTime = $item.LastWriteTime
}
