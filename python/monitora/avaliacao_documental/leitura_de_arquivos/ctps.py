"""
CTPS (Carteira de Trabalho) pela POSIÇÃO dos campos: um contrato por bloco.

A CTPS Digital (o PDF do app/gov.br, com texto ou impresso como imagem) traz,
para cada contrato, o empregador (razão social e CNPJ/CEI), as datas de
admissão e de desligamento (ou "Data de fim"/"Situação do vínculo"), a
ocupação/cargo com o CBO, o tipo de contrato e a remuneração — e, DENTRO do
mesmo contrato, as seções de alterações salariais/contratuais, férias e
afastamentos, cujas datas NÃO são admissão. A CTPS física fotografada traz os
mesmos rótulos impressos (Empregador, Cargo, C.B.O., Data admissão, Saída),
muitas vezes duas páginas lado a lado.

A página vira linhas e células (`layout`); cada célula com rótulo dá um campo
(o valor na própria célula, à direita ou embaixo), e os campos, na ordem de
leitura, formam os contratos:

    Empregador/Razão social ou CNPJ  abre um contrato novo se o atual já tem
                                     admissão (ou já tem esse campo)
    Admissão                         a primeira do contrato; outra admissão no
                                     mesmo contrato (sem empregador entre elas)
                                     abre outro contrato
    Desligamento/Data de fim/Saída   o fim; "Situação: Desligado" sem data
                                     encerra sem fim conhecido
    Alterações/Férias/Afastamentos   daí até o próximo contrato, datas e cargos
                                     são ignorados
    texto sem rótulo logo acima do CNPJ   a razão social (o app põe o nome do
                                     empregador em destaque, sem rótulo)

O CNPJ (de empresa: pode ser guardado) só vale com o dígito verificador certo
(também o alfanumérico, de julho de 2026); sem a razão social, o empregador
fica "CNPJ 00.000.000/0000-00". CPF ou CEI de empregador pessoa física nunca é
guardado. Nada é consultado fora (sem API): tudo local.
"""

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from .layout import Celula, Linha, linhas_da_pagina, valor_do_rotulo
from .texto import datas_no_texto, dobrar, numa_linha

