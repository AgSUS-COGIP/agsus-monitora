"""
O RETRATO de uma lista gerada: o que a tela grava em
TB_LISTA_CLASSIFICACAO."DS_RESULTADO" ao gerar (cópia fiel de
`retratoDaClassificacao(instantaneoDaLista(resultado, {edital, regra, versao}))`,
src/lib/classificacao/exportacao.ts e dados-do-estado.ts).

Serve para o job conferir que a lista registrada é a mesma que o Python
calcula com os dados de agora antes de gravar o relatório de desempate dela
(`conferir_com_o_registrado`). O campo que o JS deixa `undefined` some do json;
aqui ele simplesmente não entra (`_se_tem`). Os casos dourados
(tests/fixtures/classificacao/casos-do-motor.json, `retrato`) cobram os dois lados.
"""

from __future__ import annotations

from .comparacao import divergencias
from .regra import normalizar_regra

VERSAO_DO_RETRATO = 1


def _se_tem(origem: dict, chave: str, destino: str | None = None) -> dict:
    """{destino: origem[chave]} só quando a chave existe (o `undefined` do JS some do json)."""
    return {destino or chave: origem[chave]} if chave in origem else {}


def _ou_nulo(origem: dict, chave: str):
    """`valor ?? null`."""
    valor = origem.get(chave)
    return None if valor is None else valor


def _falso_no_js(valor) -> bool:
    return valor is None or valor is False or valor == "" or (isinstance(valor, int | float) and valor == 0)


def _eh_treinamento(edital: dict) -> bool:
    """ehEditalDeTreinamento (src/lib/edital-de-treinamento.ts)."""
    if edital.get("treinamento") is True:
        return True
    marca = edital.get("ST_TREINAMENTO", edital.get("st_treinamento"))
    return str("" if marca is None else marca).upper() == "S"


def instantaneo_da_lista(resultado: dict, edital: dict | None = None, regra=None, versao=None) -> dict:
    """
    O retrato que a tela registra (já passado por retratoDaClassificacao): por vaga,
    a geral e as listas por modalidade com posição, nome e nota, os eliminados com
    o motivo e quem aguarda análise; os avisos, as pendências e os totais.
    """
    edital = edital if isinstance(edital, dict) else {}
    r = normalizar_regra(regra)
    tipo = resultado["tipo"]
    parciais = r["documental"]["parciais"] if tipo == "PRELIMINAR" else []

    def so_parciais(valores) -> dict:
        if parciais and isinstance(valores, dict):
            return {"parciais": {p: _ou_nulo(valores, p) for p in parciais}}
        return {}

    def linha(lin: dict) -> dict:
        saida = {"posicao": lin["posicao"]}
        saida.update(_se_tem(lin, "analiseId", "analise_id"))
        saida.update(_se_tem(lin, "nome"))
        saida.update(_se_tem(lin, "nota"))
        saida.update(_se_tem(lin, "modalidades"))
        saida.update(_se_tem(lin, "situacao"))
        saida.update(so_parciais(lin.get("parciais")))
        if lin.get("recursos"):
            saida["recursos"] = lin["recursos"]
        return saida

    def eliminado(e: dict) -> dict:
        saida = {}
        saida.update(_se_tem(e, "analiseId", "analise_id"))
        saida.update(_se_tem(e, "nome"))
        saida.update(_se_tem(e, "motivo"))
        saida["detalhe"] = "" if _falso_no_js(e.get("detalhe")) else e["detalhe"]
        if e.get("recursos"):
            saida["recursos"] = e["recursos"]
        if (parciais or tipo == "ENTREVISTA") and "nota" in e:
            saida["nota"] = _ou_nulo(e, "nota")
            saida.update(so_parciais(e.get("parciais")))
        return saida

    def aguardando(a: dict) -> dict:
        saida = {}
        saida.update(_se_tem(a, "analiseId", "analise_id"))
        saida.update(_se_tem(a, "nome"))
        saida.update(_se_tem(a, "situacao"))
        return saida

    def vaga(v: dict) -> dict:
        saida = {}
        for chave in ("chave", "codigo", "cargo", "lotacao", "cabecalho"):
            saida.update(_se_tem(v, chave))
        saida["total"] = _ou_nulo(v, "total")
        saida["cadastro_reserva"] = not _falso_no_js(v.get("cadastroReserva"))
        saida["origem_das_vagas"] = _ou_nulo(v, "origemDasVagas")
        if v.get("limiteConvocacao"):
            saida["limite_convocacao"] = v["limiteConvocacao"]
        saida["geral"] = [linha(lin) for lin in v["geral"]]
        saida["listas"] = {codigo: [linha(lin) for lin in linhas] for codigo, linhas in v["porModalidade"].items()}
        saida["eliminados"] = [eliminado(e) for e in v["eliminados"]]
        if v.get("aguardando"):
            saida["aguardando"] = [aguardando(a) for a in v["aguardando"]]
        return saida

    def aviso(a: dict) -> dict:
        saida = {}
        saida.update(_se_tem(a, "codigo"))
        saida["vaga"] = None if _falso_no_js(a.get("vaga")) else a["vaga"]
        saida.update(_se_tem(a, "texto"))
        return saida

    def pendencia(p: dict) -> dict:
        saida = {}
        for chave in ("chave", "vaga", "metodo"):
            saida.update(_se_tem(p, chave))
        return saida

    # retratoDaClassificacao: edital.id só quando é texto; edital e unidade sempre texto.
    dados_do_edital = {}
    if isinstance(edital.get("id"), str):
        dados_do_edital["id"] = edital["id"]
    dados_do_edital["edital"] = edital.get("edital") if isinstance(edital.get("edital"), str) else ""
    dados_do_edital["unidade"] = edital.get("unidade") if isinstance(edital.get("unidade"), str) else ""
    if _eh_treinamento(edital):
        dados_do_edital["treinamento"] = True

    retrato = {
        "schema": VERSAO_DO_RETRATO,
        "tipo": tipo,
        "edital": dados_do_edital,
        "regra_versao": versao,
        "casas": resultado["casas"],
        "data_corte": resultado["dataCorte"],
        "rodape": r["rodape"],
        "empate_final": r["empate_final"]["metodo"],
        "modalidades": [{"codigo": m["codigo"], "nome": m["nome"]} for m in r["modalidades"] if m["lista_propria"]],
    }
    if parciais:
        retrato["parciais"] = list(parciais)
    retrato["vagas"] = [vaga(v) for v in resultado["vagas"]]
    retrato["avisos"] = [aviso(a) for a in resultado["avisos"]]
    retrato["pendencias"] = [pendencia(p) for p in resultado["pendencias"]]
    retrato["totais"] = resultado["totais"]
    return retrato


def retrato_do_edital(dados: dict, resultado: dict) -> dict:
    """O retrato do resultado com o edital, a regra e a versão do json de classificacao_ler_edital."""
    regra = dados.get("regra") if isinstance(dados.get("regra"), dict) else {}
    return instantaneo_da_lista(resultado, dados.get("edital"), regra.get("configuracao"), regra.get("versao"))


def conferir_com_o_registrado(calculado: dict, registrado: dict) -> list[dict]:
    """
    As diferenças entre o retrato calculado agora e o registrado na lista (o
    DS_RESULTADO, que o jsonb devolve com as chaves em outra ordem e 3.0 como 3).
    Vazio = é a mesma lista. Os valores ficam só para quem chamou (nunca para o log).
    """
    return divergencias(registrado, calculado)
