"""
A configuração de convocação do edital (Lista de aprovados › Convocação) do
jeito que a classificação a usa — cópia fiel das partes de
src/lib/modelo-de-convocacao.ts (normalizarModelo, modeloEmBranco),
src/lib/lista-convocacao-rules.ts (derivarQuadro), src/lib/configuracao-de-convocacao.ts
(lerModelosDoBanco, lerConfiguracoesDoBanco, configuracaoDaVaga) e
src/lib/classificacao/convocacao-do-edital.ts (uma conta só para as vagas por
modalidade: quadro do edital > configuração de convocação > percentuais da regra).

A entrada é a das RPCs listar_configuracao_convocacao e listar_modelos_convocacao
(as linhas cruas) e o id do edital; `convocacao_do_edital` monta a mesma
estrutura que a tela passa ao motor.
"""

from __future__ import annotations

import math
import re
import unicodedata

from .catalogo import codigos_da_modalidade
from .regra import normalizar_regra
from .semantica_js import eh_numero, numero_em_texto, numero_js, texto, texto_js, verdadeiro

_ARREDONDAMENTO_DA_REGRA = {"PARA_CIMA": "sempre_acima", "MEIO_PARA_CIMA": "meio_acima"}
_ACUMULO_DA_REGRA = {
    "MAIOR_PERCENTUAL": "maior_percentual",
    "PCD_MAIS_UMA": "acumula_com_acumulavel",
    "TODAS": "todas",
}
_ARREDONDAMENTOS = ("meio_acima", "sempre_acima")
_DISTRIBUICOES = ("proporcional", "serie_mgi", "posicao_fixa")
_COTAS_MULTIPLAS = ("maior_percentual", "acumula_com_acumulavel", "todas")
_MARCAS = re.compile("[̀-ͯ]")
_NAO_ALFANUMERICO = re.compile(r"[^a-z0-9]+")


class ConvocacaoInvalida(ValueError):
    """Resposta incompleta não pode produzir uma configuração parcial de vagas."""


def _lista(valor) -> list:
    return valor if isinstance(valor, list) else []


def _registro(valor) -> dict:
    return dict(valor) if isinstance(valor, dict) else {}


def normalizar_texto(valor) -> str:
    sem_marca = _MARCAS.sub("", unicodedata.normalize("NFD", texto_js(valor))).lower()
    return _NAO_ALFANUMERICO.sub(" ", sem_marca).strip(" ")


def _inteiro_nao_negativo(valor) -> int:
    n = numero_js(valor)
    if not math.isfinite(n):
        return 0
    n = math.floor(n)
    return n if n > 0 else 0


def _taxa(valor):
    n = numero_js(valor)
    if not math.isfinite(n) or n <= 0:
        return 0
    return min(n, 100)


def _escolher(opcoes, valor, padrao):
    v = texto(valor)
    return v if v in opcoes else padrao


def _normalizar_categoria(valor, indice: int) -> dict:
    c = _registro(valor)
    ident = normalizar_texto(c.get("id")).replace(" ", "_")
    return {
        "id": ident or f"categoria_{indice + 1}",
        "rotulo": texto(c.get("rotulo")) or f"Categoria {indice + 1}",
        "sigla": texto(c.get("sigla"))[:10] or "—",
        "ampla": c.get("ampla") is True,
        "acumulavel": c.get("acumulavel") is True,
        "percentual": _taxa(c.get("percentual")),
        "arredondamento": _escolher(_ARREDONDAMENTOS, c.get("arredondamento"), "meio_acima"),
        "teto": _taxa(c.get("teto")),
        "minimo": _inteiro_nao_negativo(c.get("minimo")),
        "cascata": [d for d in (normalizar_texto(v).replace(" ", "_") for v in _lista(c.get("cascata"))) if d],
        "ordem": indice,
    }


def normalizar_modelo(valor) -> dict:
    """normalizarModelo: uma e só uma ampla concorrência; a ampla não tem percentual."""
    modelo = _registro(valor)
    brutas = modelo.get("categorias") if isinstance(modelo.get("categorias"), list) else []
    categorias = [_normalizar_categoria(c, i) for i, c in enumerate(brutas)]
    amplas = [c for c in categorias if c["ampla"]]
    if not amplas:
        categorias.insert(
            0,
            _normalizar_categoria({"id": "ampla", "rotulo": "Ampla concorrência", "sigla": "AC", "ampla": True}, -1),
        )
    else:
        for c in amplas[1:]:
            c["ampla"] = False
    for i, c in enumerate(categorias):
        c["ordem"] = i
        if c["ampla"]:
            c["percentual"] = 0
    ids = {c["id"] for c in categorias}
    for c in categorias:
        c["cascata"] = [d for d in c["cascata"] if d in ids and d != c["id"]]
    return {
        "id": texto(modelo.get("id")),
        "nome": texto(modelo.get("nome")) or "Modelo sem nome",
        "distribuicao": _escolher(_DISTRIBUICOES, modelo.get("distribuicao"), "proporcional"),
        "cotaMultipla": _escolher(_COTAS_MULTIPLAS, modelo.get("cotaMultipla"), "maior_percentual"),
        "categorias": categorias,
    }


