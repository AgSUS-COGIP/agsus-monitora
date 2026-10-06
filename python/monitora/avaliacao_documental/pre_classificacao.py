"""
Pré-classificação de uma vaga: a Lista Geral de Classificação Provisória por
ART (item 8.3.1) e o lote de convocação (item 8.4).

Esta é a conta OFICIAL, em lote: o job scripts/pre_classificacao/ roda aqui
e grava o resultado pronto em TB_PRE_CLASSIFICACAO pelas RPCs. A cópia em
JavaScript (src/lib/avaliacao-documental/pre-classificacao.js) serve à prévia
da tela; as duas são conferidas pelos MESMOS casos dourados
(tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json). Mudou
aqui, muda lá — as regras estão descritas no cabeçalho do arquivo JS e em
docs/aya/regras-da-avaliacao-documental.md.

Nada aqui imprime ou devolve dado pessoal além do que entra: a saída tem o id
e o código do candidato, notas, posições e motivos.
"""

import math
import re
from functools import cmp_to_key

from monitora.avaliacao_documental.nota_declarada import (
    calcular_nota_declarada,
    coluna_da_pergunta,
    diverge_da_art,
    ler_art,
    normalizar_texto,
)

PREFIXO_DA_ART = "NOTA - "
SAIU_DA_EMPREGARE = {"codigo": "SAIU_DA_EMPREGARE", "motivo": "Saiu do arquivo da Empregare"}
DESEMPATE_PADRAO = ["IDOSO", "CANDIDATURA"]
LOTE_PADRAO = {
    "base": "MULTIPLO_VAGAS",
    "multiplo": 3,
    "fixo": None,
    "inclui_cr": True,
    "por_modalidade": False,
    "inclui_empatados": True,
    "linha_anda": True,
    "publica_reposicao": False,
}
_DATA = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
_NUMERO_DO_QUADRO = re.compile(r"^\d+(\.\d+)?$")
_NO_LOTE = {"NO_LOTE", "ANALISADO"}


def _objeto(v):
    return v if isinstance(v, dict) else {}


def _lista(v):
    return v if isinstance(v, list) else []


