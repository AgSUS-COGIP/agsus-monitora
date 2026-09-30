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

Acesso: só usuário autenticado no Supabase do MONITORA (Bearer do front,
conferido em /auth/v1/user). O PDF vem no corpo (application/pdf), até 4 MB.

Testes: tests/python/test_anexos_do_edital.py (roda com o Python local).
"""

import io
import json
import os
import re
import unicodedata
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
                data = date(atual, m, d)
            par.append(data)
            anterior = data
        saida.append(tuple(par) if par else None)
    return saida


def eh_cabecalho_cronograma(linha):
    celulas = [sem_acento(limpar(c)) for c in linha]
    return any(c.startswith("atividade") for c in celulas) and any(
        "data" in c for c in celulas
    )


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
    for (atividade, texto_datas), par in zip(linhas, periodos):
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


# ── HTTP (Vercel) ───────────────────────────────────────────────────────────


def usuario_autenticado(autorizacao):
    """Confere o Bearer no Supabase. Devolve o id do usuário ou None."""
    token = autorizacao[7:].strip() if autorizacao.lower().startswith("bearer ") else ""
    base = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
    chave = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get(
        "VITE_SUPABASE_ANON_KEY", ""
    )
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
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0:
            return self._responder(400, {"erro": "Envie o PDF de anexos do edital."})
        if tamanho > LIMITE_BYTES:
            return self._responder(413, {"erro": "PDF maior que 4 MB."})
        conteudo = self.rfile.read(tamanho)
        if not conteudo.startswith(b"%PDF"):
            return self._responder(400, {"erro": "O arquivo não é um PDF."})
        try:
            return self._responder(200, extrair(conteudo))
        except Exception:
            return self._responder(422, {"erro": "Não consegui ler este PDF."})

    def do_GET(self):
        self._responder(405, {"erro": "Use POST com o PDF."})
