"""
PENDÊNCIAS DO EDITAL (o que o gestor decide na tela Lista de aprovados › Pendências)

Detecção em Python, sem rede e sem banco: entra a leitura de pendencias_ler_aprovados (migration
20261026190000) e sai o instantâneo das pendências abertas, por edital, que o job grava em
TB_PENDENCIA_APROVADO (gravar_pendencias_do_edital). Quem decide é o gestor do edital ou o
administrador de Aprovados, pelas RPCs curtas da migration, que marcam a pendência resolvida na hora.

OS CINCO TIPOS
  CONTRATADO_DUAS_MATRICULAS  a mesma pessoa (código do candidato ou, sem ele, o nome) Contratado
                              com duas ou mais matrículas diferentes no mesmo edital. O gestor escolhe
                              qual vínculo vale; as outras linhas recebem o desfecho.
  CONTRATADO_EM_DUAS_LISTAS   o caso que a regra "Contratado em outra lista" não decide (AMBIGUO no
                              instantâneo TB_CONTRATACAO_APROVADO): o gestor escolhe por qual lista a
                              pessoa foi contratada; as outras ficam "Contratado em outra lista" explícito.
  PESSOA_REPETIDA             a mesma pessoa (nome) duas vezes na mesma lista, vaga e modalidade; o
                              gestor diz qual linha fica (a outra sai, sem apagar) ou que são pessoas
                              diferentes. Linhas com códigos de candidato todos diferentes não contam.
  POSICAO_REPETIDA            a mesma posição em duas ou mais linhas da mesma lista, vaga e modalidade,
                              de pessoas diferentes; o gestor confirma o empate previsto no edital ou
                              corrige a posição.
  CONVOCADO_SEM_DESFECHO      Convocado há mais de N dias (padrão 15) numa lista ativa; o gestor
                              registra o desfecho ou a nova data da convocação.

ESCOPO
  As listas vigentes de editais fora do treinamento, ativas ou não (os contratados do edital contam
  as duas). Só o Convocado sem desfecho fica nas listas ativas, como a conferência: lista inativa não
  convoca. As linhas que o job "Contratado em outra lista" já dá como em outra lista não contam como
  matrícula a mais (a contratação é uma só).

A CHAVE
  Cada pendência tem uma chave estável (sha256 do que a identifica). Quando o empate é confirmado ou as
  pessoas são dadas como diferentes, a decisão vale para aquela chave: a mesma pendência não volta. Nos
  tipos em que a chave inclui as linhas (posição e pessoa repetidas), uma linha nova no grupo é uma
  pendência nova; no Convocado, uma nova data é uma pendência nova.

Sem dado pessoal: a leitura traz só ids, hashes curtos do nome, do código e da matrícula, e o detalhe
gravado tem só números, datas e códigos de motivo.
"""

import hashlib
from collections import defaultdict
from datetime import date, timedelta

VERSAO = 1

DUAS_MATRICULAS = "CONTRATADO_DUAS_MATRICULAS"
DUAS_LISTAS = "CONTRATADO_EM_DUAS_LISTAS"
PESSOA_REPETIDA = "PESSOA_REPETIDA"
POSICAO_REPETIDA = "POSICAO_REPETIDA"
CONVOCADO_SEM_DESFECHO = "CONVOCADO_SEM_DESFECHO"
TIPOS = (DUAS_MATRICULAS, DUAS_LISTAS, PESSOA_REPETIDA, POSICAO_REPETIDA, CONVOCADO_SEM_DESFECHO)

CONTRATADO = "Contratado"
CONVOCADO = "Convocado"
DIAS_CONVOCADO = 15
MAX_LINHAS = 50

_COLUNAS = (
    "id",
    "lista",
    "vaga",
    "modalidade",
    "classificacao",
    "status",
    "convocado_em",
    "nome",
    "codigo",
    "vinculo",
    "em_outra_lista",
)


def chave(*partes):
    """sha256 (40 hex) do que identifica a pendência."""
    texto = "|".join("" if p is None else str(p) for p in partes)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:40]


def _dia(valor):
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        return None


