"""
/api/anexos-do-edital — lê o PDF de anexos de um edital da AgSUS e devolve o
cronograma (Anexo I) e o quadro de vagas (Anexo II) já estruturados.

Quem chama é o formulário do edital (src/componentes/nucleo/): a pessoa escolhe
o PDF, confere o que veio e só então salva. Nada é gravado aqui — a função só
lê o arquivo e responde JSON.

Os anexos da AgSUS têm sempre o mesmo desenho:
  - Anexo I: tabela "Atividades | Datas prováveis", com datas sem ano
    ("29/09", "30/09 a 02/10", "07 a 11/10", "24 e 25/10");
  - Anexo II: tabela "Vagas | [Lotação] | Ampla Concorrência | PcD | … | Total",
    com "CR" (cadastro reserva) ou número em cada modalidade e "1+CR" no total.
    O cargo aparece uma vez e vale para as linhas de lotação abaixo dele; a
    tabela pode continuar na página seguinte sem repetir o cabeçalho.
  - Projetos publica o quadro no Anexo I: "Vaga | Quantidade de vagas |
    Requisitos | Atribuições", sem modalidades.

Com `?tipo=retificacao`, lê a retificação do cronograma ("1ª Retificação do
Cronograma", "2ª Retificação do Anexo I"): número da retificação, edital, SEI,
data da assinatura e as duas tabelas — "Onde se lê:" (a antiga) e "Leia-se:"
(a que vale), com as linhas em negrito (as alteradas) marcadas. Quem compara
com o cronograma gravado e aplica é a tela (src/modulos/editais/).

Acesso: só usuário autenticado no Supabase do MONITORA (Bearer do front,
conferido em /auth/v1/user). O PDF vem no corpo (application/pdf), até 4 MB.

Testes: tests/python/test_anexos_do_edital.py e
tests/python/test_retificacao_do_cronograma.py (PDFs sintéticos).
"""

import io
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from http.server import BaseHTTPRequestHandler

LIMITE_BYTES = 4 * 1024 * 1024
PAGINAS_LIDAS = 8

# ── Texto ────────────────────────────────────────────────────────────────────


def limpar(valor):
    """Célula do PDF em uma linha: quebras viram espaço, espaços repetidos somem."""
    return re.sub(r"\s+", " ", str(valor or "")).strip()


def sem_acento(valor):
    texto = unicodedata.normalize("NFD", str(valor or ""))
    return "".join(c for c in texto if unicodedata.category(c) != "Mn").lower()


# ── Cronograma ──────────────────────────────────────────────────────────────

_DIA_MES = r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?"


def ler_periodo(texto):
    """
    "29/09" → ((29, 9, None), (29, 9, None)); "30/09 a 02/10" e "07 a 11/10"
    e "24 e 25/10" → início e fim. Sem data reconhecível → None.
    """
    t = limpar(texto).lower()
    m = re.fullmatch(_DIA_MES + r"\s*(?:a|e|até|-|–)\s*" + _DIA_MES, t)
    if m:
        d1, m1, a1, d2, m2, a2 = m.groups()
        return (int(d1), int(m1), a1), (int(d2), int(m2), a2)
    m = re.fullmatch(r"(\d{1,2})\s*(?:a|e|até|-|–)\s*" + _DIA_MES, t)
    if m:
        d1, d2, m2, a2 = m.groups()
        return (int(d1), int(m2), a2), (int(d2), int(m2), a2)
    m = re.fullmatch(_DIA_MES, t)
    if m:
        d, mes, a = m.groups()
        return (int(d), int(mes), a), (int(d), int(mes), a)
    return None


def _ano(valor, padrao):
    if not valor:
        return padrao
    n = int(valor)
    return n + 2000 if n < 100 else n


