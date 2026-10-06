"""
As regras das conferências de consistência, sem rede e sem banco: entram os
dados das RPCs de leitura (conferencia_ler_*), saem avisos.

Cada aviso é UM por conferência + escopo (edital, área ou vaga), com a
quantidade de casos, até 20 exemplos e TODOS os casos (até 5000) SÓ com ids,
códigos e o dado que motivou o aviso (datas, notas, corte, teto) — nunca nome,
CPF ou e-mail (o banco também recusa). Nome, edital, vaga e responsável a tela
busca na análise, com a permissão de quem lê (listar_casos_aviso_conferencia).
O resumo é montado aqui, com contagens e números de edital.

Testes: tests/python/test_conferencias.py.
"""

import math
import re
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from catalogo import CATALOGO

MAX_EXEMPLOS = 20
MAX_CASOS = 5000
TOLERANCIA = 0.01
VARIACAO_BRUSCA = 0.5
_EXEMPLO_SEGURO = re.compile(r"^[A-Za-z0-9._:/-]{1,80}$")
_ONZE_DIGITOS = re.compile(r"\d{11}")
_ESCOPO_SEGURO = re.compile(r"[^A-Za-z0-9._:/|-]")
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_CHAVE_DO_DETALHE = re.compile(r"^[a-z_]{1,30}$")
_VALOR_DO_DETALHE = re.compile(r"^[A-Za-z0-9._:/-]{0,40}$")


# ── Utilidades ──────────────────────────────────────────────────────────────


def numero(valor):
    """Número ou None (texto vazio, nulo, NaN)."""
    if valor is None or valor == "":
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(n) else n


def dia(valor):
    """date de 'AAAA-MM-DD…' (ou date/datetime); None se não der."""
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor or "")[:10]
    try:
        return date.fromisoformat(texto)
    except ValueError:
        return None


def momento(valor):
    """datetime com fuso de um timestamptz do Postgres; None se não der."""
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None


def hora(valor):
    try:
        return time.fromisoformat(str(valor)[:8])
    except ValueError:
        return None


def exemplo_seguro(valor):
    """O exemplo só entra se for id ou código (sem espaço, @ ou 11 dígitos)."""
    texto = str(valor if valor is not None else "").strip()
    if not _EXEMPLO_SEGURO.match(texto) or _ONZE_DIGITOS.search(texto):
        return None
    return texto


def detalhe_seguro(detalhe):
    """Só chaves simples e valores número, booleano ou texto de identificador (datas, códigos)."""
    saida = {}
    for chave, valor in (detalhe or {}).items():
        if not _CHAVE_DO_DETALHE.match(str(chave)) or valor is None:
            continue
        if isinstance(valor, bool):
            saida[chave] = valor
        elif isinstance(valor, (int, float)):
            if not (isinstance(valor, float) and math.isnan(valor)):
                saida[chave] = valor
        else:
            texto = valor.isoformat() if isinstance(valor, (date, datetime)) else str(valor).strip()
            if _VALOR_DO_DETALHE.match(texto) and not _ONZE_DIGITOS.search(texto):
                saida[chave] = texto
    return saida


def caso_seguro(caso):
    """
    O caso como o banco aceita: análise (uuid), código do candidato, outra
    referência e o detalhe. None se não sobrar nenhum identificador.
    """
    caso = caso or {}
    analise = str(caso.get("analise") or "").strip()
    saida = {}
    if _UUID.match(analise):
        saida["analise"] = analise
    for campo in ("codigo", "referencia"):
        seguro = exemplo_seguro(caso.get(campo)) if caso.get(campo) is not None else None
        if seguro:
            saida[campo] = seguro
    if not saida:
        return None
    detalhe = detalhe_seguro(caso.get("detalhe"))
    if detalhe:
        saida["detalhe"] = detalhe
    return saida


def escopo_de(tipo, identificador):
    ident = _ESCOPO_SEGURO.sub("-", str(identificador or "sem")).strip("-")[:170] or "sem"
    return f"{tipo}:{ident}"


