"""
O motor da classificação em Python: cópia fiel de src/lib/classificacao/motor.ts
(mesma entrada → mesma saída: posições, situação VAGA/CR, eliminados com o
motivo, modalidade, explicações e avisos). Na etapa 1 ele roda EM PARALELO com
o da tela, para conferir (scripts/classificacao/); a tela continua usando o
motor.ts. Os casos dourados de tests/fixtures/classificacao/casos-do-motor.json
cobram os dois lados (vitest e pytest).

Entrada (`classificar`): o mesmo objeto do motor.ts — tipo da lista
(PRELIMINAR, CONVOCACAO, ENTREVISTA ou FINAL), regra do edital, candidatos,
entrevistas, quadro de vagas, unidade, data de corte, desempates registrados,
convocação ({configuracoes, modelos, edital_id}: as linhas cruas das RPCs da
convocação) e ajustes de recurso aprovados.

`classificar_edital(dados, tipo)` recebe o json de obter_classificacao_do_edital
(classificarEdital do ajustes.ts). `classificar_com_rastro` devolve também o
rastro da ordenação, de onde sai o relatório de desempate (desempate.py).
"""

from __future__ import annotations

import functools
import math
from datetime import datetime

from .catalogo import (
    CRITERIO_POR_CODIGO,
    ITEM_DO_AJUSTE_POR_CODIGO,
    MOTIVOS_DE_ELIMINACAO,
    SITUACOES_AGUARDANDO_ANALISE,
    codigos_da_modalidade,
    ordem_da_competencia,
    sem_acento,
    sim_ou_nao,
)
from .convocacao import convocacao_do_edital, divergencias_das_cotas
from .numeros import (
    HORA_SEM_CERTIDAO,
    arredondar,
    data_br,
    escalar,
    formatar_nota,
    hora_br,
    ler_hora,
    numero_br,
)
from .regra import normalizar_regra
from .semantica_js import (
    aparar,
    chave_primaria,
    comparar_base,
    eh_numero,
    inteiro_pt_br,
    math_trunc,
    numero_em_texto,
    numero_js,
    texto,
    texto_js,
    verdadeiro,
)
from .vagas import montar_vagas, nivel_da_vaga

_NAN = float("nan")


class DadosInvalidos(ValueError):
    """Os dados do edital não têm a forma que o motor espera (a tela também recusa)."""


class Candidato:
    """O candidato como o motor o vê (os nomes dos campos são os do motor.ts)."""

    def __init__(self, **campos):
        self.entrevista = None
        self.notaEntrevista = None
        self.nota = None
        self.modalidadesNaLista = None
        self.grupoDaNota = None
        self.composicao = None
        self.ajustes = None
        self.__dict__.update(campos)


class Bloco:
    """Quem fica na mesma posição e como foi resolvido."""

    def __init__(self, membros, resolucao, chave=None, metodo=None, registro=None):
        self.membros = membros
        self.resolucao = resolucao
        self.chave = chave
        self.metodo = metodo
        self.registro = registro


class Linha:
    def __init__(self, c, posicao, bloco, empatados):
        self.c = c
        self.posicao = posicao
        self.bloco = bloco
        self.empatados = empatados


class Contexto:
    def __init__(self, regra, criterios, casas, data_corte, desempates, avisos):
        self.regra = regra
        self.criterios = criterios
        self.casas = casas
        self.data_corte = data_corte
        self.desempates = desempates
        self.desempates_usados: set = set()
        self.avisos = avisos
        self.nivel_desconhecido: dict = {}
        self.hora_decide: set = set()


def _ou(registro: dict, *chaves):
    """registro.a ?? registro.b (o primeiro que não é nulo)."""
    for chave in chaves:
        valor = registro.get(chave)
        if valor is not None:
            return valor
    return None


def _compara_nome(a: Candidato, b: Candidato) -> int:
    return comparar_base(a.nome, b.nome) or (-1 if a.analiseId < b.analiseId else 1 if a.analiseId > b.analiseId else 0)


_POR_NOME = functools.cmp_to_key(_compara_nome)


def _ordenar_por_nome(candidatos):
    # A chave do nome é calculada uma vez por candidato (a mesma ordem do comparador).
    return sorted(candidatos, key=lambda c: (chave_primaria(c.nome), c.analiseId))


# ── Entrada ──────────────────────────────────────────────────────────────

_CAMPOS_NUMERICOS = (
    ("notaDocumental", "nota_documental", "nota documental"),
    ("notaArt", "nota_art", "nota ART"),
    ("pontuacaoFormacao", "pontuacao_formacao", "pontuação de formação"),
    ("pontuacaoCursos", "pontuacao_cursos", "pontuação de cursos"),
    ("pontuacaoExperiencia", "pontuacao_experiencia", "pontuação de experiência"),
    ("pontuacaoEtnica", "pontuacao_etnica", "pontuação étnica"),
    ("expSaudeIndigena", "exp_saude_indigena", "experiência na saúde indígena"),
    ("expAtencaoBasica", "exp_atencao_basica", "experiência na atenção básica"),
    ("expProfissional", "exp_profissional", "experiência profissional"),
    ("expAltaComplexidade", "exp_alta_complexidade", "experiência em alta complexidade"),
    ("expSaudeDigital", "exp_saude_digital", "experiência em saúde digital"),
    ("nivelEscolaridade", "nivel_escolaridade", "nível de escolaridade"),
    ("notaConhecimentosEspecificos", "nota_conhecimentos_especificos", "nota de conhecimentos específicos"),
)


def preparar_candidatos(brutos, avisos) -> list[Candidato]:
    """Os candidatos do RPC no formato do motor (números pt-BR, modalidades em código)."""
    vistos: set = set()
    candidatos = []
    for b in brutos or []:
        if not isinstance(b, dict):
            continue
        analise_id = texto(_ou(b, "analise_id", "analiseId"))
        if not analise_id or analise_id in vistos:
            continue
        vistos.add(analise_id)
        c = Candidato(
            **{campo: None for campo, _, _ in _CAMPOS_NUMERICOS},
            modalidades=[],
            modalidadeIdentificada=False,
            analiseId=analise_id,
            codigo=texto(b.get("codigo")),
            nome=texto(_ou(b, "nome", "candidato")) or "(sem nome)",
            vaga=texto(b.get("vaga")),
            cargo=texto(b.get("cargo")),
            categoria=texto(b.get("categoria")),
            modalidadeTexto=texto(b.get("modalidade")),
            pcd=sim_ou_nao(b.get("pcd")),
            dataNascimento=texto(_ou(b, "data_nascimento", "dataNascimento")),
            horaNascimento=ler_hora(_ou(b, "hora_nascimento", "horaNascimento")) or "",
            status=texto(b.get("status")),
            etapa=texto(b.get("etapa")),
            quadroId=texto(_ou(b, "quadro", "quadroId")),
        )
        for campo, chave, rotulo in _CAMPOS_NUMERICOS:
            bruto = b.get(chave)
            n = numero_br(bruto)
            if n is None and texto(bruto):
                avisos.append(
                    {
                        "codigo": "NUMERO_INVALIDO",
                        "tom": "danger",
                        "vaga": c.vaga,
                        "analiseId": c.analiseId,
                        "texto": f'{c.nome}: "{texto(bruto)}" em {rotulo} não é número.',
                    }
                )
            setattr(c, campo, n)
        codigos = codigos_da_modalidade(c.modalidadeTexto)
        if c.pcd and "PCD" not in codigos:
            codigos.append("PCD")
        c.modalidadeIdentificada = len(codigos) > 0
        if not codigos:
            codigos.insert(0, "AC")
        c.modalidades = codigos
        candidatos.append(c)
    return candidatos


def _momento(valor) -> float:
    if not valor:
        return -math.inf
    try:
        return datetime.fromisoformat(texto_js(valor).replace("Z", "+00:00")).timestamp() * 1000
    except ValueError:
        return -math.inf


def comparar_entrevistas(a: dict, b: dict) -> float:
    """compararEntrevistas (src/lib/entrevista-vigente.ts): negativo quando `a` vale mais que `b`."""

    def tem_parecer(e):
        return e["parecer"] in ("APTO", "INAPTO")

    for diferenca in (
        int(tem_parecer(b)) - int(tem_parecer(a)),
        int(b["nota"] is not None) - int(a["nota"] is not None),
        int(b.get("origem") == "sistema") - int(a.get("origem") == "sistema"),
    ):
        if diferenca:
            return diferenca
    recente = _momento(b.get("atualizadoEm")) - _momento(a.get("atualizadoEm"))
    if recente and not math.isnan(recente):
        return recente
    return 0 if a["id"] == b["id"] else -1 if a["id"] > b["id"] else 1


