"""
A linha do quadro de vagas do edital pelo NOME da vaga das análises: cópia fiel de
private."FC_TOKENS_VAGA" (20261106170100) e private."FC_QUADRO_DA_VAGA" (20261007230000), para a conferência
"Vaga sem linha no quadro" (CLASSIFICACAO_VAGA_SEM_QUADRO) ser feita no robô das conferências e
não no banco (no banco, ~18 ms por vaga distinta: 12 a 15 s por leitura). As funções do banco
continuam lá, usadas pela classificação; quem mudar uma muda a outra (a paridade é conferida
em tests/python/test_quadro_da_vaga.py com casos tirados do banco e no ensaio de
supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql, vaga a vaga).

Semântica do Postgres reproduzida: regexp_replace sem 'g' troca só a primeira ocorrência; `.` casa
quebra de linha e `$` é o fim do texto; `\\s` inclui os espaços Unicode (como o \\s do Python em
str); lower() antes do translate (só as letras listadas perdem o acento; o resto vira separador);
a UF colada e o parêntese sem fim são tratados antes do lower(), com as mesmas classes de letras.
"""

from __future__ import annotations

import re

_EXCEL = re.compile(r"\s+em\s+excel.*\Z", re.IGNORECASE | re.DOTALL)
_PARENTESE_SEM_FIM = re.compile(r"\([^)]*\Z")
# Letra minúscula + sigla de UF no fim da palavra: "OtoniMG" -> "Otoni MG" (antes do lower()).
_UF_COLADA = re.compile(
    r"([a-záàâãäéèêëíìîïóòôõöúùûüç])"
    r"(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)"
    r"(?![A-Za-zÀ-ÿ0-9])"
)
_PARENTESES = re.compile(r"\([^)]*\)")
_SEPARADOR = re.compile(r"[^a-z0-9]+")
_NUMERO = re.compile(r"\d+")
_ACENTOS = str.maketrans("áàâãäéèêëíìîïóòôõöúùûüç", "aaaaaeeeeiiiiooooouuuuc")
_VAZIAS = frozenset({"a", "as", "o", "os", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "para"})
_SOBRAS_ACEITAS = frozenset({"vaga", "vagas", "cadastro", "reserva", "cr"})


def tokens_da_vaga(texto) -> frozenset:
    """private."FC_TOKENS_VAGA": as palavras do nome, com a UF colada na cidade separada, sem
    acento, sem o que vem entre parênteses (ou depois de um parêntese que não fecha) nem depois de
    "em excel", sem as palavras vazias (um conjunto: array_agg(distinct))."""
    t = _EXCEL.sub("", texto or "", count=1)
    t = _PARENTESE_SEM_FIM.sub(" ", t, count=1)
    t = _UF_COLADA.sub(r"\1 \2", t)
    t = _PARENTESES.sub(" ", t).lower().translate(_ACENTOS)
    t = _SEPARADOR.sub(" ", t)
    return frozenset(p for p in t.split(" ") if p and p not in _VAZIAS)


def preparar_quadros(linhas) -> dict:
    """As linhas ativas do quadro ({id, edital, cargo, lotacao}) por edital, já em tokens."""
    por_edital: dict = {}
    for q in linhas or []:
        por_edital.setdefault(q.get("edital"), []).append(
            (q.get("id"), tokens_da_vaga(q.get("cargo")), tokens_da_vaga(q.get("lotacao")))
        )
    return por_edital


def quadro_da_vaga(quadros_do_edital, nome_vaga):
    """private."FC_QUADRO_DA_VAGA": o id da linha do quadro (de preparar_quadros(...)[edital])
    cujo cargo inteiro está no nome da vaga — o cargo mais específico; entre as do mesmo cargo,
    a lotação no nome decide —, ou None quando não há uma só."""
    n = tokens_da_vaga(nome_vaga)
    cargo = []
    for ident, tc, tl in quadros_do_edital or ():
        if not tc or not tc <= n:
            continue
        lotacao = bool(tl) and tl <= n
        # O que sobra do nome além do cargo não pode contradizer a lotação da linha.
        sobra = {t for t in n if t not in tc and not _NUMERO.fullmatch(t) and t not in _SOBRAS_ACEITAS}
        compativel = not tl or sobra <= tl
        cargo.append((ident, len(tc), len(tl), lotacao, compativel))
    if not cargo:
        return None
    maior = max(c[1] for c in cargo)
    melhor = [c for c in cargo if c[1] == maior]
    com_lotacao = [c for c in melhor if c[3]]
    if com_lotacao:
        maior_lotacao = max(c[2] for c in com_lotacao)
        com_lotacao = [c for c in com_lotacao if c[2] == maior_lotacao]
    if len(com_lotacao) == 1:
        return com_lotacao[0][0]
    if not com_lotacao and len(melhor) == 1 and melhor[0][4]:
        return melhor[0][0]
    return None
