"""
O comportamento do JavaScript que o motor da classificação usa e que o Python
não tem igual: texto de um valor (String(x)), Math.round, a formatação pt-BR do
Intl (toLocaleString), a ordem alfabética do localeCompare("pt-BR") e a ordem
das chaves de um objeto. É o que faz a conta em Python dar a MESMA saída de
src/lib/classificacao/motor.ts — os casos dourados de
tests/fixtures/classificacao/casos-do-motor.json cobram.

Só biblioteca padrão.
"""

from __future__ import annotations

import math
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal

# ── Valores ─────────────────────────────────────────────────────────────


def eh_numero(valor) -> bool:
    """typeof valor === "number" (bool não é número no JS)."""
    return isinstance(valor, int | float) and not isinstance(valor, bool)


def numero_em_texto(n) -> str:
    """String(n) do JS: 3.0 → "3", 0.1 → "0.1", NaN → "NaN"."""
    if isinstance(n, int):
        return str(n)
    if math.isnan(n):
        return "NaN"
    if math.isinf(n):
        return "Infinity" if n > 0 else "-Infinity"
    if n == 0:
        return "0"
    if n.is_integer() and abs(n) < 1e21:
        return str(int(n))
    texto = repr(n)
    if "e" in texto:
        mantissa, expoente = texto.split("e")
        expoente = int(expoente)
        if -7 < expoente < 21:
            return format(Decimal(texto), "f")
        sinal = "+" if expoente > 0 else "-"
        return f"{mantissa.removesuffix('.0')}e{sinal}{abs(expoente)}"
    return texto


def texto_js(valor) -> str:
    """String(valor ?? "") do JS."""
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if eh_numero(valor):
        return numero_em_texto(valor)
    if isinstance(valor, str):
        return valor
    if isinstance(valor, list):
        return ",".join(texto_js(v) for v in valor)
    if isinstance(valor, dict):
        return "[object Object]"
    return str(valor)


_ESPACOS_DO_TRIM = " \t\n\r\x0b\x0c                 　﻿"


def aparar(texto: str) -> str:
    """String.prototype.trim()."""
    return texto.strip(_ESPACOS_DO_TRIM)


def texto(valor) -> str:
    """String(valor ?? "").trim()."""
    return aparar(texto_js(valor))


_NUMERO_JS = re.compile(r"^[+-]?(([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?|Infinity)$")


def numero_js(valor) -> float:
    """Number(valor) do JS (texto vazio e nulo = 0; o que não é número = NaN)."""
    if valor is None:
        return 0
    if isinstance(valor, bool):
        return 1 if valor else 0
    if eh_numero(valor):
        return valor
    if isinstance(valor, list):
        return numero_js(texto_js(valor)) if len(valor) <= 1 else math.nan
    if not isinstance(valor, str):
        return math.nan
    bruto = aparar(valor)
    if not bruto:
        return 0
    if re.match(r"^0[xX][0-9a-fA-F]+$", bruto):
        return int(bruto, 16)
    if re.match(r"^0[bB][01]+$", bruto):
        return int(bruto, 2)
    if re.match(r"^0[oO][0-7]+$", bruto):
        return int(bruto, 8)
    if not _NUMERO_JS.match(bruto):
        return math.nan
    return float(bruto.replace("Infinity", "inf"))


def verdadeiro(valor) -> bool:
    """Boolean(valor) do JS."""
    if valor is None or valor is False:
        return False
    if eh_numero(valor):
        return valor != 0 and not (isinstance(valor, float) and math.isnan(valor))
    if isinstance(valor, str):
        return valor != ""
    return True


# ── Math ────────────────────────────────────────────────────────────────


def math_round(x: float) -> int:
    """Math.round: o inteiro mais próximo, empate para +∞."""
    piso = math.floor(x)
    return piso + 1 if x - piso >= 0.5 else piso


def math_trunc(x: float) -> int:
    return math.trunc(x)


def math_sign(x: float) -> int:
    return 1 if x > 0 else -1 if x < 0 else 0


# ── Intl (pt-BR) ────────────────────────────────────────────────────────


def formatar_pt_br(valor: float, casas: int, agrupar: bool = False) -> str:
    """
    valor.toLocaleString("pt-BR", {minimumFractionDigits: casas,
    maximumFractionDigits: casas, useGrouping: agrupar}): vírgula decimal, o
    número decimal mais curto do valor arredondado com o empate para longe do
    zero (1,005 → "1,01", como o ICU), e "-" também no zero negativo.
    """
    negativo = valor < 0 or (valor == 0 and math.copysign(1, valor) < 0)
    decimal = Decimal(numero_em_texto(abs(valor)) if isinstance(valor, float) else str(abs(valor)))
    quantia = decimal.quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP)
    inteiro, _, fracao = format(quantia, "f").partition(".")
    if agrupar:
        inteiro = f"{int(inteiro):,}".replace(",", ".")
    saida = f"{inteiro},{fracao}" if casas > 0 else inteiro
    return f"-{saida}" if negativo else saida


