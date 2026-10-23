"""
O RELATÓRIO DE DESEMPATE de uma lista gerada: por vaga, por lista (geral e de
cada modalidade) e por nota, os grupos de empate; em cada grupo, a sequência
de critérios da regra que foi aplicada, o valor de cada candidato em cada
critério, o critério que decidiu cada par (e cada posição) e quem ficou
empatado até o fim — com o que o motor fez (sorteio ou decisão registrada,
ordem de inscrição, mesma posição ou pendente), a chave do grupo e o registro.

Sai de `classificar_com_rastro` (motor.py): é a MESMA ordenação da lista, não
uma conta à parte. Dois formatos: `relatorio_de_desempate` (json estável,
versão em VERSAO_DO_RELATORIO, para guardar junto da lista) e
`texto_do_relatorio` (texto legível).

Sem dado pessoal: o candidato é o id da análise e o código de inscrição; a
maior idade sai como a ordem de idade dentro do grupo (1 = mais velho) e se
havia certidão de nascimento, nunca a data.
"""

from __future__ import annotations

from .catalogo import CRITERIO_POR_CODIGO
from .motor import classificar_com_rastro, primeiro_que_separa, valor_do_criterio
from .numeros import escalar, formatar_nota

VERSAO_DO_RELATORIO = 1

_TITULOS = {
    "PRELIMINAR": "Avaliação documental",
    "CONVOCACAO": "Convocação para entrevista",
    "ENTREVISTA": "Resultado da entrevista",
    "FINAL": "Resultado final",
}
_DIRECOES = {
    "SIM_PRIMEIRO": "sim antes de não",
    "NAO_PRIMEIRO": "não antes de sim",
    "MAIOR_PRIMEIRO": "maior primeiro",
    "MENOR_PRIMEIRO": "menor primeiro",
}
_METODOS = {
    "SORTEIO": "sorteio registrado",
    "ORDEM_INSCRICAO": "ordem de inscrição",
    "MESMA_POSICAO": "mesma posição",
    "DECISAO_MANUAL": "decisão manual com justificativa",
}
_RESOLUCOES = {
    "SORTEIO": "sorteio registrado",
    "MANUAL": "decisão manual registrada",
    "INSCRICAO": "ordem de inscrição",
    "MESMA_POSICAO": "ficam na mesma posição",
    "PENDENTE": "aguardando o registro (pendente)",
    "MESMA_POSICAO_LISTA": "nesta lista o empate fica na mesma posição",
}


def _rotulo(criterio: str) -> str:
    definicao = CRITERIO_POR_CODIGO.get(criterio)
    return definicao.rotulo_curto if definicao else criterio


def _ordem_de_idade(membros, ctx) -> dict:
    """1 = mais velho do grupo (empate na idade, mesma ordem); sem dado = None."""
    valores = {c.analiseId: valor_do_criterio(c, "MAIOR_IDADE", ctx) for c in membros}
    distintos = sorted({v for v in valores.values() if v is not None}, reverse=True)
    return {i: (distintos.index(v) + 1 if v is not None else None) for i, v in valores.items()}


def _valor_publico(c, criterio, ctx, idades):
    """O valor do critério que pode ir para o relatório (a idade vira a ordem no grupo)."""
    if criterio == "MAIOR_IDADE":
        return {"ordemDeIdade": idades.get(c.analiseId), "certidao": bool(c.horaNascimento)}
    return valor_do_criterio(c, criterio, ctx)


def _texto_do_valor(valor, criterio) -> str:
    if valor is None:
        return "sem dado"
    if isinstance(valor, bool):
        return "sim" if valor else "não"
    if criterio == "MAIOR_IDADE":
        ordem = valor.get("ordemDeIdade")
        base = f"{ordem}º mais velho do grupo" if ordem else "sem data de nascimento"
        return base + ("" if valor.get("certidao") else ", sem certidão")
    if criterio == "EXP_PROFISSIONAL_TEMPO":
        return f"{formatar_nota(valor, 0)} dias"
    inteiro = isinstance(valor, int) or (isinstance(valor, float) and valor.is_integer())
    return formatar_nota(valor, 0 if inteiro else 2)