def _nota_da_competencia(valor):
    if isinstance(valor, list):
        ordem = numero_js(valor[0]) if len(valor) > 0 else _NAN
        criterio = texto(valor[2]) if len(valor) > 2 else ""
        nota = numero_br(valor[1]) if len(valor) > 1 else None
        return {"ordem": ordem, "criterio": criterio, "nota": nota}
    n = valor if isinstance(valor, dict) else {}
    return {
        "ordem": numero_js(n["ordem"]) if "ordem" in n else _NAN,
        "criterio": texto(n.get("criterio")),
        "nota": numero_br(n.get("nota")),
    }


def ligar_entrevistas(candidatos, brutas, avisos):
    """As entrevistas ligadas à análise pelo id; entrevista sem análise vira aviso."""
    por_analise = {c.analiseId: c for c in candidatos}
    escolhidas: dict = {}
    for b in brutas or []:
        b = b if isinstance(b, dict) else {}
        analise_id = texto(_ou(b, "analise_id", "analiseId"))
        compareceu = texto(b.get("compareceu")).upper()
        e = {
            "id": texto(b.get("id")),
            "analiseId": analise_id,
            "nome": texto(_ou(b, "nome", "candidato")),
            "vaga": texto(b.get("vaga")),
            "nota": numero_br(b.get("nota")),
            "parecer": texto(b.get("parecer")).upper() or "SEM_PARECER",
            "compareceu": compareceu or None,
            "ligacao": texto(b.get("ligacao")),
            "origem": texto(b.get("origem")) or "planilha",
            "notas": [
                n
                for n in (_nota_da_competencia(v) for v in (b.get("notas") if isinstance(b.get("notas"), list) else []))
                if eh_numero(n["ordem"]) and math.isfinite(n["ordem"])
            ],
        }
        if not analise_id or analise_id not in por_analise:
            avisos.append(
                {
                    "codigo": "ENTREVISTA_SEM_ANALISE",
                    "tom": "warning",
                    "vaga": e["vaga"],
                    "texto": f"Entrevista de {e['nome'] or '(sem nome)'} (vaga {e['vaga'] or '—'}) sem análise curricular ligada: fica fora da classificação.",
                }
            )
            continue
        c = por_analise[analise_id]
        if e["nota"] is None and texto(b.get("nota")):
            avisos.append(
                {
                    "codigo": "NUMERO_INVALIDO",
                    "tom": "danger",
                    "vaga": c.vaga,
                    "analiseId": analise_id,
                    "texto": f'{c.nome}: nota da entrevista "{texto(b.get("nota"))}" não é número.',
                }
            )
        if e["ligacao"] == "nome":
            avisos.append(
                {
                    "codigo": "ENTREVISTA_PELO_NOME",
                    "tom": "info",
                    "vaga": c.vaga,
                    "analiseId": analise_id,
                    "texto": f"{c.nome}: a entrevista foi ligada à análise pelo nome na carga da planilha; confira.",
                }
            )
        atual = escolhidas.get(analise_id)
        if atual:
            avisos.append(
                {
                    "codigo": "ENTREVISTA_REPETIDA",
                    "tom": "warning",
                    "vaga": c.vaga,
                    "analiseId": analise_id,
                    "texto": f"{c.nome}: mais de uma entrevista lançada; vale a de parecer definido (depois a com nota, depois a do sistema).",
                }
            )
            if comparar_entrevistas(e, atual) < 0:
                escolhidas[analise_id] = e
        else:
            escolhidas[analise_id] = e
    for c in candidatos:
        c.entrevista = escolhidas.get(c.analiseId)
        c.notaEntrevista = c.entrevista["nota"] if c.entrevista else None
    return candidatos


def _quase(a, b) -> bool:
    return abs(a - b) < 1e-9


def rotulo_do_item(codigo: str) -> str:
    """O rótulo de um item do ajuste ("Formação acadêmica", "Competência 2")."""
    competencia = ordem_da_competencia(codigo)
    if competencia is not None:
        return f"Competência {competencia}"
    item = ITEM_DO_AJUSTE_POR_CODIGO.get(codigo)
    return (item or {}).get("rotulo") or codigo


def _comparar_padrao(a: str, b: str) -> int:
    # localeCompare sem opções: a ordem do pt-BR e, no empate, o texto.
    ka, kb = chave_primaria(a), chave_primaria(b)
    if ka != kb:
        return -1 if ka < kb else 1
    return -1 if a < b else 1 if a > b else 0


def aplicar_ajustes(candidatos, ajustes, avisos):
    """Os ajustes da pontuação APROVADOS em recurso, por cima da nota da análise e da entrevista."""
    if not isinstance(ajustes, list) or not ajustes:
        return candidatos
    por_analise = {c.analiseId: c for c in candidatos}
    ordenados = sorted(
        ajustes,
        key=functools.cmp_to_key(
            lambda a, b: _comparar_padrao(
                texto_js(_ou(a if isinstance(a, dict) else {}, "aprovado_em") or ""),
                texto_js(_ou(b if isinstance(b, dict) else {}, "aprovado_em") or ""),
            )
        ),
    )
    for ajuste in ordenados:
        ajuste = ajuste if isinstance(ajuste, dict) else {}
        c = por_analise.get(texto(_ou(ajuste, "analise_id", "analiseId")))
        if not c:
            continue
        numero = numero_br(ajuste.get("numero"))
        numero_texto = numero_em_texto(numero) if numero is not None else "—"
        aplicados = []
        for bruto in ajuste.get("itens") if isinstance(ajuste.get("itens"), list) else []:
            item = bruto if isinstance(bruto, dict) else {}
            novo = numero_br(item.get("novo"))
            if novo is None:
                continue
            codigo = texto(item.get("codigo")).upper()
            competencia = ordem_da_competencia(codigo)
            definicao = ITEM_DO_AJUSTE_POR_CODIGO.get(codigo)
            if not definicao and competencia is None:
                continue
            precisa_entrevista = competencia is not None or codigo == "ENTREVISTA"
            if precisa_entrevista and not c.entrevista:
                avisos.append(
                    {
                        "codigo": "AJUSTE_SEM_ENTREVISTA",
                        "tom": "warning",
                        "vaga": c.vaga,
                        "analiseId": c.analiseId,
                        "texto": f"{c.nome}: o recurso nº {numero_texto} ajustou a entrevista, mas não há entrevista lançada; o ajuste desse item não entrou.",
                    }
                )
                continue
            if competencia is not None and c.entrevista:
                notas = [dict(n) for n in c.entrevista["notas"]]
                alvo = next((n for n in notas if n["ordem"] == competencia), None)
                if alvo is None:
                    alvo = {"ordem": competencia, "criterio": "", "nota": None}
                    notas.append(alvo)
                    notas.sort(key=lambda n: n["ordem"])
                atual = alvo["nota"]
                alvo["nota"] = novo
                c.entrevista = {**c.entrevista, "notas": notas}
            elif codigo == "ENTREVISTA" and c.entrevista:
                atual = c.notaEntrevista
                c.entrevista = {**c.entrevista, "nota": novo}
                c.notaEntrevista = novo
            elif definicao:
                atual = getattr(c, definicao["campo"], None)
                setattr(c, definicao["campo"], novo)
            else:
                continue
            anterior = numero_br(item.get("anterior"))
            if anterior is not None and atual is not None and not _quase(anterior, atual):
                avisos.append(
                    {
                        "codigo": "AJUSTE_DIVERGENTE",
                        "tom": "info",
                        "vaga": c.vaga,
                        "analiseId": c.analiseId,
                        "texto": f"{c.nome}: {rotulo_do_item(codigo).lower()} era {formatar_nota(anterior, 2)} no recurso nº {numero_texto} e hoje é {formatar_nota(atual, 2)}; vale o ajuste ({formatar_nota(novo, 2)}).",
                    }
                )
            aplicados.append({"codigo": codigo, "anterior": atual, "novo": novo})
        if aplicados:
            recurso = ajuste.get("recurso_id")
            c.ajustes = [*(c.ajustes or []), {"numero": numero, "recursoId": recurso, "itens": aplicados}]
    return candidatos


def _frase_dos_ajustes(c: Candidato, casas: int) -> list[str]:
    frases = []
    for a in c.ajustes or []:
        numero = numero_em_texto(a["numero"]) if a["numero"] is not None else "—"
        itens = "; ".join(
            f"{rotulo_do_item(i['codigo']).lower()} {formatar_nota(i['anterior'], casas)} → {formatar_nota(i['novo'], casas)}"
            for i in a["itens"]
        )
        frases.append(f"Nota alterada pelo recurso nº {numero}: {itens}.")
    return frases


def _recursos_do_ajuste(c: Candidato) -> list:
    return [a["numero"] for a in (c.ajustes or []) if a["numero"] is not None]


