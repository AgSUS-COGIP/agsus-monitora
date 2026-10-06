"""
A conta da ficha da avaliação documental (fase F4) a partir de UMA regra e do
que o analista lançou: situação e motivos de cada bloco, títulos, cursos,
vínculos, nota ajustada com justificativa e observações.

Cópia fiel de calcularAvaliacao (src/lib/avaliacao-documental/pontuacao.js),
com os mesmos nomes de campo na saída. A tela calcula com o JS e grava o
resultado pronto (concluir_ficha); o banco revalida a estrutura e os limites;
este módulo recalcula em lote para CONFERIR o que foi gravado
(conferir_ficha). Os casos dourados de
tests/fixtures/avaliacao-documental/casos-de-pontuacao.json rodam nos dois
lados (vitest e pytest). Mudou lá, muda aqui.
"""

import datetime
import math
import re
from decimal import ROUND_HALF_UP, Decimal

_EPSILON = 2.220446049250313e-16
_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CAMPO = re.compile(r"\{([a-z_]+)\}")

TITULO_PADRAO_DA_ETAPA = "Avaliação Documental e de Títulos"
PARCIAL_DO_TIPO = {"PONTUACAO": "ETNICO", "TITULOS": "FORMACAO", "CURSOS": "CURSOS", "VINCULOS": "EXPERIENCIA"}
PARCIAIS = {
    "ETNICO": "Critério Étnico",
    "FORMACAO": "Formação Acadêmica",
    "CURSOS": "Cursos de Aperfeiçoamento",
    "EXPERIENCIA": "Experiência Profissional",
}
SITUACOES_DO_BLOCO = {
    "CONFORME": "Conforme",
    "NAO_CONFORME": "Não conforme",
    "NAO_ENVIADO": "Não enviado",
    "NAO_SE_APLICA": "Não se aplica",
}
FORCA_DO_EFEITO = [
    "ELIMINA",
    "ZERA_PONTOS",
    "SEM_PONTOS_ALDEIA",
    "AJUSTA_PONTOS",
    "ENCAMINHA_HETEROIDENTIFICACAO",
    "ENCAMINHA_PERICIA",
    "SEGUE_AMPLA",
    "SO_REGISTRO",
]
PARECER_PADRAO = {
    "APTO": "{edital}\nCandidato(a) HABILITADO(A) na {titulo_etapa} com a pontuação total de {nota} pontos, "
    "distribuídos da seguinte forma:\n\n{distribuicao}",
    "INAPTO_REQUISITO": "{edital}\nCandidato(a) INABILITADO(A) na {titulo_etapa}, pelo(s) seguinte(s) motivo(s):\n\n{motivos}",
    "INAPTO_NOTA": "{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota mínima de {corte} pontos "
    "(item {item_corte}). Nota obtida: {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
    "observacoes": "\n\nObservações da análise:\n{observacoes}",
}


def _lista(valor):
    return valor if isinstance(valor, list) else []


def _objeto(valor):
    return valor if isinstance(valor, dict) else {}


def _texto(valor):
    return valor if isinstance(valor, str) else ""


def _numero(valor):
    if isinstance(valor, bool):
        return float(valor)
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def _eh_numero(valor):
    return isinstance(valor, (int, float)) and not isinstance(valor, bool) and math.isfinite(valor)


def arredondar(n, casas=4):
    """Math.round((n + Number.EPSILON) × 10^casas) / 10^casas, como o JS."""
    fator = 10**casas
    return math.floor((float(n) + _EPSILON) * fator + 0.5) / fator


def _com_teto(valor, teto):
    return valor if teto is None else min(valor, teto)


def _dia(texto):
    if not isinstance(texto, str) or not _DATA.match(texto):
        return None
    try:
        return datetime.date.fromisoformat(texto).toordinal()
    except ValueError:
        return None


