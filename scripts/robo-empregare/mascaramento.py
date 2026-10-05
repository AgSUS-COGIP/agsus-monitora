"""
Mascaramento do que o robô da Empregare escreve no log.

O repositório do MONITORA é público e os logs do GitHub Actions também: o robô
só imprime contagens, códigos de vaga e números de edital. Toda mensagem passa
por `mascarar` antes de sair (inclusive as de erro do Selenium e do Supabase,
que podem trazer trecho de página ou de resposta): e-mails, CPFs, telefones e
os valores das credenciais viram marcadores.

Testes: tests/python/test_robo_empregare.py.
"""

import os
import re

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_CPF = re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)")
_TELEFONE = re.compile(r"(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)")
# Qualquer sequência longa de dígitos (documento, telefone sem máscara…). Códigos de
# vaga da Empregare têm até 7 dígitos e passam.
_DIGITOS_LONGOS = re.compile(r"(?<!\d)\d{10,}(?!\d)")
_LIMITE = 600


def _credenciais():
    return [
        v
        for v in (os.environ.get("EMPREGARE_EMAIL", ""), os.environ.get("EMPREGARE_SENHA", ""))
        if v and len(v) >= 3
    ]


def mascarar(texto, credenciais=None):
    """Texto seguro para log público: sem e-mail, CPF, telefone nem credencial."""
    t = str(texto if texto is not None else "")
    for valor in credenciais if credenciais is not None else _credenciais():
        t = t.replace(valor, "<credencial>")
    t = _EMAIL.sub("<e-mail>", t)
    t = _CPF.sub("<cpf>", t)
    t = _TELEFONE.sub("<telefone>", t)
    t = _DIGITOS_LONGOS.sub("<número>", t)
    if len(t) > _LIMITE:
        t = t[:_LIMITE] + "…"
    return t


def resumo_do_erro(erro):
    """Primeira linha da exceção, mascarada (o Selenium anexa stacktrace e trechos de página)."""
    texto = str(erro or "").strip().splitlines()
    primeira = texto[0] if texto else ""
    if primeira.lower().startswith("message:"):
        primeira = primeira[len("message:"):].strip()
    nome = type(erro).__name__ if isinstance(erro, BaseException) else ""
    return mascarar(f"{nome}: {primeira}" if nome and primeira else (nome or primeira))
