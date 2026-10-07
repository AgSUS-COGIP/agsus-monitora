"""
Cálculo da entrevista: a regra de private."FC_CALCULAR_ENTREVISTA" (banco) e de
calcularEntrevista (src/lib/conducao-de-entrevista.js, a prévia da tela).

- Competência: média das notas lançadas pelos avaliadores × peso, arredondada em
  2 casas (meio para cima, como o numeric do Postgres). Sem nota = falta.
- Total: soma das competências com nota (2 casas). Faltou ("N") = 0; com falta e
  soma 0 = sem total.
- Mínimo da competência: em pontos (VALOR) ou percentual de nota máxima × peso
  (PERCENTUAL), sem arredondar.
- Média eliminatória: a média (2 casas) igual a uma das notas eliminatórias.
- Roteiro com aspectos (roteiro["aspectos"]): a nota do avaliador é a média dos
  aspectos (só com todos lançados), sem arredondar; o total é a soma das
  competências sem arredondar, 2 casas no fim; não há média eliminatória (vale o
  mínimo da competência).
- Parecer: faltou e a ausência elimina = INAPTO; não compareceu ou falta =
  SEM_PARECER; abaixo de um mínimo, média eliminatória ou total abaixo do mínimo
  total = INAPTO; senão APTO.

Decimal do começo ao fim: a soma das notas de 2 casas é exata (como no banco), sem
o 11,999… do ponto flutuante. Só biblioteca padrão.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

DUAS_CASAS = Decimal("0.01")


def numero(valor) -> Decimal | None:
    """Número do banco, da tela ou da planilha ("1,5", "1.234,5", 2): nulo se vazio ou inválido."""
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, int | float):
        return Decimal(str(valor))
    if isinstance(valor, Decimal):
        return valor
    bruto = "".join(str(valor).split())
    if not bruto:
        return None
    if "," in bruto:
        bruto = bruto.replace(".", "").replace(",", ".", 1)
    try:
        n = Decimal(bruto)
    except InvalidOperation:
        return None
    return n if n.is_finite() else None


def arredondar(valor: Decimal) -> Decimal:
    return valor.quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)


def minimo_em_pontos(competencia: dict) -> Decimal | None:
    minimo = numero(competencia.get("minimo"))
    if minimo is None:
        return None
    if competencia.get("tipo_minimo") == "PERCENTUAL":
        maxima = numero(competencia.get("nota_maxima"))
        peso = numero(competencia.get("peso"))
        if maxima is None:
            return None
        return maxima * (peso if peso is not None else Decimal(1)) * minimo / Decimal(100)
    return minimo


def media_dos_aspectos(aspectos: list[dict], notas) -> Decimal | None:
    """Média dos aspectos de um avaliador (sem arredondar); None se falta algum."""
    if not aspectos:
        return None
    if isinstance(notas, dict):
        mapa = notas
    else:
        mapa = {n.get("aspecto"): n.get("nota") for n in notas or []}
    valores = [numero(mapa.get(a.get("id"))) for a in aspectos]
    if any(v is None for v in valores):
        return None
    return sum(valores, Decimal(0)) / len(valores)


def calcular_entrevista(roteiro: dict, compareceu: str | None, avaliacoes: list[dict]) -> dict:
    """
    roteiro: {competencias: [{id, ordem, nome, nota_maxima, peso, minimo, tipo_minimo}],
              notas_eliminatorias: [...], nota_minima_total, ausencia_elimina}
    avaliacoes: [{competencia, avaliador, nota}] (só as lançadas); com aspectos,
                [{competencia, avaliador, aspectos: [{aspecto, nota}]}]

    Devolve {competencias: [{id, nota, media, quantidade, minimo, abaixo_do_minimo,
    eliminatoria}], total, parecer, falta}. Notas como Decimal (ou None).
    """
    roteiro = roteiro or {}
    aspectos = sorted(roteiro.get("aspectos") or [], key=lambda a: a.get("ordem") or 0)
    com_aspectos = bool(aspectos)
    eliminatorias = (
        []
        if com_aspectos
        else [n for n in (numero(x) for x in roteiro.get("notas_eliminatorias") or []) if n is not None]
    )
    competencias = sorted(roteiro.get("competencias") or [], key=lambda c: c.get("ordem") or 0)
    total = Decimal(0)
    bruto = Decimal(0)
    falta = False
    reprova = False
    linhas = []
    for c in competencias:
        da_competencia = [a for a in avaliacoes or [] if a.get("competencia") == c.get("id")]
        if com_aspectos:
            brutas = (media_dos_aspectos(aspectos, a.get("aspectos")) for a in da_competencia)
        else:
            brutas = (numero(a.get("nota")) for a in da_competencia)
        notas = [n for n in brutas if n is not None]
        peso = numero(c.get("peso"))
        peso = peso if peso is not None else Decimal(1)
        minimo = minimo_em_pontos(c)
        if not notas:
            falta = True
            linhas.append(
                {
                    "id": c.get("id"),
                    "quantidade": 0,
                    "media": None,
                    "nota": None,
                    "minimo": minimo,
                    "abaixo_do_minimo": False,
                    "eliminatoria": False,
                }
            )
            continue
        media = sum(notas, Decimal(0)) / len(notas)
        nota = arredondar(media * peso)
        total += nota
        bruto += media * peso
        abaixo = minimo is not None and nota < minimo
        eliminatoria = arredondar(media) in eliminatorias
        if abaixo or eliminatoria:
            reprova = True
        linhas.append(
            {
                "id": c.get("id"),
                "quantidade": len(notas),
                "media": arredondar(media),
                "nota": nota,
                "minimo": minimo,
                "abaixo_do_minimo": abaixo,
                "eliminatoria": eliminatoria,
            }
        )

    soma = arredondar(bruto if com_aspectos else total)
    minimo_total = numero(roteiro.get("nota_minima_total"))
    if compareceu == "N":
        total_final: Decimal | None = Decimal(0)
    elif falta and soma == 0:
        total_final = None
    else:
        total_final = soma

    if compareceu == "N" and roteiro.get("ausencia_elimina") is not False:
        parecer = "INAPTO"
    elif compareceu != "S" or falta:
        parecer = "SEM_PARECER"
    elif reprova or (minimo_total is not None and soma < minimo_total):
        parecer = "INAPTO"
    else:
        parecer = "APTO"

    return {"competencias": linhas, "total": total_final, "parecer": parecer, "falta": falta}
