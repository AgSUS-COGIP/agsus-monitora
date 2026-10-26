"""
A conta da ficha da avaliação documental (fase F4) a partir de UMA regra e do
que o analista lançou: situação e motivos de cada bloco, títulos, cursos,
vínculos, nota ajustada com justificativa e observações.

Cópia fiel de calcularAvaliacao (src/lib/avaliacao-documental/pontuacao.ts),
com os mesmos nomes de campo na saída. A tela calcula com o JS e grava o
resultado pronto (concluir_ficha); o banco revalida a estrutura e os limites;
este módulo recalcula em lote para CONFERIR o que foi gravado
(conferir_ficha). Os casos dourados de
tests/fixtures/avaliacao-documental/casos-de-pontuacao.json rodam nos dois
lados (vitest e pytest). Mudou lá, muda aqui.

As diferenças por cargo (regra.por_cargo) seguem
src/lib/avaliacao-documental/regra-por-cargo.ts: a regra da vaga
(regra_da_vaga) põe teto, faixas, extras, área exigida, requisitos do cargo e "não se aplica"
por cima do nível (cargo > nível > padrão).
"""

import datetime
import math
import re
import unicodedata
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
PARCIAIS_CURTAS = {
    "ETNICO": "Critério étnico",
    "FORMACAO": "Titulação",
    "CURSOS": "Cursos",
    "EXPERIENCIA": "Experiência",
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
# A linha da pontuação informativa do inapto por requisito (parecer.mostrar_pontos_quando_inapto),
# quando a regra não traz parecer.pontos_informativos (MODELO_DOS_PONTOS_INFORMATIVOS do regra.ts).
MODELO_DOS_PONTOS_INFORMATIVOS = (
    "\n\nPontuação apurada dos títulos, para fins informativos: {nota_informativa} pontos ({distribuicao_informativa})."
)


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
    """Anos (365), meses (30, até 11) e dias: 364 dias = 0 anos, 11 meses e 34 dias (anosMesesDias)."""
    total = max(0, math.floor(_numero(dias)))
    resto = total % 365
    meses = min(resto // 30, 11)
    return {"anos": total // 365, "meses": meses, "dias": resto - meses * 30}


def texto_do_cargo(valor):
    """Sem acento (U+0300–U+036F, como o JS), minúsculo, só letras e dígitos."""
    t = unicodedata.normalize("NFD", "" if valor is None else str(valor))
    t = "".join(c for c in t if not 0x300 <= ord(c) <= 0x36F).lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def cargo_casa(cargo, seletor):
    """Palavras inteiras: "cargo 1" não casa "cargo 15"."""
    s, c = texto_do_cargo(seletor), texto_do_cargo(cargo)
    return bool(s and c) and f" {s} " in f" {c} "


def diferenca_da_vaga(regra, alvo):
    """A diferença por cargo que vale para a vaga (código da vaga primeiro, depois o cargo)."""
    diferencas = [d for d in _lista(_objeto(regra).get("por_cargo")) if isinstance(d, dict)]
    alvo = _objeto(alvo)
    vaga = str(alvo.get("vaga") if alvo.get("vaga") is not None else "").strip()
    if vaga:
        for d in diferencas:
            if any(str(v).strip() == vaga for v in _lista(d.get("vagas"))):
                return d
    cargo = alvo.get("cargo")
    if not texto_do_cargo(cargo):
        return None
    return next((d for d in diferencas if any(cargo_casa(cargo, s) for s in _lista(d.get("cargos")))), None)


def bloco_do_cargo(bloco, sobrescrita, nivel):
    if not isinstance(sobrescrita, dict):
        return bloco
    parte = _objeto(bloco.get("por_nivel")).get("" if nivel is None else str(nivel))
    r = {**bloco, **parte} if isinstance(parte, dict) else {**bloco}
    r.pop("por_nivel", None)
    if sobrescrita.get("nao_se_aplica") is True:
        r["nao_se_aplica"] = True
    if "teto" in sobrescrita:
        r["teto"] = sobrescrita.get("teto")
    if _lista(sobrescrita.get("faixas")):
        r["faixas"] = sobrescrita["faixas"]
    if _lista(sobrescrita.get("extras")):
        r["extras"] = sobrescrita["extras"]
    if _texto(sobrescrita.get("area")).strip():
        r["area"] = _texto(sobrescrita.get("area")).strip()
    requisitos = _lista(sobrescrita.get("requisitos"))
    if requisitos:
        r["requisitos"] = requisitos
        r["motivos"] = [
            *_lista(bloco.get("motivos")),
            *(
                {
                    "codigo": q.get("codigo"),
                    "texto": q.get("motivo"),
                    "item_edital": q.get("item_edital") or bloco.get("item_edital") or "",
                    "efeito": "ELIMINA",
                }
                for q in requisitos
            ),
        ]
    return r


def regra_da_vaga(regra, alvo):
    """A regra com a diferença do cargo da vaga aplicada (regraDaVaga do JS)."""
    diferenca = diferenca_da_vaga(regra, alvo)
    if not diferenca:
        return regra
    sobrescritas = _objeto(diferenca.get("blocos"))
    nivel = _objeto(alvo).get("nivel")
    return {
        **regra,
        "por_cargo": [],
        "cargo": {"codigo": diferenca.get("codigo"), "rotulo": diferenca.get("rotulo")},
        "blocos": [
            bloco_do_cargo(b, sobrescritas.get(str(b.get("codigo"))), nivel) if isinstance(b, dict) else b
            for b in _lista(regra.get("blocos"))
        ],
    }


def pontos_dos_extras(bloco, lancado):
    marcados = _objeto(_objeto(lancado).get("extras"))
    return sum(
        e.get("pontos") if _eh_numero(e.get("pontos")) else 0
        for e in _lista(_objeto(bloco).get("extras"))
        if isinstance(e, dict) and marcados.get(e.get("codigo")) is True
    )


def normalizar_regra(entrada):
    """Só o que a conta da ficha usa, com os padrões de normalizarRegraAnalise."""
    r = _objeto(entrada)
    casas = r.get("casas_parecer")
    return {
        "por_cargo": _lista(r.get("por_cargo")),
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


_CODIGO_DE_MODALIDADE = re.compile(r"^[A-Z]{2,10}$")
_COTA_NEGADA = ("NAO_CONFORME", "NAO_ENVIADO")


def modalidades_do_lancamento(candidato):
    """
    As cotas que o candidato optou, em ordem de prioridade (modalidadesDoLancamento
    do JS): o lançamento `modalidades` (a lista da pré-classificação) ou, na ficha
    antiga sem a lista, a `modalidade` única. [] = só a ampla.
    """
    candidato = _objeto(candidato)
    bruta = candidato.get("modalidades")
    if not isinstance(bruta, list):
        bruta = [candidato.get("modalidade")]
    saida = []
    for valor in bruta:
        codigo = str(valor or "").strip().upper()
        if _CODIGO_DE_MODALIDADE.match(codigo) and codigo != "AC" and codigo not in saida:
            saida.append(codigo)
    return saida


def _modalidade_da_condicao(condicao):
    partes = str(condicao or "").split("=")
    return partes[1].strip().upper() if len(partes) > 1 and partes[0].strip().upper() == "MODALIDADE" else None


def _condicao_vale(condicao, candidato):
    if not condicao:
        return True
    if condicao == "INDIGENA":
        return bool(candidato.get("indigena"))
    # O bloco de cota vale para quem optou pela cota, entre as várias (114/2026, 5.8.1).
    partes = str(condicao).split("=")
    modalidade = (partes[1] if len(partes) > 1 else "").strip().upper()
    return modalidade in modalidades_do_lancamento(candidato)


def cotas_confirmadas(regra, candidato, avaliados, cotas=None):
    """
    As cotas optadas que a ficha confirmou, a final primeiro (cotasConfirmadas do
    JS; FC_COTAS_CONFIRMADAS no banco): sai a cota com bloco (condição
    MODALIDADE=<cota>) Não conforme ou Não enviado. A ordem segue o acúmulo da
    regra de classificação (cotas = {acumulo, percentuais}): PCD_MAIS_UMA → a PcD
    primeiro; depois o maior percentual (114/2026, 5.8.5); empate na ordem optada.
    """
    situacao = {}
    for a in avaliados:
        cota = _modalidade_da_condicao(a["bloco"].get("condicao"))
        if cota and a["situacao"] in _COTA_NEGADA:
            situacao[cota] = a["situacao"]
    optadas = modalidades_do_lancamento(candidato)
    confirmadas = [c for c in optadas if c not in situacao]
    cotas = _objeto(cotas)
    percentuais = _objeto(cotas.get("percentuais"))
    pcd_primeiro = cotas.get("acumulo") == "PCD_MAIS_UMA"

    def percentual(codigo):
        valor = percentuais.get(codigo)
        return valor if _eh_numero(valor) else 0

    return sorted(
        confirmadas, key=lambda c: (0 if pcd_primeiro and c == "PCD" else 1, -percentual(c), optadas.index(c))
    )


def _com_item(item, texto):
    return f"Item {item}: {texto}" if item else texto


# O "Outro motivo (descrever)": em motivos (Não confere, Não enviou) ou em
# justificativas (nota diferente da declarada), com o texto em motivo_livre,
# que vale como o motivo do item (OUTRO_MOTIVO do JS).
OUTRO_MOTIVO = "OUTRO"


def _motivo_livre_do_nao_confere(bloco, lancado):
    """
    O motivo escrito vale com o "Outro motivo" marcado ou no bloco sem motivos
    na regra (o texto é o motivo); fora disso (texto que ficou de outra
    escolha), não entra no parecer (motivoLivreDoNaoConfere do JS).
    """
    livre = str(lancado.get("motivo_livre") or "").strip()
    if not livre:
        return ""
    return livre if OUTRO_MOTIVO in _lista(lancado.get("motivos")) or not _lista(bloco.get("motivos")) else ""


def _uma_linha(texto):
    """Uma linha só: o parecer lista uma observação por linha (umaLinha do JS)."""
    return re.sub(r"\s+", " ", str(texto or "")).strip()


def _avaliar_blocos(regra, candidato, situacao_padrao):
    avaliados = []
    for bloco in regra["blocos"]:
        lancado = _objeto(_objeto(candidato.get("blocos")).get(bloco.get("codigo")))
        condicao = bloco.get("condicao") or ("INDIGENA" if bloco.get("tipo") == "PONTUACAO" else None)
        # O bloco que não se aplica ao cargo da vaga (por_cargo → nao_se_aplica).
        aplica = bloco.get("nao_se_aplica") is not True and _condicao_vale(condicao, candidato)
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
        livre = _motivo_livre_do_nao_confere(bloco, lancado) if situacao in ("NAO_CONFORME", "NAO_ENVIADO") else ""
        motivos = [
            {
                "codigo": m.get("codigo"),
                "texto": m.get("texto"),
                "item_edital": m.get("item_edital") or bloco.get("item_edital") or "",
            }
            for m in escolhidos
        ]
        if livre:
            # O motivo escrito vai como o avaliador escreveu, sem o item do edital
            # (ele cita o item no texto, se quiser); os motivos da regra levam o item.
            motivos.append({"codigo": None, "texto": livre, "item_edital": ""})
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
    extras = pontos_dos_extras(bloco, _objeto(candidato.get("blocos")).get(bloco.get("codigo")))
    if not valores and not extras:
        return 0
    dos_titulos = 0 if not valores else (sum(valores) if bloco.get("cumulativa") else max(valores))
    return _com_teto(dos_titulos + extras, bloco.get("teto"))


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


def _texto_comparavel(texto):
    """Minúsculo, espaços simples, sem a pontuação do fim (textoComparavel do JS)."""
    t = re.sub(r"\s+", " ", str(texto or "").lower()).strip()
    return re.sub(r"[.;:]+$", "", t)


def textos_das_justificativas(regra, bloco, lancado):
    """
    O motivo do bloco (com o item), a observação pronta ou o "Outro motivo"
    escrito (motivo_livre, como o avaliador escreveu, sem o item), e o texto livre (a justificativa do
    ajuste); o motivo ou a observação cujo texto já está no texto livre sai.
    """
    lancado = _objeto(lancado)
    textos = []
    livre = str(lancado.get("justificativa_livre") or "").strip()

    def no_livre(texto):
        t = _texto_comparavel(texto)
        return bool(livre) and bool(t) and t in _texto_comparavel(livre)

    for codigo in _lista(lancado.get("justificativas")):
        if codigo == OUTRO_MOTIVO:
            outro = str(lancado.get("motivo_livre") or "").strip()
            if outro and not no_livre(outro):
                textos.append(outro)  # como o avaliador escreveu, sem o item do edital
            continue
        motivo = next((m for m in _lista(bloco.get("motivos")) if m.get("codigo") == codigo), None)
        if motivo:
            if not no_livre(motivo.get("texto")):
                textos.append(_com_item(motivo.get("item_edital") or bloco.get("item_edital"), motivo.get("texto")))
            continue
        pronta = next((o for o in regra["observacoes_prontas"] if o.get("codigo") == codigo), None)
        if pronta and not no_livre(pronta.get("texto")):
            textos.append(pronta.get("texto"))
    if livre:
        textos.append(_com_item(bloco.get("item_edital"), livre))
    return textos


def observacoes_dos_itens(avaliados, candidato):
    """
    A Observação do avaliador de cada item (blocos[codigo].observacao), em
    qualquer situação (inclusive Não se aplica), na ordem da regra, como o
    avaliador escreveu, sem o item do edital nem o título do bloco; a igual à
    justificativa do ajuste ou ao motivo escrito não se repete
    (observacoesDosItens do JS).
    """
    textos = []
    for avaliado in avaliados:
        bloco = avaliado["bloco"]
        lancado = _objeto(_objeto(candidato.get("blocos")).get(bloco.get("codigo")))
        obs = _uma_linha(lancado.get("observacao"))
        if not obs:
            continue
        if any(
            _texto_comparavel(t) == _texto_comparavel(obs)
            for t in (lancado.get("justificativa_livre"), lancado.get("motivo_livre"))
        ):
            continue
        textos.append(obs)
    return textos


def _pontos_dos_cursos(bloco_geral, candidato):
    bloco = do_nivel(bloco_geral, candidato.get("nivel"))
    total = 0
    for c in _lista(candidato.get("cursos")):
        if not c or c.get("aceito") is False:
            continue
        faixa = faixa_do_curso(bloco.get("faixas"), c.get("horas"))
        total += _numero(faixa.get("pontos")) if faixa else 0
    total += pontos_dos_extras(bloco, _objeto(candidato.get("blocos")).get(bloco.get("codigo")))
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


_PONTAS_DA_LINHA = re.compile(r"^[ \t]+|[ \t]+$")


def linhas_sem_espacos_nas_pontas(texto):
    """
    Cada linha sem espaço (nem tabulação) nas pontas; o resto do texto fica igual
    (linhasSemEspacosNasPontas do JS). O parecer sai assim: o motivo ou o modelo da
    regra digitado com espaço no fim não muda o texto (o banco já tira os espaços
    das pontas do parecer inteiro em concluir_ficha).
    """
    return "\n".join(_PONTAS_DA_LINHA.sub("", linha) for linha in str(texto or "").split("\n"))


def preencher_modelo(modelo, campos):
    return _CAMPO.sub(
        lambda m: (
            str(campos[m.group(1)] if campos[m.group(1)] is not None else "") if m.group(1) in campos else m.group(0)
        ),
        str(modelo or ""),
    )


def _numero_saida(n):
    """Inteiro sai sem ".0", como o número do JS no JSON."""
    return int(n) if float(n).is_integer() else n


def calcular_avaliacao(regra_entrada, candidato=None, opcoes=None):
    """A avaliação de um candidato pela regra (calcularAvaliacao do JS)."""
    candidato = _objeto(candidato)
    # A regra da vaga: a diferença do cargo por cima do nível (cargo > nível > padrão).
    regra = regra_da_vaga(normalizar_regra(regra_entrada), candidato)
    opcoes = _objeto(opcoes)
    avaliados = _avaliar_blocos(regra, candidato, opcoes.get("situacaoPadrao") or "CONFORME")
    blocos_lancados = _objeto(candidato.get("blocos"))

    parciais, calculados, ajustes = {}, {}, {}
    experiencia = None
    eliminatorios, encaminhamentos, observacoes = [], [], []

    for avaliado in avaliados:
        bloco, efeito, motivos = avaliado["bloco"], avaliado["efeito"], avaliado["motivos"]
        parcial = PARCIAL_DO_TIPO.get(bloco.get("tipo"))
        # O bloco que não se aplica (condição do candidato ou cargo da vaga) não
        # pontua nem elimina: zero, sem o ajuste que ficou de antes e sem o
        # mínimo da experiência (calcularAvaliacao do JS).
        if parcial and avaliado["situacao"] == "NAO_SE_APLICA":
            calculados[parcial] = 0
            parciais[parcial] = 0
            continue
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

    for t in observacoes_dos_itens(avaliados, candidato):
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
    # Inapto por requisito com a opção ligada: a pontuação apurada, só informativa.
    pontos_informativos = (
        {"nota": nota_apurada, "parciais": dict(parciais)}
        if resultado == "INAPTO_REQUISITO" and regra["parecer"].get("mostrar_pontos_quando_inapto") is True
        else None
    )

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
        "nota_informativa": numero_do_parecer(nota_apurada, casas) if pontos_informativos else "",
        "distribuicao_informativa": "; ".join(
            f"{PARCIAIS_CURTAS.get(p, p)} {numero_do_parecer(parciais[p], casas)}" for p in ordem
        )
        if pontos_informativos
        else "",
    }
    parecer = preencher_modelo(regra["parecer"].get(resultado), campos)
    if pontos_informativos:
        parecer += preencher_modelo(
            regra["parecer"].get("pontos_informativos") or MODELO_DOS_PONTOS_INFORMATIVOS, campos
        )
    if observacoes:
        parecer += preencher_modelo(regra["parecer"].get("observacoes"), campos)

    # A modalidade final: a cota confirmada de maior percentual; sem nenhuma, a ampla.
    confirmadas = cotas_confirmadas(regra, candidato, avaliados, opcoes.get("cotas"))
    return {
        "resultado": resultado,
        "modalidade_final": confirmadas[0] if confirmadas else "AC",
        "modalidades_confirmadas": confirmadas,
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
        "pontos_informativos": None
        if pontos_informativos is None
        else {
            "nota": _numero_saida(pontos_informativos["nota"]),
            "parciais": {k: _numero_saida(v) for k, v in pontos_informativos["parciais"].items()},
        },
        "parecer": linhas_sem_espacos_nas_pontas(parecer).lstrip("\n"),
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
    # A pontuação informativa do inapto por requisito (parecer.mostrar_pontos_quando_inapto).
    informativa = _objeto(gravado.get("pontos_informativos")) or None
    recalculada = r["pontos_informativos"]
    if (informativa is None) != (recalculada is None) or (
        informativa and abs(_numero(informativa.get("nota")) - _numero(recalculada["nota"])) > tolerancia
    ):
        diferencas.append(
            {
                "campo": "pontos_informativos",
                "gravado": None if informativa is None else informativa.get("nota"),
                "recalculado": None if recalculada is None else recalculada["nota"],
            }
        )
    if "modalidade_final" in gravado and gravado.get("modalidade_final") != r["modalidade_final"]:
        diferencas.append(
            {
                "campo": "modalidade_final",
                "gravado": gravado.get("modalidade_final"),
                "recalculado": r["modalidade_final"],
            }
        )
    # O parecer gravado antes da geração sem espaços nas pontas das linhas (motivo da
    # regra com espaço no fim, no meio do texto) confere: só essa diferença não conta.
    if "parecer" in gravado and linhas_sem_espacos_nas_pontas(gravado.get("parecer")) != r["parecer"]:
        diferencas.append({"campo": "parecer", "gravado": "(texto)", "recalculado": "(texto)"})
    return diferencas