def aplicar_agrupamentos(candidatos, regra):
    """Reservas conjuntas da regra (`agrupa`): quem declarou PP, PI ou PQ entra na PPIQ."""
    proprias = {m["codigo"] for m in regra["modalidades"]}
    destino: dict = {}
    for m in regra["modalidades"]:
        for codigo in m["agrupa"]:
            if codigo not in proprias and codigo not in destino:
                destino[codigo] = m["codigo"]
    if not destino:
        return candidatos
    for c in candidatos:
        novos = [destino.get(m) or m for m in c.modalidades]
        c.modalidades = [m for i, m in enumerate(novos) if novos.index(m) == i]
    return candidatos


# ── Etapas ───────────────────────────────────────────────────────────────


def _situacao_apta(c: Candidato, regra) -> bool:
    aptas = [sem_acento(s) for s in regra["documental"]["situacoes_aptas"]]
    if not aptas:
        return True
    return any(s and sem_acento(s) in aptas for s in (c.status, c.etapa))


def aguardando_analise(c: Candidato, regra) -> bool:
    """Ainda sem resultado na avaliação documental: não é eliminado nem entra nas listas."""
    if not regra["etapas"]["documental"]:
        return False
    aptas = [sem_acento(s) for s in regra["documental"]["situacoes_aptas"]]
    situacoes = [aparar(sem_acento(s)) for s in (c.status, c.etapa) if s]
    if any(s in aptas for s in situacoes):
        return False
    return any(s in SITUACOES_AGUARDANDO_ANALISE for s in situacoes)


def _menor(a, b, casas=4) -> bool:
    ea, eb = escalar(a, casas), escalar(b, casas)
    return (ea if ea is not None else 0) < (eb if eb is not None else 0)


def _eliminacao_documental(c: Candidato, regra, ctx: Contexto):
    if not regra["etapas"]["documental"]:
        return None
    doc = regra["documental"]
    if not _situacao_apta(c, regra):
        minimo = doc["nota_minima"]
        abaixo = minimo is not None and c.notaDocumental is not None and _menor(c.notaDocumental, minimo)
        extra = (
            f" Nota {formatar_nota(c.notaDocumental, ctx.casas)}, abaixo do mínimo de {formatar_nota(minimo, ctx.casas)}."
            if abaixo
            else ""
        )
        return {
            "motivo": "NAO_HABILITADO",
            "detalhe": f"Situação na análise: {c.status or c.etapa or 'não informada'}.{extra}",
        }
    if c.notaDocumental is None:
        return {"motivo": "SEM_NOTA_DOCUMENTAL", "detalhe": ""}
    por_nivel = doc["nota_minima_por_nivel"]
    minimo = doc["nota_minima"]
    nivel = None
    if por_nivel:
        nivel = nivel_da_vaga(c.cargo, c.categoria, regra)
        if nivel and nivel in por_nivel:
            minimo = por_nivel[nivel]
        elif not nivel:
            ctx.nivel_desconhecido[c.vaga] = True
    if minimo is not None and _menor(c.notaDocumental, minimo):
        return {
            "motivo": "ABAIXO_NOTA_MINIMA_DOCUMENTAL",
            "detalhe": f"Nota {formatar_nota(c.notaDocumental, ctx.casas)}; mínimo {formatar_nota(minimo, ctx.casas)}{f' ({nivel})' if nivel else ''}.",
        }
    return None


def _eliminacao_entrevista(c: Candidato, regra, ctx: Contexto):
    if not regra["etapas"]["entrevista"]:
        return None
    e = c.entrevista
    ent = regra["entrevista"]
    if not e:
        return {"motivo": "SEM_ENTREVISTA", "detalhe": ""}
    if ent["exige_comparecimento"] and e["compareceu"] == "N":
        return {"motivo": "AUSENTE", "detalhe": ""}
    if ent["inapto_elimina"] and e["parecer"] == "INAPTO":
        return {"motivo": "INAPTO_ENTREVISTA", "detalhe": ""}
    if ent["so_parecer"]:
        return None if e["parecer"] == "APTO" else {"motivo": "SEM_PARECER_ENTREVISTA", "detalhe": ""}
    if e["nota"] is None:
        return {"motivo": "SEM_NOTA_ENTREVISTA", "detalhe": ""}
    if ent["nota_minima"] is not None and _menor(e["nota"], ent["nota_minima"]):
        return {
            "motivo": "ABAIXO_NOTA_MINIMA_ENTREVISTA",
            "detalhe": f"Nota {formatar_nota(e['nota'], ctx.casas)}; mínimo {formatar_nota(ent['nota_minima'], ctx.casas)}.",
        }
    exige_competencia = (
        ent["nota_minima_competencia"] is not None
        or ent["nota_eliminatoria_ate"] is not None
        or any(x["minimo"] is not None for x in ent["competencias"])
    )
    if exige_competencia and not any(n["nota"] is not None for n in e["notas"]):
        ctx.avisos.append(
            {
                "codigo": "SEM_NOTAS_COMPETENCIA",
                "tom": "warning",
                "vaga": c.vaga,
                "analiseId": c.analiseId,
                "texto": f"{c.nome}: a entrevista não tem as notas por competência; o mínimo por competência não foi conferido.",
            }
        )
    for n in e["notas"]:
        if n["nota"] is None:
            continue
        comp = next((x for x in ent["competencias"] if x["ordem"] == n["ordem"]), None)
        nome = (comp or {}).get("nome") or n["criterio"] or f"Competência {numero_em_texto(n['ordem'])}"
        ate = ent["nota_eliminatoria_ate"]
        if ate is not None:
            en, ea = escalar(n["nota"], 4), escalar(ate, 4)
            if (en if en is not None else 0) <= (ea if ea is not None else 0):
                return {
                    "motivo": "COMPETENCIA_ELIMINATORIA",
                    "detalhe": f"{nome}: {formatar_nota(n['nota'], ctx.casas)} (elimina até {formatar_nota(ate, ctx.casas)}).",
                }
        minimo = comp["minimo"] if comp and comp["minimo"] is not None else ent["nota_minima_competencia"]
        if minimo is not None and _menor(n["nota"], minimo):
            return {
                "motivo": "COMPETENCIA_ABAIXO_MINIMO",
                "detalhe": f"{nome}: {formatar_nota(n['nota'], ctx.casas)} (mínimo {formatar_nota(minimo, ctx.casas)}).",
            }
    return None


def nota_composta(c: Candidato, regra) -> dict:
    """A nota final pela composição da regra (pesos e arredondamento)."""
    comp = regra["composicao"]
    valores = {"DOCUMENTAL": c.notaDocumental, "ENTREVISTA": c.notaEntrevista, "ART": c.notaArt}
    soma = 0
    partes = []
    faltando = []
    for componente in comp["componentes"]:
        codigo, peso = componente["codigo"], componente["peso"]
        v = valores.get(codigo)
        if v is None:
            faltando.append(codigo)
            continue
        soma += v * peso
        partes.append({"codigo": codigo, "valor": v, "peso": peso})
    return {"nota": arredondar(soma, comp["casas"], comp["arredondamento"]), "partes": partes, "faltando": faltando}


# ── Ordenação e empate ──────────────────────────────────────────────────


def valor_do_criterio(c: Candidato, criterio: str, ctx: Contexto):
    definicao = CRITERIO_POR_CODIGO.get(criterio)
    return definicao.ler(c, ctx) if definicao else None


def comparar_valores(a, b, direcao: str) -> int:
    """Nulo perde sempre (vai depois), qualquer que seja a direção."""
    if a is None and b is None:
        return 0
    if a is None:
        return 1
    if b is None:
        return -1
    x = int(a) if isinstance(a, bool) else a
    y = int(b) if isinstance(b, bool) else b
    if abs(x - y) < 1e-9:
        return 0
    if direcao in ("SIM_PRIMEIRO", "MAIOR_PRIMEIRO"):
        return 1 if y > x else -1
    return 1 if x > y else -1


def descrever_valor(valor, criterio: str, c: Candidato, outro: Candidato) -> str:
    """O valor de um critério na explicação (maior idade: a data e, no mesmo dia, a hora da certidão)."""
    if valor is None:
        return "sem dado"
    if isinstance(valor, bool):
        return "sim" if valor else "não"
    if criterio == "MAIOR_IDADE" and c:
        if (outro.dataNascimento if outro else None) != c.dataNascimento:
            return f"nasc. {data_br(c.dataNascimento)}"
        if c.horaNascimento:
            return f"{hora_br(c.horaNascimento)} pela certidão"
        return f"{hora_br(HORA_SEM_CERTIDAO)}, sem certidão"
    if criterio == "EXP_PROFISSIONAL_TEMPO":
        return f"{formatar_nota(valor, 0)} dias"
    inteiro = isinstance(valor, int) or (isinstance(valor, float) and valor.is_integer())
    return formatar_nota(valor, 0 if inteiro else 2)


