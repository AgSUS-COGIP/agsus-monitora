"""
As vagas do edital para a classificação (cópia fiel de
src/lib/classificacao/vagas.ts): o código da vaga das análises ligado à linha do
quadro de vagas do edital, as vagas imediatas por modalidade (quadro do edital >
configuração de convocação > percentuais da regra) e o cabeçalho no padrão das
publicações; o nível da vaga para a nota mínima por nível.
"""

from __future__ import annotations

import functools
import math
import re

from .catalogo import codigos_da_modalidade, sem_acento
from .convocacao import modelo_da_regra, vagas_da_convocacao, vagas_pela_conta
from .numeros import numero_br
from .regra import normalizar_regra
from .semantica_js import aparar, comparar_numerico, entradas_js, math_trunc, numero_em_texto, texto, texto_js


def _id_do_quadro(q: dict) -> str:
    # String(q.id): sem a chave é "undefined", nulo é "null".
    if "id" not in q:
        return "undefined"
    return "null" if q["id"] is None else texto_js(q["id"])


def vagas_do_quadro_por_modalidade(modalidades):
    """As vagas por modalidade de uma linha do quadro: {AC: 2, PP: 1} (None = só CR)."""
    saida: dict = {}
    explicitas = False
    for nome, valor in entradas_js(modalidades) if isinstance(modalidades, dict) else []:
        codigos = codigos_da_modalidade(nome)
        if not codigos:
            continue
        codigo = codigos[0]
        n = numero_br(valor)
        if n is not None:
            explicitas = True
        saida[codigo] = saida.get(codigo, 0) + (n if n is not None else 0)
    return saida if explicitas else None


def _arredondar_cota(valor, modo):
    if modo == "PARA_CIMA":
        return math.ceil(valor - 1e-9)
    if modo == "PARA_BAIXO":
        return math.floor(valor + 1e-9)
    return math.floor(valor + 0.5 + 1e-9)


def _limpar_zeros(vagas: dict) -> dict:
    return {c: n for c, n in entradas_js(vagas) if c == "AC" or n > 0}


def vagas_pelos_percentuais(total, regra) -> dict:
    """A reserva pelos percentuais da regra (com o mínimo de vagas), o resto na ampla."""
    r = normalizar_regra(regra)
    modelo = modelo_da_regra(r)
    if modelo:
        return _limpar_zeros(vagas_pela_conta(total, modelo))
    saida = {"AC": total}
    if not total or total < max(1, r["cotas"]["minimo_vagas_reserva"]):
        return saida
    for m in r["modalidades"]:
        if m["codigo"] == "AC" or not m["percentual"]:
            continue
        n = _arredondar_cota((total * m["percentual"]) / 100, m["arredondamento"])
        if n > 0:
            saida[m["codigo"]] = n
            saida["AC"] = saida.get("AC", 0) - n
    saida["AC"] = max(0, saida.get("AC", 0))
    return saida


def _nome_da_modalidade(codigo, regra):
    if codigo == "AC":
        return "AC"
    for m in regra["modalidades"]:
        if m["codigo"] == codigo:
            return m["nome"] or codigo
    return codigo


def texto_das_vagas(vaga: dict, regra_bruta) -> str:
    """ "3 vagas (2 AC + 1 Pretos e pardos + CR)" ou "Cadastro Reserva"."""
    regra = normalizar_regra(regra_bruta)
    total = vaga.get("total")
    if total is None:
        return ""
    if not total:
        return "Cadastro Reserva"
    partes = [
        f"{numero_em_texto(n)} {_nome_da_modalidade(codigo, regra)}"
        for codigo, n in entradas_js(vaga.get("porModalidade") or {})
        if n > 0
    ]
    if vaga.get("cadastroReserva"):
        partes.append("CR")
    plural = "vaga" if total == 1 else "vagas"
    detalhe = f" ({' + '.join(partes)})" if partes else ""
    return f"{numero_em_texto(total)} {plural}{detalhe}"


def cabecalho_da_vaga(vaga: dict, regra, unidade="") -> str:
    """ "VAGA 169673 - Analista … - DSEI Xingu (Sede) - DSEI Xingu - 1 vaga (1 AC + CR)"."""
    outra_unidade = (
        unidade
        if unidade and sem_acento(texto(vaga.get("lotacao"))).lower() != sem_acento(texto(unidade)).lower()
        else ""
    )
    partes = [
        f"VAGA {vaga['codigo']}" if vaga.get("codigo") else "VAGA",
        vaga.get("cargo"),
        vaga.get("lotacao"),
        outra_unidade,
        texto_das_vagas(vaga, regra),
    ]
    return " - ".join(texto_js(p) for p in partes if texto(p))


def _mais_comum(contagem: dict) -> str:
    if not contagem:
        return ""
    return sorted(contagem.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]


