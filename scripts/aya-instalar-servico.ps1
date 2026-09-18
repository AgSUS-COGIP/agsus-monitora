<#
  Instala o serviço da Aya para subir sozinho com o Windows.

  POR QUE
  Ollama sobe com o Windows por conta própria, mas o bridge e o túnel não. A
  cada reinício da máquina eles ficavam de fora, e a Aya perdia a IA até alguém
  subir tudo de novo à mão.

  O QUE FAZ
  Registra uma tarefa agendada que executa `scripts/aya-servico.mjs` no logon do
  usuário atual. Esse script sobe o bridge, sobe o túnel, anuncia o endereço no
  banco e reinicia o que cair.

  Roda como o usuário atual, sem privilégio de administrador e sem senha
  guardada. Por isso a tarefa dispara no logon, e não no boot: não há como rodar
  antes de alguém entrar sem armazenar credencial, e guardar credencial seria
  pior do que o problema que estamos resolvendo.

  USO
    powershell -ExecutionPolicy Bypass -File scripts\aya-instalar-servico.ps1
    powershell -ExecutionPolicy Bypass -File scripts\aya-instalar-servico.ps1 -Remover
#>

[CmdletBinding()]
param(
    [switch]$Remover
)

$ErrorActionPreference = "Stop"
$nomeTarefa = "AgSUS MONITORA - Servico da Aya"

if ($Remover) {
    if (Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $nomeTarefa -Confirm:$false
        Write-Output "Tarefa removida. A Aya nao subira mais sozinha."
    } else {
        Write-Output "Nao havia tarefa registrada."
    }
    return
}

$repo = Split-Path -Parent $PSScriptRoot
$servico = Join-Path $repo "scripts\aya-servico.mjs"
if (-not (Test-Path $servico)) {
    throw "Nao encontrei $servico. Rode a partir do repositorio."
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    throw "Node nao esta no PATH. Instale o Node ou ajuste o PATH antes."
}

# A chave precisa estar persistida no nivel Usuario: a tarefa nao herda o
# ambiente do terminal em que este script rodou.
$chave = [Environment]::GetEnvironmentVariable("AYA_LOCAL_BRIDGE_KEY", "User")
if (-not $chave) {
    throw "AYA_LOCAL_BRIDGE_KEY nao esta no ambiente do Usuario. Defina uma vez com: setx AYA_LOCAL_BRIDGE_KEY `"<chave>`""
}

$acao = New-ScheduledTaskAction -Execute $node -Argument "`"$servico`"" -WorkingDirectory $repo
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Sem limite de duracao: e um servico, nao um lote. E sem exigir energia da
# tomada, senao a tarefa nao sobe quando a maquina esta na bateria.
$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $nomeTarefa `
    -Action $acao `
    -Trigger $gatilho `
    -Settings $config `
    -Description "Sobe o bridge da Aya, o tunel HTTPS e anuncia o endereco no banco." `
    -Force | Out-Null

Write-Output "Tarefa registrada: $nomeTarefa"
Write-Output "Ela roda no logon de $env:USERNAME."
Write-Output ""
Write-Output "Para iniciar agora, sem reiniciar:"
Write-Output "  Start-ScheduledTask -TaskName `"$nomeTarefa`""