def datas_com_ano(periodos, ano):
    """
    Dá ano às datas, na ordem do cronograma: começa no ano do edital e, quando
    uma data cai muito antes da anterior (dezembro → janeiro), passa ao ano
    seguinte. Data impossível (31/02) vira None.
    """
    saida = []
    atual = ano
    anterior = None
    for periodo in periodos:
        if periodo is None:
            saida.append(None)
            continue
        par = []
        for d, m, a in periodo:
            ano_da_data = _ano(a, atual)
            try:
                data = date(ano_da_data, m, d)
            except ValueError:
                par = None
                break
            if not a and anterior and (anterior - data).days > 60:
                atual += 1
                try:
                    data = date(atual, m, d)
                except ValueError:  # 29/02 num ano que não é bissexto
                    par = None
                    break
            par.append(data)
            anterior = data
        saida.append(tuple(par) if par else None)
    return saida


def eh_cabecalho_cronograma(linha):
    celulas = [sem_acento(limpar(c)) for c in linha]
    return any(c.startswith("atividade") for c in celulas) and any("data" in c for c in celulas)


def extrair_cronograma(tabelas, ano):
    """Etapas do Anexo I: [{atividade, data_inicio, data_fim, texto_datas}]."""
    linhas = []
    dentro = False
    for tabela in tabelas:
        for linha in tabela:
            if not linha:
                continue
            if eh_cabecalho_cronograma(linha):
                dentro = True
                continue
            if not dentro:
                continue
            celulas = [limpar(c) for c in linha if limpar(c)]
            if len(celulas) < 2:
                continue
            linhas.append((celulas[0], celulas[-1]))
        if dentro and linhas:
            break
    periodos = datas_com_ano([ler_periodo(d) for _, d in linhas], ano)
    etapas = []
    for (atividade, texto_datas), par in zip(linhas, periodos, strict=False):
        etapas.append(
            {
                "atividade": atividade,
                "data_inicio": par[0].isoformat() if par else "",
                "data_fim": par[1].isoformat() if par else "",
                "texto_datas": texto_datas,
            }
        )
    return etapas


# ── Quadro de vagas ─────────────────────────────────────────────────────────


def ler_quantidade(texto):
    """'1' → (1, False); 'CR' → (None, True); '2 + CR' → (2, True); '' → (None, False)."""
    t = limpar(texto).upper().replace(" ", "")
    if not t or t in ("-", "–"):
        return None, False
    cr = "CR" in t
    numero = re.search(r"\d+", t)
    return (int(numero.group(0)) if numero else None), cr


def colunas_do_quadro(cabecalho):
    """
    Posições do cabeçalho do Anexo II: cargo, lotação (opcional), modalidades e
    total. None se a linha não é o cabeçalho do quadro.
    """
    nomes = [limpar(c) for c in cabecalho]
    chaves = [sem_acento(n) for n in nomes]
    if not chaves or not chaves[0].startswith("vaga"):
        return None
    # SI: "… | Total"; Projetos: "Vaga | Quantidade de vagas | Requisitos | Atribuições".
    total = next(
        (i for i, c in enumerate(chaves) if c == "total" or c.startswith("quantidade")),
        None,
    )
    if total is None:
        return None
    lotacao = next((i for i, c in enumerate(chaves) if c.startswith("lotac")), None)
    inicio = (lotacao if lotacao is not None else 0) + 1
    modalidades = [(i, nomes[i]) for i in range(inicio, total) if nomes[i]]
    return {"lotacao": lotacao, "modalidades": modalidades, "total": total, "largura": len(nomes)}