def ler_linhas(dados):
    """As linhas da leitura compacta, como dicionários, com o edital, a área e a lista ativa."""
    listas = [
        {"id": x[0], "edital": x[1], "area": x[2], "ativa": bool(x[3])} for x in (dados or {}).get("listas") or []
    ]
    saida = []
    for bruto in (dados or {}).get("linhas") or []:
        linha = dict(zip(_COLUNAS, bruto, strict=False))
        lista = listas[linha["lista"]]
        linha.update(lista=lista["id"], edital=lista["edital"], area=lista["area"], lista_ativa=lista["ativa"])
        saida.append(linha)
    return saida


def _ids(linhas):
    return sorted(str(x["id"]) for x in linhas)


def _pendencia(tipo, edital, area, chave_, linhas, detalhe):
    ids = _ids(linhas)
    return {
        "tipo": tipo,
        "edital": edital,
        "area": area,
        "chave": chave_,
        "candidatos": ids[:MAX_LINHAS],
        "detalhe": {"linhas": len(ids), **detalhe},
    }


def pessoa(linha):
    """O mesmo critério da conferência: o código do candidato e, sem ele, o nome."""
    return f"cod:{linha['codigo']}" if linha.get("codigo") else f"nome:{linha.get('nome')}"


def duas_matriculas(linhas):
    """A mesma pessoa Contratado com duas ou mais matrículas diferentes no mesmo edital."""
    por_pessoa = defaultdict(list)
    for linha in linhas:
        if linha.get("status") == CONTRATADO and linha.get("edital") and (linha.get("codigo") or linha.get("nome")):
            por_pessoa[(linha["edital"], pessoa(linha))].append(linha)
    saida = []
    for (edital, quem), grupo in sorted(por_pessoa.items()):
        vinculos = {x["vinculo"] for x in grupo if x.get("vinculo") and not x.get("em_outra_lista")}
        if len(vinculos) < 2:
            continue
        saida.append(
            _pendencia(
                DUAS_MATRICULAS,
                edital,
                grupo[0]["area"],
                chave(DUAS_MATRICULAS, edital, quem),
                grupo,
                {"vinculos": len(vinculos)},
            )
        )
    return saida


def duas_listas(linhas, ambiguos):
    """Os grupos AMBIGUO do instantâneo "Contratado em outra lista", por edital e matrícula."""
    por_id = {str(x["id"]): x for x in linhas}
    grupos = defaultdict(list)
    motivos = {}
    for bruto in ambiguos or []:
        candidato, edital, vinculo, motivo = (list(bruto) + [None] * 4)[:4]
        linha = por_id.get(str(candidato))
        if linha is None or linha.get("status") != CONTRATADO:
            continue
        grupos[(str(edital), vinculo)].append(linha)
        motivos[(str(edital), vinculo)] = motivo
    saida = []
    for (edital, vinculo), grupo in sorted(grupos.items()):
        if len(grupo) < 2:
            continue
        saida.append(
            _pendencia(
                DUAS_LISTAS,
                edital,
                grupo[0]["area"],
                chave(DUAS_LISTAS, edital, vinculo),
                grupo,
                {"motivo": motivos[(edital, vinculo)] or "AMBIGUO"},
            )
        )
    return saida


def _mesma_vaga(linha):
    return (linha.get("lista"), linha.get("vaga"), linha.get("modalidade"))


def pessoas_repetidas(linhas):
    """A mesma pessoa (nome) duas vezes na mesma lista, vaga e modalidade."""
    grupos = defaultdict(list)
    for linha in linhas:
        if linha.get("nome"):
            grupos[(*_mesma_vaga(linha), linha["nome"])].append(linha)
    saida = []
    for (lista, vaga, modalidade, _nome), grupo in sorted(grupos.items(), key=lambda kv: str(kv[0])):
        if len(grupo) < 2:
            continue
        codigos = [x.get("codigo") for x in grupo]
        # Todos com código e nenhum repetido: homônimos, pessoas diferentes.
        if all(codigos) and len(set(codigos)) == len(codigos):
            continue
        ids = _ids(grupo)
        saida.append(
            _pendencia(
                PESSOA_REPETIDA,
                grupo[0]["edital"],
                grupo[0]["area"],
                chave(PESSOA_REPETIDA, lista, vaga, modalidade, *ids),
                grupo,
                {},
            )
        )
    return saida


