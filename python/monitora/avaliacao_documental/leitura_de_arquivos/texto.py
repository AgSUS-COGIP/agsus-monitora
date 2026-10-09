"""
Texto e datas dos documentos (biblioteca padrão).

`dobrar` deixa o texto minúsculo e sem acento com o MESMO tamanho: a busca é
feita no texto dobrado e o trecho sai do original (com os acentos), pela
mesma posição. `datas_no_texto` acha datas numéricas (12/03/2023, 12.03.23),
por extenso (12 de março de 2023) e mês/ano (03/2023, março de 2023).
"""

import calendar
import re
import unicodedata
from datetime import date

MESES = {
    "janeiro": 1,
    "jan": 1,
    "fevereiro": 2,
    "fev": 2,
    "marco": 3,
    "mar": 3,
    "abril": 4,
    "abr": 4,
    "maio": 5,
    "mai": 5,
    "junho": 6,
    "jun": 6,
    "julho": 7,
    "jul": 7,
    "agosto": 8,
    "ago": 8,
    "setembro": 9,
    "set": 9,
    "outubro": 10,
    "out": 10,
    "novembro": 11,
    "nov": 11,
    "dezembro": 12,
    "dez": 12,
}
_NOMES_DOS_MESES = "|".join(sorted(MESES, key=len, reverse=True))

_DIA_MES_ANO = re.compile(r"(?<![\d/.-])(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{4}|\d{2})(?![\d/])")
_POR_EXTENSO = re.compile(
    rf"(?<!\d)(\d{{1,2}})\s*(?:º|o|°)?\s*(?:de\s+)?({_NOMES_DOS_MESES})(?![a-z])\.?\s*(?:de\s+|/\s*)?(\d{{4}})(?!\d)"
)
_MES_ANO = re.compile(r"(?<![\d/.-])(\d{1,2})\s?/\s?(\d{4})(?![\d/])")
_MES_ANO_EXTENSO = re.compile(rf"(?<![a-z])({_NOMES_DOS_MESES})(?![a-z])\.?\s*(?:de\s+|/\s*)(\d{{4}})(?!\d)")

ANO_MINIMO = 1950
ANO_MAXIMO = 2100


def _base(c):
    d = unicodedata.normalize("NFD", c)[0].lower()
    return d if len(d) == 1 else c


def dobrar(texto):
    """Minúsculo e sem acento, com o mesmo tamanho do original (posição a posição)."""
    return "".join(_base(c) for c in unicodedata.normalize("NFC", str(texto or "")))


def preparar(texto):
    """O texto do documento em NFC, sem caracteres de controle e com espaços simples por linha."""
    t = unicodedata.normalize("NFC", str(texto or "")).replace("\xa0", " ").replace("\r", "\n")
    t = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", t)
    linhas = [re.sub(r"[ \t]+", " ", linha).strip() for linha in t.split("\n")]
    return "\n".join(linhas)


def numa_linha(texto):
    """Espaços e quebras viram um espaço só."""
    return re.sub(r"\s+", " ", str(texto or "")).strip()


def letras(texto):
    """Quantas letras e dígitos o texto tem (mede se a leitura trouxe algo)."""
    return sum(1 for c in str(texto or "") if c.isalnum())


def _data(ano, mes, dia):
    try:
        a, m = int(ano), int(mes)
        if a < 100:
            a += 2000 if a <= 49 else 1900
        if not ANO_MINIMO <= a <= ANO_MAXIMO or not 1 <= m <= 12:
            return None
        d = int(dia) if dia is not None else None
        if d is not None and not 1 <= d <= calendar.monthrange(a, m)[1]:
            return None
        return a, m, d
    except (TypeError, ValueError):
        return None


class Data:
    """Uma data achada no texto: posição, o dia (ou o mês inteiro) e a precisão."""

    __slots__ = ("inicio", "fim", "ano", "mes", "dia")

    def __init__(self, inicio, fim, ano, mes, dia):
        self.inicio, self.fim, self.ano, self.mes, self.dia = inicio, fim, ano, mes, dia

    @property
    def precisao(self):
        return "dia" if self.dia else "mes"

    def primeiro_dia(self):
        return date(self.ano, self.mes, self.dia or 1)

    def ultimo_dia(self):
        return date(self.ano, self.mes, self.dia or calendar.monthrange(self.ano, self.mes)[1])

    def __repr__(self):
        return f"Data({self.ano:04d}-{self.mes:02d}-{self.dia or 0:02d}@{self.inicio})"


def datas_no_texto(dobrado):
    """As datas do texto DOBRADO, em ordem de posição, sem sobreposição."""
    achadas, ocupado = [], []

    def livre(a, b):
        return all(b <= x or a >= y for x, y in ocupado)

    def guardar(m, ano, mes, dia):
        valor = _data(ano, mes, dia)
        if valor and livre(m.start(), m.end()):
            ocupado.append((m.start(), m.end()))
            achadas.append(Data(m.start(), m.end(), *valor))

    for m in _POR_EXTENSO.finditer(dobrado):
        guardar(m, m.group(3), MESES[m.group(2)], m.group(1))
    for m in _DIA_MES_ANO.finditer(dobrado):
        guardar(m, m.group(3), m.group(2), m.group(1))
    for m in _MES_ANO_EXTENSO.finditer(dobrado):
        guardar(m, m.group(2), MESES[m.group(1)], None)
    for m in _MES_ANO.finditer(dobrado):
        guardar(m, m.group(2), m.group(1), None)
    return sorted(achadas, key=lambda d: d.inicio)


def iso(d):
    return d.isoformat() if d else None


def trecho(original, inicio, fim, maximo=200):
    """O trecho do texto original, numa linha, sem pontuação nas pontas e com até `maximo` caracteres."""
    t = numa_linha(original[max(0, inicio) : max(0, fim)])
    t = re.sub(r"^[\s,;:.\-–—/|()\"“”'’]+|[\s,;:\-–—/|(\"“”'’]+$", "", t)
    t = t.rstrip(".").strip()
    if len(t) > maximo:
        corte = t[:maximo]
        espaco = corte.rfind(" ")
        t = (corte[:espaco] if espaco > maximo // 2 else corte).rstrip(" ,;:-") + "…"
    return t