def extrair_quadro(tabelas):
    """
    Linhas do Anexo II: [{cargo, lotacao, modalidades, vagas_imediatas,
    cadastro_reserva}] e os nomes das modalidades na ordem do edital.
    """
    colunas = None
    cargo = ""
    vagas = []
    for tabela in tabelas:
        for linha in tabela:
            if not linha:
                continue
            achadas = colunas_do_quadro(linha)
            if achadas:
                colunas = achadas
                cargo = ""
                continue
            if colunas is None or len(linha) != colunas["largura"]:
                continue
            primeira = limpar(linha[0])
            if sem_acento(primeira).startswith("cr="):
                continue
            if primeira:
                cargo = primeira
            if not cargo:
                continue
            lotacao = limpar(linha[colunas["lotacao"]]) if colunas["lotacao"] is not None else ""
            modalidades = {}
            soma = 0
            reserva = False
            for i, nome in colunas["modalidades"]:
                qt, cr = ler_quantidade(linha[i])
                modalidades[nome] = qt
                soma += qt or 0
                reserva = reserva or cr
            total, cr_total = ler_quantidade(linha[colunas["total"]])
            if total is None and not cr_total and not modalidades:
                continue
            vagas.append(
                {
                    "cargo": cargo,
                    "lotacao": lotacao,
                    "modalidades": modalidades,
                    "vagas_imediatas": total if total is not None else soma,
                    "cadastro_reserva": bool(cr_total or reserva),
                }
            )
    nomes = [nome for _, nome in colunas["modalidades"]] if colunas else []
    return vagas, nomes


# ── Documento ───────────────────────────────────────────────────────────────


def identificar(texto):
    """Número do edital ("117/2026") e unidade ("DSEI XINGU") pelo título do anexo."""
    t = limpar(texto)
    m = re.search(r"EDITAL\s*N\S{0,3}\s*(\d{1,4})\s*/\s*(\d{4})(?:\s*[-–]\s*(.{0,80}))?", t, re.I)
    if not m:
        return "", "", None
    unidade = re.split(r"\s{2,}|Atividades|Vagas", m.group(3) or "", flags=re.I)[0].strip(" -–")
    return f"{int(m.group(1))}/{m.group(2)}", unidade, int(m.group(2))


def extrair(conteudo):
    """Lê o PDF (bytes) e devolve o dicionário da resposta."""
    import pdfplumber

    tabelas = []
    textos = []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        paginas = len(pdf.pages)
        for pagina in pdf.pages[:PAGINAS_LIDAS]:
            texto = pagina.extract_text() or ""
            textos.append(texto)
            tabelas.extend(pagina.extract_tables() or [])
            if re.search(r"ANEXO\s+III", texto, re.I) and tabelas:
                break
    edital, unidade, ano = identificar("\n".join(textos[:2]))
    ano = ano or date.today().year
    cronograma = extrair_cronograma(tabelas, ano)
    vagas, modalidades = extrair_quadro(tabelas)

    avisos = []
    if not cronograma:
        avisos.append("Não achei a tabela do cronograma (Anexo I).")
    elif any(not e["data_inicio"] for e in cronograma):
        avisos.append("Algumas etapas vieram sem data reconhecível; confira antes de salvar.")
    if not vagas:
        avisos.append("Não achei o quadro de vagas (Anexo II).")
    return {
        "edital": edital,
        "unidade": unidade,
        "paginas": paginas,
        "cronograma": cronograma,
        "vagas": vagas,
        "modalidades": modalidades,
        "avisos": avisos,
    }


# ── Retificação do cronograma ──────────────────────────────────────────────

_ORDINAIS = {"primeira": 1, "segunda": 2, "terceira": 3, "quarta": 4, "quinta": 5, "sexta": 6}


def corrigir_digitacao(texto):
    """
    Conserta a digitação comum das datas da retificação: "05/ a 16/10" →
    "05 a 16/10"; "17 a 19 /09" → "17 a 19/09"; quebra de linha vira espaço.
    """
    t = limpar(texto)
    t = re.sub(r"(\d)\s+/\s*(\d)", r"\1/\2", t)
    t = re.sub(r"(\d)/\s+(\d)", r"\1/\2", t)
    t = re.sub(r"(\d)/(?!\d)", r"\1", t)
    return re.sub(r"\s+", " ", t).strip()