def plural(n, singular, varios):
    return f"{n} {singular if n == 1 else varios}"


class Acumulador:
    """Junta os casos de cada conferência + escopo num aviso só."""

    def __init__(self, editais=None):
        self._avisos = {}
        self._editais = editais or {}

    def numero_do_edital(self, edital):
        return (self._editais.get(edital) or {}).get("numero") or "sem número"

    def area_do_edital(self, edital):
        return (self._editais.get(edital) or {}).get("area")

    def anotar(self, codigo, *, edital=None, area=None, escopo=None, exemplo=None, quantidade=1, extra=None, caso=None):
        """
        Soma o caso ao aviso. `caso` ({analise, codigo, referencia, detalhe})
        diz como a tela acha o caso; sem ele, o exemplo vira a referência.
        """
        if codigo not in CATALOGO:
            raise KeyError(codigo)
        area = area or self.area_do_edital(edital)
        if escopo is None:
            escopo = escopo_de("edital", edital) if edital else escopo_de("area", area or "sem-area")
        chave = (codigo, escopo)
        aviso = self._avisos.get(chave)
        if aviso is None:
            modulo, gravidade, _titulo = CATALOGO[codigo]
            aviso = self._avisos[chave] = {
                "conferencia": codigo,
                "escopo": escopo,
                "gravidade": gravidade,
                "modulo": modulo,
                "area": area,
                "edital": edital,
                "quantidade": 0,
                "exemplos": [],
                "casos": [],
                "extra": dict(extra or {}),
                "_chaves": set(),
            }
        aviso["quantidade"] += quantidade
        self.acrescentar(aviso, exemplo, caso)
        return aviso

    @staticmethod
    def acrescentar(aviso, exemplo=None, caso=None):
        """Mais um exemplo (até 20) e mais um caso (até 5000, sem repetir) no aviso."""
        seguro = exemplo_seguro(exemplo) if exemplo is not None else None
        if seguro and seguro not in aviso["exemplos"] and len(aviso["exemplos"]) < MAX_EXEMPLOS:
            aviso["exemplos"].append(seguro)
        bruto = caso if caso is not None else ({"referencia": exemplo} if exemplo is not None else None)
        limpo = caso_seguro(bruto) if bruto is not None else None
        if not limpo or len(aviso["casos"]) >= MAX_CASOS:
            return
        chave = (limpo.get("analise"), limpo.get("codigo"), limpo.get("referencia"))
        if chave in aviso["_chaves"]:
            return
        aviso["_chaves"].add(chave)
        aviso["casos"].append(limpo)

    def avisos(self, resumir):
        """Lista final, com o resumo de cada aviso (resumir(aviso, numero_do_edital) → texto)."""
        saida = []
        for aviso in self._avisos.values():
            texto = resumir(aviso, self.numero_do_edital(aviso["edital"]))
            final = {k: v for k, v in aviso.items() if k not in ("extra", "_chaves")}
            final["resumo"] = texto[:300]
            saida.append(final)
        return saida


# ── Resumos (sem dado pessoal: contagens e números de edital) ───────────────


