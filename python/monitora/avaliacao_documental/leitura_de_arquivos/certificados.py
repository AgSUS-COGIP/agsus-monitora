"""
Certificados de curso: um item por certificado do arquivo (um PDF pode
juntar vários — o de 11 páginas da UNA-SUS traz um certificado por página).

Cada página que fala em certificado (certific…, concluiu, participou, carga
horária) começa um certificado; página sem isso (o verso com o conteúdo
programático) fica com o anterior. De cada um:

  curso        "concluiu o curso X", "curso de aperfeiçoamento em X",
               "participou do X" (até a vírgula, "com carga horária", "realizado"…)
  horas        "carga horária de 145 horas", "carga horária: 40h/a", "CH: 40",
               "40 (quarenta) horas", "40hrs", "40 horas/aula", "quarenta horas"
  instituicao  "promovido/realizado/oferecido pela X" ou a primeira linha com
               Universidade, Fundação, Instituto, Escola, Fiocruz, UNA-SUS…
  conclusao    a data do fim do período ("de A a B") ou a da emissão (a última do texto)
  pagina       a primeira página do certificado
  nome_confere o nome do candidato está no certificado
"""

import re

from .pessoas import nome_confere
from .texto import datas_no_texto, dobrar, iso, numa_linha, trecho

_MARCA = re.compile(r"certific|conclu[iu]|participou|carga horaria|declaramos que .{0,80}(curso|capacita)")
_NUMERO = r"(\d{1,4}(?:[.,]\d{1,2})?)(?![\d/])"
_POR_EXTENSO = r"(?:\s*\(\s*[a-z][a-z\s-]{2,40}\))?"  # "40 (quarenta) horas"
_UNIDADE = r"(?:horas?[\s/-]*aulas?|h\s*/\s*a|horas?|hrs?|hs|h)(?![a-z])"
_ENTRE = r"(?:\s*(?:total|minima|aproximada|de|:|=|-))*\s*"
# Com rótulo, a unidade é opcional: "carga horária: 40h/a", "carga horária total de: 40", "CH: 40", "C.H. 40".
_HORAS_ROTULADAS = re.compile(
    rf"(?:carga\s*horaria|(?<![a-z])c\.\s?h\.?|(?<![a-z])ch(?=\s*[:=]))(?![a-z]){_ENTRE}{_NUMERO}{_POR_EXTENSO}"
)
# Com contexto, a unidade é obrigatória: "com duração de 40 horas", "totalizando 40hrs", "perfazendo 40 h/a".
_HORAS = re.compile(
    rf"(?:duracao|totalizando|perfazendo|(?<![a-z])com){_ENTRE}{_NUMERO}{_POR_EXTENSO}\s*{_UNIDADE}",
)
# Solta (sem rótulo): não vale hora do dia ("das 8h às 12h", "às 14h30").
_HORAS_SOLTAS = re.compile(rf"(?<![\d.,/:])(?<!das )(?<!as ){_NUMERO}{_POR_EXTENSO}\s*{_UNIDADE}(?!\s*\d)")
_UNIDADES_POR_EXTENSO = {
    "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7,
    "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "catorze": 14,
    "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20, "trinta": 30,
    "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90, "cem": 100,
    "cento": 100, "duzentas": 200, "duzentos": 200, "trezentas": 300, "trezentos": 300, "quatrocentas": 400,
    "quatrocentos": 400, "quinhentas": 500, "quinhentos": 500, "seiscentas": 600, "seiscentos": 600,
    "setecentas": 700, "setecentos": 700, "oitocentas": 800, "oitocentos": 800, "novecentas": 900,
    "novecentos": 900, "mil": 1000,
}  # fmt: skip
_PALAVRA_DE_NUMERO = "|".join(sorted(_UNIDADES_POR_EXTENSO, key=len, reverse=True))
_HORAS_POR_EXTENSO = re.compile(
    rf"(?<![a-z])((?:(?:{_PALAVRA_DE_NUMERO})(?:\s+e\s+|\s+))*(?:{_PALAVRA_DE_NUMERO}))\s+horas?(?![a-z])"
)
_CURSO = (
    re.compile(r"(?<![a-z])curso\s+(?:livre\s+)?(?:(?:de|em|sobre)\s+)?(?:\"|“)?"),
    re.compile(r"participou\s+(?:do|da|dos|das|no|na|nos|nas)\s+(?:\"|“)?"),
    re.compile(r"conclu\w*\s+(?:com\s+\w+\s+)?(?:o|a|os|as)\s+(?:\"|“)?"),
)
_NAO_E_CURSO = re.compile(r"certific|declara|confere|^de\s+\w+$|^(?:conclusao|graduacao)$")
_FIM_DO_CURSO = re.compile(
    r"[,;\n]|\s(?:com\s+carga|com\s+(?:a\s+)?dura|carga\s+horaria|realizad|promovid|oferecid|ministrad|"
    r"no\s+periodo|na\s+modalidade|pela?\s+(?:universidade|fundacao|escola|instituto)|em\s+\d|de\s+\d|"
    r"totalizando|no\s+dia|nos\s+dias|com\s+aproveitamento|conforme|sob\s+a|carga)"
)
_INSTITUICAO_POR = re.compile(
    r"(?:promovid[oa]|realizad[oa]|oferecid[oa]|ofertad[oa]|ministrad[oa]|emitid[oa])\s+(?:pel[oa]s?|por)\s+"
)
_INSTITUICAO = re.compile(
    r"(?<![a-z])(universidade|faculdade|fundacao|instituto|escola|centro universitario|fiocruz|una-?sus|"
    r"senac|senai|sesi|sebrae|secretaria|ministerio|hospital|conselho|associacao|sociedade|enap|"
    r"organizacao pan-americana|opas|unasus|telessaude|avasus|cruz vermelha)(?![a-z])"
)
_PERIODO = re.compile(r"(?:no\s+periodo\s+de|de|entre)\s*$")

