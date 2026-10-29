"""
JSON com os números exatamente como o banco os escreveu.

O pacote volta para o banco do jeito que veio: um numeric 12.50 lido como float viraria 12.5
(e um numeric longo perderia casas). `ler` guarda cada número como `Numero` (o texto original,
comparável como Decimal) e `escrever` devolve esse texto sem mexer.
"""

import json
from decimal import Decimal


class Numero(Decimal):
    """Um número do JSON, com o texto original guardado para escrever igual."""

    __slots__ = ("texto",)

    def __new__(cls, texto):
        n = super().__new__(cls, texto)
        n.texto = texto
        return n


def ler(texto):
    return json.loads(texto, parse_float=Numero, parse_int=Numero)


_texto = json.JSONEncoder(ensure_ascii=False).encode


def _partes(valor, saida):
    if valor is None:
        saida.append("null")
    elif valor is True:
        saida.append("true")
    elif valor is False:
        saida.append("false")
    elif isinstance(valor, Numero):
        saida.append(valor.texto)
    elif isinstance(valor, str):
        saida.append(_texto(valor))
    elif isinstance(valor, int):
        saida.append(str(valor))
    elif isinstance(valor, Decimal):
        if not valor.is_finite():
            raise ValueError("número inválido no pacote")
        saida.append(str(valor))
    elif isinstance(valor, float):
        saida.append(json.dumps(valor, allow_nan=False))
    elif isinstance(valor, dict):
        saida.append("{")
        for i, (chave, item) in enumerate(valor.items()):
            if i:
                saida.append(",")
            saida.append(_texto(str(chave)))
            saida.append(":")
            _partes(item, saida)
        saida.append("}")
    elif isinstance(valor, list | tuple):
        saida.append("[")
        for i, item in enumerate(valor):
            if i:
                saida.append(",")
            _partes(item, saida)
        saida.append("]")
    else:
        raise TypeError(f"tipo fora do JSON: {type(valor).__name__}")


def escrever(valor):
    saida = []
    _partes(valor, saida)
    return "".join(saida)
