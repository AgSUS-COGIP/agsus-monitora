' ---------------------------------------------------------------------------
' Sobe o servico da Aya sem abrir janela.
'
' POR QUE ESTE ARQUIVO EXISTE
' A tarefa agendada chamava o node diretamente, e o Windows abria um console
' preto a cada logon. Num servico que roda o dia inteiro, isso e uma janela que
' o usuario fecha sem querer — derrubando a Aya junto.
'
' O Windows nao oferece um node sem janela. O caminho padrao e este: o wscript
' inicia o processo com estilo de janela 0, que e oculto de verdade, sem o
' piscar que solucoes com powershell deixam na tela.
'
' A saida nao se perde: vai para um arquivo de log, que e onde se diagnostica
' um servico que ninguem esta vendo.
'
' USO
'   wscript.exe //B "scripts\aya-servico-oculto.vbs"
' ---------------------------------------------------------------------------

Option Explicit

Dim fso, shell, pastaScripts, repo, pastaLog, arquivoLog, comando
Const LIMITE_LOG_BYTES = 5242880  ' 5 MB

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

pastaScripts = fso.GetParentFolderName(WScript.ScriptFullName)
repo = fso.GetParentFolderName(pastaScripts)

pastaLog = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\AgSUS-MONITORA"
If Not fso.FolderExists(pastaLog) Then fso.CreateFolder(pastaLog)
arquivoLog = pastaLog & "\aya-servico.log"

' Log de servico cresce para sempre se ninguem cuidar. Acima do limite,
' recomeca: o que importa para diagnostico e o episodio atual.
If fso.FileExists(arquivoLog) Then
  If fso.GetFile(arquivoLog).Size > LIMITE_LOG_BYTES Then
    fso.DeleteFile arquivoLog, True
  End If
End If

comando = "cmd /c cd /d """ & repo & """ && node ""scripts\aya-servico.mjs"" >> """ & arquivoLog & """ 2>&1"

' 0 = janela oculta. False = nao espera o processo terminar.
shell.Run comando, 0, False
