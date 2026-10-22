"""
Dados de uma execução de job no GitHub Actions, comuns a todos os jobs:
quem disparou (agenda, "Rodar agora" do MONITORA ou "Run workflow" do
GitHub), o identificador da execução, o endereço dela no GitHub e o resumo
que aparece na página da execução (GITHUB_STEP_SUMMARY).

O "Rodar agora" (RPC disparar_robo) manda `disparado_por` = id do usuário;
a agenda manda "agenda"; em branco = alguém clicou "Run workflow" no GitHub.

Códigos de saída, iguais em todos os jobs: 0 concluída; 1 erro; 2 parcial
(alguma parte falhou ou foi recusada); 3 entrada inválida (argumento fora do
formato: `Argumentos` troca o 2 do argparse, que se confundia com o parcial).

Cancelamento e tempo esgotado no GitHub Actions chegam como SIGINT/SIGTERM.
Sem tratar, o processo morria sem fechar a execução no banco, que ficava "em
andamento" até alguém olhar. `interromper_com_excecao()` transforma o sinal em
`ExecucaoInterrompida` (BaseException: passa pelos `except Exception` que
protegem cada vaga ou edital) para o job fechar a execução com erro.
"""

import argparse
import contextlib
import os
import re
import signal
import sys
import uuid
from datetime import datetime

from monitora.fuso import FUSO
from monitora.mascaramento import mascarar

CONCLUIDA, ERRO, PARCIAL, ENTRADA_INVALIDA = 0, 1, 2, 3
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


class Argumentos(argparse.ArgumentParser):
    """ArgumentParser cuja entrada inválida sai com ENTRADA_INVALIDA (3), não com o 2 do parcial."""

    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(ENTRADA_INVALIDA, f"{self.prog}: erro: {message}\n")


class ExecucaoInterrompida(BaseException):
    """O GitHub Actions cancelou a execução ou o tempo do job acabou (SIGINT/SIGTERM)."""


@contextlib.contextmanager
def interromper_com_excecao(sinais=None, instalar=signal.signal):
    """
    Durante o bloco, SIGINT/SIGTERM levantam ExecucaoInterrompida (uma vez só:
    o segundo sinal é ignorado, para o fechamento da execução terminar). Fora
    da thread principal (onde o Python não deixa instalar), não faz nada.
    """
    sinais = sinais or tuple(s for s in (getattr(signal, "SIGTERM", None), signal.SIGINT) if s is not None)
    anteriores = {}

    def ao_receber(numero, _quadro):
        for s in anteriores:
            instalar(s, signal.SIG_IGN)
        try:
            nome = signal.Signals(numero).name
        except ValueError:
            nome = str(numero)
        raise ExecucaoInterrompida(f"execução interrompida ({nome}: cancelada ou sem tempo no GitHub Actions)")

    try:
        for s in sinais:
            anteriores[s] = instalar(s, ao_receber)
    except ValueError:  # fora da thread principal
        pass
    try:
        yield
    finally:
        for s, anterior in anteriores.items():
            instalar(s, anterior if anterior is not None else signal.SIG_DFL)


def saida_do_passo(nome, valor, ambiente=None):
    """Grava `nome=valor` nas saídas do passo do GitHub Actions (GITHUB_OUTPUT); fora dele, nada."""
    a = os.environ if ambiente is None else ambiente
    if a.get("GITHUB_OUTPUT"):
        with open(a["GITHUB_OUTPUT"], "a", encoding="utf-8") as saida:
            saida.write(f"{nome}={valor}\n")
