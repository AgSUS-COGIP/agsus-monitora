"""
Distribuição das fichas da avaliação documental entre os analistas do edital
(docs/analises-no-monitora/, fase F3).

O job da pré-classificação (scripts/pre_classificacao/) usa esta conta para dar
as fichas que entram depois a quem tem menos pendentes. A mesma conta existe em
src/lib/avaliacao-documental/distribuicao.js (a prévia da tela), e os dois lados
rodam os MESMOS casos dourados:
tests/fixtures/avaliacao-documental/casos-de-distribuicao.json. Mudou aqui, muda lá.

Regra: as fichas vão na ordem recebida (a da Provisória); cada uma vai para o
analista que pode pegá-la (analisa a vaga e cabe no limite) com a menor carga
(pendentes + as recebidas agora); empate fica com quem vem primeiro na lista. O
teto é o limite da equipe e, no critério LIMITE, também o limite da regra (o
menor vale). Ficha que ninguém pode pegar fica na sobra.
"""

import math


def _inteiro_positivo(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 1:
        return None
    return math.floor(v)


def teto_do_analista(analista, criterio, limite_por_analista):
    """O teto de fichas (pendentes + novas) de um analista; None = sem teto."""
    tetos = [_inteiro_positivo((analista or {}).get("limite"))]
    if criterio == "LIMITE":
        tetos.append(_inteiro_positivo(limite_por_analista))
    validos = [t for t in tetos if t is not None]
    return min(validos) if validos else None


def distribuir_fichas(fichas, analistas, criterio="PARTES_IGUAIS", limite_por_analista=None):
    """
    fichas: [{id, vaga}] na ordem; analistas: [{usuario, vagas (None = todas), limite, pendentes}].
    Devolve {atribuicoes: [{ficha, usuario}], sobra: [ids], por_analista: {usuario: novas}}.
    """
    pessoas = []
    for a in analistas or []:
        if not a or not a.get("usuario"):
            continue
        vagas = a.get("vagas")
        pendentes = a.get("pendentes")
        pessoas.append(
            {
                "usuario": str(a["usuario"]),
                "vagas": [str(v) for v in vagas] if isinstance(vagas, list) else None,
                "teto": teto_do_analista(a, criterio, limite_por_analista),
                "carga": pendentes if isinstance(pendentes, (int, float)) and not isinstance(pendentes, bool) else 0,
                "novas": 0,
            }
        )
    atribuicoes = []
    sobra = []
    for ficha in fichas or []:
        escolhido = None
        for p in pessoas:
            if p["vagas"] is not None and str(ficha.get("vaga")) not in p["vagas"]:
                continue
            if p["teto"] is not None and p["carga"] >= p["teto"]:
                continue
            if escolhido is None or p["carga"] < escolhido["carga"]:
                escolhido = p
        if escolhido is None:
            sobra.append(ficha.get("id"))
            continue
        escolhido["carga"] += 1
        escolhido["novas"] += 1
        atribuicoes.append({"ficha": ficha.get("id"), "usuario": escolhido["usuario"]})
    return {
        "atribuicoes": atribuicoes,
        "sobra": sobra,
        "por_analista": {p["usuario"]: p["novas"] for p in pessoas},
    }


def atribuicoes_dos_novos(distribuicao):
    """
    As fichas que o job abre já com responsável: só na distribuição inicial, com
    os que entram depois para quem tem menos pendentes, e depois que a coordenação
    distribuiu. distribuicao = a resposta de pre_classificacao_ler_distribuicao.
    Devolve [{candidato, usuario}].
    """
    d = distribuicao or {}
    if d.get("modo") != "DISTRIBUICAO_INICIAL" or d.get("novos") != "MENOS_PENDENTES":
        return []
    if not d.get("distribuicao_iniciada"):
        return []
    fichas = [{"id": f.get("candidato"), "vaga": f.get("vaga")} for f in d.get("a_abrir") or []]
    r = distribuir_fichas(fichas, d.get("analistas") or [], d.get("criterio"), d.get("limite_por_analista"))
    return [{"candidato": a["ficha"], "usuario": a["usuario"]} for a in r["atribuicoes"]]
