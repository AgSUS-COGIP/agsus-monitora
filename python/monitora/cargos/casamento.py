"""
Casamento de uma grafia de cargo (texto livre das tabelas do MONITORA) com a tabela oficial de
cargos (public."TD_CARGO", carga da planilha "CARGOS SI - SIP").

A grafia entra normalizada (monitora.cargos.normalizacao, a mesma regra do banco). As regras, na
ordem em que são tentadas:

    EXATA       a grafia é o nome oficial (atual ou anterior: NOME_ANTERIOR do CSV)  alta (1,00)
    LIMPEZA     é o nome oficial depois de tirar o "CARGO 12:" do começo, o gênero
                ("(A)", "/A", "ENFERMEIRA" → ENFERMEIRO), a carga horária (só onde o
                cargo não distingue 20H/40H), a cota e o cadastro reserva do fim
                ("AMPLA CONCORRENCIA", "PPIQ", "CR"…) e os parênteses              alta (0,98)
    SINONIMO    sinônimo óbvio da lista SINONIMOS (AIS, AISAN, ACE, ASB, TSB,
                "TECNICO EM ENFERMAGEM", DENTISTA…)                                alta (0,95)
    CONECTIVOS  igual ao nome oficial sem as palavras de ligação (DE, DA, EM, A…)
                e só a um cargo                                                    alta (0,95)
    PREFIXO     os primeiros trechos separados por " - " casam por uma das regras
                acima e o resto é local, cota ou vaga ("ENFERMEIRO - DSEI
                YANOMAMI - 18 VAGAS")                                              alta (0,90)
                — vira SUGESTÃO (0,75) se o cargo é sintético ou tem variações
                ("ANALISTA ADMINISTRATIVO" × "ANALISTA ADMINISTRATIVO - LOGISTICA")
    SIMILARIDADE difflib.SequenceMatcher ≥ 0,85 entre o cargo limpo e o nome oficial que
                começa pela mesma palavra (erro de digitação), só como SUGESTÃO,
                com a razão como confiança                                         média
    CONTIDO     as palavras do nome oficial estão todas, na ordem, no cargo limpo,
                que tem palavras a mais ("ENFERMEIRO RESPONSAVEL TECNICO"); o nome
                mais longo, se for um só; só como SUGESTÃO (0,50 a 0,80)            média

MÉDICO e CIRURGIÃO DENTISTA distinguem 20H e 40H: sem a carga horária na grafia, não casam
(observação FALTA_CARGA_HORARIA); com outra carga (30H…), também não.

Só biblioteca padrão.
"""

import csv
import difflib
import pathlib
import re
from dataclasses import dataclass, field

from monitora.cargos.normalizacao import normalizar

ARQUIVO_CARGOS = pathlib.Path(__file__).with_name("cargos_si_sip.csv")

ALTA = "ALTA"
MEDIA = "MEDIA"
SEM = "SEM"

CONFIANCA = {
    "EXATA": 1.0,
    "LIMPEZA": 0.98,
    "SINONIMO": 0.95,
    "CONECTIVOS": 0.95,
    "PREFIXO": 0.9,
    "PREFIXO_AMBIGUO": 0.75,
}
LIMIAR_SIMILARIDADE = 0.85

# Cargos que distinguem a carga horária: base → {horas: nome oficial}.
CARGA_HORARIA = {
    "MEDICO": {20: "MEDICO 20H", 40: "MEDICO 40H"},
    "CIRURGIAO DENTISTA": {20: "CIRURGIAO DENTISTA 20H", 40: "CIRURGIAO DENTISTA 40H"},
}

