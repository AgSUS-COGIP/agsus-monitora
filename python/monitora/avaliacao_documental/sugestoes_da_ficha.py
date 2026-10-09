"""
SUGESTÕES DA FICHA: as linhas que as respostas do candidato já dão

Na ficha da avaliação documental, o avaliador registra os títulos, cursos e
vínculos que o documento comprova. Para a ficha já vir pronta para
conferir, este módulo lê as respostas do questionário (as colunas
"Pergunta N - …" que a regra liga a cada bloco, pelas mesmas regras de
casamento da nota declarada) e tira delas o que dá para interpretar:

  - curso com carga horária: "NR-10 Segurança em eletricidade - 120h",
    "Gestão em saúde 60 horas" (vários na mesma resposta);
  - vínculo com início e fim: "Hospital X, 01/02/2020 a 31/01/2022",
    "UBS Y 03/2018 a 12/2019" (mm/aaaa: o início no dia 1, o fim no último);
  - título acadêmico pela resposta ("Mestrado" → MESTRADO).

Opção de pontuação ("5 pontos", "De 40 a 79 horas", "Mais de 120h"),
"Anexo", "Sim"/"Não" não viram linha. Sem nada interpretável, o bloco fica
de fora (a tela abre a linha vazia, como antes).

As colunas são as da exportação (DS_COLUNA_ORIGINAL, uma linha por
candidato), que já é a resposta vigente do questionário — a mais recente, a
mesma da ficha (20261009210000) — mesmo de quem respondeu mais de uma vez.

O job da pré-classificação (scripts/pre_classificacao/pre_classificacao.py)
calcula por candidato e grava (gravar_sugestoes_da_ficha, migration
20261009190000_sugestoes_da_ficha.sql); obter_ficha_analise devolve em
`sugestoes` e a tela só exibe, com cada linha marcada "da resposta do
candidato" para o avaliador conferir ou corrigir. A nota continua a do banco.

Saída por candidato: {"<CODIGO_DO_BLOCO>": [item, …]} com os itens no
formato do lançamento da ficha (titulos/cursos/vinculos) e "da_resposta": true.
"""

import calendar
import re

from .nota_declarada import colunas_da_pergunta, normalizar_texto, opcoes_da_resposta, texto_da_resposta

ITENS_DO_TIPO = {"TITULOS": "titulos", "CURSOS": "cursos", "VINCULOS": "vinculos"}
MAXIMO_DE_LINHAS = 20
TAMANHO_DO_TEXTO = 200

# Os títulos acadêmicos (catalogo.js TITULOS_ACADEMICOS), com os nomes que aparecem nas respostas.
TITULOS = (
    ("DOUTORADO", ("doutorado", "doutor")),
    ("MESTRADO", ("mestrado", "mestre")),
    ("RESIDENCIA", ("residencia",)),
    ("ESPECIALIZACAO", ("especializacao", "pos-graduacao", "pos graduacao", "lato sensu")),
    ("GRADUACAO", ("graduacao", "bacharelado", "licenciatura")),
    ("TECNICO", ("tecnico",)),
    ("ENSINO_MEDIO", ("ensino medio",)),
)

_HORAS = re.compile(r"(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:h/a|hrs?\b|hs\b|horas?\b|h\b)", re.I)
_DATA = re.compile(r"(?<![\d/])(?:(\d{1,2})/)?(\d{1,2})/(\d{4})(?![\d/])")
_SO_OPCAO = re.compile(r"^(anexo|sim|n[aã]o|\d+(?:[.,]\d+)?\s*pontos?)$", re.I)
_FAIXA = re.compile(
    r"(?<![^\W\d_])(mais de|acima de|at[eé]|entre|menos de|no m[ií]nimo)(?![^\W\d_])"
    r"|\d+\s*(?:a|-|–)\s*\d+\s*(?:h|horas?)(?![^\W\d_])",
    re.I,
)
_SEPARADORES = re.compile(r"^[\s,;:.\-–—/|()]+|[\s,;:.\-–—/|(]+$")
_FIM_SEM_NOME = re.compile(r"(?<![^\W\d_])(com|de|desde|entre|per[ií]odo|carga hor[aá]ria|horas?)\s*$", re.I)


def _limpar(texto):
    t = str(texto or "").replace('"', "").replace("“", "").replace("”", "")
    anterior = None
    while anterior != t:
        anterior = t
        t = _SEPARADORES.sub("", _FIM_SEM_NOME.sub("", t))
    return re.sub(r"\s+", " ", t).strip()[:TAMANHO_DO_TEXTO]


def textos_uteis(respostas):
    """As respostas em texto que podem dizer algo: sem vazio, "Anexo", "Sim"/"Não" nem "5 pontos"."""
    saida = []
    for r in respostas or []:
        t = texto_da_resposta(r)
        if t and not _SO_OPCAO.match(t.strip()):
            saida.append(t.strip())
    return saida


