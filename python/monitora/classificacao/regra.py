"""
A regra de classificação de UM edital, completa (cópia fiel de normalizarRegra
em src/lib/classificacao/regra.ts): o que faltar fica neutro — nada elimina,
nada desempata —, nunca o de outro edital. Só os campos que o motor usa (os
textos do documento oficial ficam com a tela).
"""

from __future__ import annotations

import re

from .catalogo import (
    COMPONENTES_DA_NOTA,
    CRITERIO_POR_CODIGO,
    DIRECOES,
    EMPATE_NAS_LISTAS,
    METODOS_DE_EMPATE_FINAL,
    NIVEIS,
    NUMERACOES,
    PARCIAIS_DA_DOCUMENTAL,
)
from .numeros import ler_data, numero_br
from .semantica_js import math_trunc, texto, texto_js

ACUMULOS = ("MAIOR_PERCENTUAL", "PCD_MAIS_UMA", "TODAS")
ARREDONDAMENTOS_DE_COTA = ("PARA_CIMA", "MEIO_PARA_CIMA", "PARA_BAIXO")
ARREDONDAMENTOS = ("MEIO_PARA_CIMA", "TRUNCAR", "NENHUM")

MODALIDADE_AMPLA = {
    "codigo": "AC",
    "nome": "Ampla concorrência",
    "percentual": None,
    "arredondamento": "MEIO_PARA_CIMA",
    "lista_propria": False,
    "recomeca_posicao": True,
    "aparece_na_geral": True,
    "remanejar_para": [],
    "agrupa": [],
}
_COMPONENTES_PADRAO = [{"codigo": "DOCUMENTAL", "peso": 1}, {"codigo": "ENTREVISTA", "peso": 1}]
_SEPARADORES = re.compile(r"[,;\n]")


def objeto(valor) -> dict:
    return valor if isinstance(valor, dict) else {}


def lista(valor) -> list:
    return valor if isinstance(valor, list) else []


def numero_ou_nulo(valor):
    return None if valor is None or valor == "" else numero_br(valor)


def booleano(valor, padrao: bool) -> bool:
    return valor if isinstance(valor, bool) else padrao


def um_de(valor, opcoes, padrao):
    return valor if isinstance(valor, str) and valor in opcoes else padrao


def termos(valor) -> list[str]:
    brutos = valor if isinstance(valor, list) else _SEPARADORES.split(texto_js(valor))
    return [t for t in (texto(v) for v in brutos) if t]


def codigos(valor) -> list[str]:
    saida: list[str] = []
    for c in termos(valor):
        c = c.upper()
        if c not in saida:
            saida.append(c)
    return saida


def normalizar_modalidade(m) -> dict:
    o = objeto(m)
    codigo = texto(o.get("codigo")).upper()
    return {
        "codigo": codigo,
        "nome": texto(o.get("nome")) or codigo,
        "percentual": numero_ou_nulo(o.get("percentual")),
        "arredondamento": um_de(o.get("arredondamento"), ARREDONDAMENTOS_DE_COTA, "MEIO_PARA_CIMA"),
        "lista_propria": booleano(o.get("lista_propria"), codigo != "AC"),
        "recomeca_posicao": booleano(o.get("recomeca_posicao"), True),
        "aparece_na_geral": booleano(o.get("aparece_na_geral"), True),
        "remanejar_para": [c for c in codigos(o.get("remanejar_para")) if c != codigo],
        "agrupa": [c for c in codigos(o.get("agrupa")) if c != codigo],
    }


def _data_corte(valor):
    return texto(valor)[:10] if ler_data(valor) else None


