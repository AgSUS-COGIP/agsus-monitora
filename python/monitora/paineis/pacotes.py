"""
A montagem dos pacotes prontos dos painéis (migration 20261029160000).

Cópia fiel, sem recorte de coordenação, de:
    montar_analises     private."FC_MONTAR_PAINEL_ANALISE" (com a VW_ANALISES_DASHBOARD_BASE_TODOS)
    montar_aprovados    private."FC_MONTAR_APROVADOS_AREA"
    montar_entrevistas  private."FC_MONTAR_ENTREVISTAS_AREA" (com private."FC_ENTREVISTAS_VIGENTES")

A entrada é o que public.paineis_ler_fontes(cache, area) devolve: linhas cruas em listas (a
ordem das colunas está em cada função) e o "vocabulario" — os textos que ordenam, já na ordem da
colação do banco (ICU). Texto é ordenado pela posição no vocabulário, nunca pela ordem do Python,
e o nulo vai por último (ASC NULLS LAST do Postgres). Quando o SQL deixa o empate em qualquer
ordem, aqui o id desempata.

Os valores passam como vieram (datas e horas no texto do banco; números como
monitora.paineis.json_exato.Numero): o pacote sai com o mesmo JSON que o SQL montaria.
"""

import re
from datetime import datetime

ESCOPOS = ("ativo", "inativo", "desativadas")
LIMITE_SEM_ENTREVISTA = 3000
_NUMERO_EDITAL = re.compile(r"(\d{1,4})\s*/\s*(\d{4})", re.ASCII)


class FonteInvalida(ValueError):
    """A leitura não tem o formato esperado (versão do banco diferente da do job)."""


def conferir(fontes, cache):
    if not isinstance(fontes, dict) or fontes.get("schema_version") != 1 or fontes.get("cache") != cache:
        raise FonteInvalida(f"paineis_ler_fontes: formato desconhecido para {cache}")
    if not isinstance(fontes.get("vocabulario"), list) or not isinstance(fontes.get("marcas"), list):
        raise FonteInvalida(f"paineis_ler_fontes: sem vocabulário ou marcas em {cache}")


def posicoes(vocabulario):
    return {texto: i for i, texto in enumerate(vocabulario)}


def _texto(pos):
    """Chave de ordenação de um texto: a posição no vocabulário; nulo por último."""

    def chave(valor):
        if valor is None:
            return (1, 0)
        try:
            return (0, pos[valor])
        except KeyError as erro:
            raise FonteInvalida("texto fora do vocabulário") from erro

    return chave


def _nulo_por_ultimo(valor):
    return (1, 0) if valor is None else (0, valor)


def _instante(texto):
    return datetime.fromisoformat(texto) if texto is not None else None


def numero_do_edital(texto):
    """private."FC_NUMERO_EDITAL": "Edital 06/2026" → "6/2026"; sem número → None."""
    m = _NUMERO_EDITAL.search(texto or "")
    return f"{m.group(1).lstrip('0')}/{m.group(2)}" if m else None


# ── Painel de análises ─────────────────────────────────────────────────────────────────────────
# analises: id, unidade, edital, codigo_vaga, nome_vaga, candidato, categoria,
#           modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
#           nota_final_ajustada, pdf_status, tem_pdf, ativo, atualizado_em, unidade_norm, edital_norm
# editais_planilha: id, grupo, unidade, edital, ativo, data_inicio_analise, data_fim_analise,
#                   unidade_norm, edital_norm
# editais_monitora: id, unidade, edital, inicio, fim


def edital_da_analise(analise, por_edital):
    """O edital da planilha da linha (o LATERAL da VW_ANALISES_DASHBOARD_BASE_TODOS), ou None.

    Mesmo grupo e edital; com mais de um, só o da mesma unidade (o view pega um deles, sem ordem
    definida, quando há dois da mesma unidade: aqui, o primeiro da leitura).
    """
    unidade_norm, edital_norm = analise[17], analise[18]
    if edital_norm is None:
        return None
    candidatos = por_edital.get(edital_norm, ())
    if len(candidatos) == 1:
        return candidatos[0]
    if unidade_norm is None:
        return None
    for e in candidatos:
        if e[7] == unidade_norm:
            return e
    return None