def ler_datas_da_retificacao(texto):
    """
    O período de uma linha do "Leia-se", com o conector ("a", "e"…) e os
    avisos de digitação. Devolve (periodo | None, conector, avisos).
    """
    # A hora ("23/06 a 02/07 às 14h") não entra no cronograma.
    original = re.sub(r"\s*\b[àa]s\s*\d{1,2}\s*h(?:\s*\d{2})?(?:min)?\b", "", limpar(texto), flags=re.I)
    corrigido = corrigir_digitacao(original)
    avisos = []
    periodo = ler_periodo(corrigido)
    if periodo and corrigido != original:
        avisos.append(f'Digitação estranha no PDF: "{original}" (lido como "{corrigido}").')
    conector = re.search(r"\d\s*(a|e|até|-|–)\s*\d", corrigido, re.I)
    return periodo, (conector.group(1).lower() if conector else ""), avisos


def _curta(data):
    return data.strftime("%d/%m/%Y")


def etapas_da_retificacao(linhas, ano):
    """
    Linhas [(atividade, texto_datas, negrito)] → etapas com datas ISO e
    avisos: duas datas soltas ("24/09 e 07/10") viram o intervalo do menor ao
    maior, com aviso; etapa sem data reconhecível fica sem data, com aviso.
    """
    lidas = [ler_datas_da_retificacao(datas) for _, datas, _ in linhas]
    periodos = datas_com_ano([periodo for periodo, _, _ in lidas], ano)
    etapas = []
    for (atividade, texto_datas, negrito), (_, conector, avisos_da_data), par in zip(
        linhas, lidas, periodos, strict=True
    ):
        avisos = list(avisos_da_data)
        datas = limpar(texto_datas)
        inicio = fim = None
        if par:
            inicio, fim = par
            if fim < inicio:
                inicio, fim = fim, inicio
                avisos.append(f'"{datas}" está com as datas fora de ordem; lido de {_curta(inicio)} a {_curta(fim)}.')
            elif conector == "e" and (fim - inicio).days > 1:
                avisos.append(
                    f'"{datas}" são duas datas soltas; lido como o intervalo de {_curta(inicio)} a {_curta(fim)}. Confira.'
                )
        elif datas:
            avisos.append(f'Data não reconhecida no PDF: "{datas}".')
        else:
            avisos.append("Etapa sem data no PDF.")
        etapas.append(
            {
                "atividade": limpar(atividade),
                "data_inicio": inicio.isoformat() if inicio else "",
                "data_fim": fim.isoformat() if fim else "",
                "texto_datas": datas,
                "negrito": bool(negrito),
                "avisos": avisos,
            }
        )
    return etapas


def _linha_em_negrito(pagina, bbox):
    """A linha da tabela está toda em negrito (as alteradas, no "Leia-se")?"""
    x0, topo, x1, base = bbox
    px0, ptopo, px1, pbase = pagina.bbox
    caixa = (max(x0, px0), max(topo, ptopo), min(x1, px1), min(base, pbase))
    if caixa[0] >= caixa[2] or caixa[1] >= caixa[3]:
        return False
    letras = [c for c in pagina.crop(caixa).chars if c.get("text", "").strip()]
    return bool(letras) and all("bold" in str(c.get("fontname", "")).lower() for c in letras)


_MARCAS = (
    ("onde", r"Onde\s+se\s+l[êe]"),
    ("leia", r"Leia-se|Leia\s+se"),
    ("fim", r"DISPOSI[ÇC][ÕO]ES\s+FINAIS|As\s+demais\s+cl[áa]usulas"),
)


