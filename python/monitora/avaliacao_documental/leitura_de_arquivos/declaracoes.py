"""
DECLARAÇÕES de vínculo / tempo de serviço (e contratos, certidões, contracheques): quem declara, até quando e
com que carga — só biblioteca padrão.

Numa declaração o EMPREGADOR é quem declara. Ele sai, nesta ordem:

    texto       "A <razão social>, inscrita no CNPJ …, declara"
    timbre      o cabeçalho da página pela POSIÇÃO das palavras (`layout`): a linha de fonte maior ou
                centralizada no primeiro quinto da página, sem título ("DECLARAÇÃO"), endereço nem contato
    texto       "contratado(a) pela <razão social>", "trabalha … no(a) <Hospital/Clínica/…>"
    cabeçalho   sem posição (DOCX, TXT): uma das primeiras linhas com cara de instituição
    rodapé      a razão social na linha do CNPJ (ou logo acima dela) no fim da página
    CNPJ        só o CNPJ validado (rotulado "CNPJ"), quando a razão social não sai: "CNPJ 12.345.678/0001-90"

Cada página com emissor próprio (ou com título de declaração) abre uma SEÇÃO; a página sem nada disso
continua a anterior (declaração de duas páginas). Os vínculos da seção herdam o emissor dela.

Da seção sai também a data de EMISSÃO: o local e data ("Cidade, 10 de outubro de 2026"), senão a rotulada
("Emitido em"), o carimbo ou a assinatura digital, senão a última data completa. O vínculo atual conta os
dias até ela; o que começa DEPOIS dela é leitura errada (descartado, com alerta leve).

Fim: `ATUAL_DECLARADO` ("até a presente data", "atualmente", "até o momento", "encontra-se em exercício",
"permanece", verbo no presente: "exerce", "trabalha", "presta") → atual. Sem fim nem nada disso: fim não
informado (nunca um "?" ambíguo).

Carga (`carga_declarada`): só o número ligado a "horas semanais", "h/semana", "por semana", "carga horária
(semanal) de NN horas", "jornada de NN horas" (com "diárias": × 5); "plantões de NN horas" marca plantonista
e não vira carga semanal. "Carga horária total de 360 horas" (curso), CEP, endereço e datas não contam.
"""

import re
from dataclasses import dataclass

from .ctps import cnpj_no_texto
from .layout import linhas_das_palavras
from .texto import dobrar, numa_linha

# ── fim do vínculo ───────────────────────────────────────────────────────────

ATUAL_DECLARADO = re.compile(
    r"ate\s+(?:a\s+presente\s+data|o\s+presente\s+momento|o\s+momento|os\s+dias\s+atuais|hoje|a\s+data\s+atual"
    r"|o\s+presente|a\s+presente|esta\s+data|a\s+data\s+de\s+hoje)"
    r"|atualmente|em\s+exercicio|em\s+atividade|em\s+aberto|vinculo\s+ativo|sem\s+data\s+de\s+(?:saida|desligamento)"
    r"|vem\s+(?:exercendo|trabalhando|desempenhando|atuando|prestando)|faz\s+parte\s+do\s+quadro"
    r"|(?:e|esta|encontra-?\s?se)\s+(?:lotad|vinculad|contratad|trabalhando|ativ)"
    r"|(?<![a-z])e\s+(?:servidor|funcionari|empregad|colaborador)"
    r"|permanece|continua\s+(?:a\s+)?(?:exercer|trabalhar|atuar|prestar)"
    r"|(?<![a-z])(?:exerce|trabalha|presta|atua|ocupa|desempenha|labora|integra)(?![a-z])"
)

# ── carga horária ────────────────────────────────────────────────────────────

# O número e, se houver, o extenso entre parênteses ("20 (vinte) horas"): o extenso vale mais que o dígito (o OCR
# troca 0 por 6 e 8, mas raramente estraga a palavra inteira).
_NUMERO = r"(?<![\d/.,])(\d{1,2})(?:\s*\(\s*(?P<extenso>[a-z][a-z ]{1,30}?)\s*\))?"
_EXTENSO = {
    "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8,
    "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "catorze": 14, "quinze": 15,
    "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20, "trinta": 30, "quarenta": 40,
    "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80,
}  # fmt: skip