def inteiro_pt_br(n: int) -> str:
    """n.toLocaleString("pt-BR") de um inteiro: 1234 → "1.234"."""
    return formatar_pt_br(n, 0, agrupar=True)


# ── localeCompare("pt-BR") ──────────────────────────────────────────────

# A ordem primária do ICU (raiz do CLDR, que o pt-BR usa) para os caracteres que
# aparecem num nome: espaço < pontuação < símbolos < dígitos < letras. Cada grupo
# é o que o localeCompare com sensitivity "base" considera igual (medido no Node 24).
_GRUPOS_PRIMARIOS = [
    "  ",
    "_",
    "-",
    "–",
    "—",
    ",",
    ";",
    ":",
    "!",
    "?",
    ".",
    "'’‘",
    '"“”',
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "§",
    "@",
    "*",
    "/",
    "\\",
    "&",
    "#",
    "%",
    "`",
    "´",
    "^",
    "¨",
    "°",
    "+",
    "<",
    "=",
    ">",
    "|",
    "~",
    "$",
]
_PESO: dict[str, int] = {}
for _i, _grupo in enumerate(_GRUPOS_PRIMARIOS):
    for _c in _grupo:
        _PESO[_c] = _i + 1
_SIMBOLO_DESCONHECIDO = len(_GRUPOS_PRIMARIOS) + 1
_DIGITO = _SIMBOLO_DESCONHECIDO + 1
_LETRA = _DIGITO + 10
_OUTRA_LETRA = _LETRA + 26
_LETRAS_ESPECIAIS = {"ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i"}
_MARCAS = re.compile("[̀-ͯ]")


def _base(texto_: str) -> str:
    sem_marca = _MARCAS.sub("", unicodedata.normalize("NFKD", texto_)).lower()
    return "".join(_LETRAS_ESPECIAIS.get(c, c) for c in sem_marca)


def _peso_primario(c: str) -> tuple[int, int]:
    if "a" <= c <= "z":
        return (_LETRA + ord(c) - ord("a"), 0)
    if "0" <= c <= "9":
        return (_DIGITO + ord(c) - ord("0"), 0)
    if c in _PESO:
        return (_PESO[c], 0)
    if c.isalpha():
        return (_OUTRA_LETRA, ord(c))
    if unicodedata.category(c).startswith("C"):
        return (0, 0)  # controle: o ICU ignora
    return (_SIMBOLO_DESCONHECIDO, ord(c))


def chave_primaria(texto_: str) -> tuple:
    """A chave de ordenação do localeCompare("pt-BR", {sensitivity: "base"})."""
    return tuple(p for p in (_peso_primario(c) for c in _base(texto_)) if p != (0, 0))


def comparar_base(a: str, b: str) -> int:
    """a.localeCompare(b, "pt-BR", {sensitivity: "base"}): maiúscula, minúscula e acento iguais."""
    ka, kb = chave_primaria(a), chave_primaria(b)
    return -1 if ka < kb else 1 if ka > kb else 0


def _chave_secundaria(texto_: str) -> tuple:
    # Acentos: a letra sem acento antes da acentuada.
    decomposto = unicodedata.normalize("NFD", texto_)
    marcas = []
    for c in decomposto:
        if _MARCAS.match(c):
            if marcas:
                marcas[-1] = marcas[-1] + (ord(c),)
        else:
            marcas.append(())
    return tuple(marcas)


def _chave_terciaria(texto_: str) -> tuple:
    # Caixa: a minúscula antes da maiúscula.
    return tuple(1 if c.isupper() else 0 for c in _MARCAS.sub("", unicodedata.normalize("NFD", texto_)))


_PEDACOS_NUMERICOS = re.compile(r"([0-9]+)")


def comparar_numerico(a: str, b: str) -> int:
    """
    a.localeCompare(b, "pt-BR", {numeric: true}): os números escritos comparados
    pelo valor ("9" antes de "10"); o resto pela ordem do pt-BR, depois acento,
    depois caixa (minúscula antes).
    """

    def primaria(t: str) -> tuple:
        partes = []
        for i, pedaco in enumerate(_PEDACOS_NUMERICOS.split(t)):
            if i % 2:
                partes.append((_DIGITO, int(pedaco)))
            else:
                partes.extend(chave_primaria(pedaco))
        return tuple(partes)

    for chave in (primaria, _chave_secundaria, _chave_terciaria):
        ka, kb = chave(a), chave(b)
        if ka != kb:
            return -1 if ka < kb else 1
    return 0


# ── Objetos ─────────────────────────────────────────────────────────────

_INDICE = re.compile(r"^(0|[1-9][0-9]{0,9})$")


def entradas_js(objeto: dict) -> list[tuple]:
    """Object.entries: as chaves que são índice ("0", "12") primeiro, em ordem numérica; depois as outras."""
    indices = sorted((k for k in objeto if isinstance(k, str) and _INDICE.match(k) and int(k) < 2**32 - 1), key=int)
    vistos = set(indices)
    return [(k, objeto[k]) for k in indices] + [(k, v) for k, v in objeto.items() if k not in vistos]