# Sinônimos óbvios: o texto limpo inteiro → nome oficial (ou base de CARGA_HORARIA).
SINONIMOS = {
    "AIS": "AGENTE INDIGENA DE SAUDE",
    "AISAN": "AGENTE INDIGENA DE SANEAMENTO",
    "ACE": "AGENTE DE COMBATE A ENDEMIAS",
    "ASB": "AUXILIAR DE SAUDE BUCAL",
    "TSB": "TECNICO EM SAUDE BUCAL",
    "TECNICO EM ENFERMAGEM": "TECNICO DE ENFERMAGEM",
    "AUXILIAR EM SAUDE BUCAL": "AUXILIAR DE SAUDE BUCAL",
    "TECNICO DE SAUDE BUCAL": "TECNICO EM SAUDE BUCAL",
    "TECNICO EM LABORATORIO": "TECNICO DE LABORATORIO",
    "TECNICO EM EDIFICACOES": "TECNICO DE EDIFICACOES",
    "AGENTE DE COMBATE AS ENDEMIAS": "AGENTE DE COMBATE A ENDEMIAS",
    "AGENTE INDIGENA DE SAUDE AIS": "AGENTE INDIGENA DE SAUDE",
    "AGENTE INDIGENA DE SANEAMENTO AISAN": "AGENTE INDIGENA DE SANEAMENTO",
    "DENTISTA": "CIRURGIAO DENTISTA",
    "ODONTOLOGO": "CIRURGIAO DENTISTA",
    "MEDICO CLINICO GERAL": "MEDICO",
    "MEDICO CLINICO": "MEDICO",
    "MEDICO GENERALISTA": "MEDICO",
    "ARQUITETO URBANISTA": "ARQUITETO E URBANISTA",
    "ARQUITETO": "ARQUITETO E URBANISTA",
    "INTERPRETE": "INTERPRETE INDIGENA",
    "VETERINARIO": "MEDICO VETERINARIO",
    "MEDICO DE FAMILIA E COMUNIDADE": "MEDICO ESPECIALISTA - MFC",
    "MEDICO DA FAMILIA E COMUNIDADE": "MEDICO ESPECIALISTA - MFC",
    "MEDICO DE FAMILIA": "MEDICO ESPECIALISTA - MFC",
    "MEDICO DA FAMILIA": "MEDICO ESPECIALISTA - MFC",
    "MEDICO ESPECIALISTA EM MEDICINA DE FAMILIA E COMUNIDADE": "MEDICO ESPECIALISTA - MFC",
    "MEDICO ESPECIALISTA MFC": "MEDICO ESPECIALISTA - MFC",
    "MFC": "MEDICO ESPECIALISTA - MFC",
}

CONECTIVOS = frozenset({"DE", "DA", "DO", "DAS", "DOS", "EM", "E", "A", "AS", "O", "OS", "NA", "NO", "PARA"})

_CARGO_N = re.compile(r"^CARGO\s*\d+\s*[:.\-]?\s*")
_GENERO = re.compile(r"\((?:A|O|AS|OS|A/O|O/A)\)|(?<=[A-Z])/(?:A|AS)\b")
_HORAS = re.compile(r"\b(\d{2})\s*(?:H|HS|HRS|HORAS)\b(?:\s*SEMANAIS)?")
_PARENTESES = re.compile(r"\s*\([^)]*\)")
_COTA_NO_FIM = re.compile(
    r"(?:\s+|^)(?:AMPLA CONCORRENCIA|PRETOS E PARDOS|PESSOAS? COM DEFICIENCIA|CADASTRO RESERVA|"
    r"EXCLUSIVA PARA \w+|VAGA EXCLUSIVA \w+|PPIQ|PPQ|PCD|PP|AC|CR|PNE)$"
)
_TRECHOS = re.compile(r"\s*-\s+|\s+-\s*")


@dataclass(frozen=True)
class Cargo:
    codigo: int
    nome: str
    sintetico: bool
    nomes_anteriores: tuple = ()

    @property
    def nomes(self):
        return (self.nome, *self.nomes_anteriores)


