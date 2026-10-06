"""
CONFERÊNCIAS DE CONSISTÊNCIA DO MONITORA (job Python, só leitura)

Lê o banco pelas RPCs de leitura (conferencia_ler_*, só service_role), confere
regras que atravessam os módulos — Análises, Entrevistas, Classificação, Lista
de aprovados e as cargas da Empregare — e grava AVISOS em
TB_AVISO_CONFERENCIA (supabase/migrations/20261005210000_conferencias_de_consistencia.sql),
com todos os casos de cada um em TB_CASO_AVISO_CONFERENCIA (20261007120000).
Não muda análise, entrevista, lista nem aprovado. As regras estão em regras.py;
o catálogo (código, módulo, gravidade, título), em catalogo.py.

Roda pelo GitHub Actions (.github/workflows/conferencias.yml): todo dia às 6h
de Brasília, pelo "Rodar agora" das Configurações › Status das atualizações
(api/rodar-carga.js) ou pelo "Run workflow". Guia: docs/python-no-monitora.md.

Uso
  python scripts/conferencias/conferencias.py --seco
      só lê e confere; imprime o resumo e não grava nada
  python scripts/conferencias/conferencias.py [--disparado-por agenda|<uuid>] [--dias-convocado 15]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; CONFERENCIA_DIAS_CONVOCADO
(opcional, 1 a 365, padrão 15: "Convocado há mais de N dias sem desfecho").
O log é público (repositório público): só contagens, códigos de conferência e
números de edital; tudo passa por python/monitora/mascaramento.py.

Saída: 0 concluída; 2 parcial (alguma conferência falhou); 1 erro.
"""

import argparse
import os
import pathlib
import sys

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

import regras  # noqa: E402
from catalogo import CATALOGO, MODULOS, do_modulo  # noqa: E402

from monitora import config, execucao, supabase_rpc  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Conferências de consistência → MONITORA"
TAMANHO_DA_PAGINA = 5000
TAMANHO_DO_LOTE = 500
CASOS_POR_LOTE = 20000
log = registro("conferencias")


def argumentos(lista=None):
    p = argparse.ArgumentParser(description=TITULO)
    p.add_argument("--seco", action="store_true", help="só lê e confere; não grava")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    p.add_argument("--dias-convocado", type=int, default=None, help="dias de Convocado sem desfecho (1 a 365)")
    args = p.parse_args(lista)
    if args.dias_convocado is None:
        args.dias_convocado = config.inteiro("CONFERENCIA_DIAS_CONVOCADO", padrao=15, minimo=1, maximo=365)
    if not 1 <= args.dias_convocado <= 365:
        p.error("dias de convocado fora de 1 a 365")
    return args


def paginas_de_analises(chamar):
    """Gera as páginas de conferencia_ler_analises até o fim (cursor pelo id)."""
    apos = None
    while True:
        pagina = chamar("conferencia_ler_analises", {"p_apos": apos, "p_limite": TAMANHO_DA_PAGINA}) or {}
        yield pagina.get("linhas") or []
        proximo = pagina.get("proximo")
        # Cursor que não anda (ou volta igual) encerraria o job só no tempo limite.
        if not proximo or proximo == apos:
            return
        apos = proximo


def lotes(avisos, tamanho=TAMANHO_DO_LOTE, casos_por_lote=CASOS_POR_LOTE):
    """Avisos em lotes de até `tamanho` avisos e `casos_por_lote` casos (um aviso nunca se parte)."""
    lote, casos = [], 0
    for aviso in avisos:
        n = len(aviso.get("casos") or [])
        if lote and (len(lote) >= tamanho or casos + n > casos_por_lote):
            yield lote
            lote, casos = [], 0
        lote.append(aviso)
        casos += n
    if lote:
        yield lote