def numero_por_extenso(texto):
    """ "vinte e quatro" → 24; None se não for um número por extenso de 1 a 89."""
    partes = [p for p in (texto or "").split() if p != "e"]
    if not partes or any(p not in _EXTENSO for p in partes):
        return None
    valores = [_EXTENSO[p] for p in partes]
    if len(valores) == 2 and valores[0] >= 20 and valores[0] % 10 == 0 and valores[1] < 10:
        return sum(valores)
    return valores[0] if len(valores) == 1 else None


_UNIDADE = r"\s*(?:h|hs|hrs?|horas?)(?![a-z])"
_SEMANAL = r"\s*(?:semanais|semanal|por\s+semana|/\s*semana|/\s*sem(?![a-z])|na\s+semana|a\s+semana)"
_DIARIA = r"\s*(?:diarias|diaria|por\s+dia|/\s*dia|ao\s+dia)"
_NAO_SEMANAL = r"\s*(?:mensais|mensal|por\s+mes|/\s*mes|totais|total|anuais|de\s+curso|aula)"
_CARGAS = (
    ("SEMANAL", re.compile(_NUMERO + _UNIDADE + _SEMANAL)),
    (
        "ROTULADA",
        re.compile(
            r"(?:carga\s+horaria|jornada(?:\s+de\s+trabalho)?)(?:\s+semanal)?\s*(?:de|:|=|-)?\s*"
            + _NUMERO
            + _UNIDADE
            + rf"(?!{_NAO_SEMANAL})(?P<diaria>{_DIARIA})?"
        ),
    ),
    ("PLANTAO", re.compile(r"plant(?:oes|ao)\s+(?:de\s+)?" + _NUMERO + _UNIDADE)),
)


@dataclass
class Carga:
    horas: int | None  # carga semanal (None no plantão)
    posicao: int  # onde o número está (para achar a mesma captura em dois vínculos)
    plantao: int | None = None  # "plantões de 12 horas"


def carga_declarada(dobrado, inicio=0, fim=None, perto_de=None):
    """A carga do trecho [inicio, fim) do texto DOBRADO: a mais perto de `perto_de` (a data do vínculo); None
    sem número ligado a "semanais"/"carga horária"/"jornada"/"plantões"."""
    fim = len(dobrado) if fim is None else fim
    achadas = []
    for tipo, padrao in _CARGAS:
        for m in padrao.finditer(dobrado, inicio, fim):
            horas = numero_por_extenso(m.group("extenso")) or int(m.group(1))
            if tipo == "PLANTAO":
                if 1 <= horas <= 48:
                    achadas.append(Carga(None, m.start(1), horas))
                continue
            if tipo == "ROTULADA" and m.group("diaria"):
                horas = horas * 5 if horas <= 12 else 0
            if 1 <= horas <= 80:
                achadas.append(Carga(horas, m.start(1)))
    if not achadas:
        return None
    alvo = inicio if perto_de is None else perto_de
    # A semanal de verdade ganha do plantão no mesmo trecho; entre iguais, a mais perto da data do vínculo.
    return min(achadas, key=lambda c: (c.horas is None, abs(c.posicao - alvo)))


# ── emissor ──────────────────────────────────────────────────────────────────