def primeiro_que_separa(a: Candidato, b: Candidato, criterios, ctx: Contexto):
    """O primeiro critério que separa a e b ({criterio, direcao, va, vb, sinal}) ou None."""
    for d in criterios:
        va = valor_do_criterio(a, d["criterio"], ctx)
        vb = valor_do_criterio(b, d["criterio"], ctx)
        sinal = comparar_valores(va, vb, d["direcao"])
        if sinal != 0:
            return {"criterio": d["criterio"], "direcao": d["direcao"], "va": va, "vb": vb, "sinal": sinal}
    return None


def _pares_na_mesma_data(grupo, criterios, ctx):
    i = next((k for k, d in enumerate(criterios) if d["criterio"] == "MAIOR_IDADE"), -1)
    if i < 0:
        return []
    antes = criterios[:i]
    pares = []
    for x in range(len(grupo)):
        for y in range(x + 1, len(grupo)):
            a, b = grupo[x], grupo[y]
            if not a.dataNascimento or a.dataNascimento != b.dataNascimento:
                continue
            if primeiro_que_separa(a, b, antes, ctx):
                continue
            pares.append((a, b))
    return pares


def _codigo_de_inscricao(c: Candidato):
    return numero_br(c.codigo)


def _chave_do_grupo(tipo_lista, vaga, ids) -> str:
    """chaveDoGrupo (src/lib/classificacao/sorteio.ts): a lista, a vaga e os ids em ordem."""
    ordenados = sorted(set(texto_js(i) for i in ids or []))
    return f"{tipo_lista}|{vaga}|{','.join(ordenados)}"


def _ordenar_vaga(elegiveis, usar_criterios, tipo, vaga, ctx: Contexto, residual_na_mesma_posicao=False):
    por_nota: dict = {}
    for c in elegiveis:
        por_nota.setdefault(escalar(c.nota, ctx.casas), []).append(c)
    blocos: list[Bloco] = []
    for k in sorted(por_nota, key=lambda k: -(k if k is not None else 0)):
        grupo = _ordenar_por_nome(por_nota[k])
        for c in grupo:
            c.grupoDaNota = grupo
        if len(grupo) == 1:
            blocos.append(Bloco(grupo, "UNICO"))
            continue
        if not usar_criterios:
            blocos.append(Bloco(grupo, "MESMA_POSICAO_LISTA"))
            continue

        def comparar(a, b):
            s = primeiro_que_separa(a, b, ctx.criterios, ctx)
            return s["sinal"] if s else _compara_nome(a, b)

        ordenado = sorted(grupo, key=functools.cmp_to_key(comparar))
        subs: list[list[Candidato]] = []
        for c in ordenado:
            if subs and not primeiro_que_separa(subs[-1][0], c, ctx.criterios, ctx):
                subs[-1].append(c)
            else:
                subs.append([c])
        for sub in subs:
            if len(sub) == 1:
                blocos.append(Bloco(sub, "CRITERIOS"))
                continue
            if residual_na_mesma_posicao:
                blocos.append(Bloco(sub, "MESMA_POSICAO"))
                continue
            blocos.extend(_resolver_empate_final(sub, tipo, vaga, ctx))
    return blocos


def _resolver_empate_final(sub, tipo, vaga, ctx: Contexto) -> list[Bloco]:
    metodo = ctx.regra["empate_final"]["metodo"]
    chave = _chave_do_grupo(tipo, vaga, [c.analiseId for c in sub])
    if metodo == "MESMA_POSICAO":
        return [Bloco(sub, "MESMA_POSICAO", chave)]
    if metodo == "ORDEM_INSCRICAO":
        com = [c for c in sub if _codigo_de_inscricao(c) is not None]
        sem = [c for c in sub if _codigo_de_inscricao(c) is None]
        for c in sem:
            ctx.avisos.append(
                {
                    "codigo": "INSCRICAO_SEM_CODIGO",
                    "tom": "warning",
                    "vaga": vaga,
                    "analiseId": c.analiseId,
                    "texto": f"{c.nome}: sem código de inscrição numérico; fica empatado depois dos que têm.",
                }
            )
        blocos: list[Bloco] = []

        def comparar(a, b):
            return (_codigo_de_inscricao(a) or 0) - (_codigo_de_inscricao(b) or 0) or _compara_nome(a, b)

        for c in sorted(com, key=functools.cmp_to_key(comparar)):
            if blocos and _codigo_de_inscricao(blocos[-1].membros[0]) == _codigo_de_inscricao(c):
                blocos[-1].membros.append(c)
                blocos[-1].resolucao = "MESMA_POSICAO"
            else:
                blocos.append(Bloco([c], "INSCRICAO", chave))
        if sem:
            blocos.append(Bloco(sem, "MESMA_POSICAO" if len(sem) > 1 else "INSCRICAO", chave))
        return blocos
    metodo_do_registro = "SORTEIO" if metodo == "SORTEIO" else "MANUAL"
    registro = next((d for d in ctx.desempates if d["chave"] == chave and d["metodo"] == metodo_do_registro), None)
    if registro:
        ctx.desempates_usados.add(_id_do_registro(registro))
        ordem = [texto_js(x) for x in registro["ordem"]]

        def posicao(c):
            return ordem.index(c.analiseId) if c.analiseId in ordem else -1

        return [Bloco([c], metodo_do_registro, chave, registro=registro) for c in sorted(sub, key=posicao)]
    return [Bloco(sub, "PENDENTE", chave, metodo=metodo_do_registro)]


def _id_do_registro(d: dict):
    ident = d.get("id")
    return ident if verdadeiro(ident) else d["chave"]


def _numerar(blocos, pertence, numeracao) -> list[Linha]:
    linhas = []
    contador = 0
    antes = 0
    for bloco in blocos:
        membros = [c for c in bloco.membros if pertence(c)]
        if not membros:
            continue
        contador += 1
        posicao = antes + 1 if numeracao == "SALTANDO" else contador
        for c in membros:
            linhas.append(Linha(c, posicao, bloco, len(membros)))
        antes += len(membros)
    return linhas


# ── Modalidades, acúmulo e vagas ────────────────────────────────────────


def _modalidades_na_lista(c: Candidato, tipo, regra, posicao_em=None):
    conhecidas = {m["codigo"] for m in regra["modalidades"]}
    cods = [m for m in c.modalidades if m in conhecidas or m == "AC"]
    if tipo != "FINAL" or regra["cotas"]["acumulo"] == "TODAS":
        return cods
    cotas = [m for m in cods if m != "AC"]
    if len(cotas) < 2:
        return cods

    def pct(m):
        for x in regra["modalidades"]:
            if x["codigo"] == m:
                return x["percentual"] if x["percentual"] is not None else 0
        return 0

    def melhor(lista_):
        def comparar(a, b):
            diferenca = pct(b) - pct(a)
            if diferenca:
                return diferenca
            return (posicao_em(c, a) if posicao_em else 0) - (posicao_em(c, b) if posicao_em else 0)

        return sorted(lista_, key=functools.cmp_to_key(comparar))[0]

    if regra["cotas"]["acumulo"] == "PCD_MAIS_UMA":
        outras = [m for m in cotas if m != "PCD"]
        ficam = (["PCD"] if "PCD" in cotas else []) + ([melhor(outras)] if outras else [])
    else:
        ficam = [melhor(cotas)]
    return [m for m in cods if m == "AC" or m in ficam]


def _na_geral(c: Candidato, regra) -> bool:
    na_lista = c.modalidadesNaLista or []
    if "AC" in na_lista:
        return True
    for m in na_lista:
        definicao = next((x for x in regra["modalidades"] if x["codigo"] == m), None)
        if definicao is None or definicao["aparece_na_geral"] is not False:
            return True
    return False


def _alocar_vagas(vaga, geral, por_modalidade, regra, ctx: Contexto) -> dict:
    resultado: dict = {}
    if vaga.get("porModalidade") is None:
        return resultado
    lugares = dict(vaga["porModalidade"])
    ocupados: set = set()

    def ocupar(linhas, codigo, quantos):
        usados = 0
        i = 0
        while i < len(linhas) and usados < quantos:
            linha = linhas[i]
            c, bloco = linha.c, linha.bloco
            if c.analiseId in ocupados:
                i += 1
                continue
            empatados = [x for x in linhas if x.bloco is bloco and x.c.analiseId not in ocupados]
            if len(empatados) > quantos - usados and len(empatados) > 1:
                ctx.avisos.append(
                    {
                        "codigo": "EMPATE_NO_LIMITE",
                        "tom": "warning",
                        "vaga": vaga["chave"],
                        "texto": f"Vaga {vaga.get('codigo') or vaga.get('cargo')}: empate sem desempate no limite das vagas ({codigo}); resolva o empate antes de publicar.",
                    }
                )
            ocupados.add(c.analiseId)
            resultado[c.analiseId] = {"situacao": "VAGA", "modalidade": codigo}
            usados += 1
            i += 1
        return quantos - usados

    sobra = {"AC": ocupar(geral, "AC", lugares.get("AC") or 0)}
    for m in regra["modalidades"]:
        if m["codigo"] == "AC":
            continue
        sobra[m["codigo"]] = ocupar(por_modalidade.get(m["codigo"]) or [], m["codigo"], lugares.get(m["codigo"]) or 0)
    for _passo in range(len(regra["modalidades"]) + 1):
        mexeu = False
        for m in regra["modalidades"]:
            if m["codigo"] == "AC" or not ((sobra.get(m["codigo"]) or 0) > 0):
                continue
            for destino in [*m["remanejar_para"], "AC"]:
                if not ((sobra.get(m["codigo"]) or 0) > 0):
                    break
                linhas = geral if destino == "AC" else por_modalidade.get(destino) or []
                restante = ocupar(linhas, destino, sobra.get(m["codigo"]) or 0)
                if restante != sobra.get(m["codigo"]):
                    mexeu = True
                sobra[m["codigo"]] = restante
        if not mexeu:
            break
    for linhas in [geral, *por_modalidade.values()]:
        for linha in linhas:
            if linha.c.analiseId not in resultado:
                resultado[linha.c.analiseId] = {"situacao": "CR", "modalidade": None}
    return resultado