def _numero_js(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def normalizar_regra(entrada):
    """A parte da regra (normalizarRegraAnalise do JS) que a pré-classificação usa."""
    r = _objeto(entrada)
    provisoria = _objeto(r.get("provisoria"))
    tolerancia = provisoria.get("divergencia_tolerancia")
    return {
        "provisoria": {
            "eliminacao_automatica": _lista(provisoria.get("eliminacao_automatica")),
            "nota_declarada": _lista(provisoria.get("nota_declarada")),
            "divergencia_tolerancia": tolerancia if _numero_js(tolerancia) and 0 <= tolerancia <= 30 else 0,
            "desempate": provisoria["desempate"]
            if isinstance(provisoria.get("desempate"), list)
            else list(DESEMPATE_PADRAO),
            "pergunta_experiencia": provisoria.get("pergunta_experiencia").strip() or None
            if isinstance(provisoria.get("pergunta_experiencia"), str)
            else None,
        },
        "lote": {**LOTE_PADRAO, **_objeto(r.get("lote"))},
        "blocos": _lista(r.get("blocos")),
    }


def numero_no_texto(n):
    """ "24" ou "24,5": o número como a lista publica (String(n) do JS)."""
    if n is None:
        return ""
    if float(n).is_integer():
        return str(int(n))
    return repr(float(n)).replace(".", ",")


def codigos_da_modalidade(texto):
    """Os códigos de modalidade de um texto (codigosDaModalidade da Classificação)."""
    t = normalizar_texto(texto)
    if not t:
        return []
    codigos = []
    if re.search(r"ampla|\bac\b", t):
        codigos.append("AC")
    if re.search(r"defici|\bpcd\b|\bpne\b", t):
        codigos.append("PCD")
    if re.search(r"pret|pard|\bpp\b|negr", t):
        codigos.append("PP")
    if re.search(r"indigen|\bpi\b", t):
        codigos.append("PI")
    if re.search(r"quilomb|\bpq\b", t):
        codigos.append("PQ")
    if re.search(r"\btrans\b|transgener|travesti", t):
        codigos.append("TRANS")
    return codigos


def art_das_colunas(colunas):
    """A ART: a primeira coluna "NOTA - …" com número."""
    prefixo = normalizar_texto(PREFIXO_DA_ART)
    for coluna, valor in (colunas or {}).items():
        if not normalizar_texto(coluna).startswith(prefixo):
            continue
        art = ler_art(valor)
        if art is not None:
            return art
    return None


def _colunas_da_fonte(regra_de_eliminacao, colunas):
    nomes = list(colunas or {})
    if regra_de_eliminacao.get("coluna"):
        alvo = normalizar_texto(regra_de_eliminacao["coluna"])
        return [n for n in nomes if normalizar_texto(n) == alvo]
    if regra_de_eliminacao.get("coluna_prefixo"):
        alvo = normalizar_texto(regra_de_eliminacao["coluna_prefixo"])
        return [n for n in nomes if normalizar_texto(n).startswith(alvo)]
    coluna = coluna_da_pergunta(colunas, regra_de_eliminacao.get("pergunta"))
    return [coluna] if coluna else []


def eliminacao_do_candidato(regra, colunas):
    """({codigo, motivo} | None, [códigos das regras sem a coluna no arquivo])."""
    ausentes = []
    for e in _lista(((regra or {}).get("provisoria") or {}).get("eliminacao_automatica")):
        nomes = _colunas_da_fonte(e, colunas)
        if not nomes:
            ausentes.append(e.get("codigo"))
            continue
        quando = [normalizar_texto(v) for v in _lista(e.get("quando"))]
        exceto = [normalizar_texto(v) for v in _lista(e.get("exceto"))]
        for nome in nomes:
            valor = normalizar_texto(colunas.get(nome))
            if (quando and valor in quando) or (exceto and valor not in exceto):
                return {"codigo": e.get("codigo"), "motivo": e.get("motivo")}, ausentes
    return None, ausentes


def modalidade_do_candidato(regra, colunas):
    """A modalidade declarada (bloco MODALIDADE da regra): "PP", "PCD"… ou "AC"."""
    bloco = next((b for b in _lista((regra or {}).get("blocos")) if _objeto(b).get("codigo") == "MODALIDADE"), None)
    perguntas = _lista(_objeto(bloco).get("perguntas"))
    coluna = coluna_da_pergunta(colunas, perguntas[0]) if perguntas else None
    if not coluna:
        return "AC"
    return next((c for c in codigos_da_modalidade(colunas.get(coluna)) if c != "AC"), "AC")


def _numero_do_quadro(valor):
    if _numero_js(valor):
        return valor
    texto = ("" if valor is None else str(valor)).strip().replace(",", ".", 1)
    return float(texto) if _NUMERO_DO_QUADRO.match(texto) else None


def vagas_por_modalidade(modalidades):
    """{"Ampla Concorrência": 2, "PcD": 1} → {"AC": 2, "PCD": 1}; None = sem divisão."""
    if not isinstance(modalidades, dict):
        return None
    saida = {}
    explicitas = False
    for nome, valor in modalidades.items():
        codigos = codigos_da_modalidade(nome)
        if not codigos:
            continue
        n = _numero_do_quadro(valor)
        if n is not None:
            explicitas = True
        saida[codigos[0]] = saida.get(codigos[0], 0) + (n or 0)
    return saida if explicitas else None


def _vezes(multiplo, n):
    return math.ceil(multiplo * n - 1e-9)


def meses_declarados(valor):
    """
    Os meses de experiência de uma resposta da Empregare ("De 1 a 2 anos" → 12,
    "Mais de 5 anos" → 60, "6 meses" → 6, "Sem experiência" → 0): o limite de
    baixo da faixa; None quando não dá para ler (mesmo que mesesDeclarados do JS).
    """
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return valor if math.isfinite(valor) else None
    texto = normalizar_texto(valor)
    if not texto:
        return None
    numero = re.search(r"(\d+(?:[.,]\d+)?)", texto)
    if not numero:
        return 0 if re.search(r"\b(sem|nenhum|nenhuma|nao possuo|nao tenho)\b", texto) else None
    n = float(numero.group(1).replace(",", "."))
    if n.is_integer():
        n = int(n)
    unidade = re.search(r"(ano|mes)", texto[numero.end() :])
    return n * 12 if unidade and unidade.group(1) == "ano" else n


def tamanho_do_lote(lote, vaga):
    """{tamanho (None = sem como calcular), descricao, por_modalidade, aviso}."""
    lote = lote or {}
    vaga = vaga or {}
    definido = _objeto(lote.get("por_vaga")).get(str(vaga.get("codigo") or ""))
    if isinstance(definido, int) and not isinstance(definido, bool) and definido >= 1:
        return {
            "tamanho": definido,
            "descricao": f"{definido} (definido para a vaga)",
            "por_modalidade": None,
            "aviso": None,
        }
    if lote.get("base") == "FIXO":
        fixo = lote.get("fixo")
        return {
            "tamanho": fixo,
            "descricao": f"{numero_no_texto(fixo)} (número fixo)",
            "por_modalidade": None,
            "aviso": None,
        }
    if lote.get("base") == "NOTA_MINIMA":
        minimo = lote.get("nota_minima")
        if not _numero_js(minimo):
            return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_NOTA_MINIMA"}
        item = lote.get("item_edital")
        # O tamanho depende das notas: pre_classificar_vaga conta quem tem a nota mínima.
        return {
            "tamanho": None,
            "descricao": f"nota ≥ {numero_no_texto(minimo)}" + (f" (item {item})" if item else ""),
            "por_modalidade": None,
            "aviso": None,
            "nota_minima": minimo,
        }
    imediatas = vaga.get("vagas_imediatas")
    if imediatas is None:
        return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_QUADRO"}
    cr = 1 if lote.get("inclui_cr") and vaga.get("cadastro_reserva") else 0
    base = imediatas + cr
    if base <= 0:
        return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_VAGAS"}
    multiplo = lote.get("multiplo") if lote.get("multiplo") is not None else 1
    tamanho = _vezes(multiplo, base)
    m = numero_no_texto(multiplo)
    descricao = f"{m} × ({imediatas} + CR) = {tamanho}" if cr else f"{m} × {imediatas} = {tamanho}"
    if not lote.get("por_modalidade"):
        return {"tamanho": tamanho, "descricao": descricao, "por_modalidade": None, "aviso": None}
    por_modalidade = vagas_por_modalidade(vaga.get("modalidades"))
    if not por_modalidade:
        return {"tamanho": tamanho, "descricao": descricao, "por_modalidade": None, "aviso": "QUADRO_SEM_MODALIDADES"}
    tamanhos = {"AC": _vezes(multiplo, por_modalidade.get("AC", 0) + cr)}
    for codigo, n in por_modalidade.items():
        if codigo != "AC" and n > 0:
            tamanhos[codigo] = _vezes(multiplo, n)
    total = sum(tamanhos.values())
    return {
        "tamanho": total,
        "descricao": f"{re.sub(r' = [0-9]+$', '', descricao)} por modalidade = {total}",
        "por_modalidade": tamanhos,
        "aviso": None,
    }


def idade_em(nascimento, hoje):
    """Anos completos entre o nascimento e hoje ("AAAA-MM-DD"); None sem data."""
    n = _DATA.match(str(nascimento or ""))
    h = _DATA.match(str(hoje or ""))
    if not n or not h:
        return None
    ny, nm, nd = (int(x) for x in n.groups())
    hy, hm, hd = (int(x) for x in h.groups())
    return hy - ny - (1 if (hm < nm or (hm == nm and hd < nd)) else 0)


def _compara(a, b):
    return -1 if a < b else 1 if a > b else 0


def _nulos_por_ultimo(a, b, comparar):
    if a is None and b is None:
        return 0
    if a is None:
        return 1
    if b is None:
        return -1
    return comparar(a, b)


def _chave_de_ordem(desempate, hoje):
    def idoso(linha):
        idade = idade_em(linha["_nascimento"], hoje)
        return idade is not None and idade >= 60

    def comparar(a, b):
        r = _nulos_por_ultimo(a["nota"], b["nota"], lambda x, y: _compara(y, x))
        if r:
            return r
        for d in desempate:
            if d == "IDOSO":
                ia, ib = idoso(a), idoso(b)
                if ia != ib:
                    return -1 if ia else 1
                if ia:
                    r = _compara(a["_nascimento"], b["_nascimento"])
            elif d == "EXPERIENCIA_DECLARADA":
                r = _nulos_por_ultimo(a["_experiencia"], b["_experiencia"], lambda x, y: _compara(y, x))
            elif d in ("MAIS_VELHO", "MAIOR_IDADE"):
                r = _nulos_por_ultimo(a["_nascimento"], b["_nascimento"], _compara)
            elif d == "CANDIDATURA":
                r = _nulos_por_ultimo(a["_candidatura"], b["_candidatura"], _compara)
            if r:
                return r
        return _compara(a["codigo"], b["codigo"]) or _compara(a["id"], b["id"])

    return cmp_to_key(comparar)


def pre_classificar_vaga(regra, vaga, candidatos, anterior=None, ultimo_lote=0, refazer=False, hoje=None):
    """
    Pré-classifica os inscritos de uma vaga (mesmo contrato de preClassificarVaga do JS).
      regra        normalizar_regra(configuração do edital)
      vaga         {codigo, vagas_imediatas, cadastro_reserva, modalidades}
      candidatos   [{id, codigo, ativo, colunas, nascimento, candidatura}]
      anterior     {id: {situacao, lote, lista_lote, entrada, motivo_entrada, posicao}}
    Devolve {"linhas": [...], "resumo": {...}}.
    """
    anterior = anterior or {}
    provisoria = (regra or {}).get("provisoria") or {}
    lote_da_regra = (regra or {}).get("lote") or {}
    tem_declarada = len(_lista(provisoria.get("nota_declarada"))) > 0
    tolerancia = provisoria.get("divergencia_tolerancia") or 0
    desempate = provisoria["desempate"] if isinstance(provisoria.get("desempate"), list) else DESEMPATE_PADRAO
    avisos = set()
    pergunta_da_experiencia = provisoria.get("pergunta_experiencia") if "EXPERIENCIA_DECLARADA" in desempate else None

    linhas = []
    for c in _lista(candidatos):
        ant = anterior.get(c.get("id"))
        colunas = c.get("colunas") if isinstance(c.get("colunas"), dict) else {}
        eliminacao = None
        if not ant or ant.get("situacao") != "ANALISADO":
            if c.get("ativo") is False:
                if not ant:
                    continue
                eliminacao = dict(SAIU_DA_EMPREGARE)
            else:
                eliminacao, ausentes = eliminacao_do_candidato(regra, colunas)
                avisos.update(f"COLUNA_AUSENTE:{codigo}" for codigo in ausentes)
        art = art_das_colunas(colunas)
        declarada = calcular_nota_declarada(regra, colunas) if tem_declarada else None
        nota = art if art is not None else (declarada["total"] if declarada else None)
        coluna_da_experiencia = (
            coluna_da_pergunta(colunas, pergunta_da_experiencia) if pergunta_da_experiencia else None
        )
        linhas.append(
            {
                "id": c.get("id"),
                "codigo": str(c.get("codigo") if c.get("codigo") is not None else ""),
                "_nascimento": c.get("nascimento"),
                "_candidatura": c.get("candidatura"),
                "_experiencia": meses_declarados(colunas[coluna_da_experiencia]) if coluna_da_experiencia else None,
                "situacao": "ELIMINADO" if eliminacao else "RANQUEADO",
                "motivo_codigo": eliminacao["codigo"] if eliminacao else None,
                "motivo": eliminacao["motivo"] if eliminacao else None,
                "art": art,
                "nota": nota,
                "origem_nota": "ART" if art is not None else ("DECLARADA" if declarada else None),
                "declarada": declarada["total"] if declarada else None,
                "declarada_parciais": declarada["parciais"] if declarada else None,
                "sem_mapa": declarada["sem_mapa"] if declarada else 0,
                "divergente": diverge_da_art(art, declarada["total"], tolerancia) if declarada else False,
                "modalidade": modalidade_do_candidato(regra, colunas),
                "posicao": None,
                "posicao_modalidade": None,
                "lote": None,
                "lista_lote": None,
                "entrada": None,
                "motivo_entrada": None,
                "_anterior": ant,
            }
        )

    # Provisória: ART decrescente e o desempate da regra.
    ranqueados = sorted((l for l in linhas if l["situacao"] != "ELIMINADO"), key=_chave_de_ordem(desempate, hoje))
    por_modalidade = {}
    for i, linha in enumerate(ranqueados):
        linha["posicao"] = i + 1
        por_modalidade[linha["modalidade"]] = por_modalidade.get(linha["modalidade"], 0) + 1
        linha["posicao_modalidade"] = por_modalidade[linha["modalidade"]]

    # Lote.
    t = tamanho_do_lote(lote_da_regra, vaga)
    if t["aviso"]:
        avisos.add(t["aviso"])
    if t["por_modalidade"]:
        ordem_das_listas = ["AC"] + [c for c in t["por_modalidade"] if c != "AC"]
    else:
        ordem_das_listas = ["GERAL"]

    def tamanho_da_lista(b):
        return t["por_modalidade"][b] if t["por_modalidade"] else t["tamanho"]

    def cabe_na_lista(linha, b):
        return b in ("GERAL", "AC") or linha["modalidade"] == b

    def lista_do(valor):
        return valor if valor in ordem_das_listas else ordem_das_listas[0]

    def herdar(linha, ant, situacao):
        linha.update(
            situacao=situacao,
            lote=ant.get("lote") or 1,
            lista_lote=ant.get("lista_lote"),
            entrada=ant.get("entrada"),
            motivo_entrada=ant.get("motivo_entrada"),
        )

    membros, saidas = [], []
    for linha in linhas:
        ant = linha["_anterior"]
        if not ant or ant.get("situacao") not in _NO_LOTE:
            continue
        if ant.get("situacao") == "ANALISADO":
            herdar(linha, ant, "ANALISADO")
            membros.append(linha)
        elif linha["situacao"] == "ELIMINADO":
            saidas.append(linha)
        elif not refazer:
            herdar(linha, ant, "NO_LOTE")
            membros.append(linha)
    herdados = list(membros)
    # Lote pela nota mínima: entram todos com a nota mínima (quem já estava fica).
    nota_minima = t.get("nota_minima")

    def tem_nota_minima(linha):
        return linha["nota"] is not None and linha["nota"] >= nota_minima

    if nota_minima is not None:
        t["tamanho"] = sum(1 for l in ranqueados if tem_nota_minima(l)) + sum(
            1 for m in membros if not tem_nota_minima(m)
        )
        t["descricao"] = f"{t['descricao']} = {t['tamanho']}"
    inicial = refazer or not any(l["_anterior"] and l["_anterior"].get("situacao") in _NO_LOTE for l in linhas)
    saidas.sort(
        key=lambda s: (
            s["_anterior"].get("posicao") if s["_anterior"].get("posicao") is not None else math.inf,
            s["codigo"],
        )
    )

    maior_lote = max([int(ultimo_lote or 0)] + [int((l["_anterior"] or {}).get("lote") or 0) for l in linhas])
    numero_novo = 1 if inicial else maior_lote + 1
    entraram = 0

    if t["tamanho"] is not None and (inicial or lote_da_regra.get("linha_anda") is not False):
        for b in ordem_das_listas:
            tamanho = tamanho_da_lista(b)
            ocupados = sum(1 for m in membros if lista_do(m["lista_lote"]) == b)
            fila_de_saidas = [s for s in saidas if lista_do(s["_anterior"].get("lista_lote")) == b]
            ultimo = None

            def entrar(linha, empate, b=b, fila_de_saidas=fila_de_saidas):
                nonlocal entraram, ultimo
                if inicial:
                    entrada = "INICIAL"
                    motivo = (
                        f"Empatado na linha de corte (nota {numero_no_texto(linha['nota'])})"
                        if empate
                        else f"Lote inicial: {t['descricao']}"
                    )
                elif empate:
                    entrada = (ultimo or {}).get("entrada") or "AMPLIACAO"
                    motivo = f"Empatado na linha de corte (nota {numero_no_texto(linha['nota'])})"
                elif fila_de_saidas:
                    saiu = fila_de_saidas.pop(0)
                    entrada = "REPOSICAO"
                    motivo = f"Entrou no lugar de {saiu['codigo']} ({saiu['motivo']})"
                else:
                    entrada = "AMPLIACAO"
                    motivo = f"Entrou para completar o lote ({t['descricao']})"
                linha.update(situacao="NO_LOTE", lote=numero_novo, lista_lote=b, entrada=entrada, motivo_entrada=motivo)
                membros.append(linha)
                entraram += 1
                ultimo = linha

            for linha in ranqueados:
                if ocupados >= tamanho:
                    break
                if linha["situacao"] != "RANQUEADO" or not cabe_na_lista(linha, b):
                    continue
                if nota_minima is not None and not tem_nota_minima(linha):
                    continue
                entrar(linha, False)
                ocupados += 1
            if lote_da_regra.get("inclui_empatados") and ultimo and ultimo["nota"] is not None:
                nota = ultimo["nota"]
                for linha in ranqueados:
                    if linha["situacao"] == "RANQUEADO" and cabe_na_lista(linha, b) and linha["nota"] == nota:
                        entrar(linha, True)

    if not inicial and saidas and lote_da_regra.get("linha_anda") is False:
        avisos.add("LINHA_PARADA")
    # A regra diminuiu o lote: quem já estava fica (só sai eliminado).
    if t["tamanho"] is not None:
        for b in ordem_das_listas:
            if sum(1 for m in herdados if lista_do(m["lista_lote"]) == b) > tamanho_da_lista(b):
                avisos.add("LOTE_ACIMA_DO_TAMANHO")

    notas_do_lote = [m["nota"] for m in membros if m["nota"] is not None]
    art_corte = min(notas_do_lote) if notas_do_lote else None
    # Fora do lote com nota acima da linha de corte da lista em que caberia.
    acima = set()
    for b in ordem_das_listas:
        notas = [m["nota"] for m in membros if lista_do(m["lista_lote"]) == b and m["nota"] is not None]
        if not notas:
            continue
        corte = min(notas)
        for linha in ranqueados:
            if (
                linha["situacao"] == "RANQUEADO"
                and cabe_na_lista(linha, b)
                and linha["nota"] is not None
                and linha["nota"] > corte
            ):
                acima.add(linha["id"])
    acima_do_corte = len(acima)
    if acima_do_corte:
        avisos.add("FORA_DO_LOTE_ACIMA_DO_CORTE")
    sem_art = sum(1 for l in linhas if l["situacao"] != "ELIMINADO" and l["art"] is None)
    if sem_art:
        avisos.add("ART_AUSENTE")

    saida_das_linhas = [{k: v for k, v in l.items() if not k.startswith("_")} for l in linhas]
    return {
        "linhas": saida_das_linhas,
        "resumo": {
            "inscritos": len(linhas),
            "eliminados": sum(1 for l in linhas if l["situacao"] == "ELIMINADO"),
            "ranqueados": len(ranqueados),
            "no_lote": len(membros),
            "tamanho": t["tamanho"],
            "descricao": t["descricao"],
            "por_modalidade": t["por_modalidade"],
            "art_corte": art_corte,
            "divergencias": sum(1 for l in linhas if l["divergente"]),
            "sem_art": sem_art,
            "acima_do_corte": acima_do_corte,
            "entraram": entraram,
            "lote_novo": numero_novo if entraram else None,
            "saidas": [{"id": s["id"], "codigo": s["codigo"], "motivo": s["motivo"]} for s in saidas],
            "avisos": sorted(avisos),
        },
    }