def _grupos_da_lista(linhas, casas):
    grupos = []
    atual = []
    chave = object()
    for linha in linhas:
        k = escalar(linha.c.nota, casas)
        if atual and k == chave:
            atual.append(linha)
        else:
            if len(atual) > 1:
                grupos.append(atual)
            atual = [linha]
            chave = k
    if len(atual) > 1:
        grupos.append(atual)
    return grupos


def _resolucao_do_residuo(blocos) -> str:
    resolucoes = []
    for b in blocos:
        if b.resolucao not in resolucoes:
            resolucoes.append(b.resolucao)
    return resolucoes[0] if len(resolucoes) == 1 else "+".join(resolucoes)


def _grupo(linhas, lista, rastro_da_vaga, ctx) -> dict:
    criterios = ctx.criterios
    membros = [linha.c for linha in linhas]
    idades = _ordem_de_idade(membros, ctx)
    usa_criterios = rastro_da_vaga["usarCriterios"] and linhas[0].bloco.resolucao != "MESMA_POSICAO_LISTA"

    pares = []
    mais_fundo = -1
    residuo = False
    cadeias: list[list] = []
    for acima, abaixo in zip(linhas, linhas[1:], strict=False):
        a, b = acima.c, abaixo.c
        separa = primeiro_que_separa(a, b, criterios, ctx) if usa_criterios else None
        par = {"acima": a.analiseId, "abaixo": b.analiseId}
        if separa:
            indice = next(i for i, d in enumerate(criterios) if d["criterio"] == separa["criterio"])
            mais_fundo = max(mais_fundo, indice)
            par["criterio"] = separa["criterio"]
            par["valores"] = [
                _valor_publico(a, separa["criterio"], ctx, idades),
                _valor_publico(b, separa["criterio"], ctx, idades),
            ]
            par["resolucao"] = "CRITERIOS"
            if separa["criterio"] == "MAIOR_IDADE":
                # Nascidos no mesmo dia: decidiu a hora da certidão (sem certidão, 23h59min59s).
                par["horaDaCertidao"] = bool(a.dataNascimento) and a.dataNascimento == b.dataNascimento
        else:
            residuo = residuo or usa_criterios
            par["criterio"] = None
            par["valores"] = None
            blocos = [acima.bloco] if acima.bloco is abaixo.bloco else [acima.bloco, abaixo.bloco]
            par["resolucao"] = _resolucao_do_residuo(blocos) if usa_criterios else "MESMA_POSICAO_LISTA"
            if usa_criterios:
                if cadeias and cadeias[-1][-1] is acima:
                    cadeias[-1].append(abaixo)
                else:
                    cadeias.append([acima, abaixo])
        pares.append(par)

    if not usa_criterios:
        aplicados = []
    elif residuo:
        aplicados = [d["criterio"] for d in criterios]
    else:
        aplicados = [d["criterio"] for d in criterios[: mais_fundo + 1]]

    candidatos = []
    for i, linha in enumerate(linhas):
        c = linha.c
        candidatos.append(
            {
                "analiseId": c.analiseId,
                "codigo": c.codigo,
                "posicao": linha.posicao,
                "valores": {k: _valor_publico(c, k, ctx, idades) for k in aplicados},
                "decididoPor": pares[i]["criterio"] or pares[i]["resolucao"] if i < len(pares) else None,
            }
        )

    empatados = []
    for cadeia in cadeias:
        blocos = []
        for linha in cadeia:
            if linha.bloco not in blocos:
                blocos.append(linha.bloco)
        registro = next((b.registro for b in blocos if b.registro), None)
        pendente = next((b for b in blocos if b.resolucao == "PENDENTE"), None)
        empatados.append(
            {
                "analiseIds": [linha.c.analiseId for linha in cadeia],
                "codigos": [linha.c.codigo for linha in cadeia],
                "resolucao": _resolucao_do_residuo(blocos),
                "chave": next((b.chave for b in blocos if b.chave), None),
                "registro": (registro or {}).get("id"),
                "metodo": pendente.metodo if pendente else None,
            }
        )

    if not usa_criterios:
        resolucao = "MESMA_POSICAO_LISTA"
    elif empatados:
        resolucao = "EMPATE_FINAL"
    else:
        resolucao = "CRITERIOS"
    nota = linhas[0].c.nota
    return {
        "lista": lista,
        "nota": nota,
        "notaTexto": formatar_nota(nota, ctx.casas),
        "posicoes": [linhas[0].posicao, linhas[-1].posicao],
        "resolucao": resolucao,
        "criteriosAplicados": aplicados,
        "candidatos": candidatos,
        "pares": pares,
        "empatadosAteOFim": empatados,
    }