# ── Convocação ──────────────────────────────────────────────────────────


def limite_da_convocacao(vaga, regra) -> dict:
    """O limite da convocação para entrevista: N × vagas imediatas ou até a k-ésima posição."""
    conv = regra["convocacao"]
    cargo = sem_acento(vaga.get("cargo"))
    excecao = next((e for e in conv["excecoes"] if any(sem_acento(t) in cargo for t in e["termos"])), None)
    multiplo = (
        excecao["multiplo_vagas"] if excecao and excecao["multiplo_vagas"] is not None else conv["multiplo_vagas"]
    )
    posicao_cr = (
        excecao["posicao_max_cr"] if excecao and excecao["posicao_max_cr"] is not None else conv["posicao_max_cr"]
    )
    do_cargo = " (exceção do cargo)" if excecao else ""
    total = vaga.get("total")
    if total is not None and total > 0 and multiplo is not None:
        return {
            "limite": math.ceil(multiplo * total),
            "origem": f"{formatar_nota(multiplo, 0)} × {numero_em_texto(total)} vaga(s){do_cargo}",
        }
    if posicao_cr is not None:
        return {"limite": math_trunc(posicao_cr), "origem": f"até a {math_trunc(posicao_cr)}ª posição{do_cargo}"}
    return {"limite": None, "origem": "sem limite na regra"}


def _convocar(linhas, limite, incluir_empatados, ctx: Contexto, vaga, avisar=True) -> dict:
    # dict como conjunto ordenado (a ordem não importa ao motor; fica estável).
    if limite is None:
        return {linha.c.analiseId: True for linha in linhas}
    convocados: dict = {}
    blocos: list[list[Linha]] = []
    ultimo = None
    for linha in linhas:
        if ultimo is not linha.bloco:
            blocos.append([])
            ultimo = linha.bloco
        blocos[-1].append(linha)
    contados = 0
    for membros in blocos:
        if contados >= limite:
            break
        if contados + len(membros) <= limite or incluir_empatados:
            for linha in membros:
                convocados[linha.c.analiseId] = True
        else:
            if avisar:
                ctx.avisos.append(
                    {
                        "codigo": "EMPATE_NO_LIMITE",
                        "tom": "warning",
                        "vaga": vaga["chave"],
                        "texto": f"Vaga {vaga.get('codigo') or vaga.get('cargo')}: empate no limite da convocação; a regra não inclui os empatados — só entra quem cabe (ordem alfabética).",
                    }
                )
            for linha in membros[: max(0, limite - contados)]:
                convocados[linha.c.analiseId] = True
        contados += len(membros)
    return convocados


# ── Explicação ──────────────────────────────────────────────────────────


def _explicar(c: Candidato, bloco, ctx: Contexto, tipo) -> list[str]:
    partes = []
    casas = ctx.casas
    if tipo == "FINAL" and c.composicao:
        nomes = {"DOCUMENTAL": "documental", "ENTREVISTA": "entrevista"}
        detalhe = " + ".join(
            f"{nomes.get(p['codigo'], 'ART')} {formatar_nota(p['valor'], casas)}"
            + (f" × {formatar_nota(p['peso'], 2)}" if p["peso"] != 1 else "")
            for p in c.composicao["partes"]
        )
        partes.append(f"Nota {formatar_nota(c.nota, casas)}{f' ({detalhe})' if detalhe else ''}.")
        if c.composicao["faltando"]:
            partes.append(f"Sem {', '.join(c.composicao['faltando'])}: não somou na nota.")
    else:
        partes.append(f"Nota {formatar_nota(c.nota, casas)}.")

    grupo = [x for x in (c.grupoDaNota or []) if x is not c]
    if grupo:
        partes.append(f"Empatado em {formatar_nota(c.nota, casas)} com {len(grupo)}.")
        resolucao = bloco.resolucao if bloco else None
        if resolucao == "MESMA_POSICAO_LISTA":
            partes.append("Nesta lista o empate fica na mesma posição.")
        else:
            frases = []
            for outro in grupo:
                s = primeiro_que_separa(c, outro, ctx.criterios, ctx)
                if s:
                    definicao = CRITERIO_POR_CODIGO.get(s["criterio"])
                    rotulo = definicao.rotulo_curto if definicao else s["criterio"]
                    lado = "à frente de" if s["sinal"] < 0 else "atrás de"
                    frases.append(
                        f"{lado} {outro.nome} por {rotulo} ({descrever_valor(s['va'], s['criterio'], c, outro)} × {descrever_valor(s['vb'], s['criterio'], outro, c)})"
                    )
                else:
                    frases.append(f"com {outro.nome}: empate em todos os critérios")
            if frases:
                partes.append(f"Desempate: {'; '.join(frases)}.")
            registro = (bloco.registro if bloco else None) or {}
            if resolucao == "SORTEIO":
                semente = texto_js(registro.get("semente") or "")[:12]
                partes.append(f"Empate final resolvido por sorteio (semente {semente}…).")
            elif resolucao == "MANUAL":
                partes.append(f"Empate final por decisão manual: {texto_js(registro.get('justificativa') or '')}")
            elif resolucao == "INSCRICAO":
                partes.append(f"Empate final pela ordem de inscrição (código {c.codigo or '—'}).")
            elif resolucao == "MESMA_POSICAO":
                partes.append("Empate final: mesma posição.")
            elif resolucao == "PENDENTE":
                partes.append(
                    "Empate final aguardando sorteio."
                    if bloco.metodo == "SORTEIO"
                    else "Empate final aguardando decisão manual."
                )
    return partes


def _parciais_de(c: Candidato) -> dict:
    return {
        "FORMACAO": c.pontuacaoFormacao,
        "CURSOS": c.pontuacaoCursos,
        "EXPERIENCIA": c.pontuacaoExperiencia,
        "ETNICO": c.pontuacaoEtnica,
    }


_ORDEM_DOS_MOTIVOS = list(MOTIVOS_DE_ELIMINACAO)


def _ordem_do_motivo(motivo):
    return _ORDEM_DOS_MOTIVOS.index(motivo) if motivo in _ORDEM_DOS_MOTIVOS else -1


# ── Principal ───────────────────────────────────────────────────────────


def _desempate_do_motor(d) -> dict:
    d = d if isinstance(d, dict) else {}
    ordem = d.get("ordem")
    if ordem is not None and not isinstance(ordem, list):
        raise DadosInvalidos("Ordem de desempate inválida. Recarregue o edital.")
    saida = {
        **d,
        "chave": texto(d.get("chave")),
        "ordem": [texto_js(x) for x in (ordem or [])],
        "metodo": texto_js(d.get("metodo") or "").upper(),
    }
    if d.get("vaga") is None:
        saida.pop("vaga", None)
    else:
        saida["vaga"] = texto(d.get("vaga"))
    return saida


def classificar(entrada: dict | None = None) -> dict:
    """Classifica o edital numa lista (PRELIMINAR, CONVOCACAO, ENTREVISTA ou FINAL)."""
    return classificar_com_rastro(entrada)[0]


