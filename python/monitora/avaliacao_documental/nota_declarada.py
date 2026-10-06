"""
Nota declarada: a ART (nota do questionário da Empregare, "x/30") recalculada
pela regra a partir das respostas, só para CONFERIR a ART — divergência vira
aviso; a ordem da Provisória continua pela ART.

Cópia fiel de src/lib/avaliacao-documental/nota-declarada.js (mesmos nomes de
campo na saída).

Como a regra acha a pergunta (o mesmo do JS): as colunas da Empregare se
chamam "Pergunta N - <enunciado>" e o número N da mesma pergunta muda de vaga
para vaga dentro do mesmo edital. O texto da regra casa com a coluna quando é
o começo do nome inteiro ("Pergunta 15 -", como sempre foi) ou do enunciado
depois do prefixo "Pergunta N - " ("Experiência Profissional"), sem acento,
sem caixa, com os espaços colapsados e o &nbsp; como espaço. Mais de uma
coluna casando é ambíguo: não vale nenhuma e a pré-classificação avisa
(PERGUNTA_AMBIGUA:<de onde>). Quando o enunciado muda de questionário para
questionário, a regra traz uma lista de alternativas e casa com qualquer uma.
"""

import math
import re
import unicodedata

_ACENTOS = re.compile("[̀-ͯ]")
_ESPACOS = re.compile(r"\s+")
_NBSP = re.compile(r"&nbsp;|&#160;", re.IGNORECASE)
_PREFIXO_DA_PERGUNTA = re.compile(r"^pergunta ?[0-9]+ ?[-–—] ?")
_ART = re.compile(r"^(-?[0-9]+(?:[.,][0-9]+)?)")
_SEPARADORES = re.compile(r"[;|\n]")
_ASPAS = re.compile(r'"([^"]*)"')
_ENTRE_ASPAS = re.compile(r'^"[^"]*"$')
_SEM_RESPOSTA = {"", "--", "resposta nao informada"}
_EPSILON = 2.220446049250313e-16


def normalizar_texto(valor):
    """Texto comparável: sem acento, minúsculo, espaços simples (&nbsp; vira espaço)."""
    texto = _NBSP.sub(" ", "" if valor is None else str(valor))
    texto = _ACENTOS.sub("", unicodedata.normalize("NFD", texto)).lower()
    return _ESPACOS.sub(" ", texto).strip()


def colunas_da_pergunta(respostas, pergunta):
    """
    Todas as colunas que casam: o nome inteiro ou o enunciado (sem "Pergunta N - ")
    começa pelo texto. O texto pode ser uma lista de alternativas: casa com qualquer uma.
    """
    alvos = [a for a in (normalizar_texto(p) for p in (pergunta if isinstance(pergunta, list) else [pergunta])) if a]
    if not alvos:
        return []
    casadas = []
    for coluna in respostas or {}:
        nome = normalizar_texto(coluna)
        enunciado = _PREFIXO_DA_PERGUNTA.sub("", nome, count=1)
        if any(nome.startswith(alvo) or enunciado.startswith(alvo) for alvo in alvos):
            casadas.append(coluna)
    return casadas


def coluna_da_pergunta(respostas, pergunta):
    """A coluna da pergunta; None quando nenhuma ou mais de uma casa (ambígua)."""
    colunas = colunas_da_pergunta(respostas, pergunta)
    return colunas[0] if len(colunas) == 1 else None


def pergunta_ambigua(respostas, pergunta):
    """O texto da regra casa com mais de uma coluna?"""
    return len(colunas_da_pergunta(respostas, pergunta)) > 1


def numero(valor):
    """Number(v) do JavaScript para os valores da regra (finito ou 0)."""
    if isinstance(valor, bool):
        return 1.0 if valor else 0.0
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def texto_da_resposta(valor):
    """
    A resposta como a Empregare exporta, sem as aspas e sem o &nbsp;
    ('"1 ano&nbsp;"' → "1 ano"); vazia, "--" ou "Resposta não informada" → "".
    """
    t = _NBSP.sub(" ", "" if valor is None else str(valor)).strip()
    sem_aspas = t[1:-1].strip() if _ENTRE_ASPAS.match(t) else t
    return "" if normalizar_texto(sem_aspas) in _SEM_RESPOSTA else sem_aspas


def opcoes_da_resposta(valor):
    """As opções marcadas: '"Sou indígena", "Moro em aldeia"'; sem aspas, separadas por ";", "|" ou linha."""
    t = _NBSP.sub(" ", "" if valor is None else str(valor))
    entre_aspas = _ASPAS.findall(t)
    partes = entre_aspas if entre_aspas else _SEPARADORES.split(t)
    return [o for o in (texto_da_resposta(p) for p in partes) if o]


def chave_da_opcao(valor):
    """A chave tolerante de uma opção: sem aspas, acento, caixa nem espaços ("porinstituição")."""
    return normalizar_texto(texto_da_resposta(valor)).replace(" ", "")


def _valor_do_mapa(mapa, resposta):
    alvo = chave_da_opcao(resposta)
    if not alvo:
        return None
    for chave in mapa or {}:
        if chave_da_opcao(chave) == alvo:
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
        if coluna and texto_da_resposta(resposta):
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
                marcadas = {chave_da_opcao(o) for o in opcoes_da_resposta(resposta)}
                mapa = item.get("pontos") or {}
                casadas = [opcao for opcao in mapa if chave_da_opcao(opcao) in marcadas]
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
        "sem_mapa": sum(1 for i in itens if i["coluna"] and texto_da_resposta(i["resposta"]) and not i["mapeada"]),
    }


def ler_art(texto):
    """A ART como número: "6,0/30,0" ou "45,0/50,0" → 6.0 ou 45.0. Sem número ("--"), None."""
    m = _ART.match(texto_da_resposta(texto))
    if not m:
        return None
    n = float(m.group(1).replace(",", "."))
    return n if math.isfinite(n) else None


def diverge_da_art(art, declarada, tolerancia=0):
    """A ART diverge da nota declarada além da tolerância da regra?"""
    if art is None:
        return False
    return abs(float(art) - float(declarada)) > float(tolerancia or 0) + 1e-9