_ROTULOS = (
    # "CNP)", "CNPI": o J que o OCR troca.
    (
        "DOCUMENTO",
        r"cnp[j)\]il1|]\s*/\s*cei\s*/\s*cpf|cnp[j)\]il1|]\s*/\s*cpf|cnp[j)\]il1|]\s*/\s*cei|cnp[j)\]il1|]|caepf|cno(?=\s*:)|cei(?=\s*:)",
    ),
    (
        "EMPREGADOR",
        r"nome\s+(?:do\s+)?empregador|empregador(?:\s*/\s*empresa)?|razao\s+social|nome\s+empresarial|empresa(?=\s*:)",
    ),
    (
        "ADMISSAO",
        r"data\s+(?:de\s+|da\s+)?admissao|admissao|admitid[oa]\s+em|data\s+de\s+entrada|data\s+(?:de\s+)?inicio"
        r"|inicio\s+do\s+(?:contrato|vinculo)",
    ),
    (
        "DESLIGAMENTO",
        r"data\s+(?:de\s+|da\s+|do\s+)?(?:des[li1t|]{1,2}gamento|demissao|rescisao|saida|termino|encerramento|fim)"
        r"|des[li1t|]{1,2}gamento|demissao|rescisao|saida|termino(?:\s+do\s+(?:contrato|vinculo))?"
        r"|fim\s+do\s+(?:contrato|vinculo)|ultimo\s+dia\s+trabalhado",
    ),
    ("SITUACAO", r"situacao(?:\s+do\s+(?:vinculo|contrato))?"),
    ("CBO", r"c\s?\.?\s?b\s?\.?\s?o\.?(?:\s+n[ºo°.]*)?(?![a-z])"),
    ("CARGO", r"cargo\s*/\s*funcao|descricao\s+do\s+cargo|cargo(?:\s+exercido)?|ocupacao|funcao"),
    ("TIPO", r"tipo\s+de\s+(?:contrato|vinculo)|categoria(?:\s+do\s+trabalhador)?"),
    ("REMUNERACAO", r"(?:remuneracao|salario)(?:\s+(?:inicial|contratual|base|mensal|especificada))?"),
    (
        "JORNADA",
        r"jornada(?:\s+(?:de\s+trabalho|semanal))?|carga\s+horaria(?:\s+semanal)?|horas\s+semanais"
        r"|duracao\s+do\s+trabalho",
    ),
    (
        "EMISSAO",
        r"(?:documento\s+|carteira\s+)?(?:emitid[oa]|gerad[oa]|expedid[oa]|impress[oa]|extraid[oa]|consultad[oa])\s+em"
        r"|data\s+(?:de\s+|da\s+)?(?:emissao|geracao|expedicao|impressao|consulta)",
    ),
)
_ROTULO = re.compile(
    "|".join(
        f"(?P<{nome}>(?<![a-z0-9])(?<!do )(?<!da )(?<!de )(?<!pelo )(?<!pela )(?:{padrao}))(?![a-z])"
        for nome, padrao in _ROTULOS
    ),
)
_SECAO_IGNORADA = re.compile(
    r"^(?:alteracoes?|historico|ferias|afastamentos?|anotacoes|observacoes|informacoes\s+complementares|"
    r"remuneracoes|reajustes?|licencas?|dados\s+pessoais|qualificacao\s+civil|identificacao\s+do\s+trabalhador)"
    r"(?![a-z])"
)
_SECAO_CONTRATO = re.compile(
    r"^(?:contratos?\s+de\s+trabalho|contrato\s*(?:n[ºo°.]*\s*)?\d+|vinculos?\s+empregaticios?|dados\s+do\s+contrato)"
    r"(?![a-z])"
)
_DATA_SOLTA = re.compile(r"(?<![\d/])\d{1,2}\s?[/.-]\s?\d{1,2}\s?[/.-]\s?\d{2,4}(?![\d/])")
_SEM_VALOR = re.compile(r"^(?:-+|—|–|\.+|n/?a|nao\s+informad[oa]|sem\s+data|em\s+aberto|ativo|vigente)?$")
_DESLIGADO = re.compile(r"desligad|encerrad|rescindid|inativ|finalizad|extint")
_ATIVO = re.compile(r"(?<![a-z])(?:ativo|vigente|em\s+aberto|em\s+vigor)(?![a-z])")
_IDENTIFICADOR = re.compile(r"[0-9A-Za-z][0-9A-Za-z.\-/ ]{9,24}[0-9]")
_NAO_E_NOME_DE_EMPREGADOR = re.compile(
    r"^(?:carteira|ctps|contratos?|dados|nome|cpf|data|pagina|\d|https?:|www\.|gov\.br|ministerio do trabalho)"
)

MAXIMO_DE_CONTRATOS = 30


# ── CNPJ ─────────────────────────────────────────────────────────────────────


def _valor_do_caractere(c):
    return ord(c.upper()) - 48  # 0–9 → 0–9; A–Z → 17–42 (regra do CNPJ alfanumérico)


def cnpj_valido(cnpj):
    """O CNPJ (14 caracteres: 12 alfanuméricos + 2 dígitos) tem os dígitos verificadores certos."""
    c = re.sub(r"[^0-9A-Za-z]", "", str(cnpj or "")).upper()
    if not re.fullmatch(r"[0-9A-Z]{12}\d{2}", c) or len(set(c)) == 1:
        return False
    for tamanho in (12, 13):
        pesos = [(i % 8) + 2 for i in range(tamanho)][::-1]
        soma = sum(_valor_do_caractere(ch) * p for ch, p in zip(c[:tamanho], pesos, strict=True))
        dv = 0 if soma % 11 < 2 else 11 - soma % 11
        if int(c[tamanho]) != dv:
            return False
    return True


def formatar_cnpj(cnpj):
    c = re.sub(r"[^0-9A-Za-z]", "", str(cnpj or "")).upper()
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"


def cnpj_no_texto(texto):
    """(CNPJ formatado, posição inicial, final) do primeiro CNPJ válido do texto; (None, -1, -1) sem ele."""
    for m in _IDENTIFICADOR.finditer(str(texto or "")):
        bruto = re.sub(r"[^0-9A-Za-z]", "", m.group(0))
        for inicio in range(0, max(1, len(bruto) - 13)):
            candidato = bruto[inicio : inicio + 14]
            if len(candidato) == 14 and cnpj_valido(candidato):
                return formatar_cnpj(candidato), m.start(), m.end()
    return None, -1, -1


# ── células com mais de um rótulo ou mais de uma data ───────────────────────