def classificar_com_rastro(entrada: dict | None = None):
    """(resultado, rastro): o rastro guarda, por vaga, os blocos e as listas da ordenação final."""
    entrada = entrada or {}
    tipo = entrada.get("tipo") or "FINAL"
    regra = normalizar_regra(entrada.get("regra"))
    avisos: list[dict] = []
    candidatos = aplicar_ajustes(
        ligar_entrevistas(
            aplicar_agrupamentos(preparar_candidatos(entrada.get("candidatos") or [], avisos), regra),
            entrada.get("entrevistas") or [],
            avisos,
        ),
        entrada.get("ajustes") or [],
        avisos,
    )
    corte = regra["data_corte"] or entrada.get("dataCorte") or None
    criterios = [d for d in regra["desempate"] if d["criterio"] in CRITERIO_POR_CODIGO]
    ctx = Contexto(
        regra,
        criterios,
        regra["composicao"]["casas"],
        corte,
        [_desempate_do_motor(d) for d in entrada.get("desempates") or []],
        avisos,
    )
    if not corte and any(d["criterio"] in ("IDOSO_60", "MAIOR_IDADE") for d in criterios):
        avisos.append(
            {
                "codigo": "SEM_DATA_CORTE",
                "tom": "danger",
                "texto": "A regra usa a idade, mas não há data de corte (fim das inscrições): defina na regra ou no cronograma do edital.",
            }
        )

    bruta = entrada.get("convocacao")
    conv = convocacao_do_edital(bruta, bruta.get("edital_id")) if isinstance(bruta, dict) else None
    vagas = montar_vagas(
        candidatos=candidatos,
        quadro=entrada.get("quadro") or [],
        regra=regra,
        unidade=entrada.get("unidade") or "",
        convocacao=conv,
    )
    for frase in divergencias_das_cotas(regra, conv):
        avisos.append(
            {
                "codigo": "COTAS_DIFERENTES_DA_CONVOCACAO",
                "tom": "warning",
                "texto": f"Cotas da regra × configuração de convocação do edital — {frase}",
            }
        )
    for v in vagas:
        if v.get("totalNaConvocacao") is not None:
            avisos.append(
                {
                    "codigo": "VAGAS_DIFERENTES_DA_CONVOCACAO",
                    "tom": "warning",
                    "vaga": v["chave"],
                    "texto": f"Vaga {v['codigo'] or v['cargo']}: {numero_em_texto(v['total'])} vaga(s) imediata(s) no quadro do edital × {numero_em_texto(v['totalNaConvocacao'])} na configuração de convocação; valeu o quadro do edital.",
                }
            )
    por_vaga = {v["chave"]: (v, []) for v in vagas}
    for c in candidatos:
        if c.vaga not in por_vaga:
            v = {
                "lotacao": "",
                "cadastroReserva": False,
                "origemDasVagas": None,
                "cabecalho": f"VAGA {c.vaga or 'sem código'} - {c.cargo}",
                "chave": c.vaga,
                "codigo": c.vaga,
                "cargo": c.cargo,
                "total": None,
                "porModalidade": None,
                "semQuadro": True,
            }
            por_vaga[c.vaga] = (v, [])
            vagas.append(v)
        por_vaga[c.vaga][1].append(c)

    casas_do_ajuste = max(2, ctx.casas)
    saida_vagas = []
    explicacoes: dict = {}
    pendencias = []
    rastro = {"tipo": tipo, "regra": regra, "ctx": ctx, "vagas": []}
    elegiveis_total = eliminados_total = aguardando_total = 0
    numeracao = regra["empate_final"]["numeracao"]

    for v in vagas:
        da_vaga = por_vaga[v["chave"]][1]
        nome_da_vaga = v.get("codigo") or v.get("cargo")
        if v.get("semQuadro") and da_vaga:
            avisos.append(
                {
                    "codigo": "VAGA_SEM_QUADRO",
                    "tom": "warning",
                    "vaga": v["chave"],
                    "texto": f"Vaga {nome_da_vaga}: sem linha correspondente no quadro de vagas do edital; o número de vagas não aparece e a situação (vaga ou cadastro reserva) não é calculada.",
                }
            )
        sem_modalidade = sum(1 for c in da_vaga if not c.modalidadeIdentificada)
        if sem_modalidade:
            avisos.append(
                {
                    "codigo": "MODALIDADE_DESCONHECIDA",
                    "tom": "info",
                    "vaga": v["chave"],
                    "texto": f"Vaga {nome_da_vaga}: {sem_modalidade} candidato(s) sem modalidade informada, considerados na ampla concorrência.",
                }
            )

        eliminados = []
        aptos_doc = []
        aguardando = []
        for c in da_vaga:
            if aguardando_analise(c, regra):
                aguardando.append(c)
                continue
            e = _eliminacao_documental(c, regra, ctx)
            if e:
                eliminados.append({"c": c, **e})
                if c.entrevista and tipo == "FINAL":
                    avisos.append(
                        {
                            "codigo": "ENTREVISTADO_NAO_HABILITADO",
                            "tom": "warning",
                            "vaga": v["chave"],
                            "analiseId": c.analiseId,
                            "texto": f"{c.nome}: tem entrevista lançada, mas não passou na avaliação documental ({MOTIVOS_DE_ELIMINACAO.get(e['motivo'])}).",
                        }
                    )
            else:
                aptos_doc.append(c)

        parciais_da_regra = regra["documental"]["parciais"]
        if tipo == "PRELIMINAR" and parciais_da_regra:

            def diferente(c, parciais_da_regra=parciais_da_regra):
                valores = [_parciais_de(c)[p] for p in parciais_da_regra]
                if all(x is None for x in valores):
                    return False
                soma = 0
                for x in valores:
                    soma = soma + (x if x is not None else 0)
                es, en = escalar(soma, 2), escalar(c.notaDocumental, 2)
                return (es if es is not None else 0) != (en if en is not None else 0)

            diferentes = [c for c in aptos_doc if diferente(c)]
            if diferentes:
                d0 = diferentes[0]
                parciais_texto = " + ".join(
                    formatar_nota(_parciais_de(d0)[p] if _parciais_de(d0)[p] is not None else 0, 2)
                    for p in parciais_da_regra
                )
                avisos.append(
                    {
                        "codigo": "PARCIAIS_DIFERENTES_DA_NOTA",
                        "tom": "warning",
                        "vaga": v["chave"],
                        "texto": f"Vaga {nome_da_vaga}: em {len(diferentes)} de {len(aptos_doc)} candidato(s) a soma das parciais publicadas não é a nota documental (ex.: inscrição {d0.codigo or '—'}: nota {formatar_nota(d0.notaDocumental, 2)}, parciais {parciais_texto}). Confira a planilha antes de publicar.",
                    }
                )

        for c in aptos_doc:
            c.nota = arredondar(
                c.notaDocumental if c.notaDocumental is not None else 0,
                ctx.casas,
                regra["composicao"]["arredondamento"],
            )
        blocos = _ordenar_vaga(
            aptos_doc, regra["listas"]["PRELIMINAR"]["empate"] == "CRITERIOS", "PRELIMINAR", v["chave"], ctx
        )
        for c in aptos_doc:
            c.modalidadesNaLista = _modalidades_na_lista(c, "PRELIMINAR", regra)
        geral = _numerar(blocos, lambda c: _na_geral(c, regra), numeracao)
        limite_conv = limite_da_convocacao(v, regra)
        limite, origem = limite_conv["limite"], limite_conv["origem"]
        avisar_convocacao = tipo == "CONVOCACAO"
        incluir = regra["convocacao"]["incluir_empatados"]
        convocados = _convocar(geral, limite, incluir, ctx, v, avisar_convocacao)
        for m in regra["modalidades"]:
            if m["codigo"] == "AC" or m["aparece_na_geral"] is not False:
                continue
            codigo_m = m["codigo"]
            lista_m = _numerar(blocos, lambda c, cm=codigo_m: cm in (c.modalidadesNaLista or []), numeracao)
            convocados.update(_convocar(lista_m, limite, incluir, ctx, v, avisar_convocacao))

        elegiveis = aptos_doc
        tipo_da_ordem = "PRELIMINAR"
        if tipo == "ENTREVISTA":
            eliminados = []
            elegiveis = []
            for c in aptos_doc:
                if c.analiseId not in convocados:
                    continue
                e = _eliminacao_entrevista(c, regra, ctx)
                if e:
                    eliminados.append({"c": c, **e})
                    if e["motivo"] == "SEM_ENTREVISTA" and regra["etapas"]["entrevista"]:
                        avisos.append(
                            {
                                "codigo": "CONVOCADO_SEM_ENTREVISTA",
                                "tom": "warning",
                                "vaga": v["chave"],
                                "analiseId": c.analiseId,
                                "texto": f"{c.nome}: dentro do limite de convocação, mas sem entrevista lançada.",
                            }
                        )
                    continue
                base = c.notaDocumental if regra["entrevista"]["so_parecer"] else c.notaEntrevista
                c.nota = arredondar(base if base is not None else 0, ctx.casas, regra["composicao"]["arredondamento"])
                elegiveis.append(c)
            tipo_da_ordem = "ENTREVISTA"
            blocos = _ordenar_vaga(
                elegiveis,
                regra["listas"]["ENTREVISTA"]["empate"] == "CRITERIOS",
                "ENTREVISTA",
                v["chave"],
                ctx,
                residual_na_mesma_posicao=True,
            )
            geral = _numerar(blocos, lambda c: _na_geral(c, regra), numeracao)
        elif tipo == "CONVOCACAO":
            elegiveis = [c for c in aptos_doc if c.analiseId in convocados]
            for c in aptos_doc:
                if c.analiseId not in convocados:
                    eliminados.append({"c": c, "motivo": "NAO_CONVOCADO", "detalhe": f"Limite: {origem}."})
            geral = _numerar(blocos, lambda c, conv=convocados: c.analiseId in conv and _na_geral(c, regra), numeracao)
        elif tipo == "FINAL":
            elegiveis = []
            for c in aptos_doc:
                e = _eliminacao_entrevista(c, regra, ctx)
                if e:
                    eliminados.append({"c": c, **e})
                    if e["motivo"] == "SEM_ENTREVISTA" and c.analiseId in convocados and regra["etapas"]["entrevista"]:
                        avisos.append(
                            {
                                "codigo": "CONVOCADO_SEM_ENTREVISTA",
                                "tom": "warning",
                                "vaga": v["chave"],
                                "analiseId": c.analiseId,
                                "texto": f"{c.nome}: dentro do limite de convocação, mas sem entrevista lançada.",
                            }
                        )
                    if e["motivo"] == "SEM_NOTA_ENTREVISTA":
                        avisos.append(
                            {
                                "codigo": "SEM_NOTA_ENTREVISTA",
                                "tom": "warning",
                                "vaga": v["chave"],
                                "analiseId": c.analiseId,
                                "texto": f"{c.nome}: entrevista sem nota lançada.",
                            }
                        )
                    continue
                if c.analiseId not in convocados and regra["etapas"]["entrevista"]:
                    avisos.append(
                        {
                            "codigo": "ENTREVISTADO_NAO_CONVOCADO",
                            "tom": "warning",
                            "vaga": v["chave"],
                            "analiseId": c.analiseId,
                            "texto": f"{c.nome}: tem entrevista, mas está fora do limite de convocação da regra ({origem}); confira a convocação publicada.",
                        }
                    )
                c.composicao = nota_composta(c, regra)
                c.nota = c.composicao["nota"] if c.composicao["nota"] is not None else 0
                if c.composicao["faltando"]:
                    avisos.append(
                        {
                            "codigo": "COMPONENTE_FALTANDO",
                            "tom": "warning",
                            "vaga": v["chave"],
                            "analiseId": c.analiseId,
                            "texto": f"{c.nome}: sem {', '.join(c.composicao['faltando'])} — a nota final não soma esse componente.",
                        }
                    )
                elegiveis.append(c)
            tipo_da_ordem = "FINAL"
            blocos = _ordenar_vaga(
                elegiveis, regra["listas"]["FINAL"]["empate"] == "CRITERIOS", "FINAL", v["chave"], ctx
            )
            universo = [x for b in blocos for x in b.membros]

            def posicao_em(c, codigo, universo=universo):
                membros = [x for x in universo if codigo in x.modalidades]
                return next((i for i, x in enumerate(membros) if x is c), -1)

            for c in elegiveis:
                c.modalidadesNaLista = _modalidades_na_lista(c, "FINAL", regra, posicao_em)
            geral = _numerar(blocos, lambda c: _na_geral(c, regra), numeracao)

        usar_criterios = regra["listas"][tipo_da_ordem]["empate"] == "CRITERIOS"
        if usar_criterios:
            for c in elegiveis:
                if len(c.grupoDaNota or []) < 2:
                    continue
                for d in criterios:
                    if valor_do_criterio(c, d["criterio"], ctx) is not None:
                        continue
                    cat = CRITERIO_POR_CODIGO.get(d["criterio"])
                    if not cat:
                        continue
                    avisos.append(
                        {
                            "codigo": "DADO_FALTANDO",
                            "tom": "warning",
                            "vaga": v["chave"],
                            "analiseId": c.analiseId,
                            "texto": f'{c.nome}: sem {cat.falta(c, ctx)} para o critério "{cat.rotulo_curto}" — no desempate, fica atrás de quem tem.',
                        }
                    )

        if usar_criterios:
            grupos = []
            vistos_grupos: set = set()
            for c in elegiveis:
                g = c.grupoDaNota
                if g and len(g) > 1 and id(g) not in vistos_grupos:
                    vistos_grupos.add(id(g))
                    grupos.append(g)
            for grupo in grupos:
                for a, b in _pares_na_mesma_data(grupo, criterios, ctx):
                    ctx.hora_decide.add(a.analiseId)
                    ctx.hora_decide.add(b.analiseId)
                    sem_hora = sum(1 for x in (a, b) if not x.horaNascimento)
                    complemento = (
                        f" — sem certidão vale {hora_br(HORA_SEM_CERTIDAO)}; informe a hora na explicação do candidato"
                        if sem_hora
                        else ""
                    )
                    avisos.append(
                        {
                            "codigo": "HORA_DE_NASCIMENTO",
                            "tom": "warning" if sem_hora else "info",
                            "vaga": v["chave"],
                            "analiseId": a.analiseId,
                            "texto": f"{a.nome} e {b.nome}: empatados até a maior idade e nascidos no mesmo dia ({data_br(a.dataNascimento)}); decide a hora da certidão de nascimento{complemento}.",
                        }
                    )

        por_modalidade: dict = {}
        for m in regra["modalidades"]:
            if not m["lista_propria"]:
                continue
            codigo_m = m["codigo"]

            def pertence(c, cm=codigo_m, conv=convocados):
                return cm in (c.modalidadesNaLista or []) and (tipo != "CONVOCACAO" or c.analiseId in conv)

            linhas = _numerar(blocos, pertence, numeracao)
            if not m["recomeca_posicao"]:
                pos_geral = {linha.c.analiseId: linha.posicao for linha in geral}
                linhas = [
                    Linha(linha.c, pos_geral.get(linha.c.analiseId, linha.posicao), linha.bloco, linha.empatados)
                    for linha in linhas
                ]
            por_modalidade[codigo_m] = linhas

        for bloco in blocos:
            if bloco.resolucao != "PENDENTE":
                continue
            ids = {c.analiseId for c in bloco.membros}
            juntos = any(
                sum(1 for linha in linhas if linha.c.analiseId in ids) > 1
                for linhas in [geral, *por_modalidade.values()]
            )
            if not juntos:
                continue
            nota0 = bloco.membros[0].nota
            pendencias.append(
                {
                    "chave": bloco.chave,
                    "tipoLista": tipo_da_ordem,
                    "vaga": v["chave"],
                    "vagaTexto": nome_da_vaga,
                    "metodo": bloco.metodo,
                    "nota": nota0,
                    "candidatos": [
                        {"analiseId": c.analiseId, "nome": c.nome, "codigo": c.codigo} for c in bloco.membros
                    ],
                }
            )
            registre = "registre o sorteio" if bloco.metodo == "SORTEIO" else "registre a decisão"
            avisos.append(
                {
                    "codigo": "EMPATE_PENDENTE",
                    "tom": "danger",
                    "vaga": v["chave"],
                    "texto": f"Vaga {nome_da_vaga}: {len(bloco.membros)} candidatos empatados em {formatar_nota(nota0, ctx.casas)} depois de todos os critérios — {registre}.",
                }
            )

        alocacao = _alocar_vagas(v, geral, por_modalidade, regra, ctx) if tipo == "FINAL" else {}

        def situacao_de(c, alocacao=alocacao):
            if tipo == "CONVOCACAO":
                return "CONVOCADO"
            if tipo == "ENTREVISTA":
                return "APTO"
            if tipo == "FINAL":
                return (alocacao.get(c.analiseId) or {}).get("situacao") or None
            return None

        com_parciais = tipo == "PRELIMINAR"

        def linha_publica(linha, alocacao=alocacao, situacao_de=situacao_de, com_parciais=com_parciais):
            c = linha.c
            saida = {
                "analiseId": c.analiseId,
                "nome": c.nome,
                "nota": c.nota,
                "posicao": linha.posicao,
                "empatados": linha.empatados,
                "modalidades": c.modalidadesNaLista if c.modalidadesNaLista is not None else c.modalidades,
                "situacao": situacao_de(c),
                "vagaPor": (alocacao.get(c.analiseId) or {}).get("modalidade") or None,
            }
            if com_parciais:
                saida["parciais"] = _parciais_de(c)
            if c.ajustes:
                saida["recursos"] = _recursos_do_ajuste(c)
            return saida

        linha_geral_de = {linha.c.analiseId: linha for linha in geral}
        bloco_de = {}
        for b in blocos:
            for c in b.membros:
                bloco_de[c.analiseId] = b
        for c in elegiveis:
            posicoes = {}
            for codigo_m, linhas in por_modalidade.items():
                achada = next((x for x in linhas if x.c is c), None)
                if achada:
                    posicoes[codigo_m] = achada.posicao
            linha_g = linha_geral_de.get(c.analiseId)
            bloco = linha_g.bloco if linha_g else bloco_de.get(c.analiseId)
            explicacao = {
                "analiseId": c.analiseId,
                "nome": c.nome,
                "vaga": v["chave"],
                "elegivel": True,
                "nota": c.nota,
                "posicaoGeral": linha_g.posicao if linha_g else None,
                "posicoes": posicoes,
                "modalidades": c.modalidadesNaLista,
                "situacao": situacao_de(c),
            }
            if c.ajustes:
                explicacao["recursos"] = _recursos_do_ajuste(c)
            explicacao["horaNascimento"] = c.horaNascimento or None
            explicacao["horaDecide"] = c.analiseId in ctx.hora_decide
            explicacao["explicacao"] = [*_explicar(c, bloco, ctx, tipo), *_frase_dos_ajustes(c, casas_do_ajuste)]
            explicacoes[c.analiseId] = explicacao

        eliminados.sort(
            key=functools.cmp_to_key(
                lambda a, b: (_ordem_do_motivo(a["motivo"]) - _ordem_do_motivo(b["motivo"]))
                or _compara_nome(a["c"], b["c"])
            )
        )
        for e in eliminados:
            ec = e["c"]
            explicacao = {
                "analiseId": ec.analiseId,
                "nome": ec.nome,
                "vaga": v["chave"],
                "elegivel": False,
                "motivo": e["motivo"],
            }
            if ec.ajustes:
                explicacao["recursos"] = _recursos_do_ajuste(ec)
            explicacao["explicacao"] = [
                x
                for x in [
                    f"{MOTIVOS_DE_ELIMINACAO.get(e['motivo'])}.",
                    e["detalhe"],
                    *_frase_dos_ajustes(ec, casas_do_ajuste),
                ]
                if x
            ]
            explicacoes[ec.analiseId] = explicacao

        aguardando = _ordenar_por_nome(aguardando)
        for c in aguardando:
            explicacoes[c.analiseId] = {
                "analiseId": c.analiseId,
                "nome": c.nome,
                "vaga": v["chave"],
                "elegivel": False,
                "aguardando": True,
                "explicacao": [
                    f"Aguardando a análise documental (situação: {c.status or c.etapa}).",
                    "Fica fora das listas e dos eliminados até a análise ser concluída.",
                ],
            }

        elegiveis_total += len(elegiveis)
        eliminados_total += len(eliminados)
        aguardando_total += len(aguardando)

        def eliminado_publico(e, com_parciais=com_parciais):
            ec = e["c"]
            saida = {"analiseId": ec.analiseId, "nome": ec.nome, "motivo": e["motivo"], "detalhe": e["detalhe"]}
            if ec.ajustes:
                saida["recursos"] = _recursos_do_ajuste(ec)
            if com_parciais:
                saida["nota"] = ec.notaDocumental
                saida["parciais"] = _parciais_de(ec)
            elif tipo == "ENTREVISTA":
                saida["nota"] = ec.notaEntrevista
            return saida

        saida_vagas.append(
            {
                "chave": v["chave"],
                "codigo": v.get("codigo"),
                "cargo": v.get("cargo"),
                "lotacao": v.get("lotacao") or "",
                "cabecalho": v.get("cabecalho"),
                "total": v.get("total"),
                "vagasPorModalidade": v.get("porModalidade"),
                "cadastroReserva": bool(v.get("cadastroReserva")),
                "origemDasVagas": v.get("origemDasVagas") or None,
                "limiteConvocacao": {"limite": limite, "origem": origem} if tipo == "CONVOCACAO" else None,
                "geral": [linha_publica(linha) for linha in geral],
                "porModalidade": {
                    codigo_m: [linha_publica(x) for x in linhas] for codigo_m, linhas in por_modalidade.items()
                },
                "eliminados": [eliminado_publico(e) for e in eliminados],
                "aguardando": [
                    {"analiseId": c.analiseId, "nome": c.nome, "situacao": c.status or c.etapa or ""}
                    for c in aguardando
                ],
            }
        )
        rastro["vagas"].append(
            {
                "vaga": v,
                "tipoDaOrdem": tipo_da_ordem,
                "usarCriterios": usar_criterios,
                "blocos": blocos,
                "geral": geral,
                "porModalidade": por_modalidade,
            }
        )

    if aguardando_total:
        avisos.append(
            {
                "codigo": "AGUARDANDO_ANALISE",
                "tom": "warning",
                "texto": f"{inteiro_pt_br(aguardando_total)} candidato(s) aguardando a análise documental (ficha não concluída): ficam fora das listas e dos eliminados até a análise ser concluída.",
            }
        )
    for vaga in ctx.nivel_desconhecido:
        avisos.append(
            {
                "codigo": "NIVEL_DESCONHECIDO",
                "tom": "warning",
                "vaga": vaga,
                "texto": f"Vaga {vaga}: nível (superior, técnico…) não identificado; a nota mínima por nível não foi aplicada.",
            }
        )
    for d in ctx.desempates:
        if d.get("tipo_lista") == tipo or (tipo == "CONVOCACAO" and d.get("tipo_lista") == "PRELIMINAR"):
            if _id_do_registro(d) not in ctx.desempates_usados:
                aviso = {"codigo": "DESEMPATE_OBSOLETO", "tom": "info"}
                if "vaga" in d:
                    aviso["vaga"] = d["vaga"]
                o_que = "sorteio" if d["metodo"] == "SORTEIO" else "decisão"
                aviso["texto"] = (
                    f"Há {o_que} registrado para um empate que mudou (vaga {d.get('vaga') or '—'}); ele não vale mais."
                )
                avisos.append(aviso)

    vistos: set = set()
    avisos_unicos = []
    for a in avisos:
        k = f"{a['codigo']}|{a.get('analiseId') or ''}|{a['texto']}"
        if k in vistos:
            continue
        vistos.add(k)
        avisos_unicos.append(a)

    resultado = {
        "tipo": tipo,
        "dataCorte": corte,
        "casas": ctx.casas,
        "vagas": saida_vagas,
        "explicacoes": explicacoes,
        "pendencias": pendencias,
        "avisos": avisos_unicos,
        "totais": {
            "candidatos": len(candidatos),
            "elegiveis": elegiveis_total,
            "eliminados": eliminados_total,
            "aguardando": aguardando_total,
            "vagas": len(saida_vagas),
            "avisos": len(avisos_unicos),
            "pendencias": len(pendencias),
        },
    }
    return resultado, rastro


