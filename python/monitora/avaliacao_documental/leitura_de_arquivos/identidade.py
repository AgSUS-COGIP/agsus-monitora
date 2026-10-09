"""
Documento de identificação e registro em conselho: só o TIPO do documento
(nunca número, filiação, data de nascimento…). O nome e o CPF são conferidos
em `leitura` (pessoas.py), como nos outros documentos.

  identidade   RG, CIN (identidade nacional), CNH, PASSAPORTE, RNE/CRNM,
               CARTEIRA_PROFISSIONAL (a de conselho, que também identifica)
  registro     o conselho (COREN, CRM, CRP, CRESS, CREA…), se o texto diz
               que o registro está ativo/regular e a validade, se houver
"""

import re

from .texto import datas_no_texto, dobrar, iso

IDENTIDADES = (
    ("CIN", r"carteira de identidade nacional|identidade nacional"),
    ("CNH", r"carteira nacional de habilitacao|permissao para dirigir|habilitacao|detran|denatran|senatran"),
    ("PASSAPORTE", r"passaporte|passport"),
    ("RNE", r"registro nacional (?:de )?estrangeiro|carteira de registro nacional migratorio|crnm"),
    (
        "RG",
        r"carteira de identidade|registro geral|secretaria (?:de estado )?(?:da )?seguranca|instituto de identificacao|\brg\b",
    ),
    (
        "CARTEIRA_PROFISSIONAL",
        r"conselho (?:regional|federal)|carteira de identidade profissional|cedula de identidade profissional",
    ),
)
CONSELHOS = (
    "COREN",
    "CRM",
    "CRP",
    "CRESS",
    "CREA",
    "CRF",
    "CRO",
    "CREFITO",
    "CRN",
    "CRBM",
    "CRMV",
    "CRBIO",
    "CREF",
    "CRFA",
    "CRTR",
    "CRQ",
    "CFT",
    "CRT",
    "OAB",
    "CRA",
    "CRC",
    "CORECON",
)
_CONSELHO = re.compile(r"(?<![a-z])(" + "|".join(c.lower() for c in CONSELHOS) + r")(?![a-z])")
_ATIVO = re.compile(r"(?<![a-z])(ativ[oa]|regular|em dia|adimplente|habilitad[oa])(?![a-z])")
_INATIVO = re.compile(r"(?<![a-z])(inativ[oa]|cancelad[oa]|suspens[oa]|irregular|baixad[oa]|inadimplente)(?![a-z])")
_VALIDADE = re.compile(r"(?:valid[oa]?(?:e|ade)?\s*(?:ate|:)?|vencimento\s*:?)\s*$")
_REGISTRO_MTE = re.compile(
    r"ministerio do trabalho|registro profissional .{0,40}(?:mte|trabalho)|sistema informatizado de registro profissional"
)


def tipo_de_identidade(dobrado):
    for codigo, padrao in IDENTIDADES:
        if re.search(padrao, dobrado):
            return codigo
    return None


def identidade(paginas):
    """[item IDENTIDADE] com o tipo do documento, ou [] se o texto não parece documento de identificação."""
    dobrado = dobrar("\n".join(p.texto for p in paginas))
    tipo = tipo_de_identidade(dobrado)
    if not tipo:
        return []
    return [{"tipo": "IDENTIDADE", "documento": tipo, "pagina": paginas[0].numero if paginas else 1}]


def registro(paginas):
    """[item REGISTRO] com o conselho, se está ativo e a validade; [] sem conselho nem registro do MTE."""
    dobrado = dobrar("\n".join(p.texto for p in paginas))
    m = _CONSELHO.search(dobrado)
    conselho = m.group(1).upper() if m else ("MTE" if _REGISTRO_MTE.search(dobrado) else None)
    if not conselho:
        return []
    ativo = False if _INATIVO.search(dobrado) else (True if _ATIVO.search(dobrado) else None)
    validade = None
    for d in datas_no_texto(dobrado):
        if _VALIDADE.search(dobrado[max(0, d.inicio - 25) : d.inicio]):
            validade = d.ultimo_dia()
    return [
        {
            "tipo": "REGISTRO",
            "conselho": conselho,
            "ativo": ativo,
            "validade": iso(validade),
            "pagina": paginas[0].numero if paginas else 1,
        }
    ]