# Os rótulos que o OCR costuma estragar numa letra ("Data de acmissão", "Tipo ce contrato"): comparados por
# semelhança (difflib), só os longos (os curtos dariam falso positivo).
_ROTULOS_PARECIDOS = (
    ("ADMISSAO", "data de admissao"),
    ("ADMISSAO", "data admissao"),
    ("DESLIGAMENTO", "data de desligamento"),
    ("DESLIGAMENTO", "desligamento"),
    ("DESLIGAMENTO", "data de saida"),
    ("EMPREGADOR", "empregador"),
    ("EMPREGADOR", "razao social"),
    ("CARGO", "ocupacao"),
    ("TIPO", "tipo de contrato"),
    ("REMUNERACAO", "remuneracao inicial"),
)
SEMELHANCA_DO_ROTULO = 0.86


class _Achado:
    """Um rótulo achado no começo da célula: o grupo (ADMISSAO, CARGO…) e onde ele acaba."""

    def __init__(self, grupo, fim):
        self.lastgroup, self._fim = grupo, fim

    def end(self):
        return self._fim


def _rotulo_no_comeco(dobrado):
    texto = dobrado.lstrip(" •·-–*0123456789.)")
    m = _ROTULO.match(texto)
    if m:
        return _Achado(m.lastgroup, m.end())
    palavras = list(re.finditer(r"\S+", texto))
    for grupo, rotulo in _ROTULOS_PARECIDOS:
        n = len(rotulo.split())
        if len(palavras) < n:
            continue
        fim = palavras[n - 1].end()
        inicio = texto[:fim].strip(" :")
        if SequenceMatcher(None, inicio.rstrip(":"), rotulo).ratio() >= SEMELHANCA_DO_ROTULO:
            return _Achado(grupo, fim)
    return None


def e_rotulo(dobrado):
    """A célula é só um rótulo (sem valor) ou começa com um rótulo."""
    return _rotulo_no_comeco(dobrado) is not None


def _pedaco(celula, inicio, fim):
    total = max(1, len(celula.texto))
    largura = celula.x1 - celula.x0
    return Celula(
        celula.texto[inicio:fim].strip(),
        celula.x0 + largura * inicio / total,
        celula.x0 + largura * fim / total,
        celula.topo,
        celula.base,
        celula.linha,
    )


def _dividir_celula(celula):
    """A célula partida em cada rótulo de dentro ("Admissão: 01/02/2018 Desligamento: 31/01/2020") e,
    sem rótulo, em cada data ("01/02/2018 31/01/2020")."""
    dobrado = celula.dobrado
    cortes = [m.start() for m in _ROTULO.finditer(dobrado) if m.start() > 0 and dobrado[m.start() - 1] in " |;:"]
    if not cortes:
        datas = list(_DATA_SOLTA.finditer(dobrado))
        resto = _DATA_SOLTA.sub("", dobrado).strip(" -–|")
        if len(datas) > 1 and not re.search(r"[a-z]", resto):
            return [_pedaco(celula, m.start(), m.end()) for m in datas]
        return [celula]
    limites = [0, *cortes, len(celula.texto)]
    return [_pedaco(celula, a, b) for a, b in zip(limites, limites[1:], strict=False) if celula.texto[a:b].strip()]


def _dividir(linhas):
    saida = []
    for linha in linhas:
        celulas = [p for c in linha.celulas for p in _dividir_celula(c)]
        saida.append(Linha(celulas))
    return saida


def _colunas(linhas):
    """A página com duas CTPS lado a lado (foto da carteira aberta) vira duas colunas, uma depois da outra."""
    if not linhas:
        return [linhas]
    direita = max(c.x1 for linha in linhas for c in linha.celulas)
    esquerda = min(c.x0 for linha in linhas for c in linha.celulas)
    largura = max(1.0, direita - esquerda)
    xs = [
        (c.x0 - esquerda) / largura
        for linha in linhas
        for c in linha.celulas
        if (m := _rotulo_no_comeco(c.dobrado)) and m.lastgroup in ("EMPREGADOR", "ADMISSAO")
    ]
    if not (any(x < 0.3 for x in xs) and any(x > 0.45 for x in xs)):
        return [linhas]
    meio = esquerda + largura * 0.45
    lados = ([], [])
    for linha in linhas:
        for lado, celulas in enumerate(
            ([c for c in linha.celulas if c.centro < meio], [c for c in linha.celulas if c.centro >= meio])
        ):
            if celulas:
                lados[lado].append(Linha(celulas))
    return [lados[0], lados[1]]