EMPRESA = re.compile(
    r"(?<![a-z])(prefeitura|secretaria|hospital|fundacao|instituto|ltda|s/a|s\.a\.?|eireli|associacao|clinica|"
    r"cooperativa|consorcio|governo|ministerio|universidade|faculdade|empresa|servicos?|saude|distrito sanitario|"
    r"dsei|unidade|centro|laboratorio|farmacia|escola|camara|municipio|estado de|organizacao|agencia|banco|caixa|"
    r"sesi|senai|sesc|senac|sest|senat|conselho|autarquia|policlinica|maternidade|santa casa|irmandade|"
    r"servico social|assistencia|ambulatorio|upa|sociedade|epp|comercio|industria)(?![a-z])"
)
_TITULO = re.compile(
    r"^(?:declaracao|declaracoes|atestado|certidao|contrato|termo|certificado|a quem|ao\s|aos\s|ilm|prezad|ref\b|"
    r"assunto|oficio|memorando|pagina|folha|declar|atest|certific|para os devidos|continua)"
)
_CONTATO = re.compile(
    r"(?<![a-z])(?:rua|avenida|av|rodovia|travessa|alameda|praca|quadra|qd|lote|bairro|cep|tel|telefone|fone|"
    r"fax|e-?mail|www|http|https|site|caixa postal|cnpj|cpf|km|n[ºo°]|sala|andar|conjunto)(?![a-z])"
)
_INSCRITA = re.compile(
    r"\s*,?\s*(?:pessoa\s+juridica\s+de\s+direito\s+\w+\s*,?\s*)?(?:devidamente\s+)?(?:inscrit|cadastrad)[oa]\s+no\s+"
    r"(?:cnpj|c\.n\.p\.j|cadastro\s+nacional)"
)
_CONTRATADO = re.compile(r"(?:contratad|admitid|empregad|lotad)[oa]\s+(?:pela|pelo|na|no|junto\s+(?:a|ao|à))\s+")
_TRABALHA_NA = re.compile(
    r"(?<![a-z])(?:exerce|exerceu|presta|prestou|trabalha|trabalhou|atua|atuou|labora|laborou)(?![a-z])"
    r"[^.;]{0,200}?(?<![a-z])(?:nesta|neste|na|no|junto\s+(?:a|ao|à))\s+"
)
_FIM_DO_NOME = re.compile(
    r"[,;.(\n]|\s(?:para|no\s+cargo|na\s+funcao|como|desde|em\s+\d|a\s+partir|sob|inscrit|cnpj|com\s|onde|"
    r"exerce|exerceu|no\s+periodo|de\s+\d|ate|durante|pelo\s+periodo|localizad|situad|sediad|declara)"
)
_GENERICO = re.compile(r"^(?:instituicao|empresa|entidade|unidade|organizacao|orgao|casa|cargo|funcao|setor)$")
_ARTIGO = re.compile(r"^(?:a|o|as|os)\s+")


@dataclass
class Emissor:
    nome: str | None
    cnpj: str | None
    fonte: str  # TEXTO | TIMBRE | CABECALHO | RODAPE | CNPJ

    @property
    def empregador(self):
        return self.nome or (f"CNPJ {self.cnpj}" if self.cnpj else None)

    def chave(self):
        return re.sub(r"[^a-z0-9]", "", dobrar(self.nome or "")) or (self.cnpj or "")


def _limpo(texto):
    t = numa_linha(texto).strip(" -–—|•·:;,.")
    return re.sub(r"\s+-\s*$", "", t)


MAXIMO_DO_NOME = 80
# Qualificadores no fim que não são o nome: "— Empresa Privada", ", pessoa jurídica de direito privado".
_QUALIFICADOR = re.compile(
    r"^(?:empresa\s+(?:privada|publica)|entidade\s+(?:privada|publica|sem\s+fins\s+lucrativos)|sem\s+fins\s+lucrativos"
    r"|pessoa\s+juridica.*|sociedade\s+de\s+economia\s+mista|direito\s+privado|direito\s+publico|matriz|filial"
    r"|unidade\s+(?:matriz|filial))$"
)
# Preâmbulo antes do nome: "nesta empresa, GR CLINICA" → "GR CLINICA".
_PREAMBULO = re.compile(
    r"^.*(?<![a-z])(?:nesta|neste|desta|deste|nessa|nesse)\s+(?:empresa|instituicao|entidade|unidade)\b"
)
_PARTICULAS = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "na", "no", "para", "sua", "seu", "ao"}
_SIMBOLOS_DE_LIXO = re.compile(r"[|\{}\[\]~_<>@#$%^*=+¦§¨]")
_VOGAIS = set("aeiouy")
# Palavras de nome de instituição (além das de EMPRESA): uma delas no nome mostra que não é lixo de OCR.
VOCABULARIO = {
    "assistencia", "funcionarios", "medica", "medico", "medicina", "trabalho", "regional", "municipal", "estadual",
    "federal", "nacional", "social", "industria", "brasil", "brasileira", "hospitalar", "odontologica",
    "departamento", "diretoria", "coordenacao", "geral", "publica", "privada", "integrada", "especializada",
    "especializados", "medicos", "atencao", "basica", "familia", "indigena", "especial", "diagnostico",
    "imagem", "exames", "ocupacional", "previdencia", "beneficencia", "misericordia", "evangelico", "catolica",
    "comercial", "nordeste", "norte", "sul", "leste", "oeste", "central", "metropolitana", "regiao",
}  # fmt: skip


