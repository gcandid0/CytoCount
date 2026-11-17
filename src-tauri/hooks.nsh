!macro NSIS_HOOK_PREINSTALL
  ; Encerra quaisquer processos ativos do CytoCount e do sidecar Python
  ; para evitar bloqueio de arquivos (ACCESS_DENIED) durante a instalacao
  nsExec::Exec 'taskkill /F /IM viacell.exe /T'
  nsExec::Exec 'taskkill /F /IM viacell-backend.exe /T'
  Sleep 500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /IM viacell.exe /T'
  nsExec::Exec 'taskkill /F /IM viacell-backend.exe /T'
  Sleep 500
!macroend