def resumir(aviso, numero_do_edital):
    n = aviso["quantidade"]
    extra = aviso["extra"]
    onde = f"no edital {numero_do_edital}" if aviso["edital"] else "na área"
    c = aviso["conferencia"]
    if c == "ANALISE_APROVADA_ABAIXO_DO_CORTE":
        return f"{plural(n, 'análise aprovada', 'análises aprovadas')} com nota abaixo de {extra.get('corte')} {onde}."
    if c == "ANALISE_NOTA_DIFERENTE_DA_SOMA":
        return f"{plural(n, 'análise', 'análises')} com nota final diferente da soma das parciais {onde}."
    if c == "ANALISE_EXPERIENCIA_ACIMA_DO_TETO":
        return f"{plural(n, 'análise', 'análises')} com experiência acima de {extra.get('teto')} {onde}."
    if c == "ANALISE_DATA_INVALIDA":
        return f"{plural(n, 'análise', 'análises')} com data no futuro ou antes da inscrição {onde}."
    if c == "ANALISE_EM_DOIS_EDITAIS":
        return f"{plural(n, 'candidato', 'candidatos')} com análise em mais de um edital ativo."
    if c == "ENTREVISTA_SEM_NOTA_APOS_DATA":
        return f"{plural(n, 'convocado', 'convocados')} sem nota depois da data da entrevista {onde}."
    if c == "ENTREVISTA_NOTA_FORA_DA_ESCALA":
        return f"{plural(n, 'nota', 'notas')} de avaliador fora da escala do roteiro {onde}."
    if c == "ENTREVISTA_FORA_DA_CONVOCACAO":
        return f"{plural(n, 'convocado', 'convocados')} que não está na lista de convocação vigente {onde}."
    if c == "ENTREVISTA_HORARIO_DUPLICADO":
        return f"{plural(n, 'candidato', 'candidatos')} com mais de um horário de entrevista {onde}."
    if c == "CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA":
        return f"A lista final {onde} foi gerada antes da última mudança nas análises: gere de novo."
    if c == "CLASSIFICACAO_EMPATE_PENDENTE":
        return f"{plural(n, 'empate', 'empates')} sem desempate registrado na última lista {onde}."
    if c == "CLASSIFICACAO_VAGA_SEM_QUADRO":
        return f"{plural(n, 'vaga', 'vagas')} das análises sem linha no quadro de vagas {onde}."
    if c == "CLASSIFICACAO_AJUSTE_APOS_LISTA":
        return f"{plural(n, 'ajuste', 'ajustes')} de recurso aprovado depois da última lista {onde}."
    if c == "APROVADOS_CONTRATADO_DUPLICADO":
        return f"{plural(n, 'pessoa contratada', 'pessoas contratadas')} em mais de uma vaga."
    if c == "APROVADOS_CONVOCADO_SEM_DESFECHO":
        return f"{plural(n, 'convocado', 'convocados')} há mais de {extra.get('dias')} dias sem desfecho {onde}."
    if c == "APROVADOS_PENDENCIA_DA_PUBLICACAO":
        return f"{plural(n, 'pessoa', 'pessoas')} da lista anterior ainda para revisão depois da publicação {onde}."
    if c == "CARGA_VARIACAO_BRUSCA":
        return (
            f"Vaga {extra.get('vaga')}: candidatos foram de {extra.get('antes')} para {extra.get('depois')} "
            f"na última carga da Empregare."
        )
    return f"{n} casos."


# ── Análises ────────────────────────────────────────────────────────────────