def relatorio_do_rastro(resultado: dict, rastro: dict) -> dict:
    """O relatório de desempate (json estável) da lista classificada."""
    ctx = rastro["ctx"]
    regra = rastro["regra"]
    vagas = []
    totais = {"grupos": 0, "decididosPorCriterio": 0, "empatadosAteOFim": 0, "pendentes": 0, "mesmaPosicaoNaLista": 0}
    for rv in rastro["vagas"]:
        listas = [("GERAL", rv["geral"]), *rv["porModalidade"].items()]
        grupos = []
        for lista, linhas in listas:
            for linhas_do_grupo in _grupos_da_lista(linhas, ctx.casas):
                grupo = _grupo(linhas_do_grupo, lista, rv, ctx)
                grupos.append(grupo)
                totais["grupos"] += 1
                if grupo["resolucao"] == "CRITERIOS":
                    totais["decididosPorCriterio"] += 1
                elif grupo["resolucao"] == "MESMA_POSICAO_LISTA":
                    totais["mesmaPosicaoNaLista"] += 1
                else:
                    totais["empatadosAteOFim"] += 1
                totais["pendentes"] += sum(1 for e in grupo["empatadosAteOFim"] if "PENDENTE" in e["resolucao"])
        if grupos:
            v = rv["vaga"]
            vagas.append(
                {"chave": v["chave"], "codigo": v.get("codigo") or "", "cargo": v.get("cargo") or "", "grupos": grupos}
            )
    tipo_da_ordem = rastro["vagas"][0]["tipoDaOrdem"] if rastro["vagas"] else rastro["tipo"]
    return {
        "versao": VERSAO_DO_RELATORIO,
        "tipo": resultado["tipo"],
        "ordem": tipo_da_ordem,
        "casas": resultado["casas"],
        "dataCorte": resultado["dataCorte"],
        "empateNaLista": regra["listas"][tipo_da_ordem]["empate"],
        "criterios": [
            {"codigo": d["criterio"], "rotulo": _rotulo(d["criterio"]), "direcao": d["direcao"]} for d in ctx.criterios
        ],
        "empateFinal": dict(regra["empate_final"]),
        "totais": totais,
        "vagas": vagas,
    }


def relatorio_de_desempate(entrada: dict) -> tuple[dict, dict]:
    """(resultado, relatório) de uma entrada do motor."""
    resultado, rastro = classificar_com_rastro(entrada)
    return resultado, relatorio_do_rastro(resultado, rastro)


def _ordinal(n) -> str:
    return f"{n}º"