def secoes_da_retificacao(paginas):
    """
    As linhas [(atividade, datas, negrito)] de "Onde se lê" e de "Leia-se", na
    ordem do documento: cada tabela pertence à última marca acima dela, e a
    tabela que continua na página seguinte (sem cabeçalho) segue na mesma seção.
    """
    eventos = []
    for numero, pagina in enumerate(paginas):
        for nome, padrao in _MARCAS:
            for achado in pagina.search(padrao, regex=True, case=False):
                eventos.append((numero, achado["top"], 0, nome, None))
        for tabela in pagina.find_tables():
            eventos.append((numero, tabela.bbox[1], 1, "tabela", (pagina, tabela)))
    eventos.sort(key=lambda e: (e[0], e[1], e[2]))

    secoes = {"onde": [], "leia": []}
    atual = None
    for _, _, _, nome, dados in eventos:
        if nome != "tabela":
            atual = None if nome == "fim" else nome
            continue
        if atual is None:
            continue
        pagina, tabela = dados
        for linha, celulas in zip(tabela.rows, tabela.extract(), strict=False):
            if len(celulas or []) < 2 or eh_cabecalho_cronograma(celulas):
                continue
            atividade = sem_rodape(celulas[0])
            if not atividade:
                continue
            negrito = _linha_em_negrito(pagina, linha.bbox) if linha.bbox else False
            secoes[atual].append((atividade, sem_rodape(celulas[-1]), negrito))
    return secoes["onde"], secoes["leia"]


# O rodapé do SEI ("Retificação 2ª Retificação … (0698514) SEI AGSUS.002213/2026-13 / pg. 1")
# às vezes cai dentro da tabela que atravessa a página.
_RODAPE = re.compile(
    r"\s*(?:\S{0,6}\s+)?(?:\d+\s*ª\s*)?RETIFICA\S*\s.*?\(\d{6,8}\)|\s*\S?\s*AGSUS\.|\s*\(\d{6,8}\)",
    re.I,
)


def sem_rodape(texto):
    """A célula sem o pedaço do rodapé do SEI que caiu nela."""
    t = limpar(texto)
    corte = _RODAPE.search(t)
    return t[: corte.start()].strip() if corte else t


def identificar_retificacao(texto):
    """
    Do texto corrido do PDF: número e nome da retificação ("2ª Retificação do
    Cronograma"), edital do título e os outros citados, unidade, SEI, processo
    e data da assinatura.
    """
    t = limpar(texto)
    numero = None
    tipo = "do Cronograma"
    m = re.search(r"\b(\d{1,2})\s*[ªaº°]?\s*RETIFICA[ÇC][ÃA]O\b(.{0,40})", t, re.I)
    if not m:
        m = re.search(r"\b(" + "|".join(_ORDINAIS) + r")\s+RETIFICA[ÇC][ÃA]O\b(.{0,40})", t, re.I)
    if m:
        bruto = m.group(1).lower()
        numero = int(bruto) if bruto.isdigit() else _ORDINAIS[bruto]
        if re.match(r"\s*D[OE]\s+ANEXO\s+I\b", m.group(2), re.I):
            tipo = "do Anexo I"
    rotulo = f"{numero}ª Retificação {tipo}" if numero else ""

    editais = []
    for d in re.finditer(r"EDITAL\s*N\S{0,3}\s*(\d{1,4})\s*/\s*(\d{4})", t, re.I):
        valor = f"{int(d.group(1))}/{d.group(2)}"
        if valor not in editais:
            editais.append(valor)
    edital = editais[0] if editais else ""

    unidade = ""
    u = re.search(
        r"CRONOGRAMA DO PROCESSO SELETIVO\s*[-–]\s*EDITAL\s*N\S{0,3}\s*\d{1,4}\s*/\s*\d{4}\s*[-–]\s*(.{0,80})",
        t,
        re.I,
    )
    if u:
        unidade = re.split(r"\s(?:Atividades|Retifica|Leia|Onde)", u.group(1), flags=re.I)[0].strip(" -–")

    sei = re.search(r"SEI\s*n\S{0,2}\s*(\d{5,})", t, re.I) or re.search(r"\((\d{6,8})\)\s*SEI\b", t)
    processo = re.search(r"Processo\s*n\S{0,2}\s*([A-Z]+\.\d[\d./-]*\d)", t, re.I)
    assinada = re.search(r"assinado eletronicamente por .{0,250}? em (\d{2})/(\d{2})/(\d{4})", t, re.I)
    assinada_em = ""
    if assinada:
        try:
            assinada_em = date(int(assinada.group(3)), int(assinada.group(2)), int(assinada.group(1))).isoformat()
        except ValueError:
            assinada_em = ""
    return {
        "numero": numero,
        "rotulo": rotulo,
        "edital": edital,
        "editais_citados": editais,
        "unidade": unidade,
        "sei": sei.group(1) if sei else "",
        "processo": processo.group(1) if processo else "",
        "assinada_em": assinada_em,
    }


