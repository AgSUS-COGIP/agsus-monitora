"""
QUAL LINHA É A CONTRATAÇÃO ("CONTRATADO EM OUTRA LISTA"), REGRA VERSÃO 1

Quem concorre à cota concorre também à ampla, e o Empregare separa a vaga por modalidade
("MÉDICO DE FAMÍLIA E COMUNIDADE" e "… PPIQ"): a mesma pessoa tem uma linha em cada lista do
edital. Quando a planilha marca Contratado nas duas, com a MESMA matrícula, é uma contratação
só — e o edital contava duas e gastava duas vagas. Esta regra decide, sem mudar o status
gravado, qual linha é a contratação; as outras ficam "Contratado em outra lista" (situação
efetiva, guardada no instantâneo TB_CONTRATACAO_APROVADO, migration 20261024120000), que não
conta nos contratados nem ocupa vaga.

A REGRA (o que o edital diz e o banco tem)
  As listas não trazem a data da convocação (as linhas vieram de planilha); o que existe é a
  posição de cada linha e até onde cada lista já chamou alguém.
  1. Linha ALCANÇADA: a posição dela está dentro do que a convocação daquela lista já chamou —
     a maior posição com status (Convocado, Contratado, Desistente…) entre os OUTROS candidatos
     da mesma vaga, sem contar as linhas em conflito nem as já "Contratado em outra lista".
  2. Uma só alcançada → é a contratação.
  3. Mais de uma alcançada → a de ampla concorrência (só ampla, sem cota na modalidade): quem
     passa na ampla não ocupa vaga de cota.
  4. Nenhuma alcançada, ou mais de uma (ou nenhuma) de ampla entre as alcançadas → AMBÍGUO: a
     regra não escolhe; a conferência avisa a equipe, que marca a linha pela qual a pessoa não
     foi contratada como "Contratado em outra lista" (o status explícito).
  Sem desempate pela ordem em que a equipe marcou: é a ordem de digitação, não do edital.

CONGELADA
  A primeira decisão fica no instantâneo e não muda sozinha nas rodadas seguintes, mesmo que o
  alcance mude. Ela é refeita só quando a BASE muda — o conjunto de linhas Contratado daquela
  matrícula no edital: uma linha deixa de ser Contratado (inclusive quando a equipe marca o
  status explícito "Contratado em outra lista"), outra passa a ser, ou a lista é substituída.
  O banco apaga a decisão na hora em que a base muda (gatilho do histórico do status) e pede
  este job de novo. Na publicação de uma lista nova do edital, a decisão passa para as linhas
  novas (pelo candidato anterior), sem recalcular. O ambíguo não é decisão: é reavaliado a
  cada rodada.

Ficam fora: a mesma matrícula em editais diferentes (continua como aviso da conferência).
"""

import re
from collections import defaultdict

VERSAO = 1

CONTRATADO = "Contratado"
MIGRACAO = "Migração"
EM_OUTRA_LISTA = "Contratado em outra lista"

CONTRATACAO, OUTRA_LISTA, AMBIGUO = "CONTRATACAO", "OUTRA_LISTA", "AMBIGUO"
UNICA_ALCANCADA = "UNICA_ALCANCADA"
AMPLA_ALCANCADA = "AMPLA_ALCANCADA"
HERDADA = "HERDADA"
NENHUMA_ALCANCADA = "NENHUMA_ALCANCADA"
MAIS_DE_UMA_AMPLA = "MAIS_DE_UMA_AMPLA"
NENHUMA_AMPLA = "NENHUMA_AMPLA"
MOTIVOS = (UNICA_ALCANCADA, AMPLA_ALCANCADA, HERDADA, NENHUMA_ALCANCADA, MAIS_DE_UMA_AMPLA, NENHUMA_AMPLA)

_COTA = re.compile(
    r"pret|pard|ind[ií]gen|pcd|pessoas? com defici|defici[eê]n|quilomb|trans\b|ppiq|ppq|ppp|negr",
    re.IGNORECASE,
)


def eh_ampla(modalidade):
    """Só ampla concorrência ("Ampla Concorrência", “Ampla concorrência”, com erro de digitação…)."""
    texto = str(modalidade or "")
    return bool(re.search(r"ampla", texto, re.IGNORECASE)) and not _COTA.search(texto)


def _modalidade_limpa(modalidade):
    return re.sub(r"^[\"“”']+|[\"“”']+$", "", str(modalidade or "").strip()) or "sem modalidade"


def rotulo(linha):
    """'Ampla Concorrência · 137º · vaga X': como a linha aparece no motivo."""
    partes = [_modalidade_limpa(linha.get("modalidade"))]
    if linha.get("classificacao") is not None:
        partes.append(f"{linha['classificacao']}º")
    if linha.get("vaga"):
        partes.append(f"vaga {linha['vaga']}")
    return " · ".join(partes)


