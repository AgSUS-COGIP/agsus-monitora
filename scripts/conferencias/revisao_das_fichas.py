"""
A ficha CONCLUIDA que passou a ter pendência pela regra vigente vai para Em revisão
(pedido de 22/10/2026: não dar a falsa sensação de finalizado). Faz parte do job de
conferências, que lê as fichas uma vez só (conferencia_ler_fichas, com a regra de cada
versão e a data limite padrão do fim das inscrições).

A conta é a do Python (pontuacao.calcular_avaliacao e pendencias_da_ficha, cópias da
tela). A gravação é ficha a ficha pela RPC revisar_ficha_concluida_com_pendencia
(service_role), que confere de novo no banco (FC_PENDENCIAS_FICHA) e só então muda a
situação para REVISAR, sem mexer em nota nem resultado, com o histórico de origem JOB
("Conferência automática: …"). A pendência de experiência não vale quando outro critério já
elimina (a ficha segue concluída). Respeita a chave "Conferências" de Configurações ›
Automação (python/monitora/chave_da_automacao.py).
"""

from monitora.avaliacao_documental.pendencias_da_ficha import pendencias_da_ficha
from monitora.avaliacao_documental.pontuacao import calcular_avaliacao
from monitora.mascaramento import resumo_do_erro

RPC = "revisar_ficha_concluida_com_pendencia"
CHAVE_DA_AUTOMACAO = "conferencias"


def _objeto(v):
    return v if isinstance(v, dict) else {}


def opcoes_da_ficha(resultado, documental):
    """As mesmas opções da conferência da conta (regras.conferir_fichas)."""
    minima = resultado.get("nota_minima") if "nota_minima" in resultado else documental.get("nota_minima")
    opcoes = {"notaMinima": minima, "cotas": documental.get("cotas")}
    if "nota_minima" not in resultado:
        opcoes["notaMinimaPorNivel"] = documental.get("nota_minima_por_nivel") or {}
    return opcoes


def fichas_com_pendencia(paginas, hoje):
    """[{ficha, versao, edital, tipos}] das fichas concluídas com pendência; `hoje` em AAAA-MM-DD."""
    saida = []
    for pagina in paginas:
        pagina = _objeto(pagina)
        regras = {(r.get("regra"), r.get("versao")): r.get("configuracao") for r in pagina.get("regras") or []}
        for f in pagina.get("linhas") or []:
            regra = regras.get((f.get("regra"), f.get("versao_regra")))
            lancamento = _objeto(f.get("lancamento"))
            resultado = _objeto(f.get("resultado"))
            if not isinstance(regra, dict) or not lancamento or not resultado:
                continue
            try:
                avaliacao = calcular_avaliacao(
                    regra, lancamento, opcoes_da_ficha(resultado, _objeto(f.get("documental")))
                )
                # DS_RESULTADO.declarada guarda as parciais declaradas (resumoParaGravar).
                declarada = {"parciais": _objeto(resultado.get("declarada"))}
                pendencias = pendencias_da_ficha(regra, lancamento, avaliacao, declarada, hoje)
            except Exception:  # uma ficha estranha não para a varredura (a conferência da conta avisa)
                continue
            if pendencias:
                saida.append(
                    {
                        "ficha": f.get("ficha"),
                        "versao": f.get("versao"),
                        "edital": f.get("edital"),
                        "tipos": sorted({p["tipo"] for p in pendencias}),
                    }
                )
    return saida


def mandar_para_revisao(chamar, fichas, log):
    """Chama a RPC ficha a ficha. Devolve {"revisadas", "recusadas"} (recusada: o banco não confirmou)."""
    revisadas = recusadas = 0
    for f in fichas:
        if f.get("versao") is None:
            recusadas += 1
            continue
        try:
            r = _objeto(chamar(RPC, {"p_ficha": f["ficha"], "p_versao": f["versao"]}, tentativas=1))
        except Exception as erro:
            if getattr(erro, "status", None) == 404:
                log.warning("O banco ainda não tem %s (migration 20261023090000): revisão pulada.", RPC)
                return {"revisadas": revisadas, "recusadas": recusadas + len(fichas) - revisadas - recusadas}
            recusadas += 1
            log.warning("Uma ficha não foi para revisão: %s", resumo_do_erro(erro)[:200])
            continue
        if r.get("alterada") is True:
            revisadas += 1
        else:
            recusadas += 1
    return {"revisadas": revisadas, "recusadas": recusadas}
