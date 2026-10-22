"""
A POSIÇÃO das palavras na página (biblioteca padrão): linhas e células.

O texto corrido do PDF junta colunas ("Data de admissão Data de desligamento"
numa linha e as duas datas na outra) e perde o que é rótulo e o que é valor.
Com a posição de cada palavra — `extract_words` do pdfplumber no PDF com
texto, `image_to_data` do Tesseract no OCR — a página vira LINHAS (palavras
na mesma altura) e cada linha vira CÉLULAS (palavras separadas por um vão
largo: outra coluna). Daí `valor_do_rotulo` acha o valor de um rótulo no
mesmo lugar em que uma pessoa acharia:

    na própria célula      "Admissão: 01/02/2018"
    na célula à direita    "Admissão     01/02/2018"
    na célula de baixo     "Admissão" e, embaixo dele, "01/02/2018"

Sem posição (DOCX, TXT, OCR falso dos testes), `linhas_do_texto` faz linhas
do texto, com células separadas por dois espaços, tabulação ou " | ".
"""

import re
from dataclasses import dataclass, field

from .texto import dobrar, numa_linha

VAO_DE_COLUNA = 1.6  # vão maior que isso × a altura da letra: outra célula


@dataclass
class Palavra:
    texto: str
    x0: float
    x1: float
    topo: float
    base: float


@dataclass
class Celula:
    texto: str
    x0: float
    x1: float
    topo: float
    base: float
    linha: int = 0  # índice da linha na página
    usada: bool = False

    @property
    def dobrado(self):
        return dobrar(self.texto)

    @property
    def centro(self):
        return (self.x0 + self.x1) / 2


@dataclass
class Linha:
    celulas: list = field(default_factory=list)

    @property
    def texto(self):
        return " ".join(c.texto for c in self.celulas)

    @property
    def topo(self):
        return min(c.topo for c in self.celulas)

    @property
    def base(self):
        return max(c.base for c in self.celulas)

    @property
    def altura(self):
        return max(1.0, self.base - self.topo)


