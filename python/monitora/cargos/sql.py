"""
Literais SQL do PostgreSQL usados pela migration e pela correção dos apelidos.

literal_sql("TÉCNICO D'ÁGUA") → 'TÉCNICO D''ÁGUA'. Texto com caractere invisível ou de controle vira
E'…' com a sequência de escape do PostgreSQL (barra, u e quatro dígitos hexadecimais), para nenhum
invisível ficar no arquivo .sql.
"""

_BARRA = chr(92)
_SEM_ESCAPE_VISIVEL = {0x00A0, 0x2007, 0x202F}


def _visivel(c):
    return c.isprintable() and ord(c) not in _SEM_ESCAPE_VISIVEL


def literal_sql(texto):
    if all(_visivel(c) for c in texto):
        return "'" + texto.replace("'", "''") + "'"
    partes = []
    for c in texto:
        if c == "'":
            partes.append("''")
        elif c == _BARRA:
            partes.append(_BARRA * 2)
        elif _visivel(c):
            partes.append(c)
        else:
            partes.append(_BARRA + f"u{ord(c):04x}")
    return "E'" + "".join(partes) + "'"