def montar_vagas(candidatos=(), quadro=(), regra=None, unidade="", convocacao=None) -> list[dict]:
    """
    As vagas do edital: uma por código de vaga das análises (com a linha do
    quadro que a maioria dos candidatos liga) e uma por linha do quadro sem
    candidato. Ordem: código da vaga (numérica), depois a ordem do quadro.
    """
    r = normalizar_regra(regra)
    linhas: dict = {}
    for q in quadro or []:
        linhas[_id_do_quadro(q)] = q
    por_codigo: dict = {}
    for c in candidatos:
        codigo = texto(c.vaga)
        if not codigo:
            continue
        v = por_codigo.setdefault(codigo, {"cargos": {}, "quadros": {}})
        cargo = texto(c.cargo)
        if cargo:
            v["cargos"][cargo] = v["cargos"].get(cargo, 0) + 1
        q = texto_js(c.quadroId) if c.quadroId else ""
        if q:
            v["quadros"][q] = v["quadros"].get(q, 0) + 1

    usados: set = set()
    vagas: list[dict] = []

    def completar(base: dict, linha):
        da_convocacao = vagas_da_convocacao(convocacao, base["codigo"]) if base["codigo"] else None
        if linha is None:
            if da_convocacao:
                return {
                    **base,
                    "total": da_convocacao["total"],
                    "porModalidade": da_convocacao["porModalidade"],
                    "cadastroReserva": False,
                    "semQuadro": False,
                    "origemDasVagas": "CONVOCACAO",
                }
            return {
                **base,
                "total": None,
                "porModalidade": None,
                "cadastroReserva": False,
                "semQuadro": True,
                "origemDasVagas": None,
            }
        usados.add(_id_do_quadro(linha))
        imediatas = numero_br(linha.get("vagas_imediatas"))
        total = max(0, math_trunc(imediatas if imediatas is not None else 0))
        explicitas = vagas_do_quadro_por_modalidade(linha.get("modalidades"))
        casa = bool(da_convocacao) and da_convocacao["total"] == total
        ordem = numero_br(linha.get("ordem"))
        if explicitas:
            por_modalidade, origem = explicitas, "QUADRO"
        elif casa:
            por_modalidade, origem = da_convocacao["porModalidade"], "CONVOCACAO"
        else:
            por_modalidade, origem = vagas_pelos_percentuais(total, r), "REGRA"
        return {
            **base,
            "cargo": texto(linha.get("cargo")) or base["cargo"],
            "lotacao": texto(linha.get("lotacao")),
            "quadroId": _id_do_quadro(linha),
            "ordemQuadro": ordem if ordem is not None else 0,
            "total": total,
            "porModalidade": por_modalidade,
            "cadastroReserva": bool(linha.get("cadastro_reserva")),
            "semQuadro": False,
            "origemDasVagas": origem,
            "totalNaConvocacao": da_convocacao["total"] if da_convocacao and not casa else None,
        }

    ordem_dos_codigos = sorted(por_codigo.items(), key=functools.cmp_to_key(lambda a, b: comparar_numerico(a[0], b[0])))
    for codigo, v in ordem_dos_codigos:
        linha = linhas.get(_mais_comum(v["quadros"]))
        vagas.append(
            completar({"chave": codigo, "codigo": codigo, "cargo": _mais_comum(v["cargos"]), "lotacao": ""}, linha)
        )

    def ordem_da_linha(q):
        n = numero_br(q.get("ordem"))
        return n if n is not None else 0

    for linha in sorted(linhas.values(), key=ordem_da_linha):
        if _id_do_quadro(linha) in usados:
            continue
        vagas.append(
            completar(
                {
                    "chave": f"quadro:{_id_do_quadro(linha)}",
                    "codigo": "",
                    "cargo": texto(linha.get("cargo")),
                    "lotacao": "",
                },
                linha,
            )
        )
    return [{**v, "cabecalho": cabecalho_da_vaga(v, r, unidade)} for v in vagas]


_ESPACOS = re.compile(r"\s+")
_NIVEL_ESCRITO = re.compile(r"\bnivel (superior|tecnico|medio|fundamental)\b", re.ASCII)
_COMECA_COM_TECNICO = re.compile(r"^tecnic[oa]\b", re.ASCII)


def nivel_no_nome_do_cargo(cargo):
    """ "(Nível Superior)", "Nível Médio"… e, sem isso, o cargo que COMEÇA com "Técnico"."""
    c = aparar(_ESPACOS.sub(" ", sem_acento(cargo)))
    m = _NIVEL_ESCRITO.search(c)
    if m:
        return m.group(1)
    return "tecnico" if _COMECA_COM_TECNICO.search(c) else None


def nivel_da_vaga(cargo, categoria, regra):
    """O nível da vaga: pela regra (niveis_por_cargo), pelo nome do cargo, pela categoria, pelo padrão."""
    r = normalizar_regra(regra)
    c = sem_acento(cargo)
    for n in r["documental"]["niveis_por_cargo"]:
        if n["termo"] and aparar(c).startswith(aparar(sem_acento(n["termo"]))):
            return n["nivel"]
    do_nome = nivel_no_nome_do_cargo(cargo)
    if do_nome:
        return do_nome
    cat = sem_acento(categoria)
    for padrao, nivel in (
        ("superior", "superior"),
        ("tecnic", "tecnico"),
        ("medio", "medio"),
        ("fundamental", "fundamental"),
    ):
        if padrao in cat:
            return nivel
    return r["documental"]["nivel_padrao"] or None
