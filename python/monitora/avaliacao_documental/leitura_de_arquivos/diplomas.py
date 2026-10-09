"""
Diplomas e certificados de titulação: um item por documento de título do
arquivo. Frente e verso contam como um: o verso (registro, livro, folha,
apostila, assinaturas) fica com a frente e não cria título; dois títulos com a
mesma data no arquivo viram um só.

  titulo       o código da ficha (catalogo.js TITULOS_ACADEMICOS): DOUTORADO,
               MESTRADO, RESIDENCIA, ESPECIALIZACAO, GRADUACAO, TECNICO,
               ENSINO_MEDIO — o mais alto que a FRENTE diz ("título de Mestre",
               "pós-graduação lato sensu", "grau de Bacharel"…); "Doutor(a)
               Fulano" e as linhas de assinatura (Reitor, Diretor…) não contam
  curso        "em X" depois do título, ou "curso (superior) de X", até o fim
               da linha ou o conector ("a Fulano", "conferido a", "pela", "eixo");
               data, nome de pessoa ou qualificação ("brasileiro") não é curso
  instituicao  a primeira linha com Universidade, Faculdade, Instituto…
  data         "colou grau em", "concluído em" ou a última data do texto
  pagina       a primeira página do documento
"""

import re

from .certificados import instituicao_do_texto
from .pessoas import nome_confere, sem_nome_de_pessoa
from .texto import datas_no_texto, dobrar, iso, trecho

