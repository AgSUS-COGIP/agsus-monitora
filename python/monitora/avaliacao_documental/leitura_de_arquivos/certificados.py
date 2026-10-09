"""
Certificados de curso: um item por certificado do arquivo (um PDF pode
juntar vários — o de 11 páginas da UNA-SUS traz um certificado por página).

Cada página que fala em certificado (certific…, concluiu, participou, carga
horária) começa um certificado; página sem isso (o verso com o conteúdo
programático) fica com o anterior. De cada um:

  curso        "concluiu o curso X", "curso de aperfeiçoamento em X",
               "participou do X" (até a vírgula, "com carga horária", "realizado"…)
  horas        "carga horária de 145 horas", "60h", "40 h/a"
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
_HORAS = re.compile(
    r"(?:carga\s*horaria(?:\s*total)?\s*(?:de|:|=)?\s*|totalizando\s*|com\s*|duracao\s*de\s*)"
    r"(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:h(?:oras?|rs?|s)?\b|h/a|horas?-aula)",
)
_HORAS_SOLTAS = re.compile(r"(?<![\d.,/])(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:horas?(?:-aula)?\b|h/a\b|hrs?\b|hs\b|h\b)")
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


def horas_do_texto(dobrado):
    m = _HORAS.search(dobrado) or _HORAS_SOLTAS.search(dobrado)
    if not m:
        return None
    horas = round(float(m.group(1).replace(",", ".")))
    return horas if 0 < horas <= 20000 else None


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
