' Auto-Sync Dashboard CJB - Silent Launcher
' ==========================================
' Este script ejecuta auto-sync.js de forma completamente oculta
' sin mostrar ninguna ventana.

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Obtener la carpeta donde está este script
scriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Ejecutar node auto-sync.js de forma oculta (0 = ventana oculta)
WshShell.Run "node """ & scriptPath & "\auto-sync.js""", 0, False

' El script ahora está corriendo en segundo plano