def cursos_das_respostas(respostas):
    """Cursos com carga horária ("NR-10 120h; NR-35 40 horas"); faixa de opção não conta."""
    itens = []
    for texto in textos_uteis(respostas):
        if _FAIXA.search(texto):
            continue
        inicio = 0
        for m in _HORAS.finditer(texto):
            horas = round(float(m.group(1).replace(",", ".")))
            if not 0 < horas <= 20000:
                continue
            itens.append(
                {"nome": _limpar(texto[inicio : m.start()]), "horas": horas, "aceito": True, "da_resposta": True}
            )
            inicio = m.end()
    return itens[:MAXIMO_DE_LINHAS]


def _data_iso(dia, mes, ano, fim_do_mes):
    m, a = int(mes), int(ano)
    if not 1 <= m <= 12 or not 1950 <= a <= 2100:
        return None
    ultimo = calendar.monthrange(a, m)[1]
    d = int(dia) if dia else (ultimo if fim_do_mes else 1)
    if not 1 <= d <= ultimo:
        return None
    return f"{a:04d}-{m:02d}-{d:02d}"


def vinculos_das_respostas(respostas, categoria=None):
    """Vínculos com início e fim ("Hospital X, de 01/02/2020 a 31/01/2022"); pares de datas na ordem."""
    itens = []
    for texto in textos_uteis(respostas):
        datas = list(_DATA.finditer(texto))
        antes = 0
        for i in range(0, len(datas) - 1, 2):
            a, b = datas[i], datas[i + 1]
            inicio = _data_iso(a.group(1), a.group(2), a.group(3), False)
            fim = _data_iso(b.group(1), b.group(2), b.group(3), True)
            if not inicio or not fim or fim < inicio:
                continue
            item = {"empregador": _limpar(texto[antes : a.start()]), "inicio": inicio, "fim": fim, "aceito": True}
            if categoria:
                item["categoria"] = categoria
            item["da_resposta"] = True
            itens.append(item)
            antes = b.end()
    return itens[:MAXIMO_DE_LINHAS]


def titulo_das_respostas(respostas, permitidos=None):
    """O título acadêmico que a resposta indica (o mais alto que aparece), ou None."""
    textos = [normalizar_texto(t) for t in textos_uteis(respostas)]
    for codigo, nomes in TITULOS:
        if permitidos and codigo not in permitidos:
            continue
        if any(re.search(rf"(?<![a-z]){re.escape(n)}(?![a-z])", t) for t in textos for n in nomes):
            return codigo
    return None


def respostas_do_bloco(bloco, colunas):
    """Os textos das respostas às perguntas que a regra liga ao bloco (como respostasDoBloco da tela)."""
    textos, vistas = [], set()
    for pergunta in bloco.get("perguntas") or []:
        for coluna in colunas_da_pergunta(colunas, pergunta):
            if coluna in vistas:
                continue
            vistas.add(coluna)
            valor = colunas[coluna]
            opcoes = opcoes_da_resposta(valor)
            textos.extend(opcoes if len(opcoes) > 1 else [texto_da_resposta(valor)])
    return [t for t in textos if t]


def _titulos_do_nivel(bloco, nivel):
    tabela = (bloco.get("pontos_por_nivel") or {}).get(nivel) or []
    return {t.get("titulo") for t in tabela if t.get("titulo")} or None


def sugestoes_do_candidato(regra, colunas, nivel=None):
    """{CODIGO: [itens]} dos blocos de títulos, cursos e vínculos com algo interpretável nas respostas."""
    saida = {}
    for bloco in (regra or {}).get("blocos") or []:
        chave = ITENS_DO_TIPO.get(bloco.get("tipo"))
        codigo = bloco.get("codigo")
        if not chave or not codigo:
            continue
        textos = respostas_do_bloco(bloco, colunas or {})
        if chave == "cursos":
            itens = cursos_das_respostas(textos)
        elif chave == "vinculos":
            categoria = ((bloco.get("categorias") or [{}])[0] or {}).get("codigo")
            itens = vinculos_das_respostas(textos, categoria)
        else:
            titulo = titulo_das_respostas(textos, _titulos_do_nivel(bloco, nivel))
            itens = [{"titulo": titulo, "nome": "", "aceito": True, "da_resposta": True}] if titulo else []
        if itens:
            saida[codigo] = itens
    return saida


def sugestoes_da_vaga(regra, candidatos, nivel=None):
    """As sugestões dos candidatos ativos da vaga: [{"id", "blocos"}] (só quem tem alguma)."""
    saida = []
    for c in candidatos or []:
        if c.get("ativo") is False or not c.get("id"):
            continue
        blocos = sugestoes_do_candidato(regra, c.get("colunas") or {}, nivel)
        if blocos:
            saida.append({"id": c["id"], "blocos": blocos})
    return saida