def modelo_em_branco() -> dict:
    return normalizar_modelo(
        {
            "nome": "",
            "distribuicao": "proporcional",
            "cotaMultipla": "maior_percentual",
            "categorias": [{"id": "ampla", "rotulo": "Ampla concorrência", "sigla": "AC", "ampla": True}],
        }
    )


def _arredondar_vaga(valor, modo="meio_acima") -> int:
    if not math.isfinite(valor) or valor <= 0:
        return 0
    if modo == "sempre_acima":
        return math.ceil(valor)
    inteiro = math.floor(valor)
    return inteiro + 1 if valor - inteiro >= 0.5 else inteiro


def _quadro_vazio(modelo) -> dict:
    return {c["id"]: 0 for c in modelo["categorias"]}


def _ampla(modelo) -> dict:
    for c in modelo["categorias"]:
        if c["ampla"]:
            return c
    raise ConvocacaoInvalida("Modelo sem ampla concorrência. Recarregue a configuração.")


def derivar_quadro(total_imediatas, modelo) -> dict:
    """derivarQuadro: as reservas da maior taxa para a menor, com orçamento; o resto é da ampla."""
    total = _inteiro_nao_negativo(total_imediatas)
    quadro = _quadro_vazio(modelo)
    ampla = _ampla(modelo)
    if not total:
        return quadro
    restante = total
    reservas = sorted((c for c in modelo["categorias"] if not c["ampla"]), key=lambda c: (-c["percentual"], c["ordem"]))
    for c in reservas:
        if c["minimo"] > 0 and total < c["minimo"]:
            continue
        vagas = _arredondar_vaga((total * c["percentual"]) / 100, c["arredondamento"])
        if c["teto"] > 0:
            vagas = min(vagas, math.floor((total * c["teto"]) / 100))
        vagas = min(vagas, restante)
        quadro[c["id"]] = vagas
        restante -= vagas
    quadro[ampla["id"]] = restante
    return quadro


def _normalizar_quadro(quadro, modelo) -> dict:
    base = _quadro_vazio(modelo)
    for c in modelo["categorias"]:
        base[c["id"]] = _inteiro_nao_negativo(_registro(quadro).get(c["id"]))
    return base


# ── Leitura do banco ───────────────────────────────────────────────────


def _linhas(valor) -> list[dict]:
    if valor is None:
        return []
    if not isinstance(valor, list) or any(not isinstance(v, dict) for v in valor):
        raise ConvocacaoInvalida("Configuração de convocação inválida. Recarregue os modelos e as vagas.")
    return [dict(v) for v in valor]


def _identificador(valor) -> str:
    if isinstance(valor, str) and texto(valor):
        return texto(valor)
    if eh_numero(valor) and math.isfinite(valor):
        return numero_em_texto(valor)
    raise ConvocacaoInvalida("Configuração de convocação inválida. Recarregue os modelos e as vagas.")


def _chave_unica(chave: str, usadas: set) -> str:
    if chave in usadas:
        raise ConvocacaoInvalida("Configuração de convocação inválida. Recarregue os modelos e as vagas.")
    usadas.add(chave)
    return chave


def ler_modelos_do_banco(linhas) -> dict:
    """listar_modelos_convocacao → modelo_id → modelo normalizado."""
    usadas: set = set()
    saida = {}
    for linha in _linhas(linhas):
        chave = _chave_unica(_identificador(linha.get("modelo_id")), usadas)
        saida[chave] = normalizar_modelo(
            {
                "id": linha.get("modelo_id"),
                "nome": linha.get("nome"),
                "distribuicao": linha.get("distribuicao"),
                "cotaMultipla": linha.get("cota_multipla"),
                "categorias": [
                    {**c, "cascata": _ler_termos(c.get("cascata"))} for c in _linhas(linha.get("categorias"))
                ],
            }
        )
    return saida