def conferir_analises(paginas, contexto, acumulador):
    """
    paginas: iterável de listas de linhas de conferencia_ler_analises.
    contexto: conferencia_ler_contexto (editais, regras, hoje).
    """
    hoje = dia(contexto.get("hoje")) or date.today()
    editais = {e["id"]: e for e in contexto.get("editais") or []}
    regras = {r["edital"]: r for r in contexto.get("regras") or []}
    editais_por_codigo = defaultdict(set)
    areas_por_codigo = defaultdict(set)

    for linhas in paginas:
        for a in linhas:
            edital = a.get("edital")
            area = a.get("area")
            ident = a.get("id")
            regra = regras.get(edital) or {}
            nota = numero(a.get("nota"))

            corte = numero(regra.get("nota_minima"))
            aprovada = str(a.get("status") or "").strip().lower().startswith("aprovad")
            if aprovada and corte is not None and nota is not None and nota < corte - 1e-9:
                acumulador.anotar(
                    "ANALISE_APROVADA_ABAIXO_DO_CORTE",
                    edital=edital,
                    area=area,
                    exemplo=ident,
                    extra={"corte": f"{corte:g}"},
                    caso={"analise": ident, "detalhe": {"nota": nota, "corte": corte}},
                )

            partes = [numero(a.get(c)) for c in ("formacao", "cursos", "experiencia", "etnico")]
            if nota is not None and all(p is not None for p in partes) and abs(sum(partes) - nota) > TOLERANCIA:
                acumulador.anotar(
                    "ANALISE_NOTA_DIFERENTE_DA_SOMA",
                    edital=edital,
                    area=area,
                    exemplo=ident,
                    caso={"analise": ident, "detalhe": {"nota": nota, "soma": round(sum(partes), 4)}},
                )

            teto = numero(regra.get("teto_experiencia"))
            experiencia = numero(a.get("experiencia"))
            if teto is not None and experiencia is not None and experiencia > teto + 1e-9:
                acumulador.anotar(
                    "ANALISE_EXPERIENCIA_ACIMA_DO_TETO",
                    edital=edital,
                    area=area,
                    exemplo=ident,
                    extra={"teto": f"{teto:g}"},
                    caso={"analise": ident, "detalhe": {"experiencia": experiencia, "teto": teto}},
                )

            data_analise = dia(a.get("data_analise"))
            inscricao = dia(a.get("inscricao"))
            if data_analise and (data_analise > hoje or (inscricao and data_analise < inscricao)):
                acumulador.anotar(
                    "ANALISE_DATA_INVALIDA",
                    edital=edital,
                    area=area,
                    exemplo=ident,
                    caso={
                        "analise": ident,
                        "detalhe": {
                            "data_analise": data_analise,
                            "inscricao": inscricao,
                            "motivo": "futuro" if data_analise > hoje else "antes_da_inscricao",
                        },
                    },
                )

            codigo = a.get("codigo")
            if codigo and edital and (editais.get(edital) or {}).get("ativo"):
                editais_por_codigo[codigo].add(edital)
                if area:
                    areas_por_codigo[codigo].add(area)

    for codigo, conjunto in editais_por_codigo.items():
        if len(conjunto) < 2:
            continue
        for area in sorted(areas_por_codigo[codigo]) or [None]:
            acumulador.anotar(
                "ANALISE_EM_DOIS_EDITAIS",
                area=area,
                exemplo=codigo,
                caso={"codigo": codigo, "detalhe": {"editais": len(conjunto)}},
            )


# ── Entrevistas ─────────────────────────────────────────────────────────────


def _na_escala(nota, maxima, roteiro):
    if nota < -1e-9 or (maxima is not None and nota > maxima + 1e-9):
        return False
    escala = (roteiro or {}).get("escala") or "FAIXA"
    if escala == "LISTA":
        permitidas = [numero(v) for v in (roteiro.get("permitidas") or [])]
        permitidas = [v for v in permitidas if v is not None]
        return not permitidas or any(abs(nota - v) < 1e-6 for v in permitidas)
    if escala == "NIVEIS":
        niveis = [numero(v) for v in (roteiro.get("niveis") or [])]
        niveis = [v for v in niveis if v is not None]
        return not niveis or any(abs(nota - v) < 1e-6 for v in niveis)
    passo = numero((roteiro or {}).get("passo"))
    if passo and passo > 0:
        razao = nota / passo
        return abs(razao - round(razao)) < 1e-6
    return True


