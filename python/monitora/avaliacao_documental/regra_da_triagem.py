"""
Regra da Triagem: a seção própria, versionada, da regra do edital
(TB_REGRA_TRIAGEM × TH_REGRA_TRIAGEM, migration
20261029160000_regras_proprias_da_triagem.sql).

Antes, a Triagem (código técnico pre_classificacao) lia a configuração em dois
lugares:

  regra da análise (TH_REGRA_ANALISE."DS_CONFIGURACAO"):
    provisoria.eliminacao_automatica   requisitos e motivos de eliminação
    provisoria.nota_declarada          a nota declarada (base da ordem e do corte)
    provisoria.base_da_nota            DECLARADA ou ART
    provisoria.divergencia_tolerancia  tolerância ART × declarada
    provisoria.desempate               desempate da lista
    provisoria.pergunta_experiencia    pergunta da experiência declarada
    lote                               formação do lote (base, múltiplo, corte…)
    blocos[codigo=MODALIDADE].perguntas de onde vem a cota escolhida
  regra da Classificação (TH_REGRA_CLASSIFICACAO, por FC_DOCUMENTAL_DO_EDITAL):
    documental.niveis_por_cargo, documental.nivel_padrao  nível da vaga
    cotas.acumulo, modalidades[].percentual               ordem das cotas

Agora tudo isso mora na seção da Triagem (FORMATO 1, abaixo). O cálculo
(pre_classificacao.py) não mudou: `regra_do_calculo` remonta, a partir da
seção, exatamente as entradas de antes (a regra no formato da análise e o
`documental`). `secao_da_regra_antiga` faz o caminho inverso — é a mesma conta
da migration (em SQL) e serve à prova de que o resultado não muda
(scripts/pre_classificacao/comparar_regra_da_triagem.py).

Chave ausente na origem continua ausente na seção (e volta ausente no
cálculo): assim os padrões de normalizar_regra valem igual.
"""

FORMATO = 1

# Campos da Provisória que passam para a seção, com o lugar de cada um nela.
_DA_PROVISORIA = (
    ("eliminacao_automatica", ("requisitos", "eliminacao_automatica")),
    ("nota_declarada", ("nota", "nota_declarada")),
    ("base_da_nota", ("nota", "base_da_nota")),
    ("divergencia_tolerancia", ("nota", "divergencia_tolerancia")),
    ("desempate", ("desempate", "criterios")),
    ("pergunta_experiencia", ("desempate", "pergunta_experiencia")),
)
_DO_DOCUMENTAL = (
    ("niveis_por_cargo", ("nivel", "niveis_por_cargo")),
    ("nivel_padrao", ("nivel", "nivel_padrao")),
)
BLOCO_DA_MODALIDADE = "MODALIDADE"


def _objeto(v):
    return v if isinstance(v, dict) else {}


def _lista(v):
    return v if isinstance(v, list) else []


def _por(caminho, valor, destino):
    grupo, campo = caminho
    destino.setdefault(grupo, {})[campo] = valor


def secao_da_regra_antiga(analise, documental=None):
    """
    A seção da Triagem tirada da regra da análise (`analise`, o DS_CONFIGURACAO)
    e do `documental` da regra da Classificação (FC_DOCUMENTAL_DO_EDITAL).
    Mesma conta da migration 20261029160000.
    """
    analise = _objeto(analise)
    documental = _objeto(documental)
    secao = {"formato": FORMATO}
    provisoria = _objeto(analise.get("provisoria"))
    for origem, caminho in _DA_PROVISORIA:
        if origem in provisoria:
            _por(caminho, provisoria[origem], secao)
    if "lote" in analise:
        secao["lote"] = analise["lote"]
    bloco = next(
        (b for b in _lista(analise.get("blocos")) if _objeto(b).get("codigo") == BLOCO_DA_MODALIDADE),
        None,
    )
    if bloco is not None and "perguntas" in bloco:
        _por(("modalidade", "perguntas"), bloco["perguntas"], secao)
    for origem, caminho in _DO_DOCUMENTAL:
        if origem in documental:
            _por(caminho, documental[origem], secao)
    cotas = _objeto(documental.get("cotas"))
    if "acumulo" in cotas:
        _por(("modalidade", "acumulo"), cotas["acumulo"], secao)
    if "percentuais" in cotas:
        _por(("modalidade", "percentuais"), cotas["percentuais"], secao)
    return secao


def regra_do_calculo(secao, analise=None):
    """
    (regra, documental) para o cálculo, a partir da seção da Triagem.

    `regra` tem o formato da regra da análise que pre_classificacao.py lê
    (provisoria, lote, blocos); os blocos que não são da Triagem (títulos,
    cursos, vínculos: as sugestões da ficha) continuam vindo da regra da
    análise (`analise`), e o bloco MODALIDADE leva as perguntas da seção.
    `documental` tem o formato de FC_DOCUMENTAL_DO_EDITAL (só o que a
    Triagem usa: nível por cargo, nível padrão e cotas).
    """
    secao = _objeto(secao)
    analise = _objeto(analise)
    provisoria = {}
    for origem, (grupo, campo) in _DA_PROVISORIA:
        valores = _objeto(secao.get(grupo))
        if campo in valores:
            provisoria[origem] = valores[campo]
    regra = {"provisoria": provisoria}
    if "lote" in secao:
        regra["lote"] = secao["lote"]

    modalidade = _objeto(secao.get("modalidade"))
    blocos = []
    trocou = False
    for b in _lista(analise.get("blocos")):
        if _objeto(b).get("codigo") == BLOCO_DA_MODALIDADE:
            if trocou:
                continue
            trocou = True
            if "perguntas" not in modalidade:
                continue
            b = {**b, "perguntas": modalidade["perguntas"]}
        blocos.append(b)
    if not trocou and "perguntas" in modalidade:
        blocos.append({"codigo": BLOCO_DA_MODALIDADE, "tipo": "REGISTRO", "perguntas": modalidade["perguntas"]})
    regra["blocos"] = blocos

    documental = {}
    nivel = _objeto(secao.get("nivel"))
    for origem, (_, campo) in _DO_DOCUMENTAL:
        if campo in nivel:
            documental[origem] = nivel[campo]
    cotas = {}
    if "acumulo" in modalidade:
        cotas["acumulo"] = modalidade["acumulo"]
    if "percentuais" in modalidade:
        cotas["percentuais"] = modalidade["percentuais"]
    if cotas:
        documental["cotas"] = cotas
    return regra, documental