def parece_lixo(nome):
    """O nome tem cara de lixo de OCR ("Cariaira cle |DX"): símbolo de moldura/logo, palavra de 3+ letras sem
    vogal, palavrinha minúscula que não é partícula, ou nenhuma palavra conhecida num nome curto em caixa mista."""
    if _SIMBOLOS_DE_LIXO.search(nome):
        return True
    palavras = re.findall(r"[A-Za-zÀ-ÿ]+", nome)
    dobradas = [dobrar(p) for p in palavras]
    for p, d in zip(palavras, dobradas, strict=True):
        if len(d) >= 3 and not (set(d) & _VOGAIS):
            return True
        if 2 <= len(d) <= 3 and p.islower() and d not in _PARTICULAS:
            return True
    conhecidas = [d for d in dobradas if d in VOCABULARIO or EMPRESA.fullmatch(d)]
    longas = [d for d in dobradas if len(d) >= 4]
    return not conhecidas and not nome.isupper() and len(longas) < 3


def limpar_nome(texto):
    """O nome sem o que não é nome: o pedaço de frase antes ("serviço em …, nesta empresa, GR CLINICA" → "GR
    CLINICA"), o artigo ("O Serviço Social" → "Serviço Social"), o CNPJ e o qualificador no fim ("— Empresa
    Privada"), com até MAXIMO_DO_NOME caracteres (corta pelos pedaços do fim, senão pela palavra)."""
    t = _limpo(texto or "")
    corte = re.search(r"(?i)\s*[-–—,]?\s*(?:c\.?\s?n\.?\s?p\.?\s?j|inscrit[oa]\s+no)", t)
    if corte and corte.start() > 0:
        t = t[: corte.start()]
    d = dobrar(t)
    preambulo = _PREAMBULO.match(d)
    if preambulo and preambulo.end() < len(t):
        t = t[preambulo.end() :].lstrip(" ,;:-–—")
    # Pedaços separados por vírgula/travessão: fora os do começo em minúscula (frase) e os qualificadores do fim.
    pedacos = [p.strip() for p in re.split(r"\s*(?:,|\s[-–—]\s|—|–)\s*", t) if p.strip()]
    separadores = re.findall(r"\s*(?:,|\s[-–—]\s|—|–)\s*", t)
    if not pedacos:
        return ""
    comeco = 0
    while comeco < len(pedacos) - 1 and pedacos[comeco][:1].islower():
        comeco += 1
    fim = len(pedacos)
    while fim - 1 > comeco and _QUALIFICADOR.match(dobrar(pedacos[fim - 1])):
        fim -= 1
    while fim - 1 > comeco and len(_juntar(pedacos, separadores, comeco, fim)) > MAXIMO_DO_NOME:
        fim -= 1
    t = _juntar(pedacos, separadores, comeco, fim)
    t = re.sub(r"(?i)^(?:a|o|as|os)\s+(?=[A-ZÀ-Ý])", "", t)
    if len(t) > MAXIMO_DO_NOME:
        t = t[:MAXIMO_DO_NOME].rsplit(" ", 1)[0]
    return _limpo(t)


def _juntar(pedacos, separadores, comeco, fim):
    saida = pedacos[comeco]
    for k in range(comeco + 1, fim):
        separador = separadores[k - 1] if k - 1 < len(separadores) else ", "
        saida += ", " if "," in separador else " — "
        saida += pedacos[k]
    return saida