def _ler_termos(valor) -> list[str]:
    if isinstance(valor, list):
        return [t for t in (texto(v) for v in valor) if t]
    return [t for t in (texto(v) for v in re.split(r"[;\n]", texto_js(valor))) if t]


def ler_configuracoes_do_banco(linhas) -> dict:
    """listar_configuracao_convocacao → edital_id → {proporcionalidade, modeloId, padraoImediata, vagas}."""
    usadas: set = set()
    saida = {}
    for linha in _linhas(linhas):
        chave = _chave_unica(_identificador(linha.get("edital_id")), usadas)
        modelo_id = linha.get("modelo_id")
        padrao = numero_js(linha.get("padrao_imediata"))
        saida[chave] = {
            "proporcionalidade": linha.get("proporcionalidade") is not False,
            "modeloId": texto_js(modelo_id) if verdadeiro(modelo_id) else "",
            "padraoImediata": padrao if padrao and not math.isnan(padrao) else 0,
            "vagas": _mapa_das_vagas(linha.get("vagas")),
        }
    return saida


def _mapa_das_vagas(valor) -> dict:
    usadas: set = set()
    saida = {}
    for vaga in _linhas(valor):
        chave = _chave_unica(_identificador(vaga.get("codigo_vaga")), usadas)
        imediatas = numero_js(vaga.get("imediatas"))
        quadro = vaga.get("quadro")
        if quadro is not None and not isinstance(quadro, dict):
            raise ConvocacaoInvalida("Configuração de convocação inválida. Recarregue os modelos e as vagas.")
        saida[chave] = {
            "cargo": texto(vaga.get("cargo")),
            "imediatas": imediatas if imediatas and not math.isnan(imediatas) else 0,
            "manual": vaga.get("manual") is True,
            "quadro": dict(quadro or {}),
        }
    return saida


def _modelo_do_edital(configs, modelos, edital_id) -> dict:
    config = configs.get(texto_js(edital_id))
    ident = texto_js((config or {}).get("modeloId") or "")
    return modelos.get(ident) or modelo_em_branco()


def configuracao_da_vaga(configs, modelos, edital_id, codigo_vaga) -> dict:
    """quadro manual da vaga > derivado do total da vaga > derivado do padrão do edital."""
    config = configs.get(texto_js(edital_id))
    modelo = _modelo_do_edital(configs, modelos, edital_id)
    if not config:
        return {"quadro": _quadro_vazio(modelo), "modelo": modelo}
    vaga = config["vagas"].get(texto(codigo_vaga))
    if vaga and vaga["manual"]:
        quadro = _normalizar_quadro(vaga["quadro"], modelo)
    else:
        quadro = derivar_quadro(vaga["imediatas"] if vaga else config["padraoImediata"], modelo)
    return {"quadro": quadro, "modelo": modelo}


def convocacao_do_edital(bruta, edital_id=None):
    """
    A configuração de convocação de UM edital (convocacaoDoEdital): `bruta` =
    {"configuracoes": linhas de listar_configuracao_convocacao, "modelos": linhas
    de listar_modelos_convocacao}. Sem configuração para o edital → None.
    """
    if not edital_id or not isinstance(bruta, dict):
        return None
    configs = ler_configuracoes_do_banco(bruta.get("configuracoes"))
    config = configs.get(texto_js(edital_id))
    if not config:
        return None
    por_id = ler_modelos_do_banco(bruta.get("modelos"))
    modelo = por_id.get(config["modeloId"])
    return {
        "editalId": texto_js(edital_id),
        "modeloId": config["modeloId"],
        "modeloNome": (modelo or {}).get("nome") or "",
        "modelo": modelo,
        "configs": configs,
        "modelos": por_id,
    }


# ── A ponte com a classificação ────────────────────────────────────────


def codigo_da_categoria(categoria) -> str | None:
    """O código de modalidade da classificação (AC, PCD, PP…) de uma categoria do modelo."""
    categoria = categoria or {}
    if categoria.get("ampla"):
        return "AC"
    ident = texto_js(categoria.get("id") or "").replace("_", " ")
    rotulo = texto_js(categoria.get("rotulo") or "")
    sigla = texto_js(categoria.get("sigla") or "")
    achados = [c for c in codigos_da_modalidade(f"{rotulo} {sigla} {ident}") if c != "AC"]
    if achados:
        return achados[0]
    limpa = re.sub(r"[^A-Z]", "", sigla.upper())
    return limpa if re.match(r"^[A-Z]{2,8}$", limpa) else None