def escopo_da_analise(analise, edital):
    edital_ativo = True if edital is None or edital[4] is None else edital[4]
    if edital_ativo is False:
        return "inativo"
    return "ativo" if analise[15] is True else "desativadas"


def editais_do_painel(fontes, pos):
    """DS_EDITAIS: os da planilha e os com a avaliação no MONITORA que a planilha não tem."""
    texto = _texto(pos)
    planilha = fontes["editais_planilha"]
    numeros = {n for n in (numero_do_edital(e[3]) for e in planilha) if n is not None}
    itens = [
        (
            (texto(e[2]), texto(e[3])),
            {
                "grupo": e[1],
                "unidade": e[2],
                "edital": e[3],
                "ativo": e[4],
                "data_inicio_analise": e[5],
                "data_fim_analise": e[6],
            },
        )
        for e in planilha
    ]
    for m in fontes["editais_monitora"]:
        n = numero_do_edital(m[2])
        if n is not None and n in numeros:
            continue
        itens.append(
            (
                (texto(m[1]), texto(m[2])),
                {
                    "grupo": fontes["grupo"],
                    "unidade": m[1],
                    "edital": m[2],
                    "ativo": True,
                    "data_inicio_analise": m[3],
                    "data_fim_analise": m[4],
                },
            )
        )
    itens.sort(key=lambda x: x[0])
    return [obj for _, obj in itens]


def montar_analises(fontes):
    """{escopo: {linhas, total, editais, atualizado_em, concluidas_por_ano}} dos três escopos."""
    conferir(fontes, "ANALISES")
    pos = posicoes(fontes["vocabulario"])
    texto = _texto(pos)
    por_edital = {}
    for e in fontes["editais_planilha"]:
        if e[8] is not None:
            por_edital.setdefault(e[8], []).append(e)
    editais = editais_do_painel(fontes, pos)

    linhas = {escopo: [] for escopo in ESCOPOS}
    for a in fontes["analises"]:
        linhas[escopo_da_analise(a, edital_da_analise(a, por_edital))].append(a)

    pacote = {}
    for escopo in ESCOPOS:
        grupo = linhas[escopo]
        grupo.sort(key=lambda a: (texto(a[1]), texto(a[2]), texto(a[3]), texto(a[5]), a[0]))
        atualizado = None
        anos = {}
        for a in grupo:
            if a[16] is not None and (atualizado is None or _instante(a[16]) > _instante(atualizado)):
                atualizado = a[16]
            if a[8] in ("Aprovado", "Reprovado"):
                ano = str(int(a[11][:4])) if a[11] is not None else "sem_data"
                anos[ano] = anos.get(ano, 0) + 1
        pacote[escopo] = {
            "linhas": [a[:15] for a in grupo],
            "total": len(grupo),
            "editais": editais,
            "atualizado_em": atualizado,
            "concluidas_por_ano": {ano: anos[ano] for ano in sorted(anos)},
        }
    return pacote


# ── Lista de aprovados ─────────────────────────────────────────────────────────────────────────
# listas: id, edital_id, edital, unidade, ativo, arquivo_nome, importado_em
# candidatos: id, lista_id, cargo, classificacao, nota, nome, modalidade, status, processo_sei,
#             matricula, sub_judice, codigo_vaga, alterado_judicialmente, nota_original,
#             modalidade_original, classificacao_original
# contratacao: id do candidato, TP_SITUACAO, DS_MOTIVO (só das linhas Contratado)


def _dicionario(valores, texto):
    lista = sorted({v for v in valores if v is not None}, key=texto)
    return lista, {v: i for i, v in enumerate(lista)}


