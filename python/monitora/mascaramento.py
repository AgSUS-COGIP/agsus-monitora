"""
Mascaramento de dados pessoais e segredos no que o Python do MONITORA escreve.

O repositório do MONITORA é público e os logs do GitHub Actions também: os
jobs só imprimem contagens, códigos (vaga, edital, ids) e números de edital.
Toda mensagem passa por `mascarar` antes de sair (inclusive as de erro do
Selenium e do Supabase, que podem trazer trecho de página ou de resposta):
e-mails, CPFs, telefones, tokens JWT, tokens dos links da Empregare
(tokenCandidato, token, pessoa, arquivo, nome, respostaID, perguntaID, candidatura, id, vaga e o identificador interno da vaga) e os
valores das variáveis secretas viram marcadores. O logging de `monitora.registro` aplica isto em todo registro.

Testes: tests/python/test_monitora.py e tests/python/test_robo_empregare.py.
"""

import os
import re

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_CPF = re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)")
_TELEFONE = re.compile(r"(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)")
# Token JWT (as chaves do Supabase e o Bearer de quem usa o app são JWT).
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")
# Qualquer sequência longa de dígitos (documento, telefone sem máscara…). Códigos de
# vaga da Empregare têm até 7 dígitos e passam.
_DIGITOS_LONGOS = re.compile(r"(?<!\d)\d{10,}(?!\d)")
# Links da área logada da Empregare: tokens do candidato e identificadores internos.
_TOKEN_EMPREGARE = re.compile(
    r"(?i)\b(tokenCandidato|candidatura|id|token|pessoa|arquivo|nome|respostaID|questionarioRespostaID|perguntaID|vaga)"
    r"=[^&\s\"'<>]+"
)
# GetRespostaDetails/<respostaID>: o identificador da resposta no caminho.
_RESPOSTA_EMPREGARE = re.compile(r"(?i)(/GetRespostaDetails/)[^/?#\s\"'<>]+")
_VAGA_EMPREGARE = re.compile(r"(/empresa/vagas/candidaturas/)[^/?#\s\"'<>]+")
_LIMITE = 600

# Variáveis cujo VALOR nunca pode aparecer no log, mesmo que um erro o repita.
VARIAVEIS_SECRETAS = (
    "EMPREGARE_EMAIL",
    "EMPREGARE_SENHA",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "GITHUB_TOKEN",
    "GITHUB_DISPATCH_TOKEN",
)


def _credenciais():
    return [v for v in (os.environ.get(n, "") for n in VARIAVEIS_SECRETAS) if v and len(v) >= 3]


def mascarar(texto, credenciais=None):
    """Texto seguro para log público: sem e-mail, CPF, telefone, token nem credencial."""
    t = str(texto if texto is not None else "")
    for valor in credenciais if credenciais is not None else _credenciais():
        t = t.replace(valor, "<credencial>")
    t = _JWT.sub("<token>", t)
    t = _TOKEN_EMPREGARE.sub(r"\1=<token>", t)
    t = _VAGA_EMPREGARE.sub(r"\1<id>", t)
    t = _RESPOSTA_EMPREGARE.sub(r"\1<id>", t)
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
        primeira = primeira[len("message:") :].strip()
    nome = type(erro).__name__ if isinstance(erro, BaseException) else ""
    return mascarar(f"{nome}: {primeira}" if nome and primeira else (nome or primeira))
