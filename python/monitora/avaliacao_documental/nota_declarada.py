"""
Nota declarada: a ART (nota do questionário da Empregare, "x/30") recalculada
pela regra a partir das respostas, só para CONFERIR a ART — divergência vira
aviso; a ordem da Provisória continua pela ART.

Cópia fiel de src/lib/avaliacao-documental/nota-declarada.js (mesmos nomes de
campo na saída). As perguntas são achadas pelo começo do nome da coluna
("Pergunta 15 -"), sem diferença de acento e de caixa.
"""

import math
import re
import unicodedata

_ACENTOS = re.compile("[̀-ͯ]")
_ESPACOS = re.compile(r"\s+")
_ART = re.compile(r"^(-?[0-9]+(?:[.,][0-9]+)?)")
_SEPARADORES = re.compile(r"[;|\n]")
_EPSILON = 2.220446049250313e-16


def normalizar_texto(valor):
    """Texto comparável: sem acento, minúsculo, espaços simples."""
    texto = "" if valor is None else str(valor)
    texto = _ACENTOS.sub("", unicodedata.normalize("NFD", texto)).lower()
    return _ESPACOS.sub(" ", texto).strip()


def coluna_da_pergunta(respostas, pergunta):
    """A coluna das respostas cujo nome começa pelo enunciado da regra."""
    alvo = normalizar_texto(pergunta)
    if not alvo:
        return None
    for coluna in respostas or {}:
        if normalizar_texto(coluna).startswith(alvo):
            return coluna
    return None


def numero(valor):
    """Number(v) do JavaScript para os valores da regra (finito ou 0)."""
    if isinstance(valor, bool):
        return 1.0 if valor else 0.0
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def _valor_do_mapa(mapa, resposta):
    alvo = normalizar_texto(resposta)
    for chave in mapa or {}:
        if normalizar_texto(chave) == alvo:
            return numero(mapa[chave])
    return None


def arredondar(n):
    """Math.round((n + EPSILON) * 10000) / 10000, como no JavaScript."""
    return math.floor((n + _EPSILON) * 10000 + 0.5) / 10000


def _com_teto(valor, teto):
    return valor if teto is None else min(valor, numero(teto))


def calcular_nota_declarada(regra, respostas):
    """{total, parciais, itens, sem_mapa} — a nota declarada de um candidato."""
    respostas = respostas or {}
    itens = []
    for item in ((regra or {}).get("provisoria") or {}).get("nota_declarada") or []:
        coluna = coluna_da_pergunta(respostas, item.get("pergunta"))
        resposta = "" if coluna is None or respostas.get(coluna) is None else str(respostas[coluna])
        pontos = 0.0
        mapeada = False
        if coluna and resposta.strip():
            tipo = item.get("tipo")
            if tipo == "OPCAO":
                v = _valor_do_mapa(item.get("pontos"), resposta)
                mapeada = v is not None
                pontos = v or 0.0
            elif tipo == "FAIXA_EM_MESES":
                meses = _valor_do_mapa(item.get("meses"), resposta)
                mapeada = meses is not None
                pontos = (meses or 0.0) * numero(item.get("pontos_por_mes"))
            elif tipo == "OPCOES_SOMADAS":
                marcadas = {normalizar_texto(p) for p in _SEPARADORES.split(resposta)}
                marcadas.discard("")
                mapa = item.get("pontos") or {}
                casadas = [opcao for opcao in mapa if normalizar_texto(opcao) in marcadas]
                mapeada = len(casadas) > 0
                pontos = sum(numero(mapa[o]) for o in casadas)
        itens.append(
            {
                "parcial": item.get("parcial"),
                "pergunta": item.get("pergunta"),
                "coluna": coluna,
                "resposta": resposta,
                "mapeada": mapeada,
                "pontos": arredondar(_com_teto(pontos, item.get("teto"))),
            }
        )
    parciais = {}
    for item in itens:
        parciais[item["parcial"]] = arredondar(parciais.get(item["parcial"], 0.0) + item["pontos"])
    return {
        "total": arredondar(sum(parciais.values())),
        "parciais": parciais,
        "itens": itens,
        "sem_mapa": sum(1 for i in itens if i["coluna"] and i["resposta"].strip() and not i["mapeada"]),
    }


def ler_art(texto):
    """A ART como número: "6,0/30,0" → 6.0. Sem número, None."""
    m = _ART.match(("" if texto is None else str(texto)).strip())
    if not m:
        return None
    n = float(m.group(1).replace(",", "."))
    return n if math.isfinite(n) else None


def diverge_da_art(art, declarada, tolerancia=0):
    """A ART diverge da nota declarada além da tolerância da regra?"""
    if art is None:
        return False
    return abs(float(art) - float(declarada)) > float(tolerancia or 0) + 1e-9