def montar_aprovados(fontes):
    """{listas, dicionarios, linhas, total}, como FC_MONTAR_APROVADOS_AREA."""
    conferir(fontes, "APROVADOS")
    texto = _texto(posicoes(fontes["vocabulario"]))
    listas = sorted(fontes["listas"], key=lambda li: (texto(li[2]), li[0]))
    indice = {li[0]: i for i, li in enumerate(listas)}
    edital = {li[0]: li[2] for li in listas}
    cand = [c for c in fontes["candidatos"] if c[1] in indice]

    cargos, i_cargo = _dicionario((c[2] for c in cand), texto)
    modalidades, i_modalidade = _dicionario((c[6] for c in cand), texto)
    status, i_status = _dicionario((c[7] for c in cand), texto)
    codigos, i_codigo = _dicionario((c[11] for c in cand), texto)
    contratados = {c[0] for c in cand if c[7] == "Contratado"}

    cand.sort(key=lambda c: (texto(edital[c[1]]), texto(c[2]), _nulo_por_ultimo(c[3]), texto(c[5]), c[0]))

    def indice_de(dic, valor):
        return None if valor is None else dic[valor]

    linhas = []
    for c in cand:
        linha = [
            c[0],
            indice[c[1]],
            indice_de(i_cargo, c[2]),
            c[3],
            c[4],
            c[5],
            indice_de(i_modalidade, c[6]),
            indice_de(i_status, c[7]),
            c[8],
            c[9],
            c[10],
            indice_de(i_codigo, c[11]),
        ]
        if c[12] is True:
            linha += [True, c[13], c[14], c[15]]
        linhas.append(linha)

    return {
        "listas": [list(li) for li in listas],
        "dicionarios": {
            "cargo": cargos,
            "modalidade": modalidades,
            "status": status,
            "codigo_vaga": codigos,
            "contratacao": {x[0]: [x[1], x[2]] for x in fontes["contratacao"] if x[0] in contratados},
        },
        "linhas": linhas,
        "total": len(linhas),
    }


# ── Painel de entrevistas ──────────────────────────────────────────────────────────────────────
# entrevistas: CO_ENTREVISTA, CO_MONITORAMENTO, CO_ANALISE_CURRICULAR, TP_LIGACAO_ANALISE,
#              NO_UNIDADE, DS_EDITAL, CO_VAGA, NO_CARGO, NO_CANDIDATO, CO_CANDIDATO, DS_MODALIDADE,
#              VL_NOTA_TOTAL, TP_PARECER, ST_COMPARECEU, TP_ORIGEM, DT_ATUALIZACAO, DS_LINK_PLANILHA
#              (todas as ativas da área)
# notas: CO_ENTREVISTA, NU_ORDEM, DS_CRITERIO, VL_NOTA (só com nota)
# monitoramentos: id, edital, unidade, ativo, treinamento
# analises: id, nome_vaga, modalidade_concorrencia, nota_final_ajustada, status_consolidado, etapa,
#           responsavel_analise, ativo
# sem_entrevista: id, candidato, id_origem, codigo_vaga, nome_vaga, edital, unidade,
#                 nota_final_ajustada, modalidade_concorrencia


def _pessoa(e):
    """A chave de FC_ENTREVISTAS_VIGENTES: a análise, o candidato na vaga ou a própria entrevista."""
    if e[2] is not None:
        return e[2]
    if e[6] is not None and e[9] is not None:
        return f"candidato:{e[1] or ''}|{e[6]}|{e[9]}"
    return f"entrevista:{e[0]}"


def _ordem_da_vigente(e):
    """A ordem de FC_ENTREVISTAS_VIGENTES (DESC com o nulo primeiro, como no Postgres)."""
    parecer = None if e[12] is None else e[12] in ("APTO", "INAPTO")
    origem = None if e[14] is None else e[14] == "sistema"
    instante = _instante(e[15])
    return (
        0 if parecer is None else (1 if parecer else 2),
        0 if e[11] is not None else 1,
        0 if origem is None else (1 if origem else 2),
        (0, 0) if instante is None else (1, -instante.timestamp()),
        -int(e[0].replace("-", ""), 16),
    )


def entrevistas_vigentes(entrevistas):
    melhor = {}
    for e in entrevistas:
        chave = _pessoa(e)
        atual = melhor.get(chave)
        if atual is None or _ordem_da_vigente(e) < _ordem_da_vigente(atual):
            melhor[chave] = e
    return {e[0] for e in melhor.values()}


