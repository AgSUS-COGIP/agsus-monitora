"""
A comparação da classificação em Python com a do motor da tela (motor.ts): os
dois resultados em json, caminho a caminho. Número compara pelo valor (3 é 3.0,
como no JS); o resto, igual. A divergência guarda os dois valores — só para o
arquivo local do job, nunca para o log (as explicações têm nomes e datas).
"""

from __future__ import annotations

import json


def _json(valor):
    return json.loads(json.dumps(valor, ensure_ascii=False))


def divergencias(motor, python, caminho: str = "", saida: list | None = None, limite: int | None = None) -> list[dict]:
    """[{caminho, motor, python}] onde os dois json diferem (até `limite`)."""
    saida = [] if saida is None else saida
    if limite is not None and len(saida) >= limite:
        return saida
    if isinstance(motor, dict) and isinstance(python, dict):
        for chave in list(motor) + [k for k in python if k not in motor]:
            filho = f"{caminho}.{chave}" if caminho else str(chave)
            if chave not in python:
                saida.append({"caminho": filho, "motor": motor[chave], "python": "(falta)"})
            elif chave not in motor:
                saida.append({"caminho": filho, "motor": "(falta)", "python": python[chave]})
            else:
                divergencias(motor[chave], python[chave], filho, saida, limite)
            if limite is not None and len(saida) >= limite:
                break
        return saida
    if isinstance(motor, list) and isinstance(python, list):
        if len(motor) != len(python):
            saida.append({"caminho": f"{caminho}[]", "motor": len(motor), "python": len(python)})
        for i, (a, b) in enumerate(zip(motor, python, strict=False)):
            divergencias(a, b, f"{caminho}[{i}]", saida, limite)
            if limite is not None and len(saida) >= limite:
                break
        return saida
    # bool não é número no JS (True == 1 no Python); número compara pelo valor.
    iguais = motor is python if isinstance(motor, bool) or isinstance(python, bool) else motor == python
    if not iguais:
        saida.append({"caminho": caminho, "motor": motor, "python": python})
    return saida


def comparar(motor: dict, python: dict, limite: int | None = 200) -> dict:
    """{total, por_parte: {vagas: n, explicacoes: n, avisos: n…}, exemplos: [...]} da comparação."""
    lista = divergencias(_json(motor), _json(python), limite=None)
    por_parte: dict = {}
    for d in lista:
        parte = d["caminho"].split(".")[0].split("[")[0]
        por_parte[parte] = por_parte.get(parte, 0) + 1
    return {"total": len(lista), "por_parte": por_parte, "exemplos": lista[:limite] if limite else lista}
