"""
Colunas da leitura: quais colunas dos inscritos a pré-classificação precisa
ler do banco (menos egress do Supabase; 20261014220000_jobs_leem_so_o_necessario.sql).

O cálculo (pre_classificacao.py, nota_declarada.py, retrato_das_inscricoes.py,
sugestoes_da_ficha.py) só olha colunas que casam, PELO NOME, com:
  - a eliminação automática da regra (coluna exata, prefixo da coluna ou pergunta);
  - as perguntas da nota declarada, a pergunta da experiência declarada e as
    perguntas dos blocos (modalidade, títulos, cursos, vínculos);
  - a ART ("NOTA - …") e a situação do questionário ("SITUAÇÃO - …").
Cada uma dessas funções decide coluna a coluna pelo nome; então ler só as
colunas que casam com alguma delas dá exatamente o mesmo resultado (inclusive
"pergunta ambígua", que olha só as colunas que casam com a pergunta, e
"coluna ausente", que olha a coluna do próprio inscrito).

O banco devolve cada inscrito com "c" = {"<posição na lista pedida>": valor};
`montar_colunas` volta ao {nome: valor} na ordem em que o jsonb guardava (o
mesmo dicionário que a leitura completa dava).
"""

from .nota_declarada import colunas_da_pergunta, normalizar_texto
from .pre_classificacao import PREFIXO_DA_ART
from .retrato_das_inscricoes import PREFIXO_DA_SITUACAO_DO_QUESTIONARIO


def _objeto(v):
    return v if isinstance(v, dict) else {}


def _lista(v):
    return v if isinstance(v, list) else []


def perguntas_da_regra(regra):
    """Todos os textos de pergunta que a regra usa (cada um: texto ou lista de alternativas)."""
    regra = _objeto(regra)
    provisoria = _objeto(regra.get("provisoria"))
    perguntas = [_objeto(e).get("pergunta") for e in _lista(provisoria.get("eliminacao_automatica"))]
    perguntas += [_objeto(i).get("pergunta") for i in _lista(provisoria.get("nota_declarada"))]
    perguntas.append(provisoria.get("pergunta_experiencia"))
    for bloco in _lista(regra.get("blocos")):
        perguntas += _lista(_objeto(bloco).get("perguntas"))
    return [p for p in perguntas if p]


def ordem_do_jsonb(nome):
    """A ordem das chaves de um jsonb: as mais curtas (em bytes) primeiro, depois byte a byte."""
    b = str(nome).encode("utf-8")
    return (len(b), b)


def colunas_necessarias(regra, nomes):
    """
    Das colunas `nomes` (as do edital), as que o cálculo pode olhar com esta regra
    (None = sem regra: só o retrato, que olha a situação do questionário). Na ordem do jsonb.
    """
    nomes = [n for n in dict.fromkeys(nomes or []) if isinstance(n, str)]
    escolhidas = set()
    art = normalizar_texto(PREFIXO_DA_ART)
    for nome in nomes:
        normal = normalizar_texto(nome)
        if normal.startswith(art) or normal.startswith(PREFIXO_DA_SITUACAO_DO_QUESTIONARIO):
            escolhidas.add(nome)
    if regra:
        todas = dict.fromkeys(nomes)
        for pergunta in perguntas_da_regra(regra):
            escolhidas.update(colunas_da_pergunta(todas, pergunta))
        for e in _lista(_objeto(_objeto(regra).get("provisoria")).get("eliminacao_automatica")):
            e = _objeto(e)
            if e.get("coluna"):
                alvo = normalizar_texto(e["coluna"])
                escolhidas.update(n for n in nomes if normalizar_texto(n) == alvo)
            if e.get("coluna_prefixo"):
                alvo = normalizar_texto(e["coluna_prefixo"])
                escolhidas.update(n for n in nomes if normalizar_texto(n).startswith(alvo))
    return sorted(escolhidas, key=ordem_do_jsonb)


def montar_colunas(compactas, pedidas):
    """{"<posição>": valor} (resposta enxuta do banco) → {nome: valor}, na ordem de `pedidas`."""
    compactas = _objeto(compactas)
    saida = {}
    for indice in sorted(compactas, key=int):
        saida[pedidas[int(indice)]] = compactas[indice]
    return saida
