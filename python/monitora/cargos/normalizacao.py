"""
A grafia normalizada de um cargo: a cópia fiel de private."FC_NORMALIZAR_GRAFIA_CARGO"
(supabase/migrations/20261104150000_tabela_de_cargos.sql).

    1. troca acento, cedilha, traços tipográficos, aspas curvas e espaço sem quebra pelo
       equivalente simples e apaga os caracteres invisíveis (espaço de largura zero, BOM),
       com a MESMA tabela do translate() do banco (DE → PARA; o que sobra em DE é apagado);
    2. maiúsculas;
    3. espaços (espaço, tab, quebra de linha) seguidos viram um só;
    4. tira a pontuação das pontas (espaço . , ; : _ / | * " ' ` -), mantendo parênteses;
    5. vazio vira None (nulo no banco).

O teste tests/python/test_cargos.py confere que DE e PARA são os mesmos da migration.
"""

import re

# A mesma ordem do translate() da migration. DE tem 9 caracteres a mais que PARA: os invisíveis
# do fim (espaço de largura zero, não-junção, junção, BOM, hífen suave, marca da esquerda para
# a direita e da direita para a esquerda, separadores de palavra), que o translate apaga.
DE = (
    "áàâãäéèêëíìîïóòôõöúùûüçñýÿ"
    "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ"
    "ºª–—‐‑−“”„‘’´\u00a0\u2007\u202f\t\r\n"
    "\u200b\u200c\u200d\ufeff\u00ad\u200e\u200f\u2060\u2063"
)
PARA = "aaaaaeeeeiiiiooooouuuucnyyAAAAAEEEEIIIIOOOOOUUUUCNYOA-----\"\"\"'''      "

_TABELA = {ord(c): (PARA[i] if i < len(PARA) else None) for i, c in enumerate(DE)}
_ESPACOS = re.compile(r" {2,}")
_PONTAS = re.compile(r"""^[ .,;:_/|*"'`-]+|[ .,;:_/|*"'`-]+$""")


def normalizar(texto):
    """A grafia normalizada (str) ou None para nulo/vazio."""
    if texto is None:
        return None
    t = str(texto).translate(_TABELA).upper()
    t = _ESPACOS.sub(" ", t)
    t = _PONTAS.sub("", t)
    return t or None