def extrair_retificacao(conteudo):
    """Lê o PDF da retificação (bytes) e devolve o dicionário da resposta."""
    import pdfplumber

    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        paginas = pdf.pages[:PAGINAS_LIDAS]
        texto = "\n".join(p.extract_text() or "" for p in paginas)
        onde, leia = secoes_da_retificacao(paginas)
        total = len(pdf.pages)

    dados = identificar_retificacao(texto)
    # O ano das datas é o do edital; sem edital, o da assinatura.
    if dados["edital"]:
        ano = int(dados["edital"].split("/")[1])
    elif dados["assinada_em"]:
        ano = int(dados["assinada_em"][:4])
    else:
        ano = date.today().year
    avisos = []
    if not re.search(r"RETIFICA[ÇC][ÃA]O", texto, re.I):
        avisos.append("Este PDF não parece uma retificação do cronograma.")
    elif not dados["numero"]:
        avisos.append("Não achei o número da retificação no título; informe antes de aplicar.")
    if not dados["edital"]:
        avisos.append("Não achei o número do edital no PDF.")
    elif len(dados["editais_citados"]) > 1:
        outros = ", ".join(dados["editais_citados"][1:])
        avisos.append(f"O PDF cita também o edital {outros}; vale o do título ({dados['edital']}).")
    if not leia:
        avisos.append('Não achei a tabela do "Leia-se".')
    if not dados["sei"]:
        avisos.append("Não achei o número SEI do documento.")
    return {
        "tipo": "retificacao",
        **dados,
        "paginas": total,
        "onde_se_le": etapas_da_retificacao(onde, ano),
        "leia_se": etapas_da_retificacao(leia, ano),
        "avisos": avisos,
    }


# ── HTTP (Vercel) ───────────────────────────────────────────────────────────


def usuario_autenticado(autorizacao):
    """Confere o Bearer no Supabase. Devolve o id do usuário ou None."""
    token = autorizacao[7:].strip() if autorizacao.lower().startswith("bearer ") else ""
    base = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
    chave = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    if not token or not base or not chave:
        return None
    pedido = urllib.request.Request(
        f"{base}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": chave},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=10) as resposta:
            return json.loads(resposta.read()).get("id")
    except Exception:
        return None


class handler(BaseHTTPRequestHandler):
    def _responder(self, status, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        if not usuario_autenticado(self.headers.get("Authorization", "")):
            return self._responder(401, {"erro": "Entre no MONITORA para importar anexos."})
        try:
            tamanho = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            tamanho = 0
        if tamanho <= 0:
            return self._responder(400, {"erro": "Envie o PDF de anexos do edital."})
        if tamanho > LIMITE_BYTES:
            return self._responder(413, {"erro": "PDF maior que 4 MB."})
        conteudo = self.rfile.read(tamanho)
        if not conteudo.startswith(b"%PDF"):
            return self._responder(400, {"erro": "O arquivo não é um PDF."})
        consulta = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        ler = extrair_retificacao if consulta.get("tipo", [""])[0] == "retificacao" else extrair
        try:
            return self._responder(200, ler(conteudo))
        except Exception:
            return self._responder(422, {"erro": "Não consegui ler este PDF."})

    def do_GET(self):
        self._responder(405, {"erro": "Use POST com o PDF."})