def nome_de_instituicao(texto, exige_empresa=False):
    """O texto como nome de instituição, limpo (`limpar_nome`), sem título, endereço, contato, data nem cara de
    lixo de OCR (`parece_lixo`), ou None."""
    bruto = _limpo(texto)
    if len(bruto) < 3 or len(bruto) > 240 or _TITULO.match(dobrar(bruto)):
        return None
    t = limpar_nome(bruto)
    d = dobrar(t)
    if len(t) < 3 or _TITULO.match(d) or _CONTATO.search(d):
        return None
    if re.search(r"\d{1,2}\s?[/.]\s?\d{1,2}\s?[/.]\s?\d{2,4}|\d{3}\.\d{3}", d):
        return None
    sem_espaco = re.sub(r"[\s\-–—.,/&]", "", t)
    if not sem_espaco or sum(c.isalpha() for c in sem_espaco) < 0.75 * len(sem_espaco):
        return None
    palavras = re.findall(r"[A-Za-zÀ-ÿ]{2,}", t)
    if not palavras or (len(palavras) == 1 and not (t.isupper() and len(palavras[0]) >= 3)):
        return None
    if parece_lixo(t) or (exige_empresa and not EMPRESA.search(d)):
        return None
    return t


def _cnpj_rotulado(original, dobrado, inicio=0, fim=None):
    """(CNPJ validado, posição) do primeiro "CNPJ <número>" do trecho; (None, -1) sem ele."""
    fim = len(dobrado) if fim is None else fim
    for m in re.finditer(r"c\.?\s?n\.?\s?p\.?\s?j", dobrado[inicio:fim]):
        comeco = inicio + m.end()
        cnpj, a, _ = cnpj_no_texto(original[comeco : comeco + 45])
        if cnpj:
            return cnpj, comeco + a
    return None, -1


def _nome_antes_de_inscrita(original, dobrado):
    for m in _INSCRITA.finditer(dobrado):
        comeco = max(0, m.start() - 180)
        antes = original[comeco : m.start()]
        corte = max(antes.rfind("."), antes.rfind(";"), antes.rfind(":"))
        # "Ltda." e "S.A." não fecham a frase.
        while corte > 0 and re.search(r"(?i)(?:ltda|s\.a|s/a|me|epp|n[ºo°])$", antes[:corte]):
            corte = max(antes.rfind(".", 0, corte), antes.rfind(";", 0, corte))
        antes = antes[corte + 1 :]
        # As linhas do nome, de baixo para cima, até um título ("DECLARAÇÃO") ou sujeira do OCR (logo).
        linhas = []
        for linha in reversed([x.strip() for x in antes.split("\n") if x.strip()]):
            if _TITULO.match(dobrar(linha)) or sum(c.isalpha() for c in linha) < 0.5 * len(linha):
                break
            linhas.insert(0, linha)
        trecho_ = " ".join(linhas)
        d = dobrar(trecho_)
        k = d.rfind(" que ")
        if k >= 0:
            trecho_, d = trecho_[k + 5 :], d[k + 5 :]
        a = _ARTIGO.match(d.strip())
        trecho_ = trecho_.strip()[a.end() :] if a else trecho_.strip()
        trecho_ = re.sub(r"(?i)^(?:empresa|entidade|institui[cç][aã]o)\s+", "", trecho_)
        nome = nome_de_instituicao(trecho_)
        if nome:
            cnpj, _ = _cnpj_rotulado(original, dobrado, m.start(), m.end() + 60)
            return Emissor(nome, cnpj, "TEXTO")
    return None


def _nome_depois(original, dobrado, padrao, exige_empresa):
    plano = dobrado.replace("\n", " ")
    for m in padrao.finditer(plano):
        resto = plano[m.end() : m.end() + 160]
        corte = _FIM_DO_NOME.search(resto)
        bruto = original[m.end() : m.end() + (corte.start() if corte else len(resto))]
        if not bruto[:1].isupper():
            continue
        nome = nome_de_instituicao(bruto, exige_empresa)
        if nome and not _GENERICO.match(dobrar(nome)):
            return nome
    return None


def _do_texto(original, dobrado):
    """O emissor dito no texto: "A X, inscrita no CNPJ…" ou "contratada pela X" / "trabalha no Hospital X"."""
    inscrita = _nome_antes_de_inscrita(original, dobrado)
    if inscrita:
        return inscrita, None
    nome = _nome_depois(original, dobrado, _CONTRATADO, False) or _nome_depois(original, dobrado, _TRABALHA_NA, True)
    return None, (Emissor(nome, None, "TEXTO") if nome else None)


