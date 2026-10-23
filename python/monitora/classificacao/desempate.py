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

Versão 2 (23/10/2026): o cabeçalho (edital e unidade, tipo e fase da lista,
número da geração e id, quando e por quem foi gerada, versão da regra), as
modalidades com o nome (o título do grupo diz se o empate é na lista geral ou
numa lista de cota), a idade em anos na data de corte e o resumo (pares
decididos por critério e como terminaram os empates até o fim). A tela
continua lendo a versão 1 (src/lib/classificacao/relatorio-de-desempate.ts).

O candidato é o id da análise, o código de inscrição e o nome (decisão do
usuário de 23/10/2026: o relatório é documento interno da comissão, lido só
por quem vê a lista); a idade sai em anos completos na data de corte (a mesma
dos critérios idade e 60+), com a ordem de idade dentro do grupo (1 = mais
velho) e se havia certidão de nascimento — nunca a data. Nada de CPF, contato
ou data de nascimento.
"""

from __future__ import annotations

import datetime

from .catalogo import CRITERIO_POR_CODIGO
from .motor import classificar_com_rastro, primeiro_que_separa, valor_do_criterio
from .numeros import data_br, escalar, formatar_nota, idade_na_data

VERSAO_DO_RELATORIO = 2

_TITULOS = {
    "PRELIMINAR": "Avaliação documental",
    "CONVOCACAO": "Convocação para entrevista",
    "ENTREVISTA": "Resultado da entrevista",
    "FINAL": "Resultado final",
}
# O tipo da lista e a fase (etapa do processo seletivo) a que ela pertence.
_TIPOS = {"PRELIMINAR": "Preliminar", "CONVOCACAO": "Convocação", "ENTREVISTA": "Entrevista", "FINAL": "Final"}
_FASES = {
    "PRELIMINAR": "Avaliação documental e de títulos",
    "CONVOCACAO": "Convocação para a entrevista",
    "ENTREVISTA": "Entrevista",
    "FINAL": "Resultado final do processo seletivo",
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
_CRITERIOS_DE_IDADE = ("IDOSO_60", "MAIOR_IDADE")
# Horário de Brasília (sem horário de verão desde 2019).
_BRASILIA = datetime.timezone(datetime.timedelta(hours=-3))


def _rotulo(criterio: str) -> str:
    definicao = CRITERIO_POR_CODIGO.get(criterio)
    return definicao.rotulo_curto if definicao else criterio


def _ordem_de_idade(membros, ctx) -> dict:
    """1 = mais velho do grupo (empate na idade, mesma ordem); sem dado = None."""
    valores = {c.analiseId: valor_do_criterio(c, "MAIOR_IDADE", ctx) for c in membros}
    distintos = sorted({v for v in valores.values() if v is not None}, reverse=True)
    return {i: (distintos.index(v) + 1 if v is not None else None) for i, v in valores.items()}


def _valor_publico(c, criterio, ctx, ordens):
    """O valor do critério que pode ir para o relatório (a idade em anos e a ordem no grupo, nunca a data)."""
    if criterio == "MAIOR_IDADE":
        return {
            "idade": idade_na_data(c.dataNascimento, ctx.data_corte),
            "ordemDeIdade": ordens.get(c.analiseId),
            "certidao": bool(c.horaNascimento),
        }
    return valor_do_criterio(c, criterio, ctx)


def _anos(idade) -> str:
    return "sem data de nascimento" if idade is None else f"{idade} anos"


def _texto_do_valor(valor, criterio, idade=None) -> str:
    """O valor como texto; `idade` (anos na data de corte) acompanha o 60+."""
    if valor is None:
        return "sem dado"
    if isinstance(valor, bool):
        base = "sim" if valor else "não"
        return f"{base} ({_anos(idade)})" if criterio == "IDOSO_60" and idade is not None else base
    if criterio == "MAIOR_IDADE":
        ordem = valor.get("ordemDeIdade")
        base = _anos(valor.get("idade")) + (f", {ordem}º mais velho do grupo" if ordem else "")
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


def eh_lista_de_cota(lista: str) -> bool:
    """A lista de uma modalidade de cota (não a geral nem a de ampla concorrência)."""
    return lista not in ("GERAL", "AC")


def nome_da_lista(lista: str, nomes: dict) -> str:
    """ "Lista geral", "Lista de cota: Pretos e pardos (PPP)" ou "Lista de Ampla concorrência (AC)"."""
    if lista == "GERAL":
        return "Lista geral"
    nome = nomes.get(lista) or lista
    rotulo = nome if nome == lista else f"{nome} ({lista})"
    return f"Lista de cota: {rotulo}" if eh_lista_de_cota(lista) else f"Lista de {rotulo}"


def _grupo(linhas, lista, rastro_da_vaga, ctx, nomes) -> dict:
    criterios = ctx.criterios
    membros = [linha.c for linha in linhas]
    ordens = _ordem_de_idade(membros, ctx)
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
                _valor_publico(a, separa["criterio"], ctx, ordens),
                _valor_publico(b, separa["criterio"], ctx, ordens),
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
    # A idade (dado pessoal) só vai para o relatório quando a idade pesou no grupo: o grupo
    # chegou ao critério "idade" ou algum par foi decidido pelo 60+. Quem foi separado
    # antes (ex.: por exp. saúde indígena, com o 60+ empatado) fica sem a idade.
    usa_idade = "MAIOR_IDADE" in aplicados or any(p["criterio"] in _CRITERIOS_DE_IDADE for p in pares)

    candidatos = []
    for i, linha in enumerate(linhas):
        c = linha.c
        candidatos.append(
            {
                "analiseId": c.analiseId,
                "codigo": c.codigo,
                "nome": c.nome,
                "posicao": linha.posicao,
                "idade": idade_na_data(c.dataNascimento, ctx.data_corte) if usa_idade else None,
                "valores": {k: _valor_publico(c, k, ctx, ordens) for k in aplicados},
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
                "nomes": [linha.c.nome for linha in cadeia],
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
        "listaNome": nome_da_lista(lista, nomes),
        "cota": eh_lista_de_cota(lista),
        "nota": nota,
        "notaTexto": formatar_nota(nota, ctx.casas),
        "posicoes": [linhas[0].posicao, linhas[-1].posicao],
        "resolucao": resolucao,
        "criteriosAplicados": aplicados,
        "candidatos": candidatos,
        "pares": pares,
        "empatadosAteOFim": empatados,
    }


def resumo_dos_grupos(vagas, criterios) -> dict:
    """
    O resumo do topo: por critério da regra (na ordem dela), quantos pares ele
    decidiu e em quantos grupos; e como terminaram os empates até o fim (cada
    sequência de empatados em todos os critérios), por resolução, na ordem em
    que aparecem.
    """
    por_criterio = {d["codigo"]: {"pares": 0, "grupos": 0} for d in criterios}
    por_resolucao: dict = {}
    for v in vagas:
        for g in v["grupos"]:
            decidiu = set()
            for p in g["pares"]:
                if p["criterio"]:
                    item = por_criterio.setdefault(p["criterio"], {"pares": 0, "grupos": 0})
                    item["pares"] += 1
                    decidiu.add(p["criterio"])
            for k in decidiu:
                por_criterio[k]["grupos"] += 1
            for e in g["empatadosAteOFim"]:
                item = por_resolucao.setdefault(e["resolucao"], {"empates": 0, "candidatos": 0})
                item["empates"] += 1
                item["candidatos"] += len(e["analiseIds"])
    return {
        "porCriterio": [{"codigo": k, "rotulo": _rotulo(k), **n} for k, n in por_criterio.items() if n["pares"]],
        "empatesAteOFim": [
            {"resolucao": k, "rotulo": " + ".join(_RESOLUCOES.get(r, r) for r in k.split("+")), **n}
            for k, n in por_resolucao.items()
        ],
    }


def momento_br(valor) -> str:
    """ "2026-10-23T13:05:00+00:00" → "23/10/2026 10:05" (horário de Brasília); inválido → ""."""
    if not isinstance(valor, str) or not valor:
        return ""
    try:
        momento = datetime.datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return ""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=datetime.UTC)
    return momento.astimezone(_BRASILIA).strftime("%d/%m/%Y %H:%M")


def cabecalho_da_lista(dados: dict, lista: dict | None, tipo: str) -> dict:
    """
    O cabeçalho do relatório: o edital (número e unidade), a lista (tipo, fase,
    número da geração entre as do mesmo tipo no edital, id, quando e por quem
    foi gerada) e a versão da regra. `dados` é o json de
    classificacao_ler_edital; `lista`, o de classificacao_ler_lista (sem lista,
    no --seco, a versão é a vigente e a lista fica sem número, id e autor).
    """
    edital = dados.get("edital") if isinstance(dados.get("edital"), dict) else {}
    lista = lista or {}
    lista_id = str(lista.get("id") or "")
    geradas = sorted(
        (x for x in dados.get("listas") or [] if isinstance(x, dict) and x.get("tipo") == tipo),
        key=lambda x: (str(x.get("gerada_em") or ""), str(x.get("id") or "")),
    )
    numero = next((i + 1 for i, x in enumerate(geradas) if lista_id and str(x.get("id") or "") == lista_id), None)
    regra = dados.get("regra") if isinstance(dados.get("regra"), dict) else {}
    versao = lista.get("versao_regra") if lista else regra.get("versao")
    return {
        "edital": {"numero": str(edital.get("numero") or ""), "unidade": str(edital.get("unidade") or "")},
        "lista": {
            "id": lista_id or None,
            "numero": numero,
            "tipo": tipo,
            "tipoNome": _TIPOS.get(tipo, tipo),
            "fase": _FASES.get(tipo, ""),
            "geradaEm": lista.get("gerada_em") or None,
            "geradaEmTexto": momento_br(lista.get("gerada_em")),
            "geradaPor": str(lista.get("gerada_por") or "") or None,
        },
        "regra": {"versao": versao if isinstance(versao, int) and not isinstance(versao, bool) else None},
    }


def relatorio_do_rastro(resultado: dict, rastro: dict, cabecalho: dict | None = None) -> dict:
    """O relatório de desempate (json estável) da lista classificada."""
    ctx = rastro["ctx"]
    regra = rastro["regra"]
    modalidades = [{"codigo": m["codigo"], "nome": m["nome"]} for m in regra.get("modalidades") or []]
    nomes = {m["codigo"]: m["nome"] for m in modalidades}
    vagas = []
    totais = {"grupos": 0, "decididosPorCriterio": 0, "empatadosAteOFim": 0, "pendentes": 0, "mesmaPosicaoNaLista": 0}
    for rv in rastro["vagas"]:
        listas = [("GERAL", rv["geral"]), *rv["porModalidade"].items()]
        grupos = []
        for lista, linhas in listas:
            for linhas_do_grupo in _grupos_da_lista(linhas, ctx.casas):
                grupo = _grupo(linhas_do_grupo, lista, rv, ctx, nomes)
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
    criterios = [
        {"codigo": d["criterio"], "rotulo": _rotulo(d["criterio"]), "direcao": d["direcao"]} for d in ctx.criterios
    ]
    return {
        "versao": VERSAO_DO_RELATORIO,
        "tipo": resultado["tipo"],
        "ordem": tipo_da_ordem,
        "casas": resultado["casas"],
        "dataCorte": resultado["dataCorte"],
        "cabecalho": cabecalho or cabecalho_da_lista({}, None, resultado["tipo"]),
        "empateNaLista": regra["listas"][tipo_da_ordem]["empate"],
        "criterios": criterios,
        "modalidades": modalidades,
        "empateFinal": dict(regra["empate_final"]),
        "totais": totais,
        "resumo": resumo_dos_grupos(vagas, criterios),
        "vagas": vagas,
    }


def relatorio_de_desempate(entrada: dict, cabecalho: dict | None = None) -> tuple[dict, dict]:
    """(resultado, relatório) de uma entrada do motor."""
    resultado, rastro = classificar_com_rastro(entrada)
    return resultado, relatorio_do_rastro(resultado, rastro, cabecalho)


def _ordinal(n) -> str:
    return f"{n}º"


def _quem(nome: str, codigo: str, analise_id: str) -> str:
    """ "Nome (insc. 123)"; sem código, os 8 primeiros dígitos do id da análise."""
    referencia = f"insc. {codigo}" if codigo else f"análise {analise_id[:8]}"
    return f"{nome} ({referencia})" if nome else referencia


def titulo_da_vaga(vaga: dict) -> str:
    """ "Vaga 101 — Enfermeiro (Nível Superior)"; sem um dos dois, o que houver."""
    if vaga["codigo"] and vaga["cargo"]:
        return f"Vaga {vaga['codigo']} — {vaga['cargo']}"
    return f"Vaga {vaga['codigo'] or vaga['cargo']}"


def _linhas_do_cabecalho(relatorio: dict) -> list[str]:
    cab = relatorio["cabecalho"]
    edital, lista = cab["edital"], cab["lista"]
    linhas = []
    partes = [f"Edital nº {edital['numero']}" if edital["numero"] else "", edital["unidade"]]
    if any(partes):
        linhas.append(" · ".join(p for p in partes if p))
    geracao = f" · {lista['numero']}ª geração desta lista" if lista.get("numero") else ""
    linhas.append(f"Lista {lista['tipoNome']} · fase: {lista['fase']}{geracao}")
    if lista.get("id"):
        linhas.append(f"Identificador da lista: {lista['id']}")
    gerada = []
    if lista.get("geradaEmTexto"):
        gerada.append(
            f"Gerada em {lista['geradaEmTexto']}" + (f" por {lista['geradaPor']}" if lista.get("geradaPor") else "")
        )
    if cab["regra"].get("versao") is not None:
        gerada.append(f"regra versão {cab['regra']['versao']}")
    if gerada:
        linhas.append(" · ".join(gerada))
    if relatorio.get("dataCorte"):
        linhas.append(f"Data de corte (idade e 60+): {data_br(relatorio['dataCorte'])}")
    return linhas


def _linhas_do_resumo(relatorio: dict) -> list[str]:
    t, resumo = relatorio["totais"], relatorio["resumo"]
    linhas = [
        "RESUMO",
        f"{t['grupos']} grupo(s) de empate: {t['decididosPorCriterio']} decidido(s) pelos critérios, "
        f"{t['empatadosAteOFim']} com empate até o fim ({t['pendentes']} pendente(s)), "
        f"{t['mesmaPosicaoNaLista']} na mesma posição pela regra da lista.",
    ]
    if resumo["porCriterio"]:
        linhas.append("Decididos por critério (pares de candidatos · grupos):")
        linhas.extend(f"  {c['rotulo']}: {c['pares']} · {c['grupos']}" for c in resumo["porCriterio"])
    if resumo["empatesAteOFim"]:
        linhas.append("Empates até o fim e como foram resolvidos (empates · candidatos):")
        linhas.extend(f"  {e['rotulo']}: {e['empates']} · {e['candidatos']}" for e in resumo["empatesAteOFim"])
    return linhas


def texto_do_relatorio(relatorio: dict) -> str:
    """O relatório em texto legível (para o arquivo do job e a exportação)."""
    linhas = [
        f"RELATÓRIO DE DESEMPATE — {_TITULOS.get(relatorio['tipo'], relatorio['tipo'])}",
        *_linhas_do_cabecalho(relatorio),
        "",
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
    linhas.append("")
    linhas.extend(_linhas_do_resumo(relatorio))
    if not relatorio["vagas"]:
        linhas.append("")
        linhas.append("Nenhum empate de nota nesta lista.")
    else:
        linhas.append("")
        linhas.append("ÍNDICE POR VAGA")
        linhas.extend(f"  {titulo_da_vaga(v)}: {len(v['grupos'])} grupo(s)" for v in relatorio["vagas"])
    for vaga in relatorio["vagas"]:
        linhas.append("")
        linhas.append(titulo_da_vaga(vaga).upper())
        for g in vaga["grupos"]:
            primeira, ultima = g["posicoes"]
            posicoes = _ordinal(primeira) if primeira == ultima else f"{_ordinal(primeira)} a {_ordinal(ultima)}"
            linhas.append("")
            linhas.append(
                f"{titulo_da_vaga(vaga)} · {g['listaNome']} · nota {g['notaTexto']} · "
                f"{len(g['candidatos'])} empatados · {posicoes}"
            )
            if g["criteriosAplicados"]:
                linhas.append("  Critérios aplicados: " + " → ".join(_rotulo(k) for k in g["criteriosAplicados"]))
            por_id = {c["analiseId"]: c for c in g["candidatos"]}
            for c in g["candidatos"]:
                valores = " | ".join(
                    f"{_rotulo(k)}: {_texto_do_valor(v, k, c['idade'])}" for k, v in c["valores"].items()
                )
                quem = _quem(c["nome"], c["codigo"], c["analiseId"])
                linhas.append(f"  {_ordinal(c['posicao'])}  {quem}" + (f"  {valores}" if valores else ""))
            for p in g["pares"]:
                a, b = por_id[p["acima"]], por_id[p["abaixo"]]
                qa = _quem(a["nome"], a["codigo"], a["analiseId"])
                qb = _quem(b["nome"], b["codigo"], b["analiseId"])
                if p["criterio"]:
                    va = _texto_do_valor(p["valores"][0], p["criterio"], a["idade"])
                    vb = _texto_do_valor(p["valores"][1], p["criterio"], b["idade"])
                    hora = "; mesma data de nascimento, decidiu a hora da certidão" if p.get("horaDaCertidao") else ""
                    linhas.append(f"  · {qa} à frente de {qb} por {_rotulo(p['criterio'])} ({va} × {vb}){hora}")
                elif p["resolucao"] == "MESMA_POSICAO_LISTA":
                    linhas.append(f"  · {qa} e {qb}: {_RESOLUCOES['MESMA_POSICAO_LISTA']}")
            for e in g["empatadosAteOFim"]:
                quem = ", ".join(
                    _quem(n, c, i) for n, c, i in zip(e["nomes"], e["codigos"], e["analiseIds"], strict=True)
                )
                resolucao = " + ".join(_RESOLUCOES.get(r, r) for r in e["resolucao"].split("+"))
                registro = f" (registro {e['registro']})" if e["registro"] else ""
                linhas.append(f"  Empatados em todos os critérios: {quem} — {resolucao}{registro}.")
    return "\n".join(linhas) + "\n"
