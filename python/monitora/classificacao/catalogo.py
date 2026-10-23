"""
Catálogo da classificação (cópia fiel de src/lib/classificacao/catalogo.ts): os
critérios de desempate que a regra do edital escolhe e ordena (cada um sabe
ler o próprio valor do candidato e dizer o dado que falta), os motivos de
eliminação, as situações que aguardam análise, os itens do ajuste de recurso e
as modalidades escritas no texto da inscrição.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from .numeros import idade_na_data, segundos_de_vida
from .semantica_js import aparar, texto_js

DIRECOES = ("SIM_PRIMEIRO", "NAO_PRIMEIRO", "MAIOR_PRIMEIRO", "MENOR_PRIMEIRO")


def _sim(valor):
    return None if valor is None else bool(valor)


def _positivo(valor):
    return None if valor is None else valor > 0


def _falta_da_idade(_c, ctx):
    return "data de corte (fim das inscrições)" if not ctx.data_corte else "data de nascimento"


@dataclass(frozen=True)
class Criterio:
    codigo: str
    nome: str
    rotulo_curto: str
    tipo: str
    direcao: str
    ler: Any
    falta: Any


def _campo(nome):
    return lambda c, _ctx: getattr(c, nome)


def _fixo(frase):
    return lambda _c, _ctx: frase


CATALOGO_DE_CRITERIOS = (
    Criterio(
        "IDOSO_60",
        "60 anos ou mais na data de corte",
        "60+",
        "booleano",
        "SIM_PRIMEIRO",
        lambda c, ctx: (lambda idade: None if idade is None else idade >= 60)(
            idade_na_data(c.dataNascimento, ctx.data_corte)
        ),
        _falta_da_idade,
    ),
    Criterio(
        "INDIGENA_COMPROVADO",
        "Ser comprovadamente indígena",
        "indígena comprovado",
        "booleano",
        "SIM_PRIMEIRO",
        lambda c, _ctx: _positivo(c.pontuacaoEtnica),
        _fixo("pontuação étnica"),
    ),
    Criterio(
        "EXP_SAUDE_INDIGENA",
        "Maior tempo de experiência na saúde indígena",
        "exp. saúde indígena",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("expSaudeIndigena"),
        _fixo("tempo de experiência na saúde indígena"),
    ),
    Criterio(
        "EXP_ATENCAO_BASICA",
        "Maior tempo de experiência na atenção básica",
        "exp. atenção básica",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("expAtencaoBasica"),
        _fixo("tempo de experiência na atenção básica"),
    ),
    Criterio(
        "NOTA_DOCUMENTAL",
        "Maior pontuação na avaliação documental (curricular)",
        "nota documental",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("notaDocumental"),
        _fixo("nota documental"),
    ),
    Criterio(
        "NOTA_ENTREVISTA",
        "Maior pontuação na entrevista",
        "nota da entrevista",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("notaEntrevista"),
        _fixo("nota da entrevista"),
    ),
    Criterio(
        "MAIOR_IDADE",
        "Maior idade",
        "idade",
        "numero",
        "MAIOR_PRIMEIRO",
        lambda c, ctx: segundos_de_vida(c.dataNascimento, c.horaNascimento, ctx.data_corte),
        _falta_da_idade,
    ),
    Criterio(
        "PONTUACAO_ETNICA",
        "Maior pontuação no critério étnico",
        "pontuação étnica",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("pontuacaoEtnica"),
        _fixo("pontuação étnica"),
    ),
    Criterio(
        "PONTUACAO_EXPERIENCIA",
        "Maior pontuação de experiência profissional",
        "pontuação de experiência",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("pontuacaoExperiencia"),
        _fixo("pontuação de experiência"),
    ),
    Criterio(
        "PONTUACAO_FORMACAO",
        "Maior pontuação de formação acadêmica",
        "pontuação de formação",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("pontuacaoFormacao"),
        _fixo("pontuação de formação"),
    ),
    Criterio(
        "PONTUACAO_CURSOS",
        "Maior pontuação em cursos de aperfeiçoamento",
        "pontuação de cursos",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("pontuacaoCursos"),
        _fixo("pontuação de cursos"),
    ),
    Criterio(
        "EXP_PROFISSIONAL_TEMPO",
        "Maior tempo de experiência profissional",
        "tempo de experiência",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("expProfissional"),
        _fixo("tempo de experiência profissional"),
    ),
    Criterio(
        "PCD",
        "Ser pessoa com deficiência",
        "PcD",
        "booleano",
        "SIM_PRIMEIRO",
        lambda c, _ctx: _sim(c.pcd),
        _fixo("PcD"),
    ),
    Criterio(
        "EXP_ALTA_COMPLEXIDADE",
        "Maior tempo de experiência em média e alta complexidade",
        "exp. alta complexidade",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("expAltaComplexidade"),
        _fixo("tempo de experiência em média e alta complexidade"),
    ),
    Criterio(
        "EXP_SAUDE_DIGITAL",
        "Maior tempo de experiência profissional em saúde digital",
        "exp. saúde digital",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("expSaudeDigital"),
        _fixo("tempo de experiência em saúde digital"),
    ),
    Criterio(
        "MAIOR_ESCOLARIDADE",
        "Maior nível de escolaridade relacionado ao cargo",
        "escolaridade",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("nivelEscolaridade"),
        _fixo("nível de escolaridade"),
    ),
    Criterio(
        "NOTA_CONHECIMENTOS_ESPECIFICOS",
        "Maior nota em conhecimentos específicos (prova)",
        "conhecimentos específicos",
        "numero",
        "MAIOR_PRIMEIRO",
        _campo("notaConhecimentosEspecificos"),
        _fixo("nota de conhecimentos específicos"),
    ),
)
CRITERIO_POR_CODIGO = {c.codigo: c for c in CATALOGO_DE_CRITERIOS}

METODOS_DE_EMPATE_FINAL = ("SORTEIO", "ORDEM_INSCRICAO", "MESMA_POSICAO", "DECISAO_MANUAL")
NUMERACOES = ("DENSA", "SALTANDO")
EMPATE_NAS_LISTAS = ("CRITERIOS", "MESMA_POSICAO")
PARCIAIS_DA_DOCUMENTAL = ("FORMACAO", "CURSOS", "EXPERIENCIA", "ETNICO")
COMPONENTES_DA_NOTA = ("DOCUMENTAL", "ENTREVISTA", "ART")

ITENS_DO_AJUSTE = (
    {"codigo": "FORMACAO", "rotulo": "Formação acadêmica", "campo": "pontuacaoFormacao"},
    {"codigo": "CURSOS", "rotulo": "Cursos de aperfeiçoamento", "campo": "pontuacaoCursos"},
    {"codigo": "EXPERIENCIA", "rotulo": "Experiência profissional", "campo": "pontuacaoExperiencia"},
    {"codigo": "ETNICO", "rotulo": "Pertencimento étnico", "campo": "pontuacaoEtnica"},
    {"codigo": "DOCUMENTAL", "rotulo": "Nota documental", "campo": "notaDocumental"},
    {"codigo": "ENTREVISTA", "rotulo": "Nota da entrevista", "campo": "notaEntrevista"},
    {"codigo": "ART", "rotulo": "Nota da ART", "campo": "notaArt"},
)
ITEM_DO_AJUSTE_POR_CODIGO = {i["codigo"]: i for i in ITENS_DO_AJUSTE}

_COMPETENCIA = re.compile(r"^COMPETENCIA_([0-9]{1,2})$")


def ordem_da_competencia(codigo):
    """ "COMPETENCIA_3" → 3; outro código → None."""
    m = _COMPETENCIA.match(texto_js(codigo or ""))
    return int(m.group(1)) if m else None


NIVEIS = ("superior", "tecnico", "medio", "fundamental")

MOTIVOS_DE_ELIMINACAO = {
    "NAO_HABILITADO": "Não habilitado na avaliação documental",
    "SEM_NOTA_DOCUMENTAL": "Sem nota da avaliação documental",
    "ABAIXO_NOTA_MINIMA_DOCUMENTAL": "Abaixo da nota mínima da avaliação documental",
    "NAO_CONVOCADO": "Fora do limite de convocação para entrevista",
    "SEM_ENTREVISTA": "Sem entrevista lançada",
    "AUSENTE": "Ausente na entrevista",
    "INAPTO_ENTREVISTA": "Inapto na entrevista",
    "SEM_NOTA_ENTREVISTA": "Sem nota da entrevista",
    "ABAIXO_NOTA_MINIMA_ENTREVISTA": "Abaixo da nota mínima da entrevista",
    "COMPETENCIA_ABAIXO_MINIMO": "Competência da entrevista abaixo do mínimo",
    "COMPETENCIA_ELIMINATORIA": "Nota eliminatória em competência da entrevista",
    "SEM_PARECER_ENTREVISTA": "Entrevista sem parecer de apto",
}

SITUACOES_AGUARDANDO_ANALISE = (
    "pendente",
    "em analise",
    "revisar",
    "em revisao",
    "aguardando analise",
    "nao analisado",
)

_MARCAS = re.compile("[̀-ͯ]")


def sem_acento(valor) -> str:
    """String(valor ?? "").normalize("NFD") sem as marcas, em minúsculas (sem aparar)."""
    return _MARCAS.sub("", unicodedata.normalize("NFD", texto_js(valor))).lower()


# \b do JS é ASCII: re.ASCII.
_AC = re.compile(r"ampla|\bac\b", re.ASCII)
_PCD = re.compile(r"defici|\bpcd\b|\bpne\b", re.ASCII)
_PP = re.compile(r"pret|pard|\bpp\b|negr", re.ASCII)
_PI = re.compile(r"indigen|\bpi\b", re.ASCII)
_PQ = re.compile(r"quilomb|\bpq\b", re.ASCII)
_TRANS = re.compile(r"\btrans\b|transgener|travesti", re.ASCII)


def codigos_da_modalidade(valor) -> list[str]:
    """Os códigos de modalidade de um texto ("Ampla concorrência / Pretos e pardos", "PcD"). Sem nenhum → []."""
    t = sem_acento(valor)
    if not aparar(t):
        return []
    codigos = []
    for codigo, padrao in (("AC", _AC), ("PCD", _PCD), ("PP", _PP), ("PI", _PI), ("PQ", _PQ), ("TRANS", _TRANS)):
        if padrao.search(t):
            codigos.append(codigo)
    return codigos


_SIM = re.compile(r"^(s|sim|true|1|x|pcd|yes)\b", re.ASCII)


def sim_ou_nao(valor) -> bool:
    """ "Sim", "S", "true", "1", "PcD" → True; "Não", "N", "" → False."""
    if isinstance(valor, bool):
        return valor
    t = aparar(sem_acento(valor))
    if not t:
        return False
    return bool(_SIM.match(t))