def montar_entrevistas(fontes):
    """O payload de FC_MONTAR_ENTREVISTAS_AREA (gerado_em = o instante da leitura)."""
    conferir(fontes, "ENTREVISTAS")
    texto = _texto(posicoes(fontes["vocabulario"]))
    monit = {m[0]: m for m in fontes["monitoramentos"]}
    analise = {a[0]: a for a in fontes["analises"]}
    vigentes = entrevistas_vigentes(fontes["entrevistas"])

    def entra(e):
        m = monit.get(e[1]) if e[1] is not None else None
        if m is not None and m[4] is True:
            return False
        return e[1] is None or (m is not None and m[3] is True)

    escolhidas = [e for e in fontes["entrevistas"] if e[0] in vigentes and entra(e)]
    ids = {e[0] for e in escolhidas}
    notas = [n for n in fontes["notas"] if n[0] in ids]

    menor_ordem = {}
    for n in notas:
        if n[2] not in menor_ordem:
            menor_ordem[n[2]] = n[1]
        elif n[1] is not None and (menor_ordem[n[2]] is None or n[1] < menor_ordem[n[2]]):
            menor_ordem[n[2]] = n[1]
    criterios = sorted(menor_ordem, key=lambda c: (_nulo_por_ultimo(menor_ordem[c]), texto(c)))
    i_criterio = {c: i for i, c in enumerate(criterios)}
    notas_da = {}
    for n in sorted(notas, key=lambda n: _nulo_por_ultimo(n[1])):
        notas_da.setdefault(n[0], []).append([i_criterio[n[2]], n[3]])

    def edital(e):
        m = monit.get(e[1])
        return m[1] if m is not None and m[1] is not None else e[5]

    def nota_desc(valor):
        return (1, 0) if valor is None else (0, -valor)

    escolhidas.sort(key=lambda e: (texto(edital(e)), texto(e[6]), nota_desc(e[11]), texto(e[8]), e[0]))

    saida = []
    for e in escolhidas:
        m = monit.get(e[1])
        a = analise.get(e[2]) if e[2] is not None else None
        saida.append(
            {
                "id": e[0],
                "edital_id": e[1],
                "edital": edital(e),
                "edital_planilha": e[5],
                "unidade": m[2] if m is not None and m[2] is not None else e[4],
                "vaga": e[6],
                "cargo": a[1] if a is not None and a[1] is not None else e[7],
                "candidato": e[8],
                "codigo": e[9],
                "modalidade": a[2] if a is not None and a[2] is not None else e[10],
                "nota": e[11],
                "parecer": e[12],
                "compareceu": e[13],
                "origem": e[14],
                "atualizado_em": e[15],
                "link": e[16],
                "notas": notas_da.get(e[0], []),
                "analise": None
                if a is None
                else {
                    "id": a[0],
                    "ligacao": e[3],
                    "nota": a[3],
                    "resultado": a[4],
                    "etapa": a[5],
                    "responsavel": a[6],
                    "ativo": a[7],
                },
            }
        )

    vagas = {e[6] for e in escolhidas if e[6] is not None}
    sem = sorted(
        (s for s in fontes["sem_entrevista"] if s[3] in vagas),
        key=lambda s: (texto(s[5]), texto(s[3]), texto(s[1]), s[0]),
    )[:LIMITE_SEM_ENTREVISTA]

    return {
        "schema_version": 1,
        "area": fontes["area"],
        "gerado_em": fontes["lido_em"],
        "ultima_carga": fontes.get("ultima_carga"),
        "criterios": criterios,
        "entrevistas": saida,
        "aprovados_sem_entrevista": [
            {
                "analise_id": s[0],
                "candidato": s[1],
                "codigo": s[2],
                "vaga": s[3],
                "cargo": s[4],
                "edital": s[5],
                "unidade": s[6],
                "nota": s[7],
                "modalidade": s[8],
            }
            for s in sem
        ],
    }


MONTADORES = {"ANALISES": montar_analises, "APROVADOS": montar_aprovados, "ENTREVISTAS": montar_entrevistas}


def montar(cache, fontes):
    if cache not in MONTADORES:
        raise FonteInvalida(f"pacote desconhecido: {cache}")
    return MONTADORES[cache](fontes)


def linhas_do_pacote(cache, pacote):
    """Quantas linhas o pacote tem (para o resumo do job)."""
    if cache == "ANALISES":
        return sum(pacote[e]["total"] for e in ESCOPOS)
    if cache == "APROVADOS":
        return pacote["total"]
    return len(pacote["entrevistas"])