def conferir_entrevistas(dados, contexto, acumulador):
    hoje = dia(contexto.get("hoje")) or date.today()
    entrevistas = dados.get("entrevistas") or []
    por_candidato = defaultdict(list)
    for e in entrevistas:
        if e.get("edital") and e.get("analise"):
            por_candidato[(e["edital"], e["analise"])].append(e)

    # Convocado sem nota depois da data marcada na agenda.
    for g in dados.get("agenda") or []:
        data = dia(g.get("data"))
        if not data or data >= hoje:
            continue
        for e in por_candidato.get((g.get("edital"), g.get("analise")), []):
            if numero(e.get("nota")) is None and e.get("compareceu") != "N":
                acumulador.anotar(
                    "ENTREVISTA_SEM_NOTA_APOS_DATA",
                    edital=g.get("edital"),
                    area=g.get("area"),
                    exemplo=g.get("analise"),
                    caso={"analise": g.get("analise"), "detalhe": {"data_entrevista": data}},
                )
                break

    # Nota de avaliador fora da escala do roteiro.
    competencias = {c["id"]: c for c in dados.get("competencias") or []}
    roteiros = {r["id"]: r for r in dados.get("roteiros") or []}
    entrevista_por_id = {e["id"]: e for e in entrevistas}
    for v in dados.get("avaliacoes") or []:
        nota = numero(v.get("nota"))
        competencia = competencias.get(v.get("competencia"))
        entrevista = entrevista_por_id.get(v.get("entrevista"))
        if nota is None or not competencia or not entrevista:
            continue
        if not _na_escala(nota, numero(competencia.get("maxima")), roteiros.get(competencia.get("roteiro"))):
            acumulador.anotar(
                "ENTREVISTA_NOTA_FORA_DA_ESCALA",
                edital=entrevista.get("edital"),
                area=entrevista.get("area"),
                exemplo=entrevista.get("id"),
                caso={
                    "analise": entrevista.get("analise"),
                    "referencia": entrevista.get("id"),
                    "detalhe": {"nota": nota, "maxima": numero(competencia.get("maxima"))},
                },
            )

    # Convocado pelo sistema que não está na lista de convocação vigente.
    convocacao = {c["edital"]: set(c.get("analises") or []) for c in dados.get("convocacao") or []}
    for e in entrevistas:
        if e.get("origem") != "sistema" or not e.get("edital") or not e.get("analise"):
            continue
        if e["analise"] not in convocacao.get(e["edital"], set()):
            acumulador.anotar(
                "ENTREVISTA_FORA_DA_CONVOCACAO",
                edital=e["edital"],
                area=e.get("area"),
                exemplo=e["analise"],
                caso={"analise": e["analise"]},
            )

    # Dois horários: duas entrevistas ativas no mesmo edital para a mesma análise…
    for (edital, analise), lista in por_candidato.items():
        if len(lista) > 1:
            acumulador.anotar(
                "ENTREVISTA_HORARIO_DUPLICADO",
                edital=edital,
                area=lista[0].get("area"),
                exemplo=analise,
                caso={"analise": analise, "detalhe": {"horarios": len(lista)}},
            )
    # …ou o mesmo candidato (código) em horários que se cruzam em editais diferentes.
    por_codigo_e_dia = defaultdict(list)
    for g in dados.get("agenda") or []:
        if g.get("codigo") and dia(g.get("data")):
            por_codigo_e_dia[(g["codigo"], dia(g["data"]))].append(g)
    for (codigo, _data), lista in por_codigo_e_dia.items():
        if len({g.get("edital") for g in lista}) < 2:
            continue
        cruzam = False
        for i, a in enumerate(lista):
            for b in lista[i + 1 :]:
                ia, fa, ib, fb = hora(a.get("inicio")), hora(a.get("fim")), hora(b.get("inicio")), hora(b.get("fim"))
                if a.get("edital") != b.get("edital") and ia and fa and ib and fb and ia < fb and ib < fa:
                    cruzam = True
        if cruzam:
            for area in sorted({g.get("area") for g in lista if g.get("area")}) or [None]:
                acumulador.anotar("ENTREVISTA_HORARIO_DUPLICADO", area=area, exemplo=codigo, caso={"codigo": codigo})


# ── Classificação ───────────────────────────────────────────────────────────