def modelo_da_regra(regra_bruta):
    """O modelo de convocação equivalente às modalidades da regra; "fração para baixo" → None."""
    regra = normalizar_regra(regra_bruta)
    reservas = [m for m in regra["modalidades"] if m["codigo"] != "AC" and m["percentual"]]
    if any(m["arredondamento"] not in _ARREDONDAMENTO_DA_REGRA for m in reservas):
        return None
    return normalizar_modelo(
        {
            "nome": "Regra de classificação",
            "distribuicao": "proporcional",
            "cotaMultipla": _ACUMULO_DA_REGRA.get(regra["cotas"]["acumulo"]) or "maior_percentual",
            "categorias": [
                {"id": "ac", "rotulo": "Ampla concorrência", "sigla": "AC", "ampla": True},
                *(
                    {
                        "id": m["codigo"].lower(),
                        "rotulo": m["nome"],
                        "sigla": m["codigo"],
                        "percentual": m["percentual"],
                        "arredondamento": _ARREDONDAMENTO_DA_REGRA[m["arredondamento"]],
                        "acumulavel": m["codigo"] == "PCD",
                        "minimo": regra["cotas"]["minimo_vagas_reserva"],
                        "cascata": [c.lower() for c in m["remanejar_para"] if c != "AC"],
                    }
                    for m in reservas
                ),
            ],
        }
    )


def vagas_por_codigo(quadro, modelo, codigo_de=codigo_da_categoria) -> dict:
    """{AC: 2, PP: 1} a partir do quadro por categoria do modelo."""
    saida: dict = {}
    for c in (modelo or {}).get("categorias") or []:
        codigo = codigo_de(c)
        if not codigo:
            continue
        n = numero_js((quadro or {}).get(c["id"]))
        n = max(0, math.trunc(n)) if n and not math.isnan(n) and math.isfinite(n) else 0
        saida[codigo] = saida.get(codigo, 0) + n
    if "AC" not in saida:
        saida["AC"] = 0
    return saida


def vagas_pela_conta(total, modelo) -> dict:
    return vagas_por_codigo(derivar_quadro(total, modelo), modelo, lambda c: "AC" if c["ampla"] else c["sigla"])


def vagas_da_convocacao(convocacao, codigo_vaga):
    """As vagas por modalidade de uma vaga pela configuração de convocação, ou None."""
    if not convocacao:
        return None
    config = convocacao["configs"].get(convocacao["editalId"])
    codigo = texto(codigo_vaga)
    if not config or (codigo not in config["vagas"] and not config["padraoImediata"]):
        return None
    cfg = configuracao_da_vaga(convocacao["configs"], convocacao["modelos"], convocacao["editalId"], codigo)
    vagas = vagas_por_codigo(cfg["quadro"], cfg["modelo"])
    return {"total": sum(vagas.values()), "porModalidade": vagas}


def divergencias_das_cotas(regra_bruta, convocacao) -> list[str]:
    """Onde a regra de classificação e o modelo de convocação dizem coisas diferentes sobre as cotas."""
    modelo = (convocacao or {}).get("modelo")
    if not modelo:
        return []
    regra = normalizar_regra(regra_bruta)
    frases = []
    da_regra = {m["codigo"]: m for m in regra["modalidades"] if m["codigo"] != "AC"}
    do_modelo: dict = {}
    for c in modelo["categorias"]:
        codigo = codigo_da_categoria(c)
        if codigo and codigo != "AC":
            do_modelo[codigo] = c
    nome = convocacao.get("modeloNome") or "modelo de convocação"
    for codigo, c in do_modelo.items():
        m = da_regra.get(codigo)
        pct = numero_em_texto(c["percentual"])
        if not m:
            if c["percentual"]:
                frases.append(f"{codigo}: {pct}% no {nome}, ausente na regra de classificação.")
            continue
        pct_regra = m["percentual"] if m["percentual"] is not None else 0
        if pct_regra != c["percentual"]:
            frases.append(f"{codigo}: {numero_em_texto(pct_regra)}% na regra × {pct}% no {nome}.")
        if _ARREDONDAMENTO_DA_REGRA.get(m["arredondamento"]) != c["arredondamento"]:
            frases.append(f"{codigo}: arredondamento diferente da convocação.")
        minimo = regra["cotas"]["minimo_vagas_reserva"]
        if c["minimo"] != minimo:
            frases.append(f"{codigo}: mínimo de {numero_em_texto(minimo)} vaga(s) na regra × {c['minimo']} no {nome}.")
    for codigo, m in da_regra.items():
        if codigo not in do_modelo and m["percentual"]:
            frases.append(f"{codigo}: {numero_em_texto(m['percentual'])}% na regra, ausente no {nome}.")
    return frases
