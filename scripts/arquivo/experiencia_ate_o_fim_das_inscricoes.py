"""
CORREÇÃO: EXPERIÊNCIA ATÉ O FIM DAS INSCRIÇÕES (fichas concluídas de um edital)

Decisão de 22/10/2026, com a data de 14/10/2026 confirmada pela coordenação para o edital
114/2026: a experiência conta até o fim das inscrições. Fichas concluídas com vínculo aceito
depois dessa data gravaram dias a mais na experiência (DS_RESULTADO.experiencia), que vai para
o desempate e para o painel. Este script recalcula SÓ a experiência dessas fichas, com o corte
na data limite, pela conta de python/monitora/avaliacao_documental/pontuacao.py (a mesma da
tela e do banco). A nota e o resultado não mudam. A ficha em que a pontuação dos vínculos
mudaria com o corte NÃO é corrigida: aparece na lista, e o job de conferências a manda para
revisão.

    # Relatório, sem gravar (lê pela RPC conferencia_ler_fichas, service_role):
    python scripts/arquivo/experiencia_ate_o_fim_das_inscricoes.py --edital <uuid> --data-limite 2026-10-14 --seco
    # Relatório a partir de um arquivo com as páginas de conferencia_ler_fichas (sem chave nenhuma):
    python scripts/arquivo/experiencia_ate_o_fim_das_inscricoes.py --edital <uuid> --data-limite 2026-10-14 \
        --seco --de-arquivo fichas.json
    # Correção (depois da migration 20261023090000 aplicada):
    python scripts/arquivo/experiencia_ate_o_fim_das_inscricoes.py --edital <uuid> --data-limite 2026-10-14

A gravação é ficha a ficha pela RPC corrigir_experiencia_da_ficha (service_role), que confere de
novo no banco a experiência enviada e a pontuação, grava o histórico (TP_ACAO 'CORRIGIR') com a
conta do setor (Gestão da Informação de Pessoal) e republica a linha do painel. Roda na máquina
de quem opera, com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (nunca no repositório),
uma vez só. A saída não tem dado pessoal: só o id da ficha e os dias.

Saída: 0 ok; 1 erro; 2 alguma ficha não foi corrigida pelo banco; 3 entrada inválida.
"""

import argparse
import datetime
import json
import pathlib
import sys

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import supabase_rpc  # noqa: E402
from monitora.avaliacao_documental.pontuacao import apurar_experiencia, normalizar_regra, regra_da_vaga  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402

TITULO = "Correção: experiência até o fim das inscrições"
# Gestão da Informação de Pessoal (a conta do setor que assina as correções de dados).
CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43"
MOTIVO = "Correção de dados: experiência contada até o fim das inscrições ({data}); nota e resultado não mudam."
TAMANHO_DA_PAGINA = 500


def argumentos(lista=None):
    p = argparse.ArgumentParser(description=TITULO)
    p.add_argument("--edital", required=True, help="id (uuid) do edital")
    p.add_argument("--data-limite", required=True, help="AAAA-MM-DD: o fim das inscrições confirmado")
    p.add_argument("--seco", action="store_true", help="só o relatório; não grava")
    p.add_argument("--de-arquivo", help="JSON com as páginas de conferencia_ler_fichas (só com --seco)")
    args = p.parse_args(lista)
    try:
        datetime.date.fromisoformat(args.data_limite)
    except ValueError:
        p.error("data limite em AAAA-MM-DD")
    if args.de_arquivo and not args.seco:
        p.error("--de-arquivo só com --seco")
    return args


def paginas_do_banco(chamar):
    apos = None
    while True:
        pagina = chamar("conferencia_ler_fichas", {"p_apos": apos, "p_limite": TAMANHO_DA_PAGINA}) or {}
        yield pagina
        proximo = pagina.get("proximo")
        if not proximo or proximo == apos:
            return
        apos = proximo


def bloco_de_vinculos(regra, lancamento, data_limite):
    """O bloco de vínculos da regra da vaga, com a data limite (a da regra, se houver; senão, a informada)."""
    regra = regra_da_vaga(normalizar_regra(regra), lancamento)
    blocos = [b for b in regra["blocos"] if isinstance(b, dict) and b.get("tipo") == "VINCULOS"]
    if not blocos:
        return None
    bloco = blocos[-1]
    return bloco if bloco.get("data_limite") else {**bloco, "data_limite": data_limite}


