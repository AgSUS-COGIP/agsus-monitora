"""
O HASH DO RETRATO de uma lista da Classificação (TB_LISTA_CLASSIFICACAO."DS_HASH"
e TB_PEDIDO_CALCULO_CLASSIFICACAO."DS_HASH"), na mesma conta do banco
(private."FC_HASH_RETRATO_CLASSIFICACAO", 20261024130000) e da tela
(src/lib/classificacao/hash-do-retrato.ts).

O hash depende só do CONTEÚDO do retrato, não da forma dos números: o Python
grava a nota inteira como 35.0 e a tela como 35 — o mesmo valor, o mesmo hash.
A forma canônica é o texto do jsonb do PostgreSQL (jsonb::text) com cada número
sem os zeros à direita da vírgula (trim_scale: 35.0 → 35, 7.50 → 7.5). O retrato
gravado não muda (o do Python continua com 35.0).

Texto do jsonb: objeto {"chave": valor, ...} com as chaves em ordem de tamanho
(bytes UTF-8) e, no mesmo tamanho, de bytes; lista [a, b]; texto com \\" \\\\ \\b
\\f \\n \\r \\t e \\u00xx para os outros controles; número decimal, sem expoente
nem zeros à direita.
"""

from __future__ import annotations

import hashlib
import math
from decimal import Decimal

_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


def _texto(valor: str) -> str:
    saida = []
    for c in valor:
        if c in _ESCAPES:
            saida.append(_ESCAPES[c])
        elif ord(c) < 0x20:
            saida.append(f"\\u{ord(c):04x}")
        else:
            saida.append(c)
    return '"' + "".join(saida) + '"'


def numero_canonico(valor) -> str:
    """Um número no texto do jsonb, sem expoente e sem zeros à direita (35.0 → "35")."""
    if isinstance(valor, float):
        if not math.isfinite(valor):
            raise ValueError("Número inválido no retrato.")
        # repr: o menor texto que volta ao mesmo float (o mesmo do JSON do JS).
        decimal = Decimal(repr(valor))
    else:
        decimal = Decimal(valor)
    if decimal == 0:
        return "0"
    texto = format(decimal, "f")
    if "." in texto:
        texto = texto.rstrip("0").rstrip(".")
    return texto


def _ordem_do_jsonb(chave: str):
    b = chave.encode("utf-8")
    return (len(b), b)


def texto_canonico_do_retrato(valor) -> str:
    """O texto canônico do retrato (jsonb::text com os números em trim_scale)."""
    if valor is None:
        return "null"
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if isinstance(valor, int | float | Decimal):
        return numero_canonico(valor)
    if isinstance(valor, str):
        return _texto(valor)
    if isinstance(valor, list | tuple):
        return "[" + ", ".join(texto_canonico_do_retrato(v) for v in valor) + "]"
    if isinstance(valor, dict):
        pares = sorted(((str(k), v) for k, v in valor.items()), key=lambda p: _ordem_do_jsonb(p[0]))
        return "{" + ", ".join(f"{_texto(k)}: {texto_canonico_do_retrato(v)}" for k, v in pares) + "}"
    raise TypeError(f"Valor inválido no retrato: {type(valor).__name__}")


def hash_do_retrato(retrato) -> str:
    """O hash (SHA-256 hex) do retrato, igual ao que o banco grava em DS_HASH."""
    return hashlib.sha256(texto_canonico_do_retrato(retrato).encode("utf-8")).hexdigest()
