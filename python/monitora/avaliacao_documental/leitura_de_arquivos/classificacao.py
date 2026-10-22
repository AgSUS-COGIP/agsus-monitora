"""
O TIPO do documento pelo texto (dobrado: minúsculo e sem acento), para quando
a leitura não acha item (ou o anexo é de pergunta sem item na ficha) — antes
quase tudo saía OUTRO. A ordem importa: o mais específico primeiro.

`deve_ter_o_nome(tipo)` diz se o documento precisa trazer o nome do candidato
(o comprovante de residência pode estar em nome de outra pessoa; o tipo
desconhecido não se sabe): só aí o nome ausente vira NOME_DIVERGENTE.
"""

import re

from .experiencia import DECLARACAO_DE_VINCULO, tipo_do_documento
from .identidade import _CONSELHO, tipo_de_identidade

# (código, padrão no texto dobrado), do mais específico para o mais geral.
TIPOS = (
    (
        "COMPROVANTE_RESIDENCIA",
        r"comprovante de (?:residencia|endereco)|conta de (?:luz|agua|energia|telefone|gas)|energia eletrica|"
        r"consumo (?:de energia|em kwh|kwh)|\bkwh\b|leitura (?:atual|anterior)|saneamento|abastecimento de agua|"
        r"fatura (?:de|do|da)? ?(?:energia|agua|internet|telefone|cartao)|nota fiscal de energia|"
        r"declaracao de (?:residencia|endereco)",
    ),
    (
        "TITULO_ELEITOR",
        r"titulo (?:de )?eleitor|justica eleitoral|zona eleitoral|secao eleitoral|tribunal (?:superior|regional) eleitoral|"
        r"quitacao eleitoral",
    ),
    ("RESERVISTA", r"reservista|dispensa de incorporacao|certificado de alistamento militar"),
    (
        "CERTIDAO_CIVIL",
        r"certidao de (?:nascimento|casamento|obito|uniao estavel)|registro civil das pessoas naturais|oficial de registro civil",
    ),
    (
        "HISTORICO_ESCOLAR",
        r"historico (?:escolar|academico)|coeficiente de rendimento|componentes? curricular|disciplinas cursadas|"
        r"integralizacao curricular",
    ),
    ("CPF", r"comprovante de (?:situacao cadastral|inscricao) no cpf|cadastro de pessoas? fisicas?"),
    ("PIS", r"pis/pasep|\bnis\b"),
    ("CURRICULO", r"curriculum|curriculo|lattes|experiencia profissional\s*\n|formacao academica\s*\n"),
    ("LAUDO", r"laudo|cid[- ]?10|cid:|atestado medico|pessoa com deficiencia|relatorio medico"),
    ("AUTODECLARACAO", r"autodeclara|declaro-me|me autodeclaro|heteroidentificacao"),
    ("CERTIFICADO", r"certificamos|certifica que|certificado de (?:conclusao|participacao)|certificado"),
)
_DIPLOMA = re.compile(r"diploma|colou grau|confere o (?:titulo|grau)|outorga")
_REGISTRO = re.compile(r"inscri|registro|carteira|certidao|anuidade|regularidade|habilitad|cedula")
SEM_NOME_OBRIGATORIO = frozenset({"COMPROVANTE_RESIDENCIA", "OUTRO"})


def classificar(dobrado):
    """O código do tipo do documento (COMPROVANTE_RESIDENCIA, TITULO_ELEITOR, HISTORICO_ESCOLAR, DIPLOMA,
    CERTIFICADO, CTPS, DECLARACAO, REGISTRO_COREN, RG, CNH…) ou OUTRO."""
    dobrado = dobrado or ""
    padroes = dict(TIPOS)

    def tem(codigo):
        return re.search(padroes[codigo], dobrado) is not None

    experiencia = tipo_do_documento(dobrado)
    if experiencia in ("CTPS", "HOLERITE", "CERTIDAO", "CONTRATO"):
        return experiencia
    for codigo in ("COMPROVANTE_RESIDENCIA", "TITULO_ELEITOR", "RESERVISTA", "CERTIDAO_CIVIL"):
        if tem(codigo):
            return codigo
    identidade = tipo_de_identidade(dobrado)
    conselho = _CONSELHO.search(dobrado)
    if conselho and _REGISTRO.search(dobrado):
        return "REGISTRO_" + conselho.group(1).upper()
    if identidade and identidade != "CARTEIRA_PROFISSIONAL":
        return identidade
    for codigo in ("HISTORICO_ESCOLAR", "AUTODECLARACAO", "LAUDO", "CPF", "PIS"):
        if tem(codigo):
            return codigo
    if _DIPLOMA.search(dobrado):
        return "DIPLOMA"
    if experiencia == "DECLARACAO" and DECLARACAO_DE_VINCULO.search(dobrado):
        return "DECLARACAO"
    for codigo in ("CERTIFICADO", "CURRICULO"):
        if tem(codigo):
            return codigo
    if experiencia == "DECLARACAO":
        return "DECLARACAO"
    return identidade or "OUTRO"


def deve_ter_o_nome(tipo):
    return tipo not in SEM_NOME_OBRIGATORIO