def posicoes_repetidas(linhas):
    """A mesma posição em mais de uma linha da mesma lista, vaga e modalidade, de pessoas diferentes."""
    grupos = defaultdict(list)
    for linha in linhas:
        if linha.get("classificacao") is not None:
            grupos[(*_mesma_vaga(linha), linha["classificacao"])].append(linha)
    saida = []
    for (lista, vaga, modalidade, posicao), grupo in sorted(grupos.items(), key=lambda kv: str(kv[0])):
        if len(grupo) < 2:
            continue
        # A mesma pessoa duas vezes já é a pendência "Pessoa repetida".
        if len({x.get("nome") for x in grupo}) < 2:
            continue
        ids = _ids(grupo)
        saida.append(
            _pendencia(
                POSICAO_REPETIDA,
                grupo[0]["edital"],
                grupo[0]["area"],
                chave(POSICAO_REPETIDA, lista, vaga, modalidade, posicao, *ids),
                grupo,
                {"posicao": posicao},
            )
        )
    return saida


def convocados_sem_desfecho(linhas, hoje, dias=DIAS_CONVOCADO):
    """Convocado há mais de `dias` dias numa lista ativa."""
    limite = hoje - timedelta(days=dias)
    saida = []
    for linha in sorted(linhas, key=lambda x: str(x["id"])):
        convocado_em = _dia(linha.get("convocado_em"))
        if linha.get("status") != CONVOCADO or not linha.get("lista_ativa") or not convocado_em:
            continue
        if convocado_em >= limite:
            continue
        saida.append(
            _pendencia(
                CONVOCADO_SEM_DESFECHO,
                linha["edital"],
                linha["area"],
                chave(CONVOCADO_SEM_DESFECHO, linha["id"], convocado_em.isoformat()),
                [linha],
                {"convocado_em": convocado_em.isoformat(), "dias": (hoje - convocado_em).days, "prazo": dias},
            )
        )
    return saida


def detectar(dados, hoje, dias=DIAS_CONVOCADO):
    """Todas as pendências abertas hoje (lista de {tipo, edital, area, chave, candidatos, detalhe})."""
    linhas = ler_linhas(dados)
    hoje = _dia(hoje)
    return [
        *duas_matriculas(linhas),
        *duas_listas(linhas, (dados or {}).get("ambiguos")),
        *pessoas_repetidas(linhas),
        *posicoes_repetidas(linhas),
        *convocados_sem_desfecho(linhas, hoje, dias),
    ]


def resumo_por_area(pendencias):
    """{área: {tipo: quantas}} para o resumo do job (só contagens)."""
    saida = defaultdict(lambda: dict.fromkeys(TIPOS, 0))
    for p in pendencias:
        saida[p.get("area") or "sem área"][p["tipo"]] += 1
    return {area: dict(contagem) for area, contagem in sorted(saida.items())}


def comparar(pendencias, existentes):
    """
    O que a gravação faria com o instantâneo de hoje: novas, mantidas (abertas de novo), reabertas,
    permanentes (empate confirmado ou pessoas diferentes: não voltam) e saneadas (abertas que sumiram).
    `existentes`: [[tipo, chave, situacao, decisao]] de pendencias_ler_aprovados.
    """
    antes = {(e[0], e[1]): (e[2], e[3]) for e in existentes or []}
    agora = {(p["tipo"], p["chave"]) for p in pendencias}
    contagem = dict.fromkeys(("novas", "mantidas", "reabertas", "permanentes", "saneadas"), 0)
    for k in agora:
        situacao, decisao = antes.get(k, (None, None))
        if situacao is None:
            contagem["novas"] += 1
        elif situacao == "ABERTA":
            contagem["mantidas"] += 1
        elif decisao in ("EMPATE_PREVISTO", "PESSOAS_DIFERENTES"):
            contagem["permanentes"] += 1
        else:
            contagem["reabertas"] += 1
    contagem["saneadas"] = sum(1 for k, (s, _d) in antes.items() if s == "ABERTA" and k not in agora)
    return contagem
