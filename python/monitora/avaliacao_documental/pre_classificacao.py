"""
Pré-classificação de uma vaga: a Lista Geral de Classificação Provisória por
ART (item 8.3.1) e o lote de convocação (item 8.4).

Esta é a conta OFICIAL, em lote: o job scripts/pre_classificacao/ roda aqui
e grava o resultado pronto em TB_PRE_CLASSIFICACAO pelas RPCs. A cópia em
JavaScript (src/lib/avaliacao-documental/pre-classificacao.js) serve à prévia
da tela; as duas são conferidas pelos MESMOS casos dourados
(tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json). Mudou
aqui, muda lá — as regras estão descritas no cabeçalho do arquivo JS e em
docs/aya/regras-da-avaliacao-documental.md.

Nada aqui imprime ou devolve dado pessoal além do que entra: a saída tem o id
e o código do candidato, notas, posições e motivos.
"""

import math
import re
import unicodedata
from datetime import date
from functools import cmp_to_key

from monitora.avaliacao_documental.nota_declarada import (
    calcular_nota_declarada,
    chave_da_opcao,
    coluna_da_pergunta,
    diverge_da_art,
    ler_art,
    normalizar_texto,
    pergunta_ambigua,
    texto_da_resposta,
)

PREFIXO_DA_ART = "NOTA - "
PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA = "PERGUNTA_AMBIGUA:"
PREFIXO_DO_AVISO_DE_SEM_NIVEL = "SEM_NIVEL:"
NIVEIS = ("superior", "tecnico", "medio", "fundamental")
SAIU_DA_EMPREGARE = {"codigo": "SAIU_DA_EMPREGARE", "motivo": "Saiu do arquivo da Empregare"}
ENTRADA_POR_DECISAO = "DECISAO"
DESEMPATE_PADRAO = ["IDOSO", "CANDIDATURA"]
BASES_DA_NOTA = ("DECLARADA", "ART")
LOTE_PADRAO = {
    "base": "MULTIPLO_VAGAS",
    "multiplo": 3,
    "fixo": None,
    "inclui_cr": True,
    "por_modalidade": False,
    "inclui_empatados": True,
    "linha_anda": True,
    "publica_reposicao": False,
}
_DATA = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
_NUMERO_DO_QUADRO = re.compile(r"^\d+(\.\d+)?$")
_NO_LOTE = {"NO_LOTE", "ANALISADO"}
_ANOS_E_MESES = re.compile(r"([0-9]+) anos? e ([0-9]+) mes(es)?\b")
_NIVEL_ESCRITO = re.compile(r"\bnivel (superior|tecnico|medio|fundamental)\b")
_COMECA_COM_TECNICO = re.compile(r"^tecnic[oa]\b")
_MARCAS = re.compile("[̀-ͯ]")


def _objeto(v):
    return v if isinstance(v, dict) else {}


def _lista(v):
    return v if isinstance(v, list) else []