@dataclass
class Catalogo:
    cargos: list
    por_nome: dict = field(default_factory=dict)
    por_esqueleto: dict = field(default_factory=dict)
    feminino: dict = field(default_factory=dict)
    com_variacoes: set = field(default_factory=set)

    def __post_init__(self):
        for c in self.cargos:
            for nome in c.nomes:
                self.por_nome[nome] = c
                self.por_esqueleto.setdefault(esqueleto(nome), []).append(c)
        palavras = {p for c in self.cargos for nome in c.nomes for p in re.split(r"[ ,\-]+", nome) if p}
        for p in palavras:
            femininas = []
            if p.endswith("OR"):
                femininas.append(p + "A")
            elif p.endswith("O"):
                femininas.append(p[:-1] + "A")
            for f in femininas:
                if f not in palavras:
                    self.feminino[f] = p
        for c in self.cargos:
            if any(o.nome.startswith(c.nome + " - ") for o in self.cargos):
                self.com_variacoes.add(c.nome)


@dataclass(frozen=True)
class Casamento:
    nivel: str  # ALTA, MEDIA ou SEM
    codigo: int | None = None
    cargo: str | None = None
    regra: str | None = None
    confianca: float | None = None
    observacao: str | None = None


def ler_catalogo(caminho=ARQUIVO_CARGOS):
    with open(caminho, encoding="utf-8", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    return Catalogo(
        [
            Cargo(
                int(r["CODIGO"]),
                normalizar(r["NOME"]),
                r["SINTETICO"] == "S",
                tuple(normalizar(n) for n in (r.get("NOME_ANTERIOR") or "").split("|") if n.strip()),
            )
            for r in linhas
        ]
    )


def esqueleto(texto):
    """O texto sem as palavras de ligação e sem hífens/vírgulas: "TECNICO EM SAUDE BUCAL" → "TECNICO SAUDE BUCAL"."""
    return " ".join(p for p in re.split(r"[ ,\-]+", texto) if p and p not in CONECTIVOS)


def _sem_genero(texto, catalogo):
    texto = _GENERO.sub("", texto)
    return " ".join(catalogo.feminino.get(p, p) for p in texto.split(" ") if p)


def _limpo(texto, catalogo):
    """O trecho sem gênero, horas, parênteses e cota do fim, e com hífen interno como espaço."""
    t = _CARGO_N.sub("", texto)
    t = _sem_genero(t, catalogo)
    t = _HORAS.sub(" ", t)
    t = _PARENTESES.sub(" ", t)
    t = re.sub(r"(?<=\w)-(?=\w)", " ", t)
    t = re.sub(r"[.,;:]", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" -")
    anterior = None
    while anterior != t:
        anterior = t
        t = _COTA_NO_FIM.sub("", t).strip(" -")
    return t


def _horas(texto):
    return {int(m.group(1)) for m in _HORAS.finditer(texto)}


def _pelo_nome(nome, horas, catalogo):
    """Nome oficial (ou base que distingue carga horária) → (Cargo | None, observação)."""
    if nome in CARGA_HORARIA:
        if len(horas) != 1:
            return None, "FALTA_CARGA_HORARIA" if not horas else "CARGA_HORARIA_AMBIGUA"
        alvo = CARGA_HORARIA[nome].get(next(iter(horas)))
        if alvo is None:
            return None, "CARGA_HORARIA_SEM_CARGO"
        return catalogo.por_nome[alvo], None
    return catalogo.por_nome.get(nome), None


def _casar_trecho(trecho, horas, catalogo):
    """Casa um trecho (sem o resto da grafia). Devolve (Cargo, regra) | (None, observação)."""
    if trecho in catalogo.por_nome:
        return catalogo.por_nome[trecho], "EXATA"
    limpo = _limpo(trecho, catalogo)
    if not limpo:
        return None, None
    cargo, obs = _pelo_nome(limpo, horas, catalogo)
    if cargo:
        return cargo, "LIMPEZA"
    if obs:
        return None, obs
    if limpo in SINONIMOS:
        cargo, obs = _pelo_nome(SINONIMOS[limpo], horas, catalogo)
        return (cargo, "SINONIMO") if cargo else (None, obs)
    candidatos = catalogo.por_esqueleto.get(esqueleto(limpo), [])
    if len(candidatos) == 1:
        return candidatos[0], "CONECTIVOS"
    base = SINONIMOS.get(esqueleto(limpo))
    if base:
        cargo, obs = _pelo_nome(base, horas, catalogo)
        return (cargo, "SINONIMO") if cargo else (None, obs)
    return None, None


def _contido(texto, catalogo):
    """O cargo de mais palavras cujas palavras (sem conectivos) estão todas, na ordem, no texto."""
    palavras = esqueleto(texto).split(" ")
    melhores, tamanho = [], 0
    for c in catalogo.cargos:
        alvo = esqueleto(c.nome).split(" ")
        it = iter(palavras)
        if len(alvo) < len(palavras) and all(p in it for p in alvo):
            if len(alvo) > tamanho:
                melhores, tamanho = [c], len(alvo)
            elif len(alvo) == tamanho:
                melhores.append(c)
    if len(melhores) != 1:
        return None, 0.0
    return melhores[0], round(0.5 + 0.3 * tamanho / len(palavras), 3)


def _similar(texto, catalogo):
    """O cargo mais parecido (letra a letra, sem conectivos) que começa pela mesma palavra."""
    alvo = esqueleto(texto)
    primeira = alvo.split(" ")[0]
    melhor, razao = None, 0.0
    for c in catalogo.cargos:
        nome = esqueleto(c.nome)
        if nome.split(" ")[0] != primeira and difflib.SequenceMatcher(None, primeira, nome.split(" ")[0]).ratio() < 0.8:
            continue
        r = difflib.SequenceMatcher(None, alvo, nome).ratio()
        if r > razao:
            melhor, razao = c, r
    return melhor, razao


def casar(grafia_normalizada, catalogo):
    """Casa uma grafia já normalizada com o catálogo. Devolve um Casamento."""
    g = grafia_normalizada or ""
    if not g:
        return Casamento(SEM)
    horas = _horas(g)
    trechos = _TRECHOS.split(_CARGO_N.sub("", g))
    observacao = None
    for k in range(len(trechos), 0, -1):
        cargo, regra = _casar_trecho(" - ".join(trechos[:k]), horas, catalogo)
        if cargo is None:
            observacao = observacao or regra
            continue
        if k == len(trechos):
            if regra == "EXATA" and g not in cargo.nomes:
                regra = "LIMPEZA"
            return Casamento(ALTA, cargo.codigo, cargo.nome, regra, CONFIANCA[regra])
        if cargo.sintetico or cargo.nome in catalogo.com_variacoes:
            obs = "CARGO_SINTETICO" if cargo.sintetico else "CARGO_COM_VARIACOES"
            return Casamento(MEDIA, cargo.codigo, cargo.nome, "PREFIXO", CONFIANCA["PREFIXO_AMBIGUO"], obs)
        return Casamento(ALTA, cargo.codigo, cargo.nome, "PREFIXO", CONFIANCA["PREFIXO"])
    if observacao:
        return Casamento(SEM, observacao=observacao)
    limpo = _limpo(trechos[0], catalogo)
    if not limpo:
        return Casamento(SEM)
    for regra, (cargo, confianca) in (
        ("CONTIDO", _contido(limpo, catalogo)),
        ("SIMILARIDADE", _similar(limpo, catalogo)),
    ):
        if cargo is None or (regra == "SIMILARIDADE" and confianca < LIMIAR_SIMILARIDADE):
            continue
        if cargo.nome.rsplit(" ", 1)[0] in CARGA_HORARIA and len(horas) != 1:
            return Casamento(SEM, observacao="FALTA_CARGA_HORARIA")
        return Casamento(MEDIA, cargo.codigo, cargo.nome, regra, round(confianca, 3))
    return Casamento(SEM)
