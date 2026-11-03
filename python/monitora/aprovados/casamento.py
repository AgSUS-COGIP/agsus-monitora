"""
CASAMENTO DA LISTA DE APROVADOS (versão 1)

Quando uma lista de aprovados nova substitui a vigente — pela planilha (XLSX) ou pelo
resultado final da Classificação —, quem da lista vigente é a mesma pessoa de quem entra?
Quem casa leva o estado da lista (status, matrícula, processo SEI, data da convocação, sub
judice, anexos, CO_CANDIDATO_ANTERIOR); o banco aplica o plano (migration 20261030090000,
aplicar_casamento_da_lista) depois de conferir cada vínculo.

As regras, nesta ordem (as mesmas da tela desde 20261005160000):
  1. a revisão manual manda (manuais: candidato → chave de quem entra; "" = não está na nova);
  2. a mesma análise (lista publicada da Classificação);
  3. o nome normalizado (sem acento, sem caixa, só letras e números), único dos dois lados;
     homônimo desempata pela vaga (o mesmo código, um de cada lado). O que sobra não casa e,
     se tem status ou matrícula, vai para a revisão.

Entrada (pedido lido de casamento_ler_pedidos):
  novos       [{chave, analise_id, nome, codigo_vaga, posicao, ...}]   quem entra
  anteriores  [{id, analise_id, nome, cargo, codigo_vaga, classificacao, status, matricula,
                processo_sei, sub_judice, alterado_judicialmente}]   a lista vigente
  manuais     {candidato_id: chave | ""}

Saída (plano gravado por gravar_casamento_da_lista): vínculos, o resumo (casados, entram,
sem par, status sem dono, preservados, mudam de posição, sub judice mantidos), as pendências
(quem sai com status ou matrícula), quem muda de posição e quem vai para a revisão.

Só biblioteca padrão. O job: scripts/aprovados/casamento_da_lista.py.
"""

import re
import unicodedata

VERSAO = 1
FORMAS = ("ANALISE", "NOME", "NOME_VAGA", "MANUAL")
_NAO_ALFANUMERICO = re.compile(r"[^a-z0-9]+")


def _texto(valor):
    return "" if valor is None else str(valor).strip()


def normalizar_nome(nome):
    """'José  da Silva' e 'JOSE DA SILVA' viram 'jose da silva' (normalizarNome da tela)."""
    decomposto = unicodedata.normalize("NFD", _texto(nome))
    sem_acento = "".join(c for c in decomposto if not ("̀" <= c <= "ͯ"))
    return _NAO_ALFANUMERICO.sub(" ", sem_acento.lower()).strip()


def _vaga(codigo):
    return _texto(codigo).lower()


def _numero(valor):
    if valor is None or valor == "":
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def tem_dados_da_lista(c):
    """O candidato tem algo que é só da lista (e se perde se não casar)?"""
    return bool(
        _texto(c.get("status"))
        or _texto(c.get("matricula"))
        or _texto(c.get("processo_sei"))
        or c.get("sub_judice")
        or c.get("alterado_judicialmente")
    )


def _agrupar_por_nome(itens):
    grupos = {}
    for item in itens:
        chave = normalizar_nome(item.get("nome"))
        if chave:
            grupos.setdefault(chave, []).append(item)
    return grupos


