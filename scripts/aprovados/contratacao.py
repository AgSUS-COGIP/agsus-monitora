"""
CONTRATADO EM OUTRA LISTA (job Python)

Quando a mesma matrícula está Contratado em duas ou mais linhas do mesmo edital (a lista da
ampla e a da cota), decide qual é a contratação e grava a situação efetiva das outras —
"Contratado em outra lista" — no instantâneo TB_CONTRATACAO_APROVADO (migration
20261024120000). Não muda o status gravado de nenhum aprovado. A regra (versão 1, congelada
depois da primeira decisão) está em python/monitora/aprovados/contratacao.py.

Lê pela RPC contratacao_ler_aprovados e grava pela gravar_contratacao_dos_aprovados (as duas
só service_role; a de gravação só valida e guarda, e recalcula os contratados dos editais
tocados). KPIs, Visão geral, Seleção, marcos, pacote da Lista de aprovados e conferência leem
o instantâneo.

Roda pelo GitHub Actions (.github/workflows/contratacao-dos-aprovados.yml): pedido pelo banco
depois de uma mudança que envolve Contratado ou de uma lista nova (importação ou publicação),
antes das conferências diárias (conferencias.yml chama este workflow primeiro) e pelo "Run
workflow". Guia: docs/python-no-monitora.md.

Uso
  python scripts/aprovados/contratacao.py --seco
      só lê e decide; imprime por área quantos casos a regra resolve, quantos ficam ambíguos e
      quanto muda o número de contratados; não grava nada
  python scripts/aprovados/contratacao.py [--disparado-por agenda|<uuid>]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. O log é público: só contagens e áreas.

Saída: 0 concluída; 1 erro; 3 entrada inválida.
"""

import os
import pathlib
import sys
from collections import Counter, defaultdict

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.aprovados import contratacao  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Contratado em outra lista → MONITORA"
TAMANHO_DO_LOTE = 500
log = registro("contratacao-dos-aprovados")


def argumentos(lista=None):
    p = execucao.Argumentos(description=TITULO)
    p.add_argument("--seco", action="store_true", help="só lê e decide; não grava")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    return p.parse_args(lista)


def ler(chamar):
    dados = chamar("contratacao_ler_aprovados", {}) or {}
    if dados.get("schema_version") != 1:
        raise ValueError("contratacao_ler_aprovados: versão do formato desconhecida")
    return dados.get("linhas") or [], dados.get("instantaneo") or []


def linhas_do_resumo(linhas, instantaneo, resultado):
    """Por área: casos (resolvidos e ambíguos) e contratados antes → depois."""
    por_area = defaultdict(Counter)
    for g in resultado["grupos"]:
        por_area[g["area"] or "sem área"][g["acao"]] += 1
    antes = contratacao.contratados_por_area(linhas, contratacao.outra_lista_efetiva(instantaneo, linhas))
    depois_inst = contratacao.instantaneo_depois(instantaneo, resultado)
    depois = contratacao.contratados_por_area(linhas, contratacao.outra_lista_efetiva(depois_inst, linhas))
    areas = sorted(set(por_area) | set(antes) | set(depois))
    total = Counter()
    saida = []
    for area in areas:
        c = por_area[area]
        resolvidos = c["MANTIDA"] + c["NOVA"] + c["HERDADA"]
        total.update(c)
        if not c and antes.get(area, 0) == depois.get(area, 0):
            continue
        saida.append(
            f"{area}: {resolvidos + c['AMBIGUA']} caso(s) · resolvidos {resolvidos} (novos {c['NOVA']}, mantidos "
            f"{c['MANTIDA']}, herdados {c['HERDADA']}) · ambíguos {c['AMBIGUA']} · contratados "
            f"{antes.get(area, 0)} → {depois.get(area, 0)}"
        )
    motivos = Counter(g.get("motivo") for g in resultado["grupos"] if g["acao"] != "MANTIDA")
    saida.append(
        f"Total: {len(resultado['grupos'])} caso(s) · ambíguos {total['AMBIGUA']} · contratados "
        f"{sum(antes.values())} → {sum(depois.values())}"
    )
    if motivos:
        saida.append("Motivos (casos decididos agora): " + " · ".join(f"{m} {n}" for m, n in sorted(motivos.items())))
    saida.append(f"Registros a gravar: {len(resultado['gravar'])} · a remover: {len(resultado['remover'])}")
    return saida


def lotes(decisoes, tamanho=TAMANHO_DO_LOTE):
    """Lotes de até `tamanho` decisões; um grupo (edital + vínculo) nunca se parte."""
    grupos = {}
    for d in decisoes:
        grupos.setdefault((d["edital"], d["vinculo"]), []).append(d)
    lote = []
    for grupo in grupos.values():
        if lote and len(lote) + len(grupo) > tamanho:
            yield lote
            lote = []
        lote.extend(grupo)
    if lote:
        yield lote


def principal(args, configuracao=None, chamar_rpc=None):
    cfg = supabase_rpc.configuracao("docs/python-no-monitora.md") if configuracao is None else configuracao
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    linhas, instantaneo = ler(chamar)
    resultado = contratacao.decidir(linhas, instantaneo)
    resumo = linhas_do_resumo(linhas, instantaneo, resultado)
    if args.seco:
        execucao.resumir(TITULO, ["Modo seco: nada foi gravado.", *resumo])
        return execucao.CONCLUIDA

    tipo, _usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="contr")
    gravadas = removidas = 0
    # A remoção vai sozinha na primeira chamada; as decisões, em lotes.
    pedidos = [([], resultado["remover"])] if resultado["remover"] else []
    pedidos += [(lote, []) for lote in lotes(resultado["gravar"])]
    for decisoes, remover in pedidos:
        r = (
            chamar(
                "gravar_contratacao_dos_aprovados",
                {"p_execucao": id_execucao, "p_decisoes": decisoes, "p_remover": remover},
                # Sem repetir: a primeira tentativa pode ter gravado e só a resposta se perdido.
                tentativas=1,
            )
            or {}
        )
        gravadas += int(r.get("gravadas") or 0)
        removidas += int(r.get("removidas") or 0)
    execucao.resumir(
        TITULO,
        [f"Execução {id_execucao} (disparo {tipo.lower()}): gravados {gravadas} · removidos {removidas}.", *resumo],
    )
    return execucao.CONCLUIDA


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
