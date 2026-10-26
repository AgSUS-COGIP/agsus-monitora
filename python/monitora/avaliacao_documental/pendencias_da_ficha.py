"""
O que falta para concluir a ficha da avaliação documental (cópia fiel de
pendenciasDaFicha em src/lib/avaliacao-documental/ficha.ts, com os mesmos tipos):
situacao, motivo, item, datas, horas, comprovado, minimo, acima, justificativa,
requisito, extra e nota. O banco confere o mesmo ao concluir (FC_PENDENCIAS_FICHA).

Usado pelo job de conferências (scripts/conferencias): a ficha CONCLUIDA que passou
a ter pendência pela regra vigente vai para revisão (RPC
revisar_ficha_concluida_com_pendencia, que confere de novo no banco antes de mover).
Os casos dourados de tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json
rodam na tela, aqui e no banco. Mudou lá, muda aqui.
"""

import datetime
import re
import unicodedata

from .pontuacao import (
    OUTRO_MOTIVO,
    PARCIAIS,
    PARCIAL_DO_TIPO,
    _condicao_vale,
    normalizar_regra,
    regra_da_vaga,
    teto_do_bloco,
)

BLOCOS_COM_ITENS = {"TITULOS": "titulos", "CURSOS": "cursos", "VINCULOS": "vinculos"}
BLOCOS_PELA_NOTA = ("CURSOS",)
ZERAM_O_BLOCO = ("NAO_CONFORME", "NAO_ENVIADO")
MINIMO_DO_MOTIVO_LIVRE = 10
PRIMEIRA_DATA_DO_VINCULO = "1960-01-01"
DIFERENCA = 1e-4
_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
FALTA_DO_COMPROVADO = {
    "titulos": "Registre ao menos um título.",
    "cursos": "Registre ao menos um curso com carga horária.",
    "vinculos": "Registre ao menos um vínculo com início e fim.",
}
NOME_DOS_ITENS = {"titulos": "os títulos aceitos dão", "cursos": "os cursos aceitos dão"}


def _lista(v):
    return v if isinstance(v, list) else []


def _objeto(v):
    return v if isinstance(v, dict) else {}


