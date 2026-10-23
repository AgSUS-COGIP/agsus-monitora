"""
Números, datas e horas da classificação (cópia fiel de
src/lib/classificacao/numeros.ts): "12,5" lido como 12,5 (nunca 0), comparação
em inteiros na escala das casas publicadas, idade e dias de vida sem fuso, a
hora da certidão para a maior idade (sem certidão, 23:59:59).
"""

from __future__ import annotations

import calendar
import math
import re
import sys

from .semantica_js import aparar, eh_numero, formatar_pt_br, math_round, math_sign, math_trunc, texto_js

_MILHAR = re.compile(r"^-?[0-9]{1,3}(\.[0-9]{3})+$")
_NUMERO = re.compile(r"^-?[0-9]+(\.[0-9]+)?$")
_ESPACOS = re.compile(r"\s+")
EPSILON = sys.float_info.epsilon


def numero_br(valor):
    """ "12,5" → 12.5; "1.234,5" → 1234.5; "abc", "", None → None (numeroBR)."""
    if eh_numero(valor):
        return valor if math.isfinite(valor) else None
    bruto = _ESPACOS.sub("", aparar(texto_js(valor)))
    if not bruto:
        return None
    normal = bruto
    if "," in bruto and "." in bruto:
        normal = (
            bruto.replace(".", "").replace(",", ".", 1)
            if bruto.rfind(",") > bruto.rfind(".")
            else bruto.replace(",", "")
        )
    elif "," in bruto:
        if bruto.count(",") > 1:
            return None
        normal = bruto.replace(",", ".", 1)
    elif _MILHAR.match(bruto) and bruto.count(".") > 1:
        normal = bruto.replace(".", "")
    if not _NUMERO.match(normal):
        return None
    numero = float(normal)
    return numero if math.isfinite(numero) else None


def _fator(casas) -> int:
    return 10 ** max(0, min(6, math_trunc(casas)))


def arredondar(valor, casas=2, modo="MEIO_PARA_CIMA"):
    """Arredonda na escala de `casas` (o épsilon relativo corrige 1,005 = 1,00499…)."""
    if not eh_numero(valor) or not math.isfinite(valor):
        return None
    if modo == "NENHUM":
        return valor
    fator = _fator(casas)
    escalado = valor * fator
    ajuste = abs(escalado) * EPSILON * 8
    if modo == "TRUNCAR":
        inteiro = math_trunc(escalado + math_sign(escalado) * ajuste)
    else:
        inteiro = math_sign(escalado) * math_round(abs(escalado) + ajuste)
    return inteiro / fator + 0.0


def escalar(valor, casas=2):
    """O valor em inteiro na escala das casas (para comparar). None fica None."""
    if not eh_numero(valor) or not math.isfinite(valor):
        return None
    return math_round(valor * _fator(casas) + math_sign(valor) * 1e-9)


def formatar_nota(valor, casas=2) -> str:
    """52 → "52,00"; None → "—"."""
    if not eh_numero(valor) or not math.isfinite(valor):
        return "—"
    return formatar_pt_br(valor, max(0, min(6, math_trunc(casas))))


_ISO = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})")
_BR = re.compile(r"^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})$")


def ler_data(valor):
    """ "AAAA-MM-DD" (ou ISO com hora, ou "DD/MM/AAAA") → (ano, mês, dia); inválida → None."""
    bruto = aparar(texto_js(valor))
    m = _ISO.match(bruto)
    if m:
        ano, mes, dia = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = _BR.match(bruto)
        if not m:
            return None
        dia, mes, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if mes < 1 or mes > 12 or dia < 1 or dia > 31:
        return None
    if dia > _dias_no_mes(ano, mes):
        return None
    return ano, mes, dia


def _ano_do_date_utc(ano):
    # Date.UTC soma 1900 aos anos de 0 a 99.
    return ano + 1900 if 0 <= ano <= 99 else ano


def _dias_no_mes(ano, mes):
    return calendar.monthrange(_ano_do_date_utc(ano), mes)[1]


def idade_na_data(nascimento, corte):
    """Idade em anos completos na data de corte (aniversário no dia conta)."""
    n, c = ler_data(nascimento), ler_data(corte)
    if not n or not c:
        return None
    idade = c[0] - n[0]
    if c[1] < n[1] or (c[1] == n[1] and c[2] < n[2]):
        idade -= 1
    return idade


def _dia_juliano(ano, mes, dia):
    # Dias desde 0000-03-01 (proléptico gregoriano), como a diferença de Date.UTC.
    a = _ano_do_date_utc(ano) - (1 if mes <= 2 else 0)
    m = mes + 9 if mes <= 2 else mes - 3
    return 365 * a + a // 4 - a // 100 + a // 400 + (153 * m + 2) // 5 + dia - 1


def dias_de_vida(nascimento, corte):
    """Dias de vida na data de corte (para "maior idade"); antes de nascer → None."""
    n, c = ler_data(nascimento), ler_data(corte)
    if not n or not c:
        return None
    dias = _dia_juliano(*c) - _dia_juliano(*n)
    return dias if dias >= 0 else None


HORA_SEM_CERTIDAO = "23:59:59"
_HORA = re.compile(r"^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$")


def ler_hora(valor):
    """ "8:05" → "08:05:00"; inválida → None."""
    m = _HORA.match(aparar(texto_js(valor)))
    if not m:
        return None
    h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
    if h > 23 or mi > 59 or s > 59:
        return None
    return f"{h:02d}:{mi:02d}:{s:02d}"


def segundos_de_vida(nascimento, hora, corte):
    """Segundos de vida à 0h da data de corte, com a hora da certidão (sem ela, 23:59:59). Maior = mais velho."""
    dias = dias_de_vida(nascimento, corte)
    if dias is None:
        return None
    h, m, s = (int(x) for x in (ler_hora(hora) or HORA_SEM_CERTIDAO).split(":"))
    return dias * 86400 - (h * 3600 + m * 60 + s)


def hora_br(valor) -> str:
    """ "08:05:00" → "08h05min00s"."""
    h = ler_hora(valor)
    if not h:
        return ""
    hh, mm, ss = h.split(":")
    return f"{hh}h{mm}min{ss}s"


def data_br(valor) -> str:
    """ "2026-07-20" → "20/07/2026"."""
    d = ler_data(valor)
    if not d:
        return ""
    return f"{d[2]:02d}/{d[1]:02d}/{d[0]}"