def _base(ids):
    return ",".join(sorted(str(i) for i in ids))


def grupos_em_conflito(linhas):
    """{(edital, vínculo): [linhas Contratado]} com duas ou mais linhas (mesma matrícula, mesmo edital)."""
    por_chave = defaultdict(list)
    for linha in linhas:
        if linha.get("status") == CONTRATADO and linha.get("vinculo") and linha.get("edital"):
            por_chave[(linha["edital"], linha["vinculo"])].append(linha)
    return {chave: sorted(grupo, key=lambda x: str(x["id"])) for chave, grupo in por_chave.items() if len(grupo) >= 2}


def alcance_das_vagas(linhas, em_conflito):
    """{(lista, vaga): maior posição já chamada}, sem as linhas em conflito nem as "em outra lista"."""
    alcance = {}
    for linha in linhas:
        if linha.get("id") in em_conflito or not linha.get("status") or linha.get("status") == EM_OUTRA_LISTA:
            continue
        posicao = linha.get("classificacao")
        if posicao is None:
            continue
        chave = (linha.get("lista"), linha.get("vaga"))
        alcance[chave] = max(alcance.get(chave, posicao), posicao)
    return alcance


def _alcance_de(linha, alcance):
    return alcance.get((linha.get("lista"), linha.get("vaga")))


def alcancada(linha, alcance):
    limite = _alcance_de(linha, alcance)
    posicao = linha.get("classificacao")
    return posicao is not None and limite is not None and posicao <= limite


def _onde_parou(linha, alcance):
    limite = _alcance_de(linha, alcance)
    return "ninguém foi chamado ainda" if limite is None else f"a convocação parou no {limite}º"


def decidir_grupo(grupo, alcance):
    """(id da contratação ou None, motivo) para as linhas em conflito de um grupo."""
    alcancadas = [linha for linha in grupo if alcancada(linha, alcance)]
    if len(alcancadas) == 1:
        return alcancadas[0]["id"], UNICA_ALCANCADA
    if not alcancadas:
        return None, NENHUMA_ALCANCADA
    amplas = [linha for linha in alcancadas if eh_ampla(linha.get("modalidade"))]
    if len(amplas) == 1:
        return amplas[0]["id"], AMPLA_ALCANCADA
    return None, (MAIS_DE_UMA_AMPLA if amplas else NENHUMA_AMPLA)


def texto_do_motivo(linha, grupo, contratacao, motivo, alcance):
    """A explicação que a tela mostra no rótulo (até 500 caracteres)."""
    vencedora = next((x for x in grupo if x["id"] == contratacao), None)
    outras = "; ".join(rotulo(x) for x in grupo if x["id"] != linha["id"])
    if motivo in (NENHUMA_ALCANCADA, MAIS_DE_UMA_AMPLA, NENHUMA_AMPLA):
        porque = {
            NENHUMA_ALCANCADA: "nenhuma das linhas está dentro do que a convocação já chamou",
            MAIS_DE_UMA_AMPLA: "a convocação alcançou a pessoa em mais de uma vaga de ampla concorrência",
            NENHUMA_AMPLA: "a convocação alcançou a pessoa em mais de uma vaga de cota",
        }[motivo]
        texto = (
            f"Mesma matrícula Contratado também em: {outras}. A regra não decide ({porque}): marque a linha "
            "pela qual a pessoa não foi contratada como Contratado em outra lista."
        )
    elif linha["id"] == contratacao:
        porque = {
            UNICA_ALCANCADA: "é a única linha da pessoa dentro do que a convocação já chamou",
            AMPLA_ALCANCADA: "a convocação a alcançou na ampla concorrência, que não ocupa vaga de cota",
            HERDADA: "decisão da lista anterior do edital, mantida na publicação",
        }[motivo]
        texto = f"Esta é a contratação: {porque}. A outra linha ({outras}) fica Contratado em outra lista."
    else:
        porque = {
            UNICA_ALCANCADA: f"só ela está dentro do que a convocação já chamou (aqui, {_onde_parou(linha, alcance)})",
            AMPLA_ALCANCADA: "a convocação alcançou a pessoa nas duas, e quem passa na ampla concorrência não "
            "ocupa vaga de cota",
            HERDADA: "decisão da lista anterior do edital, mantida na publicação",
        }[motivo]
        texto = (
            f"A pessoa foi contratada pela linha {rotulo(vencedora) if vencedora else 'da outra lista'}: {porque}. "
            "Não conta nos contratados nem ocupa vaga desta lista."
        )
    return texto[:500]


