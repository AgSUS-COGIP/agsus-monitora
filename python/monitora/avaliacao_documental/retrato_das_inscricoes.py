"""
Retrato das inscrições de uma vaga: quantos inscritos, quantos finalizaram o
questionário, quantos estão aptos para análise pela regra e quantos foram
eliminados — só contagens, sem dado pessoal.

O job scripts/pre_classificacao/ grava um retrato por vaga e por dia (o último
do dia vale) em TH_INSCRICAO_VAGA_EDITAL pela RPC gravar_retrato_inscricoes
(migration 20261009140000_acompanhamento_das_inscricoes.sql), durante as
inscrições do cronograma. O cartão "Inscrições" da aba Pré-classificação lê a
série (obter_acompanhamento_inscricoes) e mostra a evolução diária.

    inscritos    candidatos ativos na Empregare (quem saiu do arquivo não conta)
    finalizados  ativos com o questionário finalizado (toda coluna "SITUAÇÃO - <questionário>"
                 = FINALIZADO); None quando o arquivo não tem a coluna do questionário
    aptos        pela regra: no lote base NOTA_MINIMA, quem não foi eliminado e tem a
                 nota do lote ≥ mínima; nas outras bases, no lote pela regra + fora do
                 lote acima do corte. None sem a conta (edital sem regra)
    eliminados   eliminados pela regra entre os ativos (sem "saiu da Empregare")
"""

from datetime import date, timedelta

from monitora.avaliacao_documental.nota_declarada import normalizar_texto
from monitora.avaliacao_documental.pre_classificacao import SAIU_DA_EMPREGARE, janela_das_inscricoes

PREFIXO_DA_SITUACAO_DO_QUESTIONARIO = normalizar_texto("SITUAÇÃO - ")
FINALIZADO = "finalizado"
# Depois do fim das inscrições, o retrato segue por alguns dias (cancelamentos e a
# última carga do robô); depois disso, nada mais é gravado: a tabela fica pequena.
DIAS_DEPOIS_DO_FIM = 3


def _dia(valor):
    try:
        return date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        return None


def retrata_hoje(hoje, cronograma):
    """
    O job grava o retrato hoje? Só com etapa de inscrição no cronograma e com
    hoje entre a véspera do início e DIAS_DEPOIS_DO_FIM dias depois do fim.
    """
    inicio, fim = janela_das_inscricoes(cronograma)
    dia = _dia(hoje)
    comeco = _dia(inicio) or _dia(fim)
    termino = _dia(fim)
    if not dia or not comeco or not termino:
        return False
    return comeco - timedelta(days=1) <= dia <= termino + timedelta(days=DIAS_DEPOIS_DO_FIM)


def finalizou_o_questionario(colunas):
    """True/False pelas colunas "SITUAÇÃO - <questionário>"; None sem a coluna."""
    valores = [
        normalizar_texto(valor)
        for nome, valor in (colunas or {}).items()
        if normalizar_texto(nome).startswith(PREFIXO_DA_SITUACAO_DO_QUESTIONARIO)
    ]
    if not valores:
        return None
    return all(v == FINALIZADO for v in valores)


def _ativo(candidato):
    return (candidato or {}).get("ativo") is not False


def aptos_pela_regra(regra, resultado):
    """Aptos para análise pela regra a partir do resultado de pre_classificar_vaga."""
    lote = (regra or {}).get("lote") or {}
    resumo = resultado.get("resumo") or {}
    if lote.get("base") == "NOTA_MINIMA" and lote.get("nota_minima") is not None:
        minima = lote["nota_minima"]
        return sum(
            1
            for linha in resultado.get("linhas") or []
            if linha.get("situacao") != "ELIMINADO" and linha.get("nota") is not None and linha["nota"] >= minima
        )
    return int(resumo.get("no_lote") or 0) + int(resumo.get("acima_do_corte") or 0)


def retrato_da_vaga(codigo, candidatos, regra=None, resultado=None, previa=False):
    """
    O retrato de uma vaga (dict só com o código e contagens). Sem `resultado`
    (edital sem regra), aptos e eliminados ficam None.
    """
    ativos = [c for c in candidatos or [] if _ativo(c)]
    marcas = [finalizou_o_questionario(c.get("colunas")) for c in ativos]
    finalizados = None if all(m is None for m in marcas) else sum(1 for m in marcas if m)
    aptos = eliminados = None
    if resultado is not None:
        aptos = aptos_pela_regra(regra, resultado)
        eliminados = sum(
            1
            for linha in resultado.get("linhas") or []
            if linha.get("situacao") == "ELIMINADO" and linha.get("motivo_codigo") != SAIU_DA_EMPREGARE["codigo"]
        )
    return {
        "vaga": str(codigo),
        "inscritos": len(ativos),
        "finalizados": finalizados,
        "aptos": aptos,
        "eliminados": eliminados,
        "previa": bool(previa and resultado is not None),
    }
