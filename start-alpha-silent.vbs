' Run start-alpha.bat silently (no console window popping up)
' Used by Task Scheduler so it doesn't show terminal on boot
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c start-alpha.bat", 0, False