MAXIMO_DE_CERTIFICADOS = 30


def segmentos(paginas):
    """[(primeira página, texto)] um por certificado: página sem marca de certificado vai com a anterior."""
    saida = []
    for p in paginas:
        dobrado = dobrar(p.texto)
        if _MARCA.search(dobrado) or not saida:
            saida.append([p.numero, p.texto])
        else:
            saida[-1][1] += "\n" + p.texto
    return [(n, t) for n, t in saida]


def _numero_por_extenso(texto):
    total = 0
    for palavra in re.findall(r"[a-z]+", texto):
        if palavra == "mil":
            total = max(total, 1) * 1000
        elif palavra in _UNIDADES_POR_EXTENSO:
            total += _UNIDADES_POR_EXTENSO[palavra]
    return total


def horas_do_texto(dobrado):
    """A carga horária: com rótulo ("carga horária: 40h/a", "CH: 40"), com unidade ("40hrs",
    "40 horas/aula", "com duração de 40 horas") ou por extenso ("quarenta horas")."""
    for padrao in (_HORAS_ROTULADAS, _HORAS, _HORAS_SOLTAS):
        for m in padrao.finditer(dobrado):
            horas = round(float(m.group(1).replace(",", ".")))
            if 0 < horas <= 20000:
                return horas
    m = _HORAS_POR_EXTENSO.search(dobrado)
    if m:
        horas = _numero_por_extenso(m.group(1))
        return horas if 0 < horas <= 20000 else None
    return None


def curso_do_texto(original, dobrado):
    """O nome do curso, do texto numa linha (a quebra de linha do PDF não corta o nome)."""
    linha = numa_linha(original)
    linha_dobrada = dobrar(linha)
    for padrao in _CURSO:
        for m in padrao.finditer(linha_dobrada):
            resto = linha_dobrada[m.end() :]
            fim = _FIM_DO_CURSO.search(resto)
            nome = trecho(linha, m.end(), m.end() + (fim.start() if fim else min(len(resto), 160)))
            nome = re.sub(r"^(?:o|a|os|as)\s+(?:curso\s+)?", "", nome, flags=re.I).strip('"“” ')
            if len(nome) >= 4 and re.search(r"[A-Za-zÀ-ÿ]{3}", nome) and not _NAO_E_CURSO.search(dobrar(nome)):
                return nome
    return None


def instituicao_do_texto(original, dobrado):
    m = _INSTITUICAO_POR.search(dobrado)
    if m:
        fim = re.search(r"[,;\n]|\s(?:com|no|na|em|de\s+\d|carga)\s", dobrado[m.end() :])
        nome = trecho(original, m.end(), m.end() + (fim.start() if fim else 100), 120)
        if len(nome) >= 3:
            return nome
    m = _INSTITUICAO.search(dobrado)
    if m:
        fim_da_linha = dobrado.find("\n", m.start())
        fim_da_linha = len(dobrado) if fim_da_linha < 0 else fim_da_linha
        corte = re.search(r"[,;]|\s(?:com|certifica|confere|declara)\s", dobrado[m.start() : fim_da_linha])
        fim = m.start() + corte.start() if corte else fim_da_linha
        return trecho(original, m.start(), fim, 120)
    return None


def conclusao_do_texto(dobrado, datas=None):
    """O fim do período ("de A a B") ou a última data do texto (a da emissão)."""
    datas = datas if datas is not None else datas_no_texto(dobrado)
    if not datas:
        return None
    for a, b in zip(datas, datas[1:], strict=False):
        meio = dobrado[a.fim : b.inicio]
        if len(meio) <= 12 and re.fullmatch(r"\s*(?:a|ate|à|-|–|e)\s*", meio) and _PERIODO.search(dobrado[: a.inicio]):
            return b.ultimo_dia()
    return datas[-1].ultimo_dia()


def certificados(paginas, nome_do_candidato=None):
    """Os itens CURSO do arquivo, um por certificado com curso ou carga horária."""
    itens = []
    for numero, texto in segmentos(paginas)[:MAXIMO_DE_CERTIFICADOS]:
        dobrado = dobrar(texto)
        if not _MARCA.search(dobrado):
            continue
        horas = horas_do_texto(dobrar(numa_linha(texto)))
        curso = curso_do_texto(texto, dobrado)
        if horas is None and not curso:
            continue
        itens.append(
            {
                "tipo": "CURSO",
                "curso": curso,
                "horas": horas,
                "instituicao": instituicao_do_texto(texto, dobrado),
                "conclusao": iso(conclusao_do_texto(dobrado)),
                "pagina": numero,
                "nome_confere": nome_confere(nome_do_candidato, texto) if nome_do_candidato else None,
            }
        )
    return itens