def _dimensoes(pagina, linhas):
    tamanho = getattr(pagina, "tamanho", None)
    if tamanho:
        return float(tamanho[0]), float(tamanho[1])
    x0 = min(c.x0 for linha in linhas for c in linha.celulas)
    x1 = max(c.x1 for linha in linhas for c in linha.celulas)
    return x1 + x0, max(linha.base for linha in linhas) + min(linha.topo for linha in linhas)


def timbre(pagina):
    """O nome no timbre da página pela posição das palavras: no primeiro quinto da página, a linha de fonte maior
    (1,2 × a mediana) ou centralizada que tem cara de nome de instituição (com a seguinte, se continuar o nome)."""
    palavras = getattr(pagina, "palavras", None)
    if not palavras:
        return None
    linhas = linhas_das_palavras(palavras)
    if not linhas:
        return None
    largura, altura = _dimensoes(pagina, linhas)
    alturas = sorted(linha.altura for linha in linhas)
    mediana = alturas[len(alturas) // 2]
    limite = altura * 0.2

    def avaliar(linha):
        x0, x1 = min(c.x0 for c in linha.celulas), max(c.x1 for c in linha.celulas)
        grande = linha.altura >= mediana * 1.2
        centrada = abs((x0 + x1) / 2 - largura / 2) <= largura * 0.07 and (x1 - x0) < largura * 0.9
        return grande, centrada

    candidatas = []
    for k, linha in enumerate(linhas):
        if linha.topo > limite:
            break
        grande, centrada = avaliar(linha)
        nome = nome_de_instituicao(linha.texto) if (grande or centrada) else None
        if nome:
            pontos = 2 * grande + centrada + bool(EMPRESA.search(dobrar(nome)))
            candidatas.append((-pontos, k, nome))
    if not candidatas:
        return None
    _, k, nome = min(candidatas)
    if k + 1 < len(linhas):
        seguinte = linhas[k + 1]
        g, c = avaliar(seguinte)
        continua = nome_de_instituicao(seguinte.texto) if (g or c) and seguinte.topo <= limite else None
        perto = seguinte.topo - linhas[k].base <= linhas[k].altura * 1.2
        mesma = abs(seguinte.altura - linhas[k].altura) <= linhas[k].altura * 0.2
        if continua and perto and mesma and nome.isupper() and continua.isupper() and len(nome) + len(continua) < 140:
            nome = f"{nome} {continua}"
    return nome


def _cabecalho_do_texto(original):
    """Sem posição: a primeira das 8 primeiras linhas com cara de instituição (Prefeitura, Hospital, Ltda…)."""
    for linha in [x for x in original.split("\n") if x.strip()][:8]:
        # "CERTIDÃO DE TEMPO DE SERVIÇO - Fundação Exemplo": o título e o emissor na mesma linha.
        for parte in [linha, *re.split(r"\s+[-–—|]\s+", linha)[1:]]:
            nome = nome_de_instituicao(parte, exige_empresa=True)
            if nome:
                return nome
    return None


def _rodape(original, dobrado):
    """(nome, CNPJ) do fim da página: a linha do CNPJ (o nome antes dele ou na linha de cima)."""
    linhas = original.split("\n")
    fim = [k for k, x in enumerate(linhas) if x.strip()][-6:]
    for k in reversed(fim):
        linha = linhas[k]
        d = dobrar(linha)
        cnpj, _ = _cnpj_rotulado(linha, d)
        if not cnpj:
            continue
        rotulo = re.search(r"c\.?\s?n\.?\s?p\.?\s?j", d)
        nome = nome_de_instituicao(linha[: rotulo.start()]) if rotulo else None
        if not nome and k > 0:
            nome = nome_de_instituicao(linhas[k - 1], exige_empresa=True)
        return nome, cnpj
    return None, None


def emissor_da_pagina(pagina):
    """O emissor que a página diz (sem herdar de outra), ou None."""
    original = pagina.texto or ""
    dobrado = dobrar(original)
    inscrita, frase = _do_texto(original, dobrado)
    if inscrita:
        return inscrita
    cnpj, _ = _cnpj_rotulado(original, dobrado)
    nome_rodape, cnpj_rodape = _rodape(original, dobrado)
    nome = timbre(pagina)
    if nome:
        return Emissor(nome, cnpj_rodape or cnpj, "TIMBRE")
    if frase:
        frase.cnpj = cnpj_rodape or cnpj
        return frase
    nome = _cabecalho_do_texto(original)
    if nome:
        return Emissor(nome, cnpj_rodape or cnpj, "CABECALHO")
    if nome_rodape:
        return Emissor(nome_rodape, cnpj_rodape, "RODAPE")
    if cnpj_rodape or cnpj:
        return Emissor(None, cnpj_rodape or cnpj, "CNPJ")
    return None


_ABRE_DECLARACAO = re.compile(
    r"^(?:declaracao|atestado|certidao|declaro|declaramos|atesto|atestamos|certifico|certificamos|"
    r"contrato\s+(?:individual\s+)?de|termo\s+de)"
)


def _abre_declaracao(original):
    return any(_ABRE_DECLARACAO.match(dobrar(x.strip())) for x in [y for y in original.split("\n") if y.strip()][:12])


@dataclass
class Secao:
    paginas: list
    emissor: Emissor | None


def secoes(paginas):
    """As páginas agrupadas por declaração: abre seção a página com emissor diferente do da seção corrente ou
    com título/abertura de declaração; a página sem nada disso continua a anterior."""
    saida = []
    for p in paginas:
        emissor = emissor_da_pagina(p)
        abre = _abre_declaracao(p.texto or "")
        atual = saida[-1] if saida else None
        if atual is None:
            saida.append(Secao([p], emissor))
            continue
        outro = emissor is not None and (atual.emissor is None or emissor.chave() != atual.emissor.chave())
        if outro or abre:
            saida.append(Secao([p], emissor))
            continue
        atual.paginas.append(p)
        if atual.emissor is None:
            atual.emissor = emissor
        elif emissor and not atual.emissor.cnpj:
            atual.emissor.cnpj = emissor.cnpj
    _nome_pelo_cnpj(saida)
    return saida


def _raiz(cnpj):
    return re.sub(r"[^0-9A-Za-z]", "", cnpj or "").upper()[:8]


def _nome_pelo_cnpj(secoes_):
    """A seção que só tem o CNPJ (timbre ilegível) fica com a razão social de outra seção do arquivo com o CNPJ
    da mesma raiz (matriz e filiais)."""
    nomes = {_raiz(s.emissor.cnpj): s.emissor.nome for s in secoes_ if s.emissor and s.emissor.nome and s.emissor.cnpj}
    for s in secoes_:
        if s.emissor and not s.emissor.nome and _raiz(s.emissor.cnpj) in nomes:
            s.emissor.nome = nomes[_raiz(s.emissor.cnpj)]


# ── emissão ──────────────────────────────────────────────────────────────────

_LOCAL = re.compile(r"\s*[a-z][a-z .'’\-]{1,48}?(?:\s*[-/(]\s*[a-z]{2}\)?)?\s*,\s*(?:em\s+|aos\s+|no\s+dia\s+)?")


def local_e_data(dobrado, datas):
    """A Data do "Cidade, 10 de outubro de 2026" (a última da seção) ou a data sozinha na própria linha no fim;
    None sem ela."""
    completas = [d for d in datas if d.dia]
    for d in reversed(completas):
        comeco = dobrado.rfind("\n", 0, d.inicio) + 1
        antes = dobrado[comeco : d.inicio]
        fim_da_linha = dobrado.find("\n", d.fim)
        depois = dobrado[d.fim : len(dobrado) if fim_da_linha < 0 else fim_da_linha]
        if _LOCAL.fullmatch(antes) and not re.search(r"[a-z]{3}", depois.replace("de", "")):
            return d
    if completas:
        d = completas[-1]
        comeco = dobrado.rfind("\n", 0, d.inicio) + 1
        fim_da_linha = dobrado.find("\n", d.fim)
        linha = dobrado[comeco : len(dobrado) if fim_da_linha < 0 else fim_da_linha]
        if linha.strip() == dobrado[d.inicio : d.fim].strip() and d.inicio > len(dobrado) * 0.5:
            return d
    return None