# ── O json de obter_classificacao_do_edital ─────────────────────────────


def _registros(valor) -> list[dict]:
    return [v for v in valor if isinstance(v, dict)] if isinstance(valor, list) else []


def entrada_do_edital(dados, tipo: str) -> dict:
    """
    A entrada do motor a partir do json de obter_classificacao_do_edital
    (classificarEdital + normalizarDadosParaPrevia): mesma recusa de dados
    malformados. `dados["convocacao"]` são as linhas cruas da convocação
    ({configuracoes, modelos}); o id do edital vem de `dados["edital"]["id"]`.
    """
    from monitora.avaliacao_documental.pre_classificacao import fim_das_inscricoes

    d = dados if isinstance(dados, dict) else {}
    r = d.get("regra") if isinstance(d.get("regra"), dict) else {}
    edital = d.get("edital") if isinstance(d.get("edital"), dict) else {}
    erro = texto(d.get("erro"))
    for campo in ("candidatos", "entrevistas", "quadro", "cronograma", "desempates", "ajustes"):
        valor = d.get(campo)
        if valor is not None and (not isinstance(valor, list) or len(_registros(valor)) != len(valor)):
            erro = erro or "Os dados da classificação recebidos são inválidos. Recarregue o recurso."
    configuracao = r.get("configuracao")
    if (configuracao is not None and not isinstance(configuracao, dict)) or (
        d.get("convocacao") is not None and not isinstance(d.get("convocacao"), dict)
    ):
        erro = erro or "Os dados da classificação recebidos são inválidos. Recarregue o recurso."
    if erro:
        raise DadosInvalidos(erro)
    convocacao = d.get("convocacao")
    if isinstance(convocacao, dict) and "edital_id" not in convocacao:
        convocacao = {**convocacao, "edital_id": edital.get("id")}
    return {
        "tipo": tipo,
        "regra": configuracao,
        "candidatos": _registros(d.get("candidatos")),
        "entrevistas": _registros(d.get("entrevistas")),
        "quadro": _registros(d.get("quadro")),
        "unidade": texto(edital.get("unidade")),
        "dataCorte": fim_das_inscricoes(_registros(d.get("cronograma"))),
        "desempates": _registros(d.get("desempates")),
        "convocacao": convocacao,
        "ajustes": _registros(d.get("ajustes")),
    }


def classificar_edital(dados, tipo: str) -> dict:
    """classificarEdital: o motor com o json de obter_classificacao_do_edital."""
    return classificar(entrada_do_edital(dados, tipo))
