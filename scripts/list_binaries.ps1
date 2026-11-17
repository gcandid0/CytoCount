Get-Item src-tauri\target\release\viacell.exe,
         src-tauri\target\release\bundle\nsis\CytoCount_1.2.0_x64-setup.exe,
         src-tauri\target\release\bundle\msi\CytoCount_1.2.0_x64_en-US.msi,
         src-tauri\target\release\bundle\portable\CytoCount_1.2.0_x64_Portable.zip |
ForEach-Object {
    [PSCustomObject]@{
        Arquivo = $_.Name
        TamanhoMB = [math]::Round($_.Length / 1MB, 2)
        DataModificacao = $_.LastWriteTime
        Caminho = $_.FullName
    }
} | Format-Table -AutoSize