def texto_do_relatorio(relatorio: dict) -> str:
    """O relatório em texto legível (para o arquivo do job e a exportação)."""
    linhas = [
        f"RELATÓRIO DE DESEMPATE — {_TITULOS.get(relatorio['tipo'], relatorio['tipo'])}",
    ]
    criterios = relatorio["criterios"]
    if relatorio["empateNaLista"] == "CRITERIOS" and criterios:
        linhas.append(
            "Critérios da regra, nesta ordem: "
            + "; ".join(
                f"{i + 1}) {c['rotulo']} ({_DIRECOES.get(c['direcao'], c['direcao'])})" for i, c in enumerate(criterios)
            )
            + "."
        )
    elif relatorio["empateNaLista"] == "CRITERIOS":
        linhas.append("A regra não tem critérios de desempate.")
    else:
        linhas.append("Nesta lista o empate de nota fica na mesma posição (a regra não aplica os critérios).")
    final = relatorio["empateFinal"]
    linhas.append(
        f"Empate que sobra: {_METODOS.get(final['metodo'], final['metodo'])}. "
        f"Numeração: {'1º, 2º, 2º, 4º' if final['numeracao'] == 'SALTANDO' else '1º, 2º, 2º, 3º'}."
    )
    t = relatorio["totais"]
    linhas.append(
        f"{t['grupos']} grupo(s) de empate: {t['decididosPorCriterio']} decidido(s) pelos critérios, "
        f"{t['empatadosAteOFim']} com empate até o fim ({t['pendentes']} pendente(s)), "
        f"{t['mesmaPosicaoNaLista']} na mesma posição pela regra da lista."
    )
    if not relatorio["vagas"]:
        linhas.append("")
        linhas.append("Nenhum empate de nota nesta lista.")
    for vaga in relatorio["vagas"]:
        for g in vaga["grupos"]:
            lista = "lista geral" if g["lista"] == "GERAL" else f"lista {g['lista']}"
            primeira, ultima = g["posicoes"]
            posicoes = _ordinal(primeira) if primeira == ultima else f"{_ordinal(primeira)} a {_ordinal(ultima)}"
            linhas.append("")
            linhas.append(
                f"Vaga {vaga['codigo'] or vaga['cargo']} · {lista} · nota {g['notaTexto']} · "
                f"{len(g['candidatos'])} empatados · {posicoes}"
            )
            if g["criteriosAplicados"]:
                linhas.append("  Critérios aplicados: " + " → ".join(_rotulo(k) for k in g["criteriosAplicados"]))
            por_id = {c["analiseId"]: c for c in g["candidatos"]}
            for c in g["candidatos"]:
                valores = " | ".join(f"{_rotulo(k)}: {_texto_do_valor(v, k)}" for k, v in c["valores"].items())
                quem = f"insc. {c['codigo']}" if c["codigo"] else f"análise {c['analiseId'][:8]}"
                linhas.append(f"  {_ordinal(c['posicao'])}  {quem}" + (f"  {valores}" if valores else ""))
            for p in g["pares"]:
                a, b = por_id[p["acima"]], por_id[p["abaixo"]]
                qa = f"insc. {a['codigo']}" if a["codigo"] else f"análise {a['analiseId'][:8]}"
                qb = f"insc. {b['codigo']}" if b["codigo"] else f"análise {b['analiseId'][:8]}"
                if p["criterio"]:
                    va, vb = (_texto_do_valor(v, p["criterio"]) for v in p["valores"])
                    hora = "; mesma data de nascimento, decidiu a hora da certidão" if p.get("horaDaCertidao") else ""
                    linhas.append(f"  · {qa} à frente de {qb} por {_rotulo(p['criterio'])} ({va} × {vb}){hora}")
                elif p["resolucao"] == "MESMA_POSICAO_LISTA":
                    linhas.append(f"  · {qa} e {qb}: {_RESOLUCOES['MESMA_POSICAO_LISTA']}")
            for e in g["empatadosAteOFim"]:
                quem = ", ".join(f"insc. {c}" if c else "sem código" for c in e["codigos"])
                resolucao = " + ".join(_RESOLUCOES.get(r, r) for r in e["resolucao"].split("+"))
                registro = f" (registro {e['registro']})" if e["registro"] else ""
                linhas.append(f"  Empatados em todos os critérios: {quem} — {resolucao}{registro}.")
    return "\n".join(linhas) + "\n"