def _numero(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _eh_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _tem_texto(v, minimo=1):
    return len(str(v if v is not None else "").strip()) >= minimo


def _data_valida(texto):
    if not isinstance(texto, str) or not _DATA.match(texto):
        return False
    try:
        return datetime.date.fromisoformat(texto).isoformat() == texto
    except ValueError:
        return False


def _texto_comparavel(t):
    """textoComparavel de ficha.ts: sem acento, minúsculo, só letras e dígitos."""
    t = unicodedata.normalize("NFD", "" if t is None else str(t))
    t = "".join(c for c in t if not 0x300 <= ord(c) <= 0x36F).lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def _mesmo_texto(a, b):
    return bool(_texto_comparavel(a)) and _texto_comparavel(a) == _texto_comparavel(b)


def texto_da_nota(valor):
    """textoDaNota: vírgula decimal, até 2 casas ("12,5")."""
    n = _numero(valor)
    if n is None:
        return "—"
    texto = f"{round(n, 2):,.2f}".rstrip("0").rstrip(".")
    return texto.replace(",", "_").replace(".", ",").replace("_", ".")


def falta_nas_datas_do_vinculo(vinculo, hoje):
    """faltaNasDatasDoVinculo (datas-do-vinculo.ts); `hoje` em AAAA-MM-DD."""
    v = _objeto(vinculo)
    inicio, fim = v.get("inicio"), v.get("fim")
    if not _data_valida(inicio) or not _data_valida(fim) or fim < inicio:
        return "Confira o início e o fim do vínculo."
    if inicio < PRIMEIRA_DATA_DO_VINCULO:
        return "Vínculo com data antes de 1960: confira o início."
    if fim > hoje:
        return "Vínculo com fim depois de hoje: o tempo comprovado vai até a data do documento."
    return None


def item_completo(chave, item):
    if not isinstance(item, dict):
        return False
    if chave == "titulos":
        return bool(item.get("titulo"))
    if chave == "cursos":
        return (_numero(item.get("horas")) or 0) > 0
    if chave == "vinculos":
        return _data_valida(item.get("inicio")) and _data_valida(item.get("fim")) and item["fim"] >= item["inicio"]
    return True


def decide_pela_nota(bloco, lancamento):
    if _objeto(bloco).get("tipo") not in BLOCOS_PELA_NOTA:
        return False
    chave = BLOCOS_COM_ITENS[bloco["tipo"]]
    return not any(
        isinstance(i, dict) and not i.get("do_arquivo") and i.get("aceito") is not False and item_completo(chave, i)
        for i in _lista(_objeto(lancamento).get(chave))
    )


def _muda_o_resultado(efeito):
    return isinstance(efeito, str) and efeito not in ("", "SO_REGISTRO")


def bloco_nao_pontua_no_nivel(bloco, nivel):
    """blocoNaoPontuaNoNivel (FC_BLOCO_NAO_PONTUA_NO_NIVEL)."""
    if not nivel or _objeto(bloco).get("tipo") not in ("TITULOS", "CURSOS", "VINCULOS"):
        return False
    do_nivel = _objeto(_objeto(bloco.get("por_nivel")).get(nivel))
    pode_mudar = (
        any(_muda_o_resultado(e) for e in _objeto(bloco.get("efeitos")).values())
        or any(_muda_o_resultado(_objeto(m).get("efeito")) for m in _lista(bloco.get("motivos")))
        or bool(_lista(bloco.get("requisitos")))
        or bool(_lista(bloco.get("extras")))
        or bool(_lista(do_nivel.get("extras")))
        or (_eh_numero(bloco.get("minimo_meses")) and bloco["minimo_meses"] > 0)
    )
    if pode_mudar:
        return False
    if teto_do_bloco(bloco, nivel) == 0:
        return True
    por_nivel = _objeto(bloco.get("pontos_por_nivel"))
    return bloco.get("tipo") == "TITULOS" and bool(por_nivel) and not _lista(por_nivel.get(nivel))


def bloco_se_aplica(bloco, lancamento):
    if _objeto(bloco).get("nao_se_aplica") is True:
        return False
    if bloco_nao_pontua_no_nivel(bloco, _objeto(lancamento).get("nivel")):
        return False
    condicao = bloco.get("condicao") or ("INDIGENA" if bloco.get("tipo") == "PONTUACAO" else None)
    return _condicao_vale(condicao, _objeto(lancamento))


def opcoes_de_justificativa(regra, bloco):
    motivos = _lista(_objeto(bloco).get("motivos"))
    prontas = [
        o
        for o in _lista(regra.get("observacoes_prontas"))
        if not any(
            m.get("codigo") == o.get("codigo")
            or _mesmo_texto(m.get("texto"), o.get("texto"))
            or _mesmo_texto(m.get("texto"), o.get("rotulo"))
            for m in motivos
        )
    ]
    return [*motivos, *prontas]


def _da_regra(codigos):
    return [c for c in _lista(codigos) if c != OUTRO_MOTIVO]


def _motivo_livre_basta(lancado):
    return _tem_texto(lancado.get("motivo_livre"), MINIMO_DO_MOTIVO_LIVRE)


def bloco_justificado(regra, bloco, lancado):
    lancado = _objeto(lancado)
    if _da_regra(lancado.get("justificativas")):
        return True
    if OUTRO_MOTIVO in _lista(lancado.get("justificativas")) and _motivo_livre_basta(lancado):
        return True
    if lancado.get("situacao") in ZERAM_O_BLOCO and (_lista(lancado.get("motivos")) or _motivo_livre_basta(lancado)):
        return True
    return not opcoes_de_justificativa(regra, bloco) and _tem_texto(lancado.get("justificativa_livre"), 10)


def acima_do_comprovado_justificado(regra, bloco, lancado):
    return _objeto(lancado).get("edita_nota") is True and bloco_justificado(regra, bloco, lancado)


def divergencia_do_bloco(bloco, avaliacao, declarada):
    parcial = PARCIAL_DO_TIPO.get(bloco.get("tipo"))
    if not parcial:
        return None
    decl = _objeto(_objeto(declarada).get("parciais")).get(parcial)
    apur = _objeto(_objeto(avaliacao).get("parciais")).get(parcial)
    if not _eh_numero(decl) or not _eh_numero(apur):
        return None
    return {"parcial": parcial, "declarada": decl, "apurada": apur} if abs(apur - decl) > DIFERENCA else None


def falta_do_comprovado(bloco, lancamento, declarada):
    chave = BLOCOS_COM_ITENS.get(_objeto(bloco).get("tipo"))
    if not chave or bloco["tipo"] in BLOCOS_PELA_NOTA:
        return None
    decl = _objeto(_objeto(declarada).get("parciais")).get(PARCIAL_DO_TIPO[bloco["tipo"]])
    if not (_eh_numero(decl) and decl > 0):
        return None
    algum = any(
        isinstance(i, dict) and i.get("aceito") is not False and item_completo(chave, i)
        for i in _lista(_objeto(lancamento).get(chave))
    )
    return None if algum else FALTA_DO_COMPROVADO[chave]


def pontuacao_acima_do_comprovado(bloco, lancamento, avaliacao):
    """pontuacaoAcimaDoComprovado: Conforme acima do que os itens aceitos dão (abaixo vale a declarada)."""
    chave = BLOCOS_COM_ITENS.get(_objeto(bloco).get("tipo"))
    lancado = _objeto(_objeto(_objeto(lancamento).get("blocos")).get(bloco.get("codigo")))
    if not chave or lancado.get("situacao") != "CONFORME" or decide_pela_nota(bloco, lancamento):
        return None
    parcial = PARCIAL_DO_TIPO[bloco["tipo"]]
    valor = _objeto(_objeto(avaliacao).get("parciais")).get(parcial)
    calculado = _objeto(_objeto(avaliacao).get("calculados")).get(parcial)
    if not _eh_numero(valor) or not _eh_numero(calculado) or not valor - calculado > DIFERENCA:
        return None
    exp = _objeto(_objeto(avaliacao).get("experiencia"))
    meses = None
    if bloco["tipo"] == "VINCULOS":
        meses = int(_numero(exp.get("meses_considerados", exp.get("meses"))) or 0)
    return {"parcial": parcial, "valor": valor, "calculado": calculado, "meses": meses}


def _mes(n):
    return f"{n} {'mês' if n == 1 else 'meses'}"


def _pts(n):
    return f"{texto_da_nota(n)} {'ponto' if _numero(n) == 1 else 'pontos'}"


def _nome_curto(bloco):
    parcial = PARCIAL_DO_TIPO.get(bloco.get("tipo"))
    if parcial:
        return PARCIAIS[parcial]
    return re.split(r" \(|,", str(bloco.get("titulo") or bloco.get("codigo") or ""))[0].strip()


def _texto_do_acima(bloco, acima):
    if bloco.get("tipo") == "VINCULOS":
        return (
            f"Experiência confirmada com {_pts(acima['valor'])}, mas os vínculos aceitos comprovam "
            f"{_mes(acima['meses'])} ({_pts(acima['calculado'])}). Lance os vínculos que comprovam o período "
            "declarado ou ajuste a pontuação em Editar nota, com justificativa."
        )
    itens = NOME_DOS_ITENS[BLOCOS_COM_ITENS[bloco["tipo"]]]
    return (
        f"{_nome_curto(bloco)} confirmada com {_pts(acima['valor'])}, mas {itens} {_pts(acima['calculado'])}. "
        "Registre os itens que comprovam o declarado ou ajuste a pontuação em Editar nota, com justificativa."
    )


def faltas_do_cargo(bloco, lancado):
    """faltasDoCargo (regra-por-cargo.ts)."""
    lancado = _objeto(lancado)
    if lancado.get("situacao") != "CONFORME":
        return []
    faltas = []
    marcados = _objeto(lancado.get("requisitos"))
    if any(marcados.get(_objeto(r).get("codigo")) is not True for r in _lista(bloco.get("requisitos"))):
        faltas.append({"tipo": "requisito", "texto": "Confira cada requisito do cargo."})
    if not _eh_numero(lancado.get("nota_ajustada")):
        extras = _objeto(lancado.get("extras"))
        for e in _lista(bloco.get("extras")):
            if not isinstance(extras.get(_objeto(e).get("codigo")), bool):
                faltas.append({"tipo": "extra", "texto": f"Confira: {_objeto(e).get('rotulo')}."})
    return faltas


def pendencias_da_ficha(regra_entrada, lancamento, avaliacao, declarada, hoje):
    """[{bloco, tipo, texto}] (pendenciasDaFicha). `avaliacao` é a de calcular_avaliacao; `hoje` em AAAA-MM-DD."""
    lancamento = _objeto(lancamento)
    regra = regra_da_vaga(normalizar_regra(regra_entrada), lancamento)
    pendencias = []
    blocos = _objeto(lancamento.get("blocos"))
    efeitos = [(_objeto(b).get("codigo"), _objeto(b).get("efeito")) for b in _lista(_objeto(avaliacao).get("blocos"))]
    eliminado_por_bloco = any(e == "ELIMINA" for _, e in efeitos)
    resultado = _objeto(avaliacao).get("resultado")
    for bloco in regra["blocos"]:
        if not isinstance(bloco, dict) or bloco.get("tipo") == "REGISTRO" or not bloco_se_aplica(bloco, lancamento):
            continue
        codigo = bloco.get("codigo")
        lancado = _objeto(blocos.get(codigo))
        situacao = lancado.get("situacao")

        def falta(tipo, texto, codigo=codigo):
            pendencias.append({"bloco": codigo, "tipo": tipo, "texto": texto})

        if not situacao:
            falta(
                "situacao",
                "Escolha Confere, Não confere ou Editar nota."
                if PARCIAL_DO_TIPO.get(bloco.get("tipo"))
                else "Escolha Confere ou Não confere.",
            )
        zera = situacao in ZERAM_O_BLOCO
        marcadas = lancado.get("motivos") if zera else lancado.get("justificativas") if situacao == "CONFORME" else []
        outro = OUTRO_MOTIVO in _lista(marcadas)
        motivos_da_regra = _lista(bloco.get("motivos"))
        if outro and not _motivo_livre_basta(lancado):
            falta("motivo" if zera else "justificativa", "Descreva o outro motivo (10 caracteres ou mais).")
        elif (
            zera
            and not _da_regra(lancado.get("motivos"))
            and not (outro or (not motivos_da_regra and _motivo_livre_basta(lancado)))
        ):
            falta(
                "motivo",
                "Escolha o motivo." if motivos_da_regra else "Escreva o motivo (10 caracteres ou mais).",
            )
        chave = None if decide_pela_nota(bloco, lancamento) else BLOCOS_COM_ITENS.get(bloco.get("tipo"))
        if chave:
            itens = [i for i in _lista(lancamento.get(chave)) if not zera or item_completo(chave, i)]
            if any(isinstance(i, dict) and i.get("aceito") is False and not i.get("motivo") for i in itens):
                falta("item", "Escolha o motivo da recusa do item.")
            aceitos = [i for i in itens if isinstance(i, dict) and i.get("aceito") is not False]
            if chave == "vinculos":
                nas_datas = next((t for t in (falta_nas_datas_do_vinculo(v, hoje) for v in aceitos) if t), None)
                if nas_datas:
                    falta("datas", nas_datas)
            if chave == "cursos" and any(not ((_numero(c.get("horas")) or 0) > 0) for c in aceitos):
                falta("horas", "Informe a carga horária do curso.")
            comprovado = (
                falta_do_comprovado(bloco, lancamento, declarada)
                if situacao == "CONFORME" and not eliminado_por_bloco
                else None
            )
            if comprovado:
                falta("comprovado", comprovado)
            exp = _objeto(avaliacao).get("experiencia")
            minimo = _numero(bloco.get("minimo_meses")) or 0
            eliminado_por_outro = any(e == "ELIMINA" and c != codigo for c, e in efeitos)
            if (
                chave == "vinculos"
                and exp
                and minimo > 0
                and (bloco.get("efeito_minimo") or "ELIMINA") == "ELIMINA"
                and not eliminado_por_outro
            ):
                meses = _numero(exp.get("meses_considerados" if bloco.get("minimo_conta_estagio") else "meses")) or 0
                meses = int(meses)
                minimo_texto = int(minimo) if float(minimo).is_integer() else minimo
                if not comprovado and situacao == "CONFORME" and meses < minimo:
                    falta(
                        "minimo",
                        f"Experiência mínima de {_mes(minimo_texto)} não comprovada (comprovado {_mes(meses)}): "
                        "registre os vínculos que comprovam ou escolha Não confere.",
                    )
                if zera and meses >= minimo:
                    marcada = "Não enviou" if situacao == "NAO_ENVIADO" else "Não confere"
                    falta(
                        "minimo",
                        f"Experiência marcada como {marcada}, mas os vínculos aceitos somam {_mes(meses)} "
                        f"(mínimo {_mes(minimo_texto)}). Desmarque os vínculos que não foram aceitos — sem a "
                        "experiência mínima o candidato é eliminado — ou marque Confere.",
                    )
            acima = (
                pontuacao_acima_do_comprovado(bloco, lancamento, avaliacao)
                if not comprovado
                and resultado != "INAPTO_REQUISITO"
                and not any(p["bloco"] == codigo and p["tipo"] == "minimo" for p in pendencias)
                else None
            )
            if acima and not acima_do_comprovado_justificado(regra, bloco, lancado):
                falta("acima", _texto_do_acima(bloco, acima))
        if (
            situacao == "CONFORME"
            and resultado != "INAPTO_REQUISITO"
            and divergencia_do_bloco(bloco, avaliacao, declarada)
            and not bloco_justificado(regra, bloco, lancado)
            and not (outro and not _motivo_livre_basta(lancado))
        ):
            falta("justificativa", "Pontuação diferente da declarada: escolha a justificativa.")
        for f in faltas_do_cargo(bloco, lancado):
            falta(f["tipo"], f["texto"])
        ajuste = lancado.get("nota_ajustada")
        teto = teto_do_bloco(bloco, lancamento.get("nivel"))
        if _eh_numero(ajuste) and (ajuste < 0 or (teto is not None and ajuste > teto)):
            falta("nota", f"Ajuste a pontuação entre 0 e {texto_da_nota(teto)}.")
    return pendencias