def _numero_js(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def normalizar_pergunta(valor):
    """A pergunta da regra: texto ou lista de alternativas (normalizarPergunta do JS). Sem texto, None."""
    if isinstance(valor, list):
        textos = [t.strip() for t in valor if isinstance(t, str) and t.strip()]
        return textos or None
    return valor.strip() or None if isinstance(valor, str) else None


def base_da_nota(provisoria):
    """
    A base da nota do lote (baseDaNota do JS): a da regra ou, sem ela, DECLARADA
    quando há nota declarada configurada (senão ART). Valor desconhecido fica
    como está, para a validação recusar.
    """
    p = _objeto(provisoria)
    if p.get("base_da_nota") is not None:
        return p["base_da_nota"]
    return "DECLARADA" if _lista(p.get("nota_declarada")) else "ART"


def erros_da_base_da_nota(provisoria):
    """Os erros da base da nota do lote (as mesmas mensagens de validarRegraAnalise e do banco)."""
    p = _objeto(provisoria)
    base = p.get("base_da_nota")
    if base is None:
        return []
    if base not in BASES_DA_NOTA:
        return ["Base da nota do lote: DECLARADA ou ART."]
    if base == "DECLARADA" and not _lista(p.get("nota_declarada")):
        return ["Base da nota do lote pela declarada: configure a nota declarada."]
    return []


def normalizar_regra(entrada):
    """
    A parte da regra (normalizarRegraAnalise do JS) que a pré-classificação usa.
    Base da nota inválida levanta ValueError (o edital falha com a mensagem).
    """
    r = _objeto(entrada)
    provisoria = _objeto(r.get("provisoria"))
    erros = erros_da_base_da_nota(provisoria)
    if erros:
        raise ValueError(erros[0])
    tolerancia = provisoria.get("divergencia_tolerancia")
    return {
        "provisoria": {
            "eliminacao_automatica": _lista(provisoria.get("eliminacao_automatica")),
            "nota_declarada": _lista(provisoria.get("nota_declarada")),
            "divergencia_tolerancia": tolerancia if _numero_js(tolerancia) and 0 <= tolerancia <= 30 else 0,
            "desempate": provisoria["desempate"]
            if isinstance(provisoria.get("desempate"), list)
            else list(DESEMPATE_PADRAO),
            "pergunta_experiencia": normalizar_pergunta(provisoria.get("pergunta_experiencia")),
            "base_da_nota": base_da_nota(provisoria),
        },
        "lote": {**LOTE_PADRAO, **_objeto(r.get("lote"))},
        "blocos": _lista(r.get("blocos")),
    }


def _sem_acento(valor):
    """semAcento da Classificação: sem acento e minúsculo."""
    return _MARCAS.sub("", unicodedata.normalize("NFD", "" if valor is None else str(valor))).lower()


def nivel_no_nome_do_cargo(cargo):
    """O nível escrito no cargo ("(Nível Superior)") ou o cargo que começa com "Técnico"; None se não diz."""
    c = re.sub(r"\s+", " ", _sem_acento(cargo)).strip()
    escrito = _NIVEL_ESCRITO.search(c)
    if escrito:
        return escrito.group(1)
    return "tecnico" if _COMECA_COM_TECNICO.search(c) else None


def nivel_da_vaga(cargo, documental=None):
    """
    O nível da vaga (nivelDaVaga de src/lib/classificacao/vagas.js, sem a
    categoria): niveis_por_cargo da regra de classificação (o cargo COMEÇA com
    o termo), o nível escrito no nome do cargo e o nível padrão da regra.
    """
    doc = _objeto(documental)
    c = _sem_acento(cargo)
    for n in _lista(doc.get("niveis_por_cargo")):
        n = _objeto(n)
        termo = str(n.get("termo") if n.get("termo") is not None else "").strip()
        nivel = n.get("nivel")
        if termo and nivel in NIVEIS and c.strip().startswith(_sem_acento(termo).strip()):
            return nivel
    do_nome = nivel_no_nome_do_cargo(cargo)
    if do_nome:
        return do_nome
    padrao = doc.get("nivel_padrao")
    return padrao if padrao in NIVEIS else None


def numero_no_texto(n):
    """ "24" ou "24,5": o número como a lista publica (String(n) do JS)."""
    if n is None:
        return ""
    if float(n).is_integer():
        return str(int(n))
    return repr(float(n)).replace(".", ",")


def codigos_da_modalidade(texto):
    """Os códigos de modalidade de um texto (codigosDaModalidade da Classificação)."""
    t = normalizar_texto(texto)
    if not t:
        return []
    codigos = []
    if re.search(r"ampla|\bac\b", t):
        codigos.append("AC")
    if re.search(r"defici|\bpcd\b|\bpne\b", t):
        codigos.append("PCD")
    if re.search(r"pret|pard|\bpp\b|negr", t):
        codigos.append("PP")
    if re.search(r"indigen|\bpi\b", t):
        codigos.append("PI")
    if re.search(r"quilomb|\bpq\b", t):
        codigos.append("PQ")
    if re.search(r"\btrans\b|transgener|travesti", t):
        codigos.append("TRANS")
    return codigos


def fim_das_inscricoes(cronograma):
    """
    "AAAA-MM-DD" do fim das inscrições no cronograma do edital
    (dataDeCorteDoCronograma do JS): a etapa de inscrição (sem resultado,
    recurso, homologação, deferimento ou validação no nome — "Validação das
    inscrições" é a etapa seguinte, dos Projetos); com prorrogação, o fim mais
    tarde; sem fim, o início. None sem etapa de inscrição.
    """
    return janela_das_inscricoes(cronograma)[1]


def etapas_de_inscricao(cronograma):
    """As etapas de inscrição do cronograma (etapasDeInscricao do JS)."""
    etapas = []
    for etapa in _lista(cronograma):
        etapa = _objeto(etapa)
        nome = _sem_acento(etapa.get("atividade"))
        if re.search(r"inscri", nome) and not re.search(r"resultado|recurso|homolog|deferid|valida", nome):
            etapas.append(etapa)
    return etapas


def janela_das_inscricoes(cronograma):
    """("AAAA-MM-DD" do início, do fim) das inscrições: o início mais cedo e o fim mais tarde (sem fim, o início)."""
    inicio = fim = None
    for etapa in etapas_de_inscricao(cronograma):
        comeco = str(etapa.get("inicio"))[:10] if _data_valida(etapa.get("inicio")) else None
        termino = next((str(etapa.get(k))[:10] for k in ("fim", "inicio") if _data_valida(etapa.get(k))), None)
        if comeco and (inicio is None or comeco < inicio):
            inicio = comeco
        if termino and (fim is None or termino > fim):
            fim = termino
    return inicio, fim


def _data_valida(valor):
    m = _DATA.match(str(valor if valor is not None else "").strip())
    if not m:
        return False
    try:
        date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return False
    return True


def congela_a_declarada(hoje, fim):
    """Esta pré-classificação congela a nota declarada? Depois do fim das inscrições (hoje > fim) ou sem data de fim."""
    if not fim:
        return True
    dia = _DATA.match(str(hoje or ""))
    return bool(dia) and dia.group(0) > fim


def declarada_congelada(valor):
    """A declarada congelada lida do anterior ({total, parciais, sem_mapa, respostas}), ou None."""
    if not isinstance(valor, dict) or not _numero_js(valor.get("total")):
        return None
    sem_mapa = valor.get("sem_mapa")
    return {
        "total": valor["total"],
        "parciais": valor["parciais"] if isinstance(valor.get("parciais"), dict) else {},
        "sem_mapa": sem_mapa if isinstance(sem_mapa, int) and not isinstance(sem_mapa, bool) else 0,
        "respostas": _lista(valor.get("respostas")),
    }


def _retrato_da_declarada(declarada):
    """O que se guarda ao congelar a declarada: o total, as parciais e as respostas usadas."""
    return {
        "total": declarada["total"],
        "parciais": declarada["parciais"],
        "sem_mapa": declarada["sem_mapa"],
        "respostas": [
            {"parcial": i["parcial"], "coluna": i["coluna"], "resposta": i["resposta"], "pontos": i["pontos"]}
            for i in declarada["itens"]
            if i["coluna"]
        ],
    }


def art_das_colunas(colunas):
    """A ART: a primeira coluna "NOTA - …" com número."""
    prefixo = normalizar_texto(PREFIXO_DA_ART)
    for coluna, valor in (colunas or {}).items():
        if not normalizar_texto(coluna).startswith(prefixo):
            continue
        art = ler_art(valor)
        if art is not None:
            return art
    return None


def _colunas_da_fonte(regra_de_eliminacao, colunas):
    nomes = list(colunas or {})
    if regra_de_eliminacao.get("coluna"):
        alvo = normalizar_texto(regra_de_eliminacao["coluna"])
        return [n for n in nomes if normalizar_texto(n) == alvo]
    if regra_de_eliminacao.get("coluna_prefixo"):
        alvo = normalizar_texto(regra_de_eliminacao["coluna_prefixo"])
        return [n for n in nomes if normalizar_texto(n).startswith(alvo)]
    # Pergunta ambígua: None (nem ausente nem lida; o aviso é PERGUNTA_AMBIGUA).
    if pergunta_ambigua(colunas, regra_de_eliminacao.get("pergunta")):
        return None
    coluna = coluna_da_pergunta(colunas, regra_de_eliminacao.get("pergunta"))
    return [coluna] if coluna else []


def perguntas_ambiguas(regra, colunas, pergunta_da_experiencia=None):
    """
    As perguntas da regra que casam com mais de uma coluna do candidato, como
    os códigos dos avisos da vaga (perguntasAmbiguas do JS):
    PERGUNTA_AMBIGUA:<código da eliminação>, PERGUNTA_AMBIGUA:NOTA_<parcial>,
    PERGUNTA_AMBIGUA:MODALIDADE e PERGUNTA_AMBIGUA:EXPERIENCIA_DECLARADA.
    """
    provisoria = (regra or {}).get("provisoria") or {}
    bloco = next((b for b in _lista((regra or {}).get("blocos")) if _objeto(b).get("codigo") == "MODALIDADE"), None)
    perguntas_do_bloco = _lista(_objeto(bloco).get("perguntas"))
    fontes = [
        (_objeto(e).get("codigo"), _objeto(e).get("pergunta"))
        for e in _lista(provisoria.get("eliminacao_automatica"))
        if not _objeto(e).get("coluna") and not _objeto(e).get("coluna_prefixo")
    ]
    fontes += [
        (f"NOTA_{_objeto(i).get('parcial') or ''}", _objeto(i).get("pergunta"))
        for i in _lista(provisoria.get("nota_declarada"))
    ]
    fontes.append(("MODALIDADE", perguntas_do_bloco[0] if perguntas_do_bloco else None))
    fontes.append(("EXPERIENCIA_DECLARADA", pergunta_da_experiencia))
    return [
        f"{PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA}{codigo}"
        for codigo, pergunta in fontes
        if pergunta and pergunta_ambigua(colunas, pergunta)
    ]


def eliminacao_do_candidato(regra, colunas):
    """({codigo, motivo} | None, [códigos das regras sem a coluna no arquivo])."""
    ausentes = []
    for e in _lista(((regra or {}).get("provisoria") or {}).get("eliminacao_automatica")):
        nomes = _colunas_da_fonte(e, colunas)
        if nomes is None:
            continue
        if not nomes:
            ausentes.append(e.get("codigo"))
            continue
        quando = [chave_da_opcao(v) for v in _lista(e.get("quando"))]
        exceto = [chave_da_opcao(v) for v in _lista(e.get("exceto"))]
        for nome in nomes:
            valor = chave_da_opcao(colunas.get(nome))
            if (quando and valor in quando) or (exceto and valor not in exceto):
                return {"codigo": e.get("codigo"), "motivo": e.get("motivo")}, ausentes
    return None, ausentes


def modalidade_do_candidato(regra, colunas):
    """A modalidade declarada (bloco MODALIDADE da regra): "PP", "PCD"… ou "AC"."""
    bloco = next((b for b in _lista((regra or {}).get("blocos")) if _objeto(b).get("codigo") == "MODALIDADE"), None)
    perguntas = _lista(_objeto(bloco).get("perguntas"))
    coluna = coluna_da_pergunta(colunas, perguntas[0]) if perguntas else None
    if not coluna:
        return "AC"
    return next((c for c in codigos_da_modalidade(colunas.get(coluna)) if c != "AC"), "AC")


def _numero_do_quadro(valor):
    if _numero_js(valor):
        return valor
    texto = ("" if valor is None else str(valor)).strip().replace(",", ".", 1)
    return float(texto) if _NUMERO_DO_QUADRO.match(texto) else None


def vagas_por_modalidade(modalidades):
    """{"Ampla Concorrência": 2, "PcD": 1} → {"AC": 2, "PCD": 1}; None = sem divisão."""
    if not isinstance(modalidades, dict):
        return None
    saida = {}
    explicitas = False
    for nome, valor in modalidades.items():
        codigos = codigos_da_modalidade(nome)
        if not codigos:
            continue
        n = _numero_do_quadro(valor)
        if n is not None:
            explicitas = True
        saida[codigos[0]] = saida.get(codigos[0], 0) + (n or 0)
    return saida if explicitas else None


def _vezes(multiplo, n):
    return math.ceil(multiplo * n - 1e-9)


def meses_declarados(valor):
    """
    Os meses de experiência de uma resposta da Empregare ("De 1 a 2 anos" → 12,
    "Mais de 5 anos" → 60, "6 meses obrigatórios" → 6, '"1 ano e 6 meses"' → 18,
    "4 anos e 2 meses" → 50, "Não possuo" → 0): o limite de baixo da faixa; None
    quando não dá para ler ("--"; mesmo que mesesDeclarados do JS).
    """
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return valor if math.isfinite(valor) else None
    texto = normalizar_texto(texto_da_resposta(valor))
    if not texto:
        return None
    anos_e_meses = _ANOS_E_MESES.search(texto)
    if anos_e_meses:
        return int(anos_e_meses.group(1)) * 12 + int(anos_e_meses.group(2))
    numero = re.search(r"(\d+(?:[.,]\d+)?)", texto)
    if not numero:
        return 0 if re.search(r"\b(sem|nenhum|nenhuma|nao possuo|nao tenho)\b", texto) else None
    n = float(numero.group(1).replace(",", "."))
    if n.is_integer():
        n = int(n)
    unidade = re.search(r"(ano|mes)", texto[numero.end() :])
    return n * 12 if unidade and unidade.group(1) == "ano" else n


def tamanho_do_lote(lote, vaga):
    """{tamanho (None = sem como calcular), descricao, por_modalidade, aviso}."""
    lote = lote or {}
    vaga = vaga or {}
    definido = _objeto(lote.get("por_vaga")).get(str(vaga.get("codigo") or ""))
    if isinstance(definido, int) and not isinstance(definido, bool) and definido >= 1:
        return {
            "tamanho": definido,
            "descricao": f"{definido} (definido para a vaga)",
            "por_modalidade": None,
            "aviso": None,
        }
    if lote.get("base") == "FIXO":
        fixo = lote.get("fixo")
        return {
            "tamanho": fixo,
            "descricao": f"{numero_no_texto(fixo)} (número fixo)",
            "por_modalidade": None,
            "aviso": None,
        }
    if lote.get("base") == "NOTA_MINIMA":
        minimo = lote.get("nota_minima")
        if not _numero_js(minimo):
            return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_NOTA_MINIMA"}
        item = lote.get("item_edital")
        # O tamanho depende das notas: pre_classificar_vaga conta quem tem a nota mínima.
        return {
            "tamanho": None,
            "descricao": f"nota ≥ {numero_no_texto(minimo)}" + (f" (item {item})" if item else ""),
            "por_modalidade": None,
            "aviso": None,
            "nota_minima": minimo,
        }
    imediatas = vaga.get("vagas_imediatas")
    if imediatas is None:
        return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_QUADRO"}
    cr = 1 if lote.get("inclui_cr") and vaga.get("cadastro_reserva") else 0
    base = imediatas + cr
    if base <= 0:
        return {"tamanho": None, "descricao": "", "por_modalidade": None, "aviso": "SEM_VAGAS"}
    multiplo = lote.get("multiplo") if lote.get("multiplo") is not None else 1
    tamanho = _vezes(multiplo, base)
    m = numero_no_texto(multiplo)
    descricao = f"{m} × ({imediatas} + CR) = {tamanho}" if cr else f"{m} × {imediatas} = {tamanho}"
    if not lote.get("por_modalidade"):
        return {"tamanho": tamanho, "descricao": descricao, "por_modalidade": None, "aviso": None}
    por_modalidade = vagas_por_modalidade(vaga.get("modalidades"))
    if not por_modalidade:
        return {"tamanho": tamanho, "descricao": descricao, "por_modalidade": None, "aviso": "QUADRO_SEM_MODALIDADES"}
    tamanhos = {"AC": _vezes(multiplo, por_modalidade.get("AC", 0) + cr)}
    for codigo, n in por_modalidade.items():
        if codigo != "AC" and n > 0:
            tamanhos[codigo] = _vezes(multiplo, n)
    total = sum(tamanhos.values())
    return {
        "tamanho": total,
        "descricao": f"{re.sub(r' = [0-9]+$', '', descricao)} por modalidade = {total}",
        "por_modalidade": tamanhos,
        "aviso": None,
    }


def idade_em(nascimento, hoje):
    """Anos completos entre o nascimento e hoje ("AAAA-MM-DD"); None sem data."""
    n = _DATA.match(str(nascimento or ""))
    h = _DATA.match(str(hoje or ""))
    if not n or not h:
        return None
    ny, nm, nd = (int(x) for x in n.groups())
    hy, hm, hd = (int(x) for x in h.groups())
    return hy - ny - (1 if (hm < nm or (hm == nm and hd < nd)) else 0)


def _compara(a, b):
    return -1 if a < b else 1 if a > b else 0


def _nulos_por_ultimo(a, b, comparar):
    if a is None and b is None:
        return 0
    if a is None:
        return 1
    if b is None:
        return -1
    return comparar(a, b)


def _chave_de_ordem(desempate, hoje):
    def idoso(linha):
        idade = idade_em(linha["_nascimento"], hoje)
        return idade is not None and idade >= 60

    def comparar(a, b):
        r = _nulos_por_ultimo(a["nota"], b["nota"], lambda x, y: _compara(y, x))
        if r:
            return r
        for d in desempate:
            if d == "IDOSO":
                ia, ib = idoso(a), idoso(b)
                if ia != ib:
                    return -1 if ia else 1
                if ia:
                    r = _compara(a["_nascimento"], b["_nascimento"])
            elif d == "EXPERIENCIA_DECLARADA":
                r = _nulos_por_ultimo(a["_experiencia"], b["_experiencia"], lambda x, y: _compara(y, x))
            elif d in ("MAIS_VELHO", "MAIOR_IDADE"):
                r = _nulos_por_ultimo(a["_nascimento"], b["_nascimento"], _compara)
            elif d == "CANDIDATURA":
                r = _nulos_por_ultimo(a["_candidatura"], b["_candidatura"], _compara)
            if r:
                return r
        return _compara(a["codigo"], b["codigo"]) or _compara(a["id"], b["id"])

    return cmp_to_key(comparar)


def motivo_da_decisao(decisoes, id_):
    """O motivo da decisão vigente da coordenação para o candidato ({id: {motivo}}), ou None (motivoDaDecisao do JS)."""
    motivo = _objeto(_objeto(decisoes).get(id_)).get("motivo")
    return motivo.strip() if isinstance(motivo, str) and motivo.strip() else None


def _pelo_lote_da_regra(ant):
    """Entrou no lote pela regra (a anterior), e não por decisão da coordenação."""
    return (
        bool(ant)
        and ant.get("situacao") in _NO_LOTE
        and (ant.get("situacao") == "ANALISADO" or ant.get("entrada") != ENTRADA_POR_DECISAO)
    )


def pre_classificar_vaga(
    regra, vaga, candidatos, anterior=None, ultimo_lote=0, refazer=False, hoje=None, congelar=False, decisoes=None
):
    """
    Pré-classifica os inscritos de uma vaga (mesmo contrato de preClassificarVaga do JS).
      regra        normalizar_regra(configuração do edital)
      vaga         {codigo, vagas_imediatas, cadastro_reserva, modalidades, nivel}
                   (nivel: o da vaga, para a nota declarada por nível; None = desconhecido)
      candidatos   [{id, codigo, ativo, colunas, nascimento, candidatura}]
      anterior     {id: {situacao, lote, lista_lote, entrada, motivo_entrada, posicao, declarada_congelada}}
      congelar     guarda a declarada completa de quem ainda não a tem congelada (congela_a_declarada)
      decisoes     {id: {motivo}}: as decisões vigentes da coordenação (ficam no lote, entrada DECISAO)
    Devolve {"linhas": [...], "resumo": {...}} (resumo.no_lote: pela regra; resumo.por_decisao: por decisão).
    """
    anterior = anterior or {}
    decisoes = decisoes or {}
    provisoria = (regra or {}).get("provisoria") or {}
    lote_da_regra = (regra or {}).get("lote") or {}
    tem_declarada = len(_lista(provisoria.get("nota_declarada"))) > 0
    # Corte e ordem pela declarada (padrão com nota declarada) ou pela ART.
    pela_declarada = tem_declarada and (provisoria.get("base_da_nota") or "DECLARADA") == "DECLARADA"
    tolerancia = provisoria.get("divergencia_tolerancia") or 0
    desempate = provisoria["desempate"] if isinstance(provisoria.get("desempate"), list) else DESEMPATE_PADRAO
    avisos = set()
    pergunta_da_experiencia = provisoria.get("pergunta_experiencia") if "EXPERIENCIA_DECLARADA" in desempate else None
    nivel_da_vaga_atual = _objeto(vaga).get("nivel") if _objeto(vaga).get("nivel") in NIVEIS else None

    linhas = []
    for c in _lista(candidatos):
        ant = anterior.get(c.get("id"))
        colunas = c.get("colunas") if isinstance(c.get("colunas"), dict) else {}
        eliminacao = None
        if not ant or ant.get("situacao") != "ANALISADO":
            if c.get("ativo") is False:
                if not ant:
                    continue
                eliminacao = dict(SAIU_DA_EMPREGARE)
            else:
                eliminacao, ausentes = eliminacao_do_candidato(regra, colunas)
                avisos.update(f"COLUNA_AUSENTE:{codigo}" for codigo in ausentes)
        avisos.update(perguntas_ambiguas(regra, colunas, pergunta_da_experiencia))
        art = art_das_colunas(colunas)
        # A declarada congelada vale como está; senão, recalculada pelas respostas.
        guardada = declarada_congelada((ant or {}).get("declarada_congelada")) if tem_declarada else None
        if guardada:
            declarada = {**guardada, "completa": True, "itens": []}
        else:
            declarada = calcular_nota_declarada(regra, colunas, nivel_da_vaga_atual) if tem_declarada else None
        congelada = guardada or (
            _retrato_da_declarada(declarada) if congelar and declarada and declarada["completa"] else None
        )
        if declarada:
            avisos.update(
                f"{PREFIXO_DO_AVISO_DE_SEM_NIVEL}NOTA_{i['parcial'] or ''}"
                for i in declarada["itens"]
                if i["nivel_desconhecido"]
            )
        pela_base = pela_declarada and bool(declarada) and declarada["completa"] is True
        if pela_base:
            nota = declarada["total"]
        else:
            nota = art if art is not None else (declarada["total"] if declarada else None)
        coluna_da_experiencia = (
            coluna_da_pergunta(colunas, pergunta_da_experiencia) if pergunta_da_experiencia else None
        )
        linhas.append(
            {
                "id": c.get("id"),
                "codigo": str(c.get("codigo") if c.get("codigo") is not None else ""),
                "_nascimento": c.get("nascimento"),
                "_candidatura": c.get("candidatura"),
                "_experiencia": meses_declarados(colunas[coluna_da_experiencia]) if coluna_da_experiencia else None,
                "situacao": "ELIMINADO" if eliminacao else "RANQUEADO",
                "motivo_codigo": eliminacao["codigo"] if eliminacao else None,
                "motivo": eliminacao["motivo"] if eliminacao else None,
                "art": art,
                "nota": nota,
                "origem_nota": "DECLARADA"
                if pela_base
                else ("ART" if art is not None else ("DECLARADA" if declarada else None)),
                "declarada": declarada["total"] if declarada else None,
                "declarada_parciais": declarada["parciais"] if declarada else None,
                "declarada_completa": declarada["completa"] if declarada else None,
                "declarada_congelada": congelada,
                "sem_mapa": declarada["sem_mapa"] if declarada else 0,
                "_fora_da_base": pela_declarada and not pela_base,
                # Só a declarada completa confere a ART (a incompleta não diverge).
                "divergente": diverge_da_art(art, declarada["total"], tolerancia)
                if declarada and declarada["completa"]
                else False,
                "modalidade": modalidade_do_candidato(regra, colunas),
                "posicao": None,
                "posicao_modalidade": None,
                "lote": None,
                "lista_lote": None,
                "entrada": None,
                "motivo_entrada": None,
                "_anterior": ant,
            }
        )

    # Provisória: ART decrescente e o desempate da regra; depois do último, os
    # eliminados pela regra que ficam no lote por decisão da coordenação.
    ordem = _chave_de_ordem(desempate, hoje)
    ranqueados = sorted((l for l in linhas if l["situacao"] != "ELIMINADO"), key=ordem)
    eliminados_por_decisao = sorted(
        (
            l
            for l in linhas
            if l["situacao"] == "ELIMINADO"
            and l["motivo_codigo"] != SAIU_DA_EMPREGARE["codigo"]
            and motivo_da_decisao(decisoes, l["id"])
        ),
        key=ordem,
    )
    por_modalidade = {}
    for i, linha in enumerate(ranqueados + eliminados_por_decisao):
        linha["posicao"] = i + 1
        por_modalidade[linha["modalidade"]] = por_modalidade.get(linha["modalidade"], 0) + 1
        linha["posicao_modalidade"] = por_modalidade[linha["modalidade"]]

    # Lote.
    t = tamanho_do_lote(lote_da_regra, vaga)
    if t["aviso"]:
        avisos.add(t["aviso"])
    if t["por_modalidade"]:
        ordem_das_listas = ["AC"] + [c for c in t["por_modalidade"] if c != "AC"]
    else:
        ordem_das_listas = ["GERAL"]

    def tamanho_da_lista(b):
        return t["por_modalidade"][b] if t["por_modalidade"] else t["tamanho"]

    def cabe_na_lista(linha, b):
        return b in ("GERAL", "AC") or linha["modalidade"] == b

    def lista_do(valor):
        return valor if valor in ordem_das_listas else ordem_das_listas[0]

    def herdar(linha, ant, situacao):
        linha.update(
            situacao=situacao,
            lote=ant.get("lote") or 1,
            lista_lote=ant.get("lista_lote"),
            entrada=ant.get("entrada"),
            motivo_entrada=ant.get("motivo_entrada"),
        )

    # Quem entrou por decisão da coordenação não é do lote da regra (ver as decisões, abaixo).
    membros, por_decisao, saidas = [], [], []
    for linha in linhas:
        ant = linha["_anterior"]
        if not ant or ant.get("situacao") not in _NO_LOTE:
            continue
        if ant.get("situacao") == "ANALISADO":
            herdar(linha, ant, "ANALISADO")
            (por_decisao if ant.get("entrada") == ENTRADA_POR_DECISAO else membros).append(linha)
        elif not _pelo_lote_da_regra(ant):
            continue
        elif linha["situacao"] == "ELIMINADO" and motivo_da_decisao(decisoes, linha["id"]):
            # Eliminado pela regra, mas fica no lote por decisão (sem abrir reposição).
            if linha["motivo_codigo"] == SAIU_DA_EMPREGARE["codigo"]:
                saidas.append(linha)
        elif linha["situacao"] == "ELIMINADO":
            saidas.append(linha)
        elif not refazer:
            herdar(linha, ant, "NO_LOTE")
            membros.append(linha)
    herdados = list(membros)

    def fixo_por_decisao(linha):
        """Quem já está no lote por decisão (vigente, ou já analisado) fica por decisão: não entra pela regra nem conta para o tamanho dela."""
        ant = linha["_anterior"] or {}
        return ant.get("entrada") == ENTRADA_POR_DECISAO and (
            ant.get("situacao") == "ANALISADO"
            or (ant.get("situacao") == "NO_LOTE" and motivo_da_decisao(decisoes, linha["id"]) is not None)
        )

    # Lote pela nota mínima: entram todos com a nota mínima (quem já estava fica).
    nota_minima = t.get("nota_minima")

    def tem_nota_minima(linha):
        return linha["nota"] is not None and linha["nota"] >= nota_minima

    if nota_minima is not None:
        t["tamanho"] = sum(1 for l in ranqueados if tem_nota_minima(l) and not fixo_por_decisao(l)) + sum(
            1 for m in membros if not tem_nota_minima(m)
        )
        t["descricao"] = f"{t['descricao']} = {t['tamanho']}"
    inicial = refazer or not any(_pelo_lote_da_regra(l["_anterior"]) for l in linhas)
    saidas.sort(
        key=lambda s: (
            s["_anterior"].get("posicao") if s["_anterior"].get("posicao") is not None else math.inf,
            s["codigo"],
        )
    )

    maior_lote = max([int(ultimo_lote or 0)] + [int((l["_anterior"] or {}).get("lote") or 0) for l in linhas])
    numero_novo = 1 if inicial else maior_lote + 1
    entraram = 0

    if t["tamanho"] is not None and (inicial or lote_da_regra.get("linha_anda") is not False):
        for b in ordem_das_listas:
            tamanho = tamanho_da_lista(b)
            ocupados = sum(1 for m in membros if lista_do(m["lista_lote"]) == b)
            fila_de_saidas = [s for s in saidas if lista_do(s["_anterior"].get("lista_lote")) == b]
            ultimo = None

            def entrar(linha, empate, b=b, fila_de_saidas=fila_de_saidas):
                nonlocal entraram, ultimo
                if inicial:
                    entrada = "INICIAL"
                    motivo = (
                        f"Empatado na linha de corte (nota {numero_no_texto(linha['nota'])})"
                        if empate
                        else f"Lote inicial: {t['descricao']}"
                    )
                elif empate:
                    entrada = (ultimo or {}).get("entrada") or "AMPLIACAO"
                    motivo = f"Empatado na linha de corte (nota {numero_no_texto(linha['nota'])})"
                elif fila_de_saidas:
                    saiu = fila_de_saidas.pop(0)
                    entrada = "REPOSICAO"
                    motivo = f"Entrou no lugar de {saiu['codigo']} ({saiu['motivo']})"
                else:
                    entrada = "AMPLIACAO"
                    motivo = f"Entrou para completar o lote ({t['descricao']})"
                linha.update(situacao="NO_LOTE", lote=numero_novo, lista_lote=b, entrada=entrada, motivo_entrada=motivo)
                membros.append(linha)
                entraram += 1
                ultimo = linha

            for linha in ranqueados:
                if ocupados >= tamanho:
                    break
                if linha["situacao"] != "RANQUEADO" or not cabe_na_lista(linha, b):
                    continue
                if fixo_por_decisao(linha):
                    continue
                if nota_minima is not None and not tem_nota_minima(linha):
                    continue
                entrar(linha, False)
                ocupados += 1
            if lote_da_regra.get("inclui_empatados") and ultimo and ultimo["nota"] is not None:
                nota = ultimo["nota"]
                for linha in ranqueados:
                    if (
                        linha["situacao"] == "RANQUEADO"
                        and cabe_na_lista(linha, b)
                        and linha["nota"] == nota
                        and not fixo_por_decisao(linha)
                    ):
                        entrar(linha, True)

    # Decisões da coordenação: no lote mesmo que a regra elimine ou deixe fora.
    ultimo_lote_da_vaga = max(1, maior_lote, numero_novo if entraram else 0)
    for linha in linhas:
        motivo = motivo_da_decisao(decisoes, linha["id"])
        if not motivo or linha["situacao"] in ("NO_LOTE", "ANALISADO"):
            continue
        if linha["motivo_codigo"] == SAIU_DA_EMPREGARE["codigo"]:
            avisos.add("DECISAO_SAIU_DA_EMPREGARE")
            continue
        ant = linha["_anterior"] or {}
        estava = ant.get("situacao") == "NO_LOTE" and int(ant.get("lote") or 0) >= 1
        lista_da_modalidade = linha["modalidade"] if linha["modalidade"] in ordem_das_listas else ordem_das_listas[0]
        linha.update(
            situacao="NO_LOTE",
            motivo_codigo=None,
            motivo=None,
            lote=int(ant["lote"]) if estava else ultimo_lote_da_vaga,
            lista_lote=ant.get("lista_lote")
            if estava and ant.get("lista_lote") in ordem_das_listas
            else lista_da_modalidade,
            entrada=ENTRADA_POR_DECISAO,
            motivo_entrada=motivo,
        )
        por_decisao.append(linha)

    if not inicial and saidas and lote_da_regra.get("linha_anda") is False:
        avisos.add("LINHA_PARADA")
    # A regra diminuiu o lote: quem já estava fica (só sai eliminado).
    if t["tamanho"] is not None:
        for b in ordem_das_listas:
            if sum(1 for m in herdados if lista_do(m["lista_lote"]) == b) > tamanho_da_lista(b):
                avisos.add("LOTE_ACIMA_DO_TAMANHO")

    notas_do_lote = [m["nota"] for m in membros if m["nota"] is not None]
    art_corte = min(notas_do_lote) if notas_do_lote else None
    # Fora do lote com nota acima da linha de corte da lista em que caberia.
    acima = set()
    for b in ordem_das_listas:
        notas = [m["nota"] for m in membros if lista_do(m["lista_lote"]) == b and m["nota"] is not None]
        if not notas:
            continue
        corte = min(notas)
        for linha in ranqueados:
            if (
                linha["situacao"] == "RANQUEADO"
                and cabe_na_lista(linha, b)
                and linha["nota"] is not None
                and linha["nota"] > corte
            ):
                acima.add(linha["id"])
    acima_do_corte = len(acima)
    if acima_do_corte:
        avisos.add("FORA_DO_LOTE_ACIMA_DO_CORTE")
    sem_art = sum(1 for l in linhas if l["situacao"] != "ELIMINADO" and l["art"] is None)
    # Sem ART só pesa para quem a nota não veio da declarada completa.
    if any(
        l["situacao"] != "ELIMINADO" and l["art"] is None and not (pela_declarada and l["declarada_completa"])
        for l in linhas
    ):
        avisos.add("ART_AUSENTE")
    pela_art = sum(1 for l in linhas if l["situacao"] != "ELIMINADO" and l["_fora_da_base"])
    if pela_art:
        avisos.add("SEM_DECLARADA_COMPLETA")

    saida_das_linhas = [{k: v for k, v in l.items() if not k.startswith("_")} for l in linhas]
    return {
        "linhas": saida_das_linhas,
        "resumo": {
            "inscritos": len(linhas),
            "eliminados": sum(1 for l in linhas if l["situacao"] == "ELIMINADO"),
            "ranqueados": len(ranqueados),
            "no_lote": len(membros),
            "por_decisao": len(por_decisao),
            "tamanho": t["tamanho"],
            "descricao": t["descricao"],
            "por_modalidade": t["por_modalidade"],
            "art_corte": art_corte,
            "base_da_nota": "DECLARADA" if pela_declarada else "ART",
            "pela_art": pela_art,
            "congeladas": sum(1 for l in linhas if l["declarada_congelada"] is not None),
            "divergencias": sum(1 for l in linhas if l["divergente"]),
            "sem_art": sem_art,
            "acima_do_corte": acima_do_corte,
            "entraram": entraram,
            "lote_novo": numero_novo if entraram else None,
            "saidas": [{"id": s["id"], "codigo": s["codigo"], "motivo": s["motivo"]} for s in saidas],
            "avisos": sorted(avisos),
        },
    }