def dias_dos_intervalos(intervalos, unir=True, limite=None):
    """Dias de intervalos [inicio, fim] inclusivos; unir emenda o dia seguinte."""
    corte = _dia(limite) if limite else None
    dias = []
    for item in _lista(intervalos):
        a, b = _dia(_objeto(item).get("inicio")), _dia(_objeto(item).get("fim"))
        if a is None or b is None or b < a:
            continue
        if corte is not None:
            b = min(b, corte)
        if b >= a:
            dias.append((a, b))
    dias.sort()
    if not unir:
        return sum(b - a + 1 for a, b in dias)
    total = 0
    atual = None
    for a, b in dias:
        if atual and a <= atual[1] + 1:
            atual[1] = max(atual[1], b)
        else:
            if atual:
                total += atual[1] - atual[0] + 1
            atual = [a, b]
    if atual:
        total += atual[1] - atual[0] + 1
    return total


def anos_meses_dias(dias):
    total = max(0, math.floor(_numero(dias)))
    resto = total % 365
    return {"anos": total // 365, "meses": resto // 30, "dias": resto % 30}


def normalizar_regra(entrada):
    """Só o que a conta da ficha usa, com os padrões de normalizarRegraAnalise."""
    r = _objeto(entrada)
    casas = r.get("casas_parecer")
    return {
        "titulo_etapa": _texto(r.get("titulo_etapa")).strip() or TITULO_PADRAO_DA_ETAPA,
        "edital_rotulo": _texto(r.get("edital_rotulo")),
        "casas_parecer": casas if _eh_numero(casas) and 0 <= casas <= 4 else 1,
        "blocos": _lista(r.get("blocos")),
        "corte": {"item_edital": _texto(_objeto(r.get("corte")).get("item_edital"))},
        "parecer": {**PARECER_PADRAO, **_objeto(r.get("parecer"))},
        "observacoes_prontas": _lista(r.get("observacoes_prontas")),
    }


def _forca(efeito):
    return FORCA_DO_EFEITO.index(efeito) if efeito in FORCA_DO_EFEITO else len(FORCA_DO_EFEITO)


def _mais_forte(efeitos):
    validos = sorted((e for e in efeitos if e), key=_forca)
    return validos[0] if validos else None


def _condicao_vale(condicao, candidato):
    if not condicao:
        return True
    if condicao == "INDIGENA":
        return bool(candidato.get("indigena"))
    partes = str(condicao).split("=")
    modalidade = partes[1] if len(partes) > 1 else ""
    return str(candidato.get("modalidade") or "").upper() == str(modalidade or "").upper()


def _com_item(item, texto):
    return f"Item {item}: {texto}" if item else texto


def _avaliar_blocos(regra, candidato, situacao_padrao):
    avaliados = []
    for bloco in regra["blocos"]:
        lancado = _objeto(_objeto(candidato.get("blocos")).get(bloco.get("codigo")))
        condicao = bloco.get("condicao") or ("INDIGENA" if bloco.get("tipo") == "PONTUACAO" else None)
        aplica = _condicao_vale(condicao, candidato)
        situacao = (lancado.get("situacao") or situacao_padrao) if aplica else "NAO_SE_APLICA"
        escolhidos = []
        if situacao in ("NAO_CONFORME", "NAO_ENVIADO"):
            for codigo in _lista(lancado.get("motivos")):
                achado = next((m for m in _lista(bloco.get("motivos")) if m.get("codigo") == codigo), None)
                if achado:
                    escolhidos.append(achado)
        if situacao == "NAO_SE_APLICA":
            efeito_da_situacao = None
        else:
            efeitos = _objeto(bloco.get("efeitos"))
            efeito_da_situacao = efeitos.get(situacao)
            if efeito_da_situacao is None:
                efeito_da_situacao = None if situacao == "CONFORME" else "SO_REGISTRO"
        dos_motivos = [m.get("efeito") for m in escolhidos if m.get("efeito")]
        efeito = _mais_forte(dos_motivos) if dos_motivos else efeito_da_situacao
        livre = str(lancado.get("motivo_livre") or "").strip()
        motivos = [
            {
                "codigo": m.get("codigo"),
                "texto": m.get("texto"),
                "item_edital": m.get("item_edital") or bloco.get("item_edital") or "",
            }
            for m in escolhidos
        ]
        if livre:
            motivos.append({"codigo": None, "texto": livre, "item_edital": bloco.get("item_edital") or ""})
        avaliados.append({"bloco": bloco, "situacao": situacao, "efeito": efeito, "motivos": motivos})
    return avaliados


def _pontos_etnicos(bloco, avaliado, candidato):
    if avaliado["situacao"] == "NAO_SE_APLICA" or not candidato.get("indigena"):
        return 0
    if avaliado["efeito"] in ("ELIMINA", "ZERA_PONTOS"):
        return 0
    pontos = _numero(bloco.get("indigena"))
    aldeia_vale = (
        candidato.get("mora_aldeia")
        and (candidato.get("aldeia_na_lista") if bloco.get("lista_aldeias") else True)
        and avaliado["efeito"] != "SEM_PONTOS_ALDEIA"
    )
    if aldeia_vale:
        pontos += _numero(bloco.get("aldeia"))
    return _com_teto(pontos, bloco.get("teto"))


def _pontos_dos_titulos(bloco, candidato):
    tabela = _lista(_objeto(bloco.get("pontos_por_nivel")).get(candidato.get("nivel")))
    valores = []
    for t in _lista(candidato.get("titulos")):
        if not t or t.get("aceito") is False:
            continue
        achado = next((x for x in tabela if x.get("titulo") == t.get("titulo")), None)
        valores.append(_numero(achado.get("pontos")) if achado else 0)
    if not valores:
        return 0
    total = sum(valores) if bloco.get("cumulativa") else max(valores)
    return _com_teto(total, bloco.get("teto"))


def faixa_do_curso(faixas, horas):
    h = _numero(horas)
    for f in _lista(faixas):
        if h >= _numero(f.get("min_horas")) and (f.get("max_horas") is None or h <= f.get("max_horas")):
            return f
    return None


def do_nivel(bloco, nivel):
    parte = _objeto(bloco.get("por_nivel")).get(nivel)
    return {**bloco, **parte} if isinstance(parte, dict) and parte else bloco


def teto_do_bloco(bloco, nivel):
    teto = do_nivel(bloco, nivel).get("teto") if bloco.get("tipo") in ("CURSOS", "VINCULOS") else bloco.get("teto")
    return None if teto is None else _numero(teto)


def nota_ajustada(lancado):
    v = _objeto(lancado).get("nota_ajustada")
    return float(v) if _eh_numero(v) else None


def textos_das_justificativas(regra, bloco, lancado):
    lancado = _objeto(lancado)
    textos = []
    for codigo in _lista(lancado.get("justificativas")):
        motivo = next((m for m in _lista(bloco.get("motivos")) if m.get("codigo") == codigo), None)
        if motivo:
            textos.append(_com_item(motivo.get("item_edital") or bloco.get("item_edital"), motivo.get("texto")))
            continue
        pronta = next((o for o in regra["observacoes_prontas"] if o.get("codigo") == codigo), None)
        if pronta:
            textos.append(pronta.get("texto"))
    livre = str(lancado.get("justificativa_livre") or "").strip()
    if livre:
        textos.append(_com_item(bloco.get("item_edital"), livre))
    return textos


def _pontos_dos_cursos(bloco_geral, candidato):
    bloco = do_nivel(bloco_geral, candidato.get("nivel"))
    total = 0
    for c in _lista(candidato.get("cursos")):
        if not c or c.get("aceito") is False:
            continue
        faixa = faixa_do_curso(bloco.get("faixas"), c.get("horas"))
        total += _numero(faixa.get("pontos")) if faixa else 0
    return _com_teto(arredondar(total), bloco.get("teto"))


def apurar_experiencia(bloco, candidato):
    unir = bloco.get("unir_sobreposicao") is not False
    limite = bloco.get("data_limite") or None
    categorias = _lista(bloco.get("categorias"))
    maximo = bloco.get("max_vinculos")
    aceitos = [v for v in _lista(candidato.get("vinculos")) if v and v.get("aceito") is not False]
    aceitos = aceitos[: 20 if maximo is None else int(maximo)]
    por_categoria = {}
    for c in categorias:
        dias = dias_dos_intervalos([v for v in aceitos if v.get("categoria") == c.get("codigo")], unir, limite)
        por_categoria[c.get("codigo")] = {"dias_total": dias, **anos_meses_dias(dias), "desempate": c.get("desempate")}
    que_contam = {c.get("codigo") for c in categorias if c.get("pontua") is not False}
    dias_total = dias_dos_intervalos([v for v in aceitos if v.get("categoria") in que_contam], unir, limite)
    dias_por_mes = bloco.get("dias_por_mes") if bloco.get("dias_por_mes") is not None else 30
    meses = math.floor(dias_total / dias_por_mes)
    estagio = _objeto(bloco.get("estagio_indigena"))
    meses_estagio = 0
    if estagio.get("ativo") and candidato.get("indigena") and _numero(candidato.get("estagio_horas")) > 0:
        if not estagio.get("so_sem_experiencia") or meses == 0:
            horas_por_dia = estagio.get("horas_por_dia") if estagio.get("horas_por_dia") is not None else 8
            dias_estagio = estagio.get("dias_por_mes") if estagio.get("dias_por_mes") is not None else 22
            meses_estagio = math.floor(_numero(candidato.get("estagio_horas")) / horas_por_dia / dias_estagio)
    if estagio.get("so_sem_experiencia") is False:
        considerados = meses + meses_estagio
    else:
        considerados = meses if meses > 0 else meses_estagio
    do_nivel_da_vaga = do_nivel(bloco, candidato.get("nivel"))
    minimo = _numero(bloco.get("minimo_meses"))
    que_pontuam = max(0, considerados - (minimo if bloco.get("desconta_minimo") else 0))
    if (bloco.get("pontuacao") or "POR_MES") == "POR_PERIODO":
        periodo = _numero(bloco.get("periodo_meses")) or 1
        bruto = math.floor(que_pontuam / periodo) * _numero(do_nivel_da_vaga.get("pontos_por_periodo"))
    else:
        bruto = que_pontuam * _numero(do_nivel_da_vaga.get("pontos_por_mes"))
    pontos = _com_teto(arredondar(bruto), do_nivel_da_vaga.get("teto"))
    meses_do_minimo = considerados if bloco.get("minimo_conta_estagio") else meses
    return {
        "dias_total": dias_total,
        "meses": meses,
        "meses_estagio": meses_estagio,
        "meses_considerados": considerados,
        "por_categoria": por_categoria,
        "pontos": pontos,
        "abaixo_do_minimo": minimo > 0 and meses_do_minimo < minimo,
    }


def numero_do_parecer(valor, casas=1):
    """Vírgula decimal com as casas da regra (toLocaleString pt-BR, arredonda a metade para cima)."""
    quantum = Decimal(1).scaleb(-int(casas))
    q = Decimal(repr(_numero(valor))).quantize(quantum, rounding=ROUND_HALF_UP)
    inteiro, _, decimais = f"{abs(q):f}".partition(".")
    grupos = []
    while len(inteiro) > 3:
        grupos.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    grupos.insert(0, inteiro)
    texto = ".".join(grupos) + ("," + decimais if decimais else "")
    return ("-" if q < 0 else "") + texto


def preencher_modelo(modelo, campos):
    return _CAMPO.sub(
        lambda m: str(campos[m.group(1)] if campos[m.group(1)] is not None else "")
        if m.group(1) in campos
        else m.group(0),
        str(modelo or ""),
    )


def _numero_saida(n):
    """Inteiro sai sem ".0", como o número do JS no JSON."""
    return int(n) if float(n).is_integer() else n


def calcular_avaliacao(regra_entrada, candidato=None, opcoes=None):
    """A avaliação de um candidato pela regra (calcularAvaliacao do JS)."""
    regra = normalizar_regra(regra_entrada)
    candidato = _objeto(candidato)
    opcoes = _objeto(opcoes)
    avaliados = _avaliar_blocos(regra, candidato, opcoes.get("situacaoPadrao") or "CONFORME")
    blocos_lancados = _objeto(candidato.get("blocos"))

    parciais, calculados, ajustes = {}, {}, {}
    experiencia = None
    eliminatorios, encaminhamentos, observacoes = [], [], []

    for avaliado in avaliados:
        bloco, efeito, motivos = avaliado["bloco"], avaliado["efeito"], avaliado["motivos"]
        parcial = PARCIAL_DO_TIPO.get(bloco.get("tipo"))
        if parcial:
            pontos = 0
            tipo = bloco.get("tipo")
            if tipo == "PONTUACAO":
                pontos = _pontos_etnicos(bloco, avaliado, candidato)
            elif tipo == "TITULOS":
                pontos = _pontos_dos_titulos(bloco, candidato)
            elif tipo == "CURSOS":
                pontos = _pontos_dos_cursos(bloco, candidato)
            elif tipo == "VINCULOS":
                experiencia = apurar_experiencia(bloco, candidato)
                pontos = experiencia["pontos"]
                if experiencia["abaixo_do_minimo"]:
                    m = bloco.get("minimo_meses")
                    texto = (
                        f"não comprovou a experiência profissional mínima de {_numero_saida(_numero(m))} "
                        f"{'mês' if _numero(m) == 1 else 'meses'}."
                    )
                    item = bloco.get("item_minimo") or bloco.get("item_edital")
                    if (bloco.get("efeito_minimo") or "ELIMINA") == "ELIMINA":
                        eliminatorios.append(_com_item(item, texto))
                    else:
                        observacoes.append(_com_item(item, texto))
            zera = efeito in ("ELIMINA", "ZERA_PONTOS")
            calculados[parcial] = 0 if zera else arredondar(pontos)
            ajuste = nota_ajustada(blocos_lancados.get(bloco.get("codigo")))
            if ajuste is not None:
                pontos = _com_teto(max(0, ajuste), teto_do_bloco(bloco, candidato.get("nivel")))
                ajustes[parcial] = {"calculado": calculados[parcial], "ajustado": 0 if zera else arredondar(pontos)}
            if zera:
                pontos = 0
            parciais[parcial] = arredondar(pontos)
        if efeito == "ELIMINA":
            if motivos:
                eliminatorios.extend(_com_item(m["item_edital"], m["texto"]) for m in motivos)
            else:
                rotulo = SITUACOES_DO_BLOCO.get(avaliado["situacao"], str(avaliado["situacao"] or "")).lower()
                eliminatorios.append(_com_item(bloco.get("item_edital"), f"{bloco.get('titulo')} — {rotulo}."))
        else:
            if (
                efeito
                and (efeito.startswith("ENCAMINHA_") or efeito == "SEGUE_AMPLA")
                and efeito not in encaminhamentos
            ):
                encaminhamentos.append(efeito)
            observacoes.extend(_com_item(m["item_edital"], m["texto"]) for m in motivos)
            if parcial:
                for t in textos_das_justificativas(regra, bloco, blocos_lancados.get(bloco.get("codigo"))):
                    if t not in observacoes:
                        observacoes.append(t)

    for codigo in _lista(candidato.get("observacoes_prontas")):
        pronta = next((o for o in regra["observacoes_prontas"] if o.get("codigo") == codigo), None)
        if pronta and pronta.get("texto") not in observacoes:
            observacoes.append(pronta.get("texto"))
    livre = str(candidato.get("observacoes") or "").strip()
    if livre:
        observacoes.append(livre)

    nota_apurada = arredondar(sum(parciais.values()))
    por_nivel = _objeto(opcoes.get("notaMinimaPorNivel")).get(candidato.get("nivel"))
    if por_nivel is not None:
        nota_minima = _numero(por_nivel)
    elif opcoes.get("notaMinima") is None:
        nota_minima = None
    else:
        nota_minima = _numero(opcoes.get("notaMinima"))

    if eliminatorios:
        resultado = "INAPTO_REQUISITO"
    elif nota_minima is not None and nota_apurada < nota_minima:
        resultado = "INAPTO_NOTA"
    else:
        resultado = "APTO"
    nota_final = 0 if resultado == "INAPTO_REQUISITO" else nota_apurada

    casas = regra["casas_parecer"]
    ordem = [PARCIAL_DO_TIPO.get(b.get("tipo")) for b in regra["blocos"]]
    ordem = [p for p in ordem if p and p in parciais]
    distribuicao = "\n".join(f"- {PARCIAIS.get(p, p)}: {numero_do_parecer(parciais[p], casas)} pontos." for p in ordem)
    campos = {
        "edital": regra["edital_rotulo"],
        "titulo_etapa": regra["titulo_etapa"] or TITULO_PADRAO_DA_ETAPA,
        "nota": numero_do_parecer(nota_final, casas),
        "corte": "" if nota_minima is None else numero_do_parecer(nota_minima, 2),
        "item_corte": regra["corte"]["item_edital"],
        "distribuicao": distribuicao,
        "motivos": "\n".join(f"- {t}" for t in eliminatorios),
        "observacoes": "\n".join(f"- {t}" for t in observacoes),
    }
    parecer = preencher_modelo(regra["parecer"].get(resultado), campos)
    if observacoes:
        parecer += preencher_modelo(regra["parecer"].get("observacoes"), campos)

    return {
        "resultado": resultado,
        "nota_apurada": _numero_saida(nota_apurada),
        "nota_final": _numero_saida(nota_final),
        "nota_minima": nota_minima,
        "parciais": {k: _numero_saida(v) for k, v in parciais.items()},
        "calculados": {k: _numero_saida(v) for k, v in calculados.items()},
        "ajustes": {
            k: {"calculado": _numero_saida(v["calculado"]), "ajustado": _numero_saida(v["ajustado"])}
            for k, v in ajustes.items()
        },
        "blocos": [
            {
                "codigo": a["bloco"].get("codigo"),
                "situacao": a["situacao"],
                "efeito": a["efeito"],
                "motivos": a["motivos"],
            }
            for a in avaliados
        ],
        "eliminatorios": eliminatorios,
        "encaminhamentos": encaminhamentos,
        "observacoes": observacoes,
        "experiencia": experiencia,
        "parecer": parecer.lstrip("\n"),
    }


def conferir_ficha(regra, lancamento, gravado, opcoes=None, tolerancia=1e-4):
    """
    Recalcula uma ficha concluída e devolve as diferenças com o que foi gravado
    (TB_FICHA_ANALISE."DS_RESULTADO" e "DS_PARECER"): lista vazia = confere.
    """
    gravado = _objeto(gravado)
    r = calcular_avaliacao(regra, lancamento, opcoes)
    diferencas = []
    if r["resultado"] != gravado.get("resultado"):
        diferencas.append({"campo": "resultado", "gravado": gravado.get("resultado"), "recalculado": r["resultado"]})
    for campo in ("nota_apurada", "nota_final"):
        if abs(_numero(gravado.get(campo)) - _numero(r[campo])) > tolerancia:
            diferencas.append({"campo": campo, "gravado": gravado.get(campo), "recalculado": r[campo]})
    parciais = _objeto(gravado.get("parciais"))
    for p in sorted(set(parciais) | set(r["parciais"])):
        if abs(_numero(parciais.get(p)) - _numero(r["parciais"].get(p))) > tolerancia:
            diferencas.append(
                {"campo": f"parciais.{p}", "gravado": parciais.get(p), "recalculado": r["parciais"].get(p)}
            )
    if "parecer" in gravado and str(gravado.get("parecer") or "") != r["parecer"]:
        diferencas.append({"campo": "parecer", "gravado": "(texto)", "recalculado": "(texto)"})
    return diferencas