def _mediana(valores, padrao=10.0):
    valores = sorted(v for v in valores if v > 0)
    return valores[len(valores) // 2] if valores else padrao


def linhas_das_palavras(palavras, vao=VAO_DE_COLUNA):
    """As palavras agrupadas em linhas (de cima para baixo) e, em cada linha, em células."""
    palavras = [p for p in palavras if p.texto and p.texto.strip()]
    if not palavras:
        return []
    altura = _mediana([p.base - p.topo for p in palavras])
    palavras.sort(key=lambda p: ((p.topo + p.base) / 2, p.x0))
    grupos, atual, centro = [], [], None
    for p in palavras:
        meio = (p.topo + p.base) / 2
        if atual and abs(meio - centro) > altura * 0.55:
            grupos.append(atual)
            atual = []
        atual.append(p)
        centro = sum((q.topo + q.base) / 2 for q in atual) / len(atual)
    if atual:
        grupos.append(atual)
    linhas = []
    for n, grupo in enumerate(grupos):
        grupo.sort(key=lambda p: p.x0)
        celulas, corrente = [], [grupo[0]]
        for anterior, p in zip(grupo, grupo[1:], strict=False):
            if p.x0 - anterior.x1 > altura * vao:
                celulas.append(corrente)
                corrente = []
            corrente.append(p)
        celulas.append(corrente)
        linhas.append(
            Linha(
                [
                    Celula(
                        " ".join(p.texto for p in c),
                        min(p.x0 for p in c),
                        max(p.x1 for p in c),
                        min(p.topo for p in c),
                        max(p.base for p in c),
                        n,
                    )
                    for c in celulas
                ]
            )
        )
    return linhas


def palavras_do_pdfplumber(pagina):
    """As palavras de uma página do pdfplumber (com posição)."""
    try:
        bruto = pagina.extract_words(x_tolerance=1.5, y_tolerance=2.5, keep_blank_chars=False)
    except Exception:  # pragma: no cover - PDF estranho: fica sem posição
        return []
    return [Palavra(w["text"], float(w["x0"]), float(w["x1"]), float(w["top"]), float(w["bottom"])) for w in bruto]


def palavras_do_tesseract(dados, confianca_minima=10):
    """As palavras do `image_to_data` do Tesseract (com posição), sem as de confiança muito baixa."""
    saida = []
    for i, texto in enumerate(dados.get("text") or []):
        texto = (texto or "").strip()
        if not texto:
            continue
        try:
            conf = float(dados["conf"][i])
        except (TypeError, ValueError, KeyError, IndexError):
            conf = -1
        if 0 <= conf < confianca_minima:
            continue
        x, y = float(dados["left"][i]), float(dados["top"][i])
        saida.append(Palavra(texto, x, x + float(dados["width"][i]), y, y + float(dados["height"][i])))
    return saida


_SEPARADOR = re.compile(r"\s*\|\s*|\t+| {2,}")


def linhas_do_texto(texto):
    """Linhas sem posição: cada linha do texto, com células separadas por " | ", tabulação ou dois espaços."""
    linhas = []
    for n, linha in enumerate(str(texto or "").split("\n")):
        partes = [numa_linha(p) for p in _SEPARADOR.split(linha) if p and p.strip()]
        if not partes:
            continue
        celulas, x = [], 0.0
        for parte in partes:
            largura = float(len(parte))
            celulas.append(Celula(parte, x, x + largura, float(n * 10), float(n * 10 + 8), len(linhas)))
            x += largura + 4
        linhas.append(Linha(celulas))
    for i, linha in enumerate(linhas):
        for c in linha.celulas:
            c.linha = i
    return linhas


def linhas_da_pagina(pagina):
    """As linhas da página: pela posição das palavras, se houver; senão, pelo texto."""
    if getattr(pagina, "palavras", None):
        return linhas_das_palavras(pagina.palavras)
    return linhas_do_texto(pagina.texto)


def _sobrepoe(a, b, folga=0.0):
    return min(a.x1, b.x1) + folga >= max(a.x0, b.x0)


def valor_do_rotulo(linhas, i, celula, resto, e_rotulo, aceita=None, linhas_abaixo=2):
    """
    O valor do rótulo `celula` (linha `i`), o primeiro candidato que `aceita` (sem `aceita`: qualquer
    texto com letra ou número): o `resto` da célula depois do rótulo; a célula logo abaixo do rótulo
    (na mesma coluna); a próxima célula da linha. Outro rótulo nunca é valor.
    Devolve (texto, células usadas) ou (None, []).
    """

    def bom(texto):
        texto = (texto or "").strip(" :-–|")
        if not re.search(r"[0-9A-Za-zÀ-ÿ]", texto) or e_rotulo(dobrar(texto)):
            return None
        return texto if aceita is None or aceita(texto) else None

    valor = bom(resto)
    if valor:
        return valor, []
    linha = linhas[i]
    k = linha.celulas.index(celula)
    candidatas = []
    # Linha só de rótulos e, embaixo, o mesmo número de células: o valor é o da mesma coluna
    # (vale também sem posição, no texto: "Admissão  Desligamento" / "01/02/2018  31/01/2020").
    if i + 1 < len(linhas) and len(linha.celulas) > 1 and all(e_rotulo(c.dobrado) for c in linha.celulas):
        embaixo = linhas[i + 1].celulas
        if len(embaixo) == len(linha.celulas):
            candidatas.append(embaixo[k])
    for j in range(i + 1, min(len(linhas), i + 1 + linhas_abaixo)):
        abaixo = [c for c in linhas[j].celulas if not c.usada and _sobrepoe(c, celula, 2)]
        if abaixo:
            # A célula mais alinhada com o rótulo (pela esquerda) é a dele.
            candidatas.append(min(abaixo, key=lambda c: abs(c.x0 - celula.x0)))
            break
    if k + 1 < len(linha.celulas):
        candidatas.append(linha.celulas[k + 1])
    for c in candidatas:
        if c.usada:
            continue
        valor = bom(c.texto)
        if valor:
            return valor, [c]
    return None, []


def campo_rotulado(pagina, padrao, aceita=None):
    """O valor do primeiro rótulo `padrao` (regex no texto dobrado, no começo da célula) da página, pela posição
    (na célula, à direita ou embaixo): "Carga horária" e, embaixo, "40 horas". None sem rótulo ou sem valor."""
    if pagina is None:
        return None
    rotulo = re.compile(rf"^(?:{padrao})(?![a-z])")
    linhas = linhas_da_pagina(pagina)
    for i, linha in enumerate(linhas):
        for celula in linha.celulas:
            m = rotulo.match(celula.dobrado.strip())
            if not m:
                continue
            valor, _ = valor_do_rotulo(
                linhas, i, celula, celula.texto.strip()[m.end() :], lambda d: bool(rotulo.match(d.strip())), aceita
            )
            if valor:
                return valor
    return None
