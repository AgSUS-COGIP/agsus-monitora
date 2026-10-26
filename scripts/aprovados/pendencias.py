"""
PENDÊNCIAS DO EDITAL (job Python)

Detecta, nas listas de aprovados vigentes, o que o gestor do edital precisa decidir — Contratado
com duas matrículas, Contratado em duas listas que a regra não decide, pessoa repetida, posição
repetida e Convocado sem desfecho — e grava o instantâneo TB_PENDENCIA_APROVADO (migration
20261026190000). A regra está em python/monitora/aprovados/pendencias.py; quem decide é o gestor,
na tela Lista de aprovados › Pendências, pelas RPCs que marcam a pendência resolvida na hora.

Lê pela RPC pendencias_ler_aprovados e grava pela gravar_pendencias_do_edital (as duas só
service_role; a de gravação só valida e guarda: abre as novas, reabre a resolvida que voltou, mantém
o empate confirmado e dá como saneada a aberta que sumiu da lista).

Roda pelo GitHub Actions, no mesmo workflow do "Contratado em outra lista"
(.github/workflows/contratacao-dos-aprovados.yml), logo depois dele: pedido pelo banco depois de uma
mudança que envolve Contratado ou de uma lista nova, antes das conferências diárias e pelo "Run
workflow". Guia: docs/python-no-monitora.md.

Uso
  python scripts/aprovados/pendencias.py --seco
      só lê e detecta; imprime por área e tipo quantas pendências há e o que mudaria; não grava
  python scripts/aprovados/pendencias.py [--disparado-por agenda|<uuid>] [--dias-convocado 15]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; CONFERENCIA_DIAS_CONVOCADO (opcional, 1 a 365,
padrão 15: a mesma da conferência "Convocado há muitos dias sem desfecho"). O log é público: só
contagens, áreas e tipos.

Saída: 0 concluída; 1 erro; 3 entrada inválida.
"""

import os
import pathlib
import sys

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import config, execucao, supabase_rpc  # noqa: E402
from monitora.aprovados import pendencias  # noqa: E402
from monitora.fuso import hoje_em_brasilia  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Pendências do edital → MONITORA"
ROTULOS = {
    pendencias.DUAS_MATRICULAS: "duas matrículas",
    pendencias.DUAS_LISTAS: "duas listas",
    pendencias.PESSOA_REPETIDA: "pessoa repetida",
    pendencias.POSICAO_REPETIDA: "posição repetida",
    pendencias.CONVOCADO_SEM_DESFECHO: "convocado sem desfecho",
}
log = registro("pendencias-do-edital")


def argumentos(lista=None):
    p = execucao.Argumentos(description=TITULO)
    p.add_argument("--seco", action="store_true", help="só lê e detecta; não grava")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    p.add_argument("--dias-convocado", type=int, default=None, help="dias de Convocado sem desfecho (1 a 365)")
    args = p.parse_args(lista)
    if args.dias_convocado is None:
        args.dias_convocado = config.inteiro("CONFERENCIA_DIAS_CONVOCADO", padrao=15, minimo=1, maximo=365)
    if not 1 <= args.dias_convocado <= 365:
        p.error("dias de convocado fora de 1 a 365")
    return args


def ler(chamar):
    dados = chamar("pendencias_ler_aprovados", {}) or {}
    if dados.get("schema_version") != 1:
        raise ValueError("pendencias_ler_aprovados: versão do formato desconhecida")
    return dados


def linhas_do_resumo(detectadas, existentes):
    """Por área: quantas de cada tipo; no fim, o total e o que a gravação faria."""
    saida = []
    total = dict.fromkeys(pendencias.TIPOS, 0)
    for area, contagem in pendencias.resumo_por_area(detectadas).items():
        for tipo, n in contagem.items():
            total[tipo] += n
        partes = " · ".join(f"{ROTULOS[t]} {n}" for t, n in contagem.items())
        saida.append(f"{area}: {sum(contagem.values())} pendência(s) · {partes}")
    saida.append(
        f"Total: {len(detectadas)} pendência(s) · " + " · ".join(f"{ROTULOS[t]} {n}" for t, n in total.items())
    )
    mudanca = pendencias.comparar(detectadas, existentes)
    saida.append(
        "Instantâneo: "
        + " · ".join(f"{k} {mudanca[k]}" for k in ("novas", "mantidas", "reabertas", "permanentes", "saneadas"))
    )
    return saida


def principal(args, configuracao=None, chamar_rpc=None, hoje=None):
    cfg = supabase_rpc.configuracao("docs/python-no-monitora.md") if configuracao is None else configuracao
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    dados = ler(chamar)
    detectadas = pendencias.detectar(dados, hoje or hoje_em_brasilia(), args.dias_convocado)
    resumo = linhas_do_resumo(detectadas, dados.get("pendencias"))
    if args.seco:
        execucao.resumir(TITULO, ["Modo seco: nada foi gravado.", *resumo])
        return execucao.CONCLUIDA

    tipo, _usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="pend")
    gravar = [{k: p[k] for k in ("tipo", "edital", "chave", "candidatos", "detalhe")} for p in detectadas]
    r = (
        chamar(
            "gravar_pendencias_do_edital",
            {"p_execucao": id_execucao, "p_lido_em": dados.get("lido_em"), "p_pendencias": gravar},
            # Sem repetir: a primeira tentativa pode ter gravado e só a resposta se perdido.
            tentativas=1,
        )
        or {}
    )
    execucao.resumir(
        TITULO,
        [
            f"Execução {id_execucao} (disparo {tipo.lower()}): novas {r.get('novas', 0)} · mantidas "
            f"{r.get('mantidas', 0)} · reabertas {r.get('reabertas', 0)} · permanentes {r.get('permanentes', 0)} · "
            f"saneadas {r.get('saneadas', 0)}.",
            *resumo,
        ],
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