# (código, padrões no texto dobrado), do mais alto para o mais baixo.
NIVEIS = (
    (
        "DOUTORADO",
        r"doutorado|titulo de doutor|grau de doutor|doutor(?:a|\(a\))? em\s|philosophiae doctor"
        r"|(?<![a-z])ph\.? ?d(?![a-z])",
    ),
    ("MESTRADO", r"mestrado|titulo de mestre|grau de mestre|mestre(?:a|\(a\))? em\s"),
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
_FIM_DO_CURSO = re.compile(
    r"[,;.\"“”:=|«»]|\s(?:a|ao|aos|pela?|na|no|com|coma|em\s+\d|em\s+conformidade|por\s+ter|eixo|nos\s+termos|"
    r"de\s+acordo|conforme|tendo|resolucao)"
    r"(?![a-z])|\s(?:conferid|outorgad|realizad|habilitac|modalidad|reconhecid|registrad|concluid)"
)
_NAO_E_CURSO = re.compile(r"certific|declara|diploma|universidade|faculdade|reitor|registr|portaria")
_DATA_DO_TITULO = re.compile(
    r"colou grau|concluid[oa] em|conclusao em|expedido em|outorgad[oa] em|defesa|aprovad[oa] em"
)
# A frente do diploma diz o que confere; o verso (registro, livro, folha, apostila, assinaturas) não.
_FRENTE = re.compile(
    r"confere|conferimos|outorga|colou grau|concede|titulo de|grau de|certifica(?:mos)? que|concluiu|conclusao do curso"
)
# Linha curta com cargo (a assinatura: "Prof. Doutor em Educação Fulano — Reitor") não é a titulação do candidato.
_CARGO_DE_ASSINATURA = re.compile(
    r"(?<![a-z])(?:reitor|reitora|vice-?reitor|pro-?reitor|diretor|diretora|coordenador|coordenadora|secretari[oa]|"
    r"presidente|chefe|superintendente|responsavel|assinatura|orientador|orientadora|prof\.|dr\.|dra\.)"
)
_DOUTOR_DE_ALGUEM = re.compile(
    r"(?<![a-z])(?<!de )(?:doutor\(a\)|doutora|doutor|mestre)\s+(?!em\s|e\s|a\s|ao\s|pel|no\s|na\s)(?=[a-z])"
)


def _sem_assinaturas(dobrado):
    """O texto sem as linhas de assinatura/cargo e sem "Doutor(a) Fulano" (tratamento, não titulação)."""
    linhas = []
    for linha in dobrado.split("\n"):
        if _CARGO_DE_ASSINATURA.search(linha) and len(linha.split()) <= 12:
            linhas.append(" " * len(linha))
        else:
            linhas.append(_DOUTOR_DE_ALGUEM.sub(lambda m: " " * len(m.group()), linha))
    return "\n".join(linhas)


def nivel_do_texto(dobrado):
    texto = _sem_assinaturas(dobrado)
    for codigo, padrao in NIVEIS:
        if re.search(padrao, texto):
            return codigo
    return None


def limpar_curso(valor, nome_do_candidato=None):
    """O nome do curso sem lixo; None se for data, número, nome de pessoa ou texto comprido demais."""
    if not valor:
        return None
    valor = sem_nome_de_pessoa(valor, nome_do_candidato, estrito=True)
    if not valor or _NAO_E_CURSO.search(dobrar(valor)):
        return None
    digitos = sum(c.isdigit() for c in valor)
    if digitos * 4 > len(valor) or len(valor.split()) > 10:
        return None
    return valor


def curso_do_titulo(original, nome_do_candidato=None):
    """O curso depois de "Bacharel em", "curso de"…: até o fim da linha ou o primeiro conector."""
    dobrado = dobrar(original)
    for m in _CURSO.finditer(dobrado):
        inicio = m.end()
        while inicio < len(dobrado) and dobrado[inicio] in ' \n\t"“':
            inicio += 1
        fim_da_linha = dobrado.find("\n", inicio)
        fim_da_linha = len(dobrado) if fim_da_linha < 0 else fim_da_linha
        resto = dobrado[inicio:fim_da_linha]
        fim = _FIM_DO_CURSO.search(resto)
        bruto = trecho(original, inicio, inicio + (fim.start() if fim else min(len(resto), 120)), 120)
        nome = limpar_curso(bruto, nome_do_candidato)
        if nome and len(nome) >= 3:
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
    """[[primeira página, texto da frente, texto do documento]]: a página com título e frente
    ("confere", "outorga"…) abre um documento; o verso (sem frente) fica com o anterior."""
    saida = []
    for p in paginas:
        dobrado = dobrar(p.texto)
        if (nivel_do_texto(dobrado) and _DOCUMENTO.search(dobrado) and _FRENTE.search(dobrado)) or not saida:
            saida.append([p.numero, p.texto, p.texto])
        else:
            saida[-1][2] += "\n" + p.texto
    return saida


def _juntar_repetidos(itens):
    """Mesmo título com a mesma data (ou duas leituras com a mesma data) no arquivo: um item só."""
    saida = []
    for it in itens:
        igual = next(
            (
                s
                for s in saida
                if (it["data"] and s["data"] == it["data"]) or (not it["data"] and s["titulo"] == it["titulo"])
            ),
            None,
        )
        if igual is None:
            saida.append(it)
            continue
        for campo in ("curso", "instituicao"):
            if not igual.get(campo) and it.get(campo):
                igual[campo] = it[campo]
        if it.get("nome_confere") is True:
            igual["nome_confere"] = True
    return saida


def titulos(paginas, nome_do_candidato=None):
    """Os itens TITULO do arquivo (o título mais alto da frente de cada documento)."""
    itens = []
    for numero, frente, texto in segmentos_de_titulo(paginas)[:10]:
        dobrado_frente, dobrado = dobrar(frente), dobrar(texto)
        nivel = nivel_do_texto(dobrado_frente) or nivel_do_texto(dobrado)
        if not nivel or not _DOCUMENTO.search(dobrado):
            continue
        itens.append(
            {
                "tipo": "TITULO",
                "titulo": nivel,
                "curso": curso_do_titulo(frente, nome_do_candidato) or curso_do_titulo(texto, nome_do_candidato),
                "instituicao": instituicao_do_texto(frente, dobrado_frente) or instituicao_do_texto(texto, dobrado),
                "data": iso(data_do_titulo(dobrado)),
                "pagina": numero,
                "nome_confere": nome_confere(nome_do_candidato, texto) if nome_do_candidato else None,
            }
        )
    return _juntar_repetidos(itens)
