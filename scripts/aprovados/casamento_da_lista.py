"""
CASAMENTO DA LISTA DE APROVADOS (job Python)

Quando a lista de aprovados de um edital vai ser substituída — pela planilha (XLSX) ou pelo
resultado final da Classificação —, a tela pede a prévia (RPC pedir_casamento_da_lista,
migration 20261030090000) e o banco pede este job. Ele lê o pedido (quem entra, a lista
vigente e as revisões à mão), casa as pessoas com a regra de python/monitora/aprovados/
casamento.py e grava o plano (vínculos e resumo) no instantâneo TB_PEDIDO_CASAMENTO_LISTA.
A tela mostra o plano; ao confirmar, o banco confere e aplica numa transação curta
(aplicar_casamento_da_lista).

Lê pela RPC casamento_ler_pedidos e grava pela gravar_casamento_da_lista (as duas só
service_role; a de gravação só valida e guarda).

Roda pelo GitHub Actions (.github/workflows/casamento-da-lista.yml): pedido pelo banco a cada
prévia (input pedido) e pelo "Run workflow" (sem pedido: todos os pendentes).

Uso
  python scripts/aprovados/casamento_da_lista.py [--pedido <uuid>] [--seco]
      --seco: só lê e casa; imprime as contagens; não grava nada

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. O LOG É PÚBLICO: só contagens (nada de
nome, matrícula ou edital).

Saída: 0 concluída; 1 erro; 2 parcial (algum pedido falhou); 3 entrada inválida.
"""

import os
import pathlib
import re
import sys

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.aprovados import casamento  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Casamento da lista de aprovados → MONITORA"
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
log = registro("casamento-da-lista")


def _pedido(valor):
    v = str(valor or "").strip()
    if v and not _UUID.fullmatch(v):
        raise execucao.argparse.ArgumentTypeError("pedido deve ser um uuid")
    return v.lower() or None


def argumentos(lista=None):
    p = execucao.Argumentos(description=TITULO)
    p.add_argument("--pedido", type=_pedido, default=_pedido(os.environ.get("PEDIDO", "")))
    p.add_argument("--seco", action="store_true", help="só lê e casa; não grava")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    return p.parse_args(lista)


def ler(chamar, pedido):
    dados = chamar("casamento_ler_pedidos", {"p_pedido": pedido}) or {}
    if dados.get("schema_version") != 1:
        raise ValueError("casamento_ler_pedidos: versão do formato desconhecida")
    return dados.get("pedidos") or []


def calcular(pedido):
    return casamento.plano(pedido.get("anteriores") or [], pedido.get("novos") or [], pedido.get("manuais") or {})


def principal(args, configuracao=None, chamar_rpc=None):
    cfg = supabase_rpc.configuracao("docs/python-no-monitora.md") if configuracao is None else configuracao
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    pedidos = ler(chamar, args.pedido)
    tipo, _usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="casam")
    linhas, gravados, falhas = [], 0, 0
    for i, pedido in enumerate(pedidos, start=1):
        try:
            plano = calcular(pedido)
        except Exception as erro:  # um pedido ruim não derruba os outros
            falhas += 1
            log.error("Pedido %d: %s", i, resumo_do_erro(erro))
            if not args.seco:
                chamar(
                    "gravar_casamento_da_lista",
                    {
                        "p_execucao": id_execucao,
                        "p_pedido": pedido["pedido"],
                        "p_plano": None,
                        "p_erro": "O cálculo do casamento falhou; peça a prévia de novo.",
                    },
                    tentativas=1,
                )
            continue
        r = plano["resumo"]
        linhas.append(
            f"Pedido {i}: {len(pedido.get('anteriores') or [])} na lista vigente · {len(pedido.get('novos') or [])} "
            f"na nova · casados {r['casados']} · entram {r['entram']} · sem par {r['sem_par']} · status sem dono "
            f"{r['sem_dono']} · sub judice mantidos {r['sub_judice_mantidos']}"
        )
        if args.seco:
            continue
        chamar(
            "gravar_casamento_da_lista",
            {"p_execucao": id_execucao, "p_pedido": pedido["pedido"], "p_plano": plano, "p_erro": None},
            # Sem repetir: a primeira tentativa pode ter gravado e só a resposta se perdido.
            tentativas=1,
        )
        gravados += 1
    cabeca = (
        "Modo seco: nada foi gravado."
        if args.seco
        else f"Execução {id_execucao} (disparo {tipo.lower()}): {gravados} plano(s) gravado(s), {falhas} falha(s)."
    )
    execucao.resumir(TITULO, [cabeca, f"Pedidos lidos: {len(pedidos)}", *linhas])
    return execucao.PARCIAL if falhas else execucao.CONCLUIDA


def main(lista=None):
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    try:
        return principal(argumentos(lista))
    except SystemExit:
        raise
    except Exception as erro:
        log.error("Erro: %s", resumo_do_erro(erro))
        return execucao.ERRO


if __name__ == "__main__":
    sys.exit(main())
