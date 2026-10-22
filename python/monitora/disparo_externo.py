"""
Registro, no MONITORA, das execuções iniciadas direto no GitHub.

Os robôs pedidos pelo banco (agenda do pg_cron, "Rodar agora" da tela, SQL
direto) já ficam em TL_DISPARO_ROBO na hora do pedido. Quem clica "Run
workflow" na aba Actions (ou roda `gh workflow run`) não passa pelo banco:
sem este passo, a execução não aparecia no "Status das atualizações". O
primeiro passo de cada workflow da lista fixa chama este módulo, que grava a
execução pela RPC registrar_disparo_externo (migration
20261020170000_inscricoes_congeladas.sql; leitura-de-arquivos.yml desde a
20261022120000_robos_mais_robustos.sql): origem GITHUB, o ator
(github.triggering_actor), o endereço da execução e um resumo curto dos inputs
(modo, editais, vagas — nunca candidatos nem token).

Nunca derruba o workflow: qualquer falha vira um aviso (::warning::) e a saída
é sempre 0. Pula quando o disparo veio do banco (disparado_por = id do
usuário, AGENDA, manual) ou do fim do robô (robo).

    PYTHONPATH=python python -m monitora.disparo_externo robo-empregare.yml

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DISPARADO_POR, ATOR_GITHUB
(github.triggering_actor), GITHUB_SERVER_URL/GITHUB_REPOSITORY/GITHUB_RUN_ID
(do próprio Actions) e, para o resumo, MODO, EDITAIS, VAGAS, LIMITE.
"""

import os
import re
import sys

from monitora import supabase_rpc
from monitora.execucao import url_da_execucao
from monitora.mascaramento import mascarar, resumo_do_erro

RPC = "registrar_disparo_externo"
WORKFLOWS = (
    "sincronizar-entrevistas.yml",
    "sincronizar-selecao.yml",
    "conferencias.yml",
    "robo-empregare.yml",
    "pre-classificacao.yml",
    "leitura-de-arquivos.yml",
)
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_JA_REGISTRADOS = {"agenda", "manual", "robo"}


def veio_do_banco(disparado_por):
    """O disparo já está em TL_DISPARO_ROBO (pedido pelo banco) ou é o passo do fim do robô?"""
    v = str(disparado_por or "").strip()
    return v.lower() in _JA_REGISTRADOS or bool(_UUID.fullmatch(v))


def resumo(ambiente):
    """'modo normal · editais 114/2026 · vagas 2 · limite 60' — só o que já sai no log público."""
    partes = []
    modo = str(ambiente.get("MODO") or "").strip()
    if modo:
        partes.append(f"modo {modo}")
    editais = [e for e in re.split(r"[\s,;]+", str(ambiente.get("EDITAIS") or "")) if e]
    if editais:
        partes.append("editais " + ", ".join(editais[:10]) + (f" (+{len(editais) - 10})" if len(editais) > 10 else ""))
    vagas = [v for v in re.split(r"[\s,;]+", str(ambiente.get("VAGAS") or "")) if v]
    if vagas:
        partes.append(f"{len(vagas)} vaga(s)")
    limite = str(ambiente.get("LIMITE") or "").strip()
    if limite and modo not in ("", "anexos"):
        partes.append(f"limite {limite}")
    if str(ambiente.get("FORCAR_CONGELADO") or "").strip():
        partes.append("forçar edital congelado")
    return mascarar(" · ".join(partes))[:300] or None


def registrar(workflow, ambiente=None, chamar=None, configuracao=None, imprimir=print):
    """
    Registra a execução; devolve o CO_DISPARO, ou None quando pulou ou falhou
    (com um aviso no log). Nunca levanta exceção.
    """
    a = os.environ if ambiente is None else ambiente
    try:
        if workflow not in WORKFLOWS:
            imprimir(f"::warning::Registro da execução: workflow fora da lista ({mascarar(str(workflow))[:60]}).")
            return None
        if veio_do_banco(a.get("DISPARADO_POR")):
            imprimir("Execução pedida pelo MONITORA: já registrada no banco.")
            return None
        url = url_da_execucao(a)
        if not url:
            imprimir("Fora do GitHub Actions: nada a registrar.")
            return None
        config = (configuracao or supabase_rpc.configuracao)(ambiente=a)
        chamar = chamar or supabase_rpc.chamar
        disparo = chamar(
            config,
            RPC,
            {"p_workflow": workflow, "p_ator": a.get("ATOR_GITHUB") or None, "p_url": url, "p_resumo": resumo(a)},
            # Uma tentativa: o registro não pode atrasar o robô (e a RPC já é idempotente pelo endereço).
            tentativas=1,
        )
        imprimir(f"Execução registrada no MONITORA (Status das atualizações, disparo {disparo}).")
        return disparo
    except Exception as erro:  # noqa: BLE001 — o registro nunca derruba o robô
        status = getattr(erro, "status", None)
        motivo = (
            "o banco ainda não tem registrar_disparo_externo (migration 20261020170000)"
            if status == 404
            else mascarar(resumo_do_erro(erro))[:200]
        )
        imprimir(f"::warning::Execução NÃO registrada no MONITORA ({motivo}); o robô segue.")
        return None


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    registrar(argv[0] if argv else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