# ── os campos, na ordem de leitura ──────────────────────────────────────────


def _tem_data(texto):
    return _data(texto) is not None


def _data_ou_situacao(texto):
    return _tem_data(texto) or bool(_DESLIGADO.search(dobrar(texto)))


# O que vale como valor de cada rótulo (a célula ao lado de "Data de admissão" que não tem data não é dela).
_ACEITA = {
    "ADMISSAO": _tem_data,
    "EMISSAO": _tem_data,
    "DESLIGAMENTO": _data_ou_situacao,
    "DOCUMENTO": lambda t: len(re.sub(r"[^0-9A-Za-z]", "", t)) >= 11
    and bool(re.search(r"\d{6}", re.sub(r"\D", "", t))),
}


@dataclass
class Campo:
    nome: str  # um dos _ROTULOS, SECAO_IGNORADA, SECAO_CONTRATO ou TEXTO
    valor: str | None
    pagina: int


def _campos_da_pagina(pagina):
    campos = []
    for linhas in _colunas(_dividir(linhas_da_pagina(pagina))):
        for i, linha in enumerate(linhas):
            for celula in linha.celulas:
                if celula.usada:
                    continue
                celula.usada = True
                dobrado = celula.dobrado.strip()
                limpo = dobrado.strip(" :.-–|•")
                if _SECAO_CONTRATO.match(limpo) and len(limpo) <= 40:
                    campos.append(Campo("SECAO_CONTRATO", None, pagina.numero))
                    continue
                if _SECAO_IGNORADA.match(limpo) and len(limpo) <= 50 and not _DATA_SOLTA.search(limpo):
                    campos.append(Campo("SECAO_IGNORADA", None, pagina.numero))
                    continue
                m = _rotulo_no_comeco(dobrado)
                if m is None:
                    # CNPJ válido sem rótulo (ou com o rótulo mal lido): é o documento do empregador.
                    nome = "DOCUMENTO" if cnpj_no_texto(celula.texto)[0] else "TEXTO"
                    campos.append(Campo(nome, celula.texto, pagina.numero))
                    continue
                deslocamento = len(dobrado) - len(dobrado.lstrip(" •·-–*0123456789.)"))
                resto = celula.texto.strip()[deslocamento + m.end() :]
                valor, usadas = valor_do_rotulo(linhas, i, celula, resto, e_rotulo, _ACEITA.get(m.lastgroup))
                for u in usadas:
                    u.usada = True
                campos.append(Campo(m.lastgroup, valor, pagina.numero))
    return campos


_MES_DO_OCR = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10,
    "nov": 11, "dez": 12,
}  # fmt: skip
_POR_EXTENSO_DO_OCR = re.compile(r"(?<!\d)(\d{1,2})\s*de\s+([a-z]{3})[a-z]{0,7}\s+de\s+(\d{4})(?!\d)")


def _data(valor):
    """A primeira data do valor (completa, de preferência); por extenso com o mês mal lido pelo OCR
    ("10 de martão de 2020"), o mês sai das três primeiras letras."""
    dobrado = dobrar(valor or "")
    datas = datas_no_texto(dobrado)
    completas = [d for d in datas if d.dia]
    if completas or datas:
        return (completas or datas)[0]
    m = _POR_EXTENSO_DO_OCR.search(dobrado)
    if m and m.group(2) in _MES_DO_OCR:
        achadas = datas_no_texto(f"{int(m.group(1)):02d}/{_MES_DO_OCR[m.group(2)]:02d}/{m.group(3)}")
        if achadas:
            return achadas[0]
    return None


def _nome_de_empregador(texto):
    t = numa_linha(texto).strip(" :-–|")
    d = dobrar(t)
    if len(t) < 3 or len(t) > 140 or _NAO_E_NOME_DE_EMPREGADOR.match(d) or _DATA_SOLTA.search(d):
        return None
    if e_rotulo(d) or _SECAO_IGNORADA.match(d) or _SECAO_CONTRATO.match(d):
        return None
    return t if re.search(r"[A-Za-zÀ-ÿ]{3}", t) else None