def conferir(chamar, dias_convocado):
    """Roda os cinco módulos. Devolve (avisos, conferências que rodaram, conferências que falharam)."""
    contexto = chamar("conferencia_ler_contexto", {}) or {}
    editais = {e["id"]: e for e in contexto.get("editais") or []}
    acumulador = regras.Acumulador(editais)
    etapas = {
        "analises": lambda: regras.conferir_analises(paginas_de_analises(chamar), contexto, acumulador),
        "entrevistas": lambda: regras.conferir_entrevistas(
            chamar("conferencia_ler_entrevistas", {}) or {}, contexto, acumulador
        ),
        "classificacao": lambda: regras.conferir_classificacao(
            chamar("conferencia_ler_classificacao", {}) or {}, acumulador
        ),
        "aprovados": lambda: regras.conferir_aprovados(
            chamar("conferencia_ler_aprovados", {}) or {}, contexto, acumulador, dias_convocado
        ),
        "cargas": lambda: regras.conferir_cargas(chamar("conferencia_ler_cargas", {}) or {}, acumulador),
    }
    rodadas, falhas = [], []
    for modulo in MODULOS:
        try:
            etapas[modulo]()
            rodadas += do_modulo(modulo)
            log.info("Módulo %s conferido.", modulo)
        except Exception as erro:
            falhas += do_modulo(modulo)
            log.warning("Módulo %s falhou: %s", modulo, resumo_do_erro(erro))
    avisos = acumulador.avisos(regras.resumir)
    # Aviso de um módulo que falhou no meio não é gravado: a conferência dele não rodou inteira.
    avisos = [a for a in avisos if a["conferencia"] not in falhas]
    return avisos, rodadas, falhas


def linhas_do_resumo(avisos, rodadas, falhas):
    por_modulo = {m: 0 for m in MODULOS}
    por_codigo = {}
    for a in avisos:
        por_modulo[a["modulo"]] += 1
        por_codigo[a["conferencia"]] = por_codigo.get(a["conferencia"], 0) + 1
    linhas = [
        f"Conferências que rodaram: {len(rodadas)} de {len(CATALOGO)}"
        + (f" · falharam: {', '.join(sorted({CATALOGO[c][0] for c in falhas}))}" if falhas else "")
        + ".",
        "Avisos por módulo: " + " · ".join(f"{m} {n}" for m, n in por_modulo.items()) + ".",
    ]
    linhas += [f"{codigo}: {n} aviso(s)" for codigo, n in sorted(por_codigo.items())]
    return linhas


def principal(args, configuracao=None, chamar_rpc=None):
    cfg = configuracao or supabase_rpc.configuracao("docs/python-no-monitora.md")
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    if args.seco:
        avisos, rodadas, falhas = conferir(chamar, args.dias_convocado)
        execucao.resumir(TITULO, ["Modo seco: nada foi gravado."] + linhas_do_resumo(avisos, rodadas, falhas))
        return 2 if falhas else 0

    tipo, usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="conf")
    chamar(
        "iniciar_conferencia",
        {"p_execucao": id_execucao, "p_disparo": tipo, "p_usuario": usuario, "p_url": execucao.url_da_execucao()},
        # Sem repetir: se a resposta se perdeu, a 2ª tentativa esbarraria na execução que a 1ª abriu.
        tentativas=1,
    )
    log.info("Execução %s (disparo %s).", id_execucao, tipo.lower())
    try:
        avisos, rodadas, falhas = conferir(chamar, args.dias_convocado)
        for lote in lotes(avisos):
            chamar("gravar_avisos_conferencia", {"p_execucao": id_execucao, "p_avisos": lote})
    except Exception as erro:
        mensagem = resumo_do_erro(erro)
        try:
            chamar(
                "finalizar_conferencia",
                {"p_execucao": id_execucao, "p_conferencias": [], "p_falhas": [], "p_erro": mensagem},
            )
        except Exception as erro_ao_fechar:
            log.error("Também não consegui fechar a execução: %s", resumo_do_erro(erro_ao_fechar))
        execucao.resumir(TITULO, [f"Execução {id_execucao} FALHOU: {mensagem}"])
        return 1

    fim = (
        chamar(
            "finalizar_conferencia",
            {"p_execucao": id_execucao, "p_conferencias": rodadas, "p_falhas": falhas, "p_erro": None},
        )
        or {}
    )
    situacao = fim.get("situacao", "FALHOU")
    execucao.resumir(
        TITULO,
        [
            f"Execução {id_execucao}: {situacao}.",
            f"Avisos novos ou reabertos: {fim.get('novos', 0)} · abertos: {fim.get('abertos', 0)} · "
            f"resolvidos agora: {fim.get('resolvidos', 0)}.",
        ]
        + linhas_do_resumo(avisos, rodadas, falhas),
    )
    return {"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1)


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
        return 1


if __name__ == "__main__":
    sys.exit(main())