def avaliar_fichas(paginas, edital, data_limite):
    """[{ficha, versao, dias_antes, dias_depois, pontos_antes, pontos_depois, experiencia, corrige}]."""
    saida = []
    for pagina in paginas:
        pagina = pagina or {}
        regras = {(r.get("regra"), r.get("versao")): r.get("configuracao") for r in pagina.get("regras") or []}
        for f in pagina.get("linhas") or []:
            if f.get("edital") != edital:
                continue
            resultado = f.get("resultado") if isinstance(f.get("resultado"), dict) else {}
            gravada = resultado.get("experiencia") if isinstance(resultado.get("experiencia"), dict) else None
            regra = regras.get((f.get("regra"), f.get("versao_regra")))
            lancamento = f.get("lancamento") if isinstance(f.get("lancamento"), dict) else {}
            if not gravada or not isinstance(regra, dict):
                continue
            bloco = bloco_de_vinculos(regra, lancamento, data_limite)
            if bloco is None:
                continue
            nova = apurar_experiencia(bloco, lancamento)
            if nova["dias_total"] == gravada.get("dias_total"):
                continue
            pontos_antes = (resultado.get("calculados") or {}).get("EXPERIENCIA")
            saida.append(
                {
                    "ficha": f.get("ficha"),
                    "versao": f.get("versao"),
                    "dias_antes": gravada.get("dias_total"),
                    "dias_depois": nova["dias_total"],
                    "pontos_antes": pontos_antes,
                    "pontos_depois": nova["pontos"],
                    "experiencia": {
                        "dias_total": nova["dias_total"],
                        "meses": nova["meses"],
                        "meses_considerados": nova["meses_considerados"],
                    },
                    "corrige": pontos_antes is not None and abs(float(pontos_antes) - float(nova["pontos"])) < 1e-4,
                }
            )
    return saida


def relatorio(fichas):
    corrigir = [f for f in fichas if f["corrige"]]
    mudaria = [f for f in fichas if not f["corrige"]]
    linhas = [
        f"Fichas concluídas com dias depois da data limite: {len(fichas)}.",
        f"A corrigir (pontuação igual, nota e resultado não mudam): {len(corrigir)}"
        f" · dias cortados: {sum(f['dias_antes'] - f['dias_depois'] for f in corrigir)}.",
        f"Pontuação mudaria (não corrigidas, vão para revisão): {len(mudaria)}.",
    ]
    for f in fichas:
        linhas.append(
            f"- {f['ficha']}: {f['dias_antes']} → {f['dias_depois']} dias"
            + ("" if f["corrige"] else f" · pontos {f['pontos_antes']} → {f['pontos_depois']} (não corrigida)")
        )
    return linhas


def principal(args, configuracao=None, chamar_rpc=None, imprimir=print):
    if args.de_arquivo:
        dados = json.loads(pathlib.Path(args.de_arquivo).read_text(encoding="utf-8"))
        paginas = dados if isinstance(dados, list) else [dados]
        chamar = None
    else:
        cfg = configuracao or supabase_rpc.configuracao("scripts/arquivo/experiencia_ate_o_fim_das_inscricoes.py")
        chamar_rpc = chamar_rpc or supabase_rpc.chamar

        def chamar(funcao, corpo, **opcoes):
            return chamar_rpc(cfg, funcao, corpo, **opcoes)

        paginas = paginas_do_banco(chamar)
    fichas = avaliar_fichas(paginas, args.edital, args.data_limite)
    linhas = relatorio(fichas)
    if args.seco:
        imprimir("\n".join([f"{TITULO} — modo seco: nada foi gravado.", *linhas]))
        return 0
    recusadas = 0
    data = datetime.date.fromisoformat(args.data_limite).strftime("%d/%m/%Y")
    for f in (f for f in fichas if f["corrige"]):
        try:
            chamar(
                "corrigir_experiencia_da_ficha",
                {
                    "p_ficha": f["ficha"],
                    "p_versao": f["versao"],
                    "p_experiencia": f["experiencia"],
                    "p_motivo": MOTIVO.format(data=data),
                    "p_usuario": CONTA_DO_SETOR,
                },
                # Sem repetir: a 2ª tentativa esbarraria na versão que a 1ª já subiu.
                tentativas=1,
            )
        except Exception as erro:  # a recusa de uma ficha não para as outras
            recusadas += 1
            linhas.append(f"! {f['ficha']} não corrigida: {resumo_do_erro(erro)[:200]}")
    imprimir("\n".join([TITULO, *linhas, f"Recusadas pelo banco: {recusadas}."]))
    return 2 if recusadas else 0


def main(lista=None):
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    try:
        return principal(argumentos(lista))
    except SystemExit as saida:
        return 3 if saida.code else 0
    except Exception as erro:
        print(f"Erro: {resumo_do_erro(erro)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