def _separar_documento(valor):
    """O valor do campo CNPJ/Empregador: (CNPJ válido ou None, o nome que veio junto ou None)."""
    cnpj, a, b = cnpj_no_texto(valor)
    if not cnpj:
        # CPF/CEI de pessoa física: não guarda o número; o resto pode ser o nome do empregador.
        resto = re.sub(r"[\d.\-/]{8,}", " ", valor or "")
        return None, _nome_de_empregador(resto)
    resto = (valor[:a] + " " + valor[b:]).strip()
    resto = re.sub(r"(?i)\b(?:cnpj|cei|cpf|caepf|cno)\b\s*:?", " ", resto)
    return cnpj, _nome_de_empregador(resto)


@dataclass
class Contrato:
    pagina: int
    empregador: str | None = None
    cnpj: str | None = None
    admissao: object = None
    desligamento: object = None
    desligado: bool = False
    cargo: str | None = None
    cbo: str | None = None
    jornada: str | None = None


def ler_contratos(paginas):
    """([Contrato], data de emissão ou None) da CTPS pela posição dos campos."""
    contratos, atual, ignorando, emissao, textos = [], None, False, None, []

    def fechar():
        nonlocal atual
        if atual is not None and atual.admissao is not None:
            contratos.append(atual)
        atual = None

    for campo in (c for p in paginas for c in _campos_da_pagina(p)):
        nome, valor = campo.nome, campo.valor
        if nome == "SECAO_CONTRATO":
            fechar()
            ignorando, textos = False, []
            continue
        if nome == "SECAO_IGNORADA":
            ignorando = True
            continue
        if nome == "TEXTO":
            textos = (textos + [valor])[-2:]
            continue
        if nome == "EMISSAO":
            d = _data(valor)
            if d and d.dia:
                emissao = d.primeiro_dia()
            continue
        if nome in ("EMPREGADOR", "DOCUMENTO"):
            cnpj, junto = _separar_documento(valor or "") if nome == "DOCUMENTO" else (None, None)
            if nome == "EMPREGADOR":
                cnpj, a, b = cnpj_no_texto(valor or "")
                junto = _nome_de_empregador((valor or "")[:a] + " " + (valor or "")[b:] if cnpj else valor or "")
            ja_tem = atual is not None and (atual.empregador if nome == "EMPREGADOR" else atual.cnpj)
            if atual is not None and (atual.admissao is not None or ja_tem):
                fechar()
            if atual is None:
                atual = Contrato(campo.pagina)
                # O nome do empregador em destaque, sem rótulo, logo antes do CNPJ.
                if nome == "DOCUMENTO" and not junto and textos:
                    atual.empregador = _nome_de_empregador(textos[-1])
            ignorando, textos = False, []
            atual.cnpj = atual.cnpj or cnpj
            atual.empregador = atual.empregador or junto
            continue
        if ignorando:
            continue
        if nome == "CARGO" and valor and atual is not None and atual.cargo and atual.admissao is not None:
            # Outro cargo depois de um contrato completo (layout com o cargo ANTES da admissão): o próximo contrato.
            fechar()
            atual = Contrato(campo.pagina, cargo=valor)
            continue
        if nome == "ADMISSAO":
            d = _data(valor)
            if d is None:
                continue
            if atual is not None and atual.admissao is not None:
                fechar()
            if atual is None:
                atual = Contrato(campo.pagina)
            atual.admissao = d
            atual.pagina = campo.pagina
        elif atual is None:
            continue
        elif nome == "DESLIGAMENTO":
            d = _data(valor)
            if d is not None and atual.desligamento is None:
                atual.desligamento = d
            elif valor and _DESLIGADO.search(dobrar(valor)):
                atual.desligado = True
        elif nome == "SITUACAO" and valor:
            v = dobrar(valor)
            if _DESLIGADO.search(v) and not _ATIVO.search(v.replace("inativ", "")):
                atual.desligado = True
        elif nome == "CARGO" and valor and not atual.cargo:
            atual.cargo = valor
        elif nome == "CBO" and valor and not atual.cbo:
            m = re.search(r"(\d{4})\s?[-.]?\s?(\d{2})(?!\d)", valor)
            if m:
                atual.cbo = f"{m.group(1)}-{m.group(2)}"
            descricao = re.sub(r"^[\d\s.\-–]+", "", valor).strip(" -–:")
            if not atual.cargo and re.search(r"[A-Za-zÀ-ÿ]{3}", descricao):
                atual.cargo = descricao
        elif nome == "JORNADA" and valor and not atual.jornada:
            atual.jornada = valor
        if len(contratos) >= MAXIMO_DE_CONTRATOS:
            break
    fechar()
    return contratos[:MAXIMO_DE_CONTRATOS], emissao