def casar(anteriores, novos, manuais=None):
    """
    {"vinculos": [{candidato_id, chave, forma}], "nao_casados": [{...anterior, ambiguo, decidido}]}.
    A ordem é a da tela (casarCandidatos), para o plano sair igual.
    """
    manuais = manuais or {}
    livres = {}
    for n in novos or []:
        chave = _texto(n.get("chave"))
        if chave and chave not in livres:
            livres[chave] = n
    vinculos, decididos, ambiguos = [], set(), set()

    def vincular(anterior, novo, forma):
        vinculos.append({"candidato_id": _texto(anterior["id"]), "chave": _texto(novo["chave"]), "forma": forma})
        livres.pop(_texto(novo["chave"]), None)
        decididos.add(_texto(anterior["id"]))

    lista = [a for a in anteriores or [] if _texto(a.get("id"))]

    # 1. A revisão manual manda.
    for a in lista:
        id_ = _texto(a["id"])
        if id_ not in manuais:
            continue
        escolhido = _texto(manuais[id_])
        if not escolhido:
            decididos.add(id_)
            continue
        novo = livres.get(escolhido)
        if novo is not None:
            vincular(a, novo, "MANUAL")

    # 2. A mesma análise.
    por_analise = {}
    for chave, n in livres.items():
        analise = _texto(n.get("analise_id"))
        if analise and analise not in por_analise:
            por_analise[analise] = chave
    for a in lista:
        if _texto(a["id"]) in decididos:
            continue
        chave = por_analise.get(_texto(a.get("analise_id")))
        if chave and chave in livres:
            vincular(a, livres[chave], "ANALISE")

    # 3. O nome normalizado; homônimo desempata pela vaga.
    restantes = [a for a in lista if _texto(a["id"]) not in decididos]
    antes_por_nome = _agrupar_por_nome(restantes)
    depois_por_nome = _agrupar_por_nome(list(livres.values()))
    for nome, antes in antes_por_nome.items():
        depois = [n for n in depois_por_nome.get(nome, []) if _texto(n["chave"]) in livres]
        if not depois:
            continue
        if len(antes) == 1 and len(depois) == 1:
            vincular(antes[0], depois[0], "NOME")
            continue
        for a in antes:
            vaga = _vaga(a.get("codigo_vaga"))
            mesmos = [
                n for n in depois if _texto(n["chave"]) in livres and vaga and _vaga(n.get("codigo_vaga")) == vaga
            ]
            rivais = [b for b in antes if b is not a and vaga and _vaga(b.get("codigo_vaga")) == vaga]
            if len(mesmos) == 1 and not rivais:
                vincular(a, mesmos[0], "NOME_VAGA")
            else:
                ambiguos.add(_texto(a["id"]))

    casados = {v["candidato_id"] for v in vinculos}
    nao_casados = [
        {**a, "ambiguo": _texto(a["id"]) in ambiguos, "decidido": _texto(a["id"]) in decididos}
        for a in lista
        if _texto(a["id"]) not in casados
    ]
    return {"vinculos": vinculos, "nao_casados": nao_casados}


def _mudou_de_posicao(anterior, novo):
    if _numero(anterior.get("classificacao")) != _numero(novo.get("posicao")):
        return True
    vaga = _vaga(anterior.get("codigo_vaga"))
    return bool(vaga) and vaga != _vaga(novo.get("codigo_vaga"))


def _pendencia(a):
    return {
        "candidato_id": _texto(a["id"]),
        "nome": a.get("nome"),
        "cargo": a.get("cargo"),
        "codigo_vaga": a.get("codigo_vaga"),
        "classificacao": a.get("classificacao"),
        "status": a.get("status"),
        "matricula": a.get("matricula"),
        "processo_sei": a.get("processo_sei"),
    }


def plano(anteriores, novos, manuais=None):
    """O plano do casamento: vínculos, resumo, pendências, quem muda e quem revisar."""
    manuais = manuais or {}
    casamento = casar(anteriores, novos, manuais)
    por_id = {_texto(a.get("id")): a for a in anteriores or []}
    por_chave = {_texto(n.get("chave")): n for n in novos or []}
    vinculados = {v["chave"] for v in casamento["vinculos"]}
    mudam, preservados = [], 0
    for v in casamento["vinculos"]:
        a, n = por_id.get(v["candidato_id"]), por_chave.get(v["chave"])
        if a is None or n is None:
            continue
        if _mudou_de_posicao(a, n):
            mudam.append(
                {
                    "candidato_id": v["candidato_id"],
                    "chave": v["chave"],
                    "de": a.get("classificacao"),
                    "para": n.get("posicao"),
                }
            )
        if tem_dados_da_lista(a):
            preservados += 1
    sub_judice = [a for a in casamento["nao_casados"] if a.get("sub_judice")]
    saem = [a for a in casamento["nao_casados"] if not a.get("sub_judice")]
    pendencias = [_pendencia(a) for a in saem if tem_dados_da_lista(a)]
    # Para revisar: quem saiu com dados ou é homônimo sem par, e quem já foi revisto à mão.
    nao_casados = {_texto(n["id"]): n for n in casamento["nao_casados"]}

    def para_revisar(id_):
        if id_ in manuais:
            return True
        n = nao_casados.get(id_)
        return bool(n) and not n.get("sub_judice") and (tem_dados_da_lista(n) or n["ambiguo"])

    revisar = [_texto(a["id"]) for a in anteriores or [] if _texto(a.get("id")) and para_revisar(_texto(a["id"]))]
    entram = [_texto(n.get("chave")) for n in novos or [] if _texto(n.get("chave")) not in vinculados]
    return {
        "versao": VERSAO,
        "vinculos": casamento["vinculos"],
        "resumo": {
            "casados": len(casamento["vinculos"]),
            "entram": len(entram),
            "sem_par": len(saem),
            "sem_dono": len(pendencias),
            "preservados": preservados,
            "mudam": len(mudam),
            "sub_judice_mantidos": len(sub_judice),
            "ambiguos": sum(1 for a in casamento["nao_casados"] if a["ambiguo"] and not a["decidido"]),
        },
        "pendencias": pendencias,
        "mudam": mudam,
        "revisar": revisar,
    }