def _decisoes_do_grupo(chave, grupo, contratacao, motivo, alcance):
    edital, vinculo = chave
    base = _base(x["id"] for x in grupo)
    saida = []
    for linha in grupo:
        if contratacao is None:
            situacao = AMBIGUO
        else:
            situacao = CONTRATACAO if linha["id"] == contratacao else OUTRA_LISTA
        saida.append(
            {
                "candidato": linha["id"],
                "edital": edital,
                "vinculo": vinculo,
                "situacao": situacao,
                "contratacao": contratacao,
                "motivo": motivo,
                "texto": texto_do_motivo(linha, grupo, contratacao, motivo, alcance),
                "base": base,
                "versao": VERSAO,
            }
        )
    return saida


def _herdar(grupo, por_candidato):
    """A decisão congelada da lista anterior, se as linhas do grupo são exatamente as de um grupo decidido."""
    anteriores = {linha.get("anterior"): linha for linha in grupo}
    if None in anteriores or len(anteriores) != len(grupo):
        return None
    velhas = [por_candidato.get(a) for a in anteriores]
    if any(v is None or v.get("situacao") == AMBIGUO for v in velhas):
        return None
    bases = {v.get("base") for v in velhas}
    if len(bases) != 1 or bases.pop() != _base(anteriores):
        return None
    contratacao_velha = velhas[0].get("contratacao")
    nova = anteriores.get(contratacao_velha)
    return nova["id"] if nova else None


_CAMPOS = ("edital", "vinculo", "situacao", "contratacao", "motivo", "texto", "base", "versao")


def _igual(nova, velha):
    return velha is not None and all(str(nova.get(c)) == str(velha.get(c)) for c in _CAMPOS)


def decidir(linhas, instantaneo):
    """
    Aplica a regra. Devolve {gravar, remover, grupos}: as decisões a gravar (só as que mudaram),
    os candidatos cujo registro sai do instantâneo e, por grupo, o que aconteceu
    (MANTIDA, NOVA, HERDADA ou AMBIGUA), para o resumo.
    """
    por_candidato = {str(r.get("candidato")): r for r in instantaneo or []}
    grupos = grupos_em_conflito(linhas or [])
    em_conflito = {linha["id"] for grupo in grupos.values() for linha in grupo}
    alcance = alcance_das_vagas(linhas or [], em_conflito)

    gravar, ficam, resumo = [], set(), []
    for chave, grupo in sorted(grupos.items()):
        ids = [linha["id"] for linha in grupo]
        base = _base(ids)
        existentes = [por_candidato.get(str(i)) for i in ids]
        congelada = all(
            r is not None and r.get("base") == base and r.get("situacao") != AMBIGUO and r.get("versao") is not None
            for r in existentes
        )
        area = grupo[0].get("area")
        if congelada:
            ficam.update(str(i) for i in ids)
            resumo.append({"edital": chave[0], "area": area, "linhas": len(grupo), "acao": "MANTIDA"})
            continue
        herdada = _herdar(grupo, por_candidato)
        if herdada is not None:
            contratacao, motivo, acao = herdada, HERDADA, "HERDADA"
        else:
            contratacao, motivo = decidir_grupo(grupo, alcance)
            acao = "AMBIGUA" if contratacao is None else "NOVA"
        decisoes = _decisoes_do_grupo(chave, grupo, contratacao, motivo, alcance)
        ficam.update(str(d["candidato"]) for d in decisoes)
        # O grupo vai inteiro: o banco confere que as decisões cobrem toda a base.
        if not all(_igual(d, por_candidato.get(str(d["candidato"]))) for d in decisoes):
            gravar.extend(decisoes)
        resumo.append({"edital": chave[0], "area": area, "linhas": len(grupo), "acao": acao, "motivo": motivo})

    remover = sorted(c for c in por_candidato if c not in ficam)
    return {"gravar": gravar, "remover": remover, "grupos": resumo}


def contratados_por_area(linhas, outra_lista):
    """{área: contratados} como os KPIs contam: Contratado e Migração, menos os "em outra lista" efetivos."""
    contagem = defaultdict(int)
    for linha in linhas or []:
        if linha.get("status") in (CONTRATADO, MIGRACAO) and str(linha.get("id")) not in outra_lista:
            contagem[linha.get("area") or "sem área"] += 1
    return dict(contagem)


def outra_lista_efetiva(instantaneo, linhas):
    """Os candidatos "em outra lista" pelo instantâneo, só se a linha continua Contratado."""
    contratados = {str(x["id"]) for x in linhas or [] if x.get("status") == CONTRATADO}
    return {
        str(r["candidato"])
        for r in instantaneo or []
        if r.get("situacao") == OUTRA_LISTA and str(r.get("candidato")) in contratados
    }


def instantaneo_depois(instantaneo, resultado):
    """O instantâneo como fica depois de gravar o resultado (para o resumo do modo seco)."""
    por_candidato = {str(r.get("candidato")): r for r in instantaneo or []}
    for c in resultado["remover"]:
        por_candidato.pop(c, None)
    for decisao in resultado["gravar"]:
        por_candidato[str(decisao["candidato"])] = decisao
    return list(por_candidato.values())
