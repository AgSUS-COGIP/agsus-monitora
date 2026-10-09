"""
Diplomas e certificados de titulação: um item por documento de título do
arquivo (frente e verso contam como um).

  titulo       o código da ficha (catalogo.js TITULOS_ACADEMICOS): DOUTORADO,
               MESTRADO, RESIDENCIA, ESPECIALIZACAO, GRADUACAO, TECNICO,
               ENSINO_MEDIO — o mais alto que o texto diz ("título de Mestre",
               "pós-graduação lato sensu", "grau de Bacharel"…)
  curso        "em X" depois do título, ou "curso (superior) de X"
  instituicao  a primeira linha com Universidade, Faculdade, Instituto…
  data         "colou grau em", "concluído em" ou a última data do texto
  pagina       a primeira página do documento
"""

import re

from .certificados import instituicao_do_texto
from .pessoas import nome_confere
from .texto import datas_no_texto, dobrar, iso, numa_linha, trecho

# (código, padrões no texto dobrado), do mais alto para o mais baixo.
NIVEIS = (
    ("DOUTORADO", r"doutorado|titulo de doutor|grau de doutor|doutor em|philosophiae doctor|ph\.? ?d"),
    ("MESTRADO", r"mestrado|titulo de mestre|grau de mestre|mestre em"),
    ("RESIDENCIA", r"residencia (?:medica|multiprofissional|em area profissional|uniprofissional)|residencia em"),
    (
        "ESPECIALIZACAO",
        r"especializacao|especialista em|pos-? ?graduacao|lato sensu|\bmba\b|aperfeicoamento .{0,20}360 ?h",
    ),
    (
        "GRADUACAO",
        r"bacharel|licenciad[oa]|licenciatura|graduacao em|graduad[oa] em|tecnologo em|curso superior de|"
        r"colou grau|grau de|diploma de (?:ensino )?superior|ensino superior",
    ),
    ("TECNICO", r"tecnico em|curso tecnico|habilitacao profissional tecnica|educacao profissional tecnica"),
    ("ENSINO_MEDIO", r"ensino medio|segundo grau|2o grau|educacao basica"),
)
_DOCUMENTO = re.compile(r"diploma|certific|historico escolar|declara|confere|outorga|colou grau|conclu")
_CURSO = re.compile(
    r"(?:mestre|doutor|especialista|bacharel|licenciad[oa]|tecnologo|tecnico|graduad[oa]|"
    r"especializacao|mestrado|doutorado|residencia|graduacao|curso superior)\s+(?:de\s+|em\s+|no\s+curso\s+de\s+)"
)
_FIM_DO_CURSO = re.compile(r"[,;.\"”]|\s(?:pela?|na|no|com|conferid|outorgad|realizad|em\s+\d|aos\s|por\s+ter)\s")
_DATA_DO_TITULO = re.compile(
    r"colou grau|concluid[oa] em|conclusao em|expedido em|outorgad[oa] em|defesa|aprovad[oa] em"
)


def nivel_do_texto(dobrado):
    for codigo, padrao in NIVEIS:
        if re.search(padrao, dobrado):
            return codigo
    return None


def curso_do_titulo(original, dobrado):
    linha = numa_linha(original)
    linha_dobrada = dobrar(linha)
    for m in _CURSO.finditer(linha_dobrada):
        resto = linha_dobrada[m.end() :]
        fim = _FIM_DO_CURSO.search(resto)
        nome = trecho(linha, m.end(), m.end() + (fim.start() if fim else min(len(resto), 120)), 160)
        if len(nome) >= 3 and not re.search(r"certific|declara", dobrar(nome)):
            return nome
    return None


def data_do_titulo(dobrado):
    datas = datas_no_texto(dobrado)
    if not datas:
        return None
    m = _DATA_DO_TITULO.search(dobrado)
    if m:
        depois = [d for d in datas if 0 <= d.inicio - m.end() <= 60]
        if depois:
            return depois[0].ultimo_dia()
    return datas[-1].ultimo_dia()


def segmentos_de_titulo(paginas):
    """Um documento por página com marca de diploma; a página sem marca (verso) fica com a anterior."""
    saida = []
    for p in paginas:
        dobrado = dobrar(p.texto)
        if (nivel_do_texto(dobrado) and _DOCUMENTO.search(dobrado)) or not saida:
            saida.append([p.numero, p.texto])
        else:
            saida[-1][1] += "\n" + p.texto
    return saida


def titulos(paginas, nome_do_candidato=None):
    """Os itens TITULO do arquivo (o título mais alto de cada documento)."""
    itens = []
    for numero, texto in segmentos_de_titulo(paginas)[:10]:
        dobrado = dobrar(texto)
        nivel = nivel_do_texto(dobrado)
        if not nivel or not _DOCUMENTO.search(dobrado):
            continue
        itens.append(
            {
                "tipo": "TITULO",
                "titulo": nivel,
                "curso": curso_do_titulo(texto, dobrado),
                "instituicao": instituicao_do_texto(texto, dobrado),
                "data": iso(data_do_titulo(dobrado)),
                "pagina": numero,
                "nome_confere": nome_confere(nome_do_candidato, texto) if nome_do_candidato else None,
            }
        )
    return itens