def conferir_classificacao(dados, acumulador):
    listas = dados.get("listas") or []
    ultima = {(lista.get("edital"), lista.get("tipo")): lista for lista in listas}
    alteradas = {a["edital"]: momento(a.get("alterada_em")) for a in dados.get("analises_alteradas") or []}

    for lista in listas:
        edital = lista.get("edital")
        gerada = momento(lista.get("gerada_em"))
        if lista.get("tipo") == "FINAL" and gerada and alteradas.get(edital) and alteradas[edital] > gerada:
            acumulador.anotar(
                "CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA",
                edital=edital,
                area=lista.get("area"),
                exemplo=lista.get("id"),
            )
        pendencias = int(numero(lista.get("pendencias")) or 0)
        if pendencias > 0:
            aviso = acumulador.anotar(
                "CLASSIFICACAO_EMPATE_PENDENTE",
                edital=edital,
                area=lista.get("area"),
                quantidade=pendencias,
                exemplo=lista.get("id"),
            )
            for vaga in lista.get("vagas_pendentes") or []:
                Acumulador.acrescentar(aviso, vaga)

    for v in dados.get("vagas_sem_quadro") or []:
        acumulador.anotar(
            "CLASSIFICACAO_VAGA_SEM_QUADRO", edital=v.get("edital"), area=v.get("area"), exemplo=v.get("vaga")
        )

    for j in dados.get("ajustes") or []:
        lista = ultima.get((j.get("edital"), j.get("tipo")))
        aprovado = momento(j.get("aprovado_em"))
        gerada = momento((lista or {}).get("gerada_em"))
        if lista and aprovado and gerada and aprovado > gerada:
            acumulador.anotar(
                "CLASSIFICACAO_AJUSTE_APOS_LISTA", edital=j.get("edital"), area=j.get("area"), exemplo=j.get("id")
            )


# ── Lista de aprovados ──────────────────────────────────────────────────────


def conferir_aprovados(dados, contexto, acumulador, dias_convocado=15):
    hoje = dia(contexto.get("hoje")) or date.today()
    limite = hoje - timedelta(days=dias_convocado)
    candidatos = dados.get("candidatos") or []

    contratados = defaultdict(list)
    for c in candidatos:
        if c.get("status") == "Contratado" and c.get("pessoa"):
            contratados[c["pessoa"]].append(c)
        convocado_em = dia(c.get("convocado_em"))
        if c.get("status") == "Convocado" and convocado_em and convocado_em < limite:
            acumulador.anotar(
                "APROVADOS_CONVOCADO_SEM_DESFECHO",
                edital=c.get("edital"),
                area=c.get("area"),
                exemplo=c.get("id"),
                extra={"dias": dias_convocado},
            )

    for lista in contratados.values():
        if len({c.get("id") for c in lista}) < 2:
            continue
        for area in sorted({c.get("area") for c in lista if c.get("area")}) or [None]:
            aviso = acumulador.anotar("APROVADOS_CONTRATADO_DUPLICADO", area=area, exemplo=lista[0].get("id"))
            for c in lista[1:]:
                Acumulador.acrescentar(aviso, c.get("id"))

    for p in dados.get("pendencias") or []:
        ids = p.get("candidatos") or []
        if not ids:
            continue
        aviso = acumulador.anotar(
            "APROVADOS_PENDENCIA_DA_PUBLICACAO",
            edital=p.get("edital"),
            area=p.get("area"),
            quantidade=len(ids),
            exemplo=ids[0],
        )
        for ident in ids[1:]:
            Acumulador.acrescentar(aviso, ident)


# ── Cargas ──────────────────────────────────────────────────────────────────


def variacao_da_vaga(vaga):
    """(antes, depois) da última carga da vaga, ou None quando não dá para comparar."""
    ativos = int(numero(vaga.get("ativos")) or 0)
    if vaga.get("situacao") == "RECUSADA":
        arquivo = numero(vaga.get("arquivo"))
        return (ativos, int(arquivo)) if arquivo is not None else None
    antes = ativos - int(numero(vaga.get("novos")) or 0) + int(numero(vaga.get("saidas")) or 0)
    return (antes, ativos) if antes > 0 else None


def conferir_cargas(dados, acumulador):
    for vaga in dados.get("vagas") or []:
        par = variacao_da_vaga(vaga)
        if not par:
            continue
        antes, depois = par
        if antes > 0 and abs(depois - antes) / antes >= VARIACAO_BRUSCA:
            codigo = vaga.get("vaga")
            acumulador.anotar(
                "CARGA_VARIACAO_BRUSCA",
                edital=vaga.get("edital"),
                area=vaga.get("area"),
                escopo=escopo_de("vaga", codigo),
                exemplo=codigo,
                extra={"vaga": codigo, "antes": antes, "depois": depois},
            )
