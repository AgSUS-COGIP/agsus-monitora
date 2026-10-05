"""
Dados de uma execução de job no GitHub Actions, comuns a todos os jobs:
quem disparou (agenda, "Rodar agora" do MONITORA ou "Run workflow" do
GitHub), o identificador da execução, o endereço dela no GitHub e o resumo
que aparece na página da execução (GITHUB_STEP_SUMMARY).

O "Rodar agora" (api/rodar-carga.js) manda `disparado_por` = id do usuário;
a agenda manda "agenda"; em branco = alguém clicou "Run workflow" no GitHub.
"""

import os
import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from monitora.mascaramento import mascarar

FUSO = ZoneInfo("America/Sao_Paulo")
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def disparo(valor):
    """('AGENDA'|'MONITORA'|'GITHUB', uuid do usuário ou None)."""
    v = str(valor or "").strip()
    if v.lower() == "agenda":
        return "AGENDA", None
    if _UUID.fullmatch(v):
        return "MONITORA", v.lower()
    return "GITHUB", None


def identificador(agora=None, sufixo=None, prefixo="gh"):
    """Identificador da execução: <prefixo>-AAAAMMDDTHHMMSS-<8 hex> (hora de Brasília)."""
    agora = agora or datetime.now(FUSO)
    return f"{prefixo}-{agora:%Y%m%dT%H%M%S}-{(sufixo or uuid.uuid4().hex)[:8]}"


def url_da_execucao(ambiente=None):
    """Endereço da execução no GitHub Actions; None fora do GitHub."""
    a = os.environ if ambiente is None else ambiente
    servidor, repositorio, execucao = (
        a.get(n, "") for n in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID")
    )
    if servidor == "https://github.com" and repositorio and execucao.isdigit():
        return f"{servidor}/{repositorio}/actions/runs/{execucao}"
    return None


def resumir(titulo, linhas, ambiente=None, imprimir=print):
    """Resumo mascarado no log e, no GitHub Actions, na página da execução."""
    a = os.environ if ambiente is None else ambiente
    texto = "\n".join([f"## {titulo}", ""] + [f"- {mascarar(linha)}" for linha in linhas])
    imprimir(texto, flush=True)
    if a.get("GITHUB_STEP_SUMMARY"):
        with open(a["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as saida:
            saida.write(texto + "\n")
    return texto