def normalizar_regra(bruta) -> dict:
    """A regra completa, com os campos que faltarem neutros (normalizarRegra)."""
    r = objeto(bruta)
    doc = objeto(r.get("documental"))
    ent = objeto(r.get("entrevista"))
    comp = objeto(r.get("composicao"))
    listas = objeto(r.get("listas"))
    empate = objeto(r.get("empate_final"))
    cotas = objeto(r.get("cotas"))
    conv = objeto(r.get("convocacao"))
    etapas = objeto(r.get("etapas"))
    por_nivel = objeto(doc.get("nota_minima_por_nivel"))

    modalidades = [m for m in (normalizar_modalidade(x) for x in lista(r.get("modalidades"))) if m["codigo"]]
    if not any(m["codigo"] == "AC" for m in modalidades):
        modalidades.insert(0, normalizar_modalidade(MODALIDADE_AMPLA))

    minimos_por_nivel = {}
    for nivel in NIVEIS:
        minimo = numero_ou_nulo(por_nivel.get(nivel))
        if minimo is not None:
            minimos_por_nivel[nivel] = minimo

    situacoes = doc.get("situacoes_aptas")
    componentes = lista(comp.get("componentes")) or _COMPONENTES_PADRAO

    def criterio(d):
        codigo = texto(objeto(d).get("criterio")).upper()
        catalogo = CRITERIO_POR_CODIGO.get(codigo)
        return {
            "criterio": codigo,
            "direcao": um_de(objeto(d).get("direcao"), DIRECOES, catalogo.direcao if catalogo else "MAIOR_PRIMEIRO"),
        }

    def ordem_da_competencia(c, i):
        ordem = numero_ou_nulo(objeto(c).get("ordem"))
        return math_trunc(ordem if ordem is not None else i + 1)

    def peso(c):
        p = numero_ou_nulo(objeto(c).get("peso"))
        return 1 if p is None else p

    casas = numero_ou_nulo(comp.get("casas"))
    minimo_reserva = numero_ou_nulo(cotas.get("minimo_vagas_reserva"))
    return {
        "data_corte": _data_corte(r.get("data_corte")),
        "etapas": {
            "documental": booleano(etapas.get("documental"), True),
            "entrevista": booleano(etapas.get("entrevista"), True),
        },
        "documental": {
            "situacoes_aptas": termos(["Aprovado"] if situacoes is None else situacoes),
            "nota_minima": numero_ou_nulo(doc.get("nota_minima")),
            "nota_minima_por_nivel": minimos_por_nivel,
            "niveis_por_cargo": [
                n
                for n in (
                    {
                        "termo": texto(objeto(x).get("termo")),
                        "nivel": um_de(objeto(x).get("nivel"), NIVEIS, ""),
                    }
                    for x in lista(doc.get("niveis_por_cargo"))
                )
                if n["termo"] and n["nivel"]
            ],
            "nivel_padrao": um_de(doc.get("nivel_padrao"), NIVEIS, None),
            "parciais": [c for c in codigos(doc.get("parciais")) if c in PARCIAIS_DA_DOCUMENTAL],
        },
        "entrevista": {
            "nota_minima": numero_ou_nulo(ent.get("nota_minima")),
            "nota_minima_competencia": numero_ou_nulo(ent.get("nota_minima_competencia")),
            "nota_eliminatoria_ate": numero_ou_nulo(ent.get("nota_eliminatoria_ate")),
            "competencias": [
                c
                for c in (
                    {
                        "ordem": ordem_da_competencia(x, i),
                        "nome": texto(objeto(x).get("nome")),
                        "minimo": numero_ou_nulo(objeto(x).get("minimo")),
                    }
                    for i, x in enumerate(lista(ent.get("competencias")))
                )
                if c["ordem"] > 0
            ],
            "exige_comparecimento": booleano(ent.get("exige_comparecimento"), True),
            "inapto_elimina": booleano(ent.get("inapto_elimina"), True),
            "so_parecer": booleano(ent.get("so_parecer"), False),
        },
        "composicao": {
            "componentes": [
                c
                for c in (
                    {"codigo": um_de(objeto(x).get("codigo"), COMPONENTES_DA_NOTA, ""), "peso": peso(x)}
                    for x in componentes
                )
                if c["codigo"]
            ],
            "casas": math_trunc(2 if casas is None else casas),
            "arredondamento": um_de(comp.get("arredondamento"), ARREDONDAMENTOS, "MEIO_PARA_CIMA"),
        },
        "desempate": [d for d in (criterio(x) for x in lista(r.get("desempate"))) if d["criterio"]],
        "listas": {
            "PRELIMINAR": {
                "empate": um_de(objeto(listas.get("PRELIMINAR")).get("empate"), EMPATE_NAS_LISTAS, "MESMA_POSICAO")
            },
            "ENTREVISTA": {
                "empate": um_de(objeto(listas.get("ENTREVISTA")).get("empate"), EMPATE_NAS_LISTAS, "MESMA_POSICAO")
            },
            "FINAL": {"empate": um_de(objeto(listas.get("FINAL")).get("empate"), EMPATE_NAS_LISTAS, "CRITERIOS")},
        },
        "empate_final": {
            "metodo": um_de(empate.get("metodo"), METODOS_DE_EMPATE_FINAL, "MESMA_POSICAO"),
            "numeracao": um_de(empate.get("numeracao"), NUMERACOES, "DENSA"),
        },
        "modalidades": modalidades,
        "cotas": {
            "minimo_vagas_reserva": math_trunc(0 if minimo_reserva is None else minimo_reserva),
            "acumulo": um_de(cotas.get("acumulo"), ACUMULOS, "TODAS"),
        },
        "convocacao": {
            "multiplo_vagas": numero_ou_nulo(conv.get("multiplo_vagas")),
            "posicao_max_cr": numero_ou_nulo(conv.get("posicao_max_cr")),
            "incluir_empatados": booleano(conv.get("incluir_empatados"), True),
            "excecoes": [
                e
                for e in (
                    {
                        "termos": termos(objeto(x).get("termos")),
                        "multiplo_vagas": numero_ou_nulo(objeto(x).get("multiplo_vagas")),
                        "posicao_max_cr": numero_ou_nulo(objeto(x).get("posicao_max_cr")),
                    }
                    for x in lista(conv.get("excecoes"))
                )
                if e["termos"]
            ],
        },
    }
