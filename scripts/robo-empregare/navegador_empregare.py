"""
O portal da empresa na Empregare, pelo Selenium (Chrome headless).

Porta a lógica do robô original (repositório privado
AgSUS-COGIP/COGIP_extracao-empregare, "src/extração empregare.py"):
login em duas telas, busca da vaga em "Vagas Anunciadas", Processo Seletivo →
"Relatório e Indicadores" → "Exportar Candidatos" com as respostas do
questionário e de competência, e o download na Central de Exportações
(tabela Tabulator lida por JavaScript, rolando para carregar todas as linhas).

Diferenças do original:
  - credenciais só do ambiente (EMPREGARE_EMAIL / EMPREGARE_SENHA), nunca no código;
  - Chrome headless com perfil e pasta de download temporários (sem caminho pessoal);
  - Selenium Manager acha o chromedriver (sem webdriver_manager);
  - login conferido: se a tela de login continua, para com erro claro;
  - na Central, só vale exportação feita nesta execução (a mais recente da vaga,
    pela data lida de verdade, não pelo texto), para não baixar a de outro dia;
  - nada de nome, e-mail ou CPF no log: só códigos de vaga e contagens.

Tempos e repetições são os do original (TENTATIVAS_CENTRAL, ESPERA_…).

Links para a ficha da avaliação documental (fase F7; migration
20261007160000_link_do_candidato_na_empregare.sql): ao pedir a exportação, o
robô guarda o identificador interno da vaga (do link
/empresa/vagas/candidaturas/<id>|; o código numérico dá "Sem permissão") e,
em capturar_candidatos, abre as candidaturas da vaga, carrega a lista inteira
(espera o AJAX da 1ª página e rola até o fim: rolagem infinita) e lê do HTML,
em cada div.curriculo-list-item, o código de cada
candidato (data-pessoa-id, o mesmo CÓDIGO do Excel) e o link de detalhes
(/empresa/curriculo/detalhes?tokenCandidato=…). Lê o DOM, e não o POST
GetCandidatos, porque o formato desse POST não é público e o DOM é o que a
tela mostra. Falha aqui só registra aviso: a exportação segue. Os links levam
tokens de acesso: nunca vão para o log (só contagens).
"""

import os
import re
import time
from datetime import datetime, timedelta
from html.parser import HTMLParser
from urllib.parse import unquote

from monitora.mascaramento import resumo_do_erro

URL_BASE = "https://corporate.empregare.com"
URL_LOGIN = URL_BASE + "/empresa/login"
URL_VAGAS = URL_BASE + "/empresa/vagas"
URL_EXPORTACOES = URL_BASE + "/empresa/exportacoes"
URL_CANDIDATURAS = URL_BASE + "/empresa/vagas/candidaturas/"

# Lista de candidatos da vaga: limites para não prender a execução numa vaga.
LIMITE_DE_PAGINAS = 100
LIMITE_DE_ROLAGENS = 300
RODADAS_SEM_NOVIDADE = 2  # rolagens seguidas sem candidato novo = fim da lista
ESPERA_PELA_LISTA = 20  # segundos até o AJAX trazer a 1ª página de candidatos
ESPERA_POR_MAIS = 6  # segundos esperando a rolagem trazer mais candidatos
INTERVALO_DA_LISTA = 0.5  # segundos entre uma contagem e outra
TEMPO_LIMITE_DA_LISTA = 120  # segundos por vaga
ORCAMENTO_DOS_LINKS = 25 * 60  # segundos na execução inteira (o workflow tem 120 min)
ESPERA_DA_LISTA = 1.5  # segundos depois de rolar ou trocar de página

SITUACAO_DISPONIVEL = "Disponível"
ORIGEM_EXPORTACAO = "Candidatos da vaga (Excel)"

TENTATIVAS_CENTRAL = 12
ESPERA_ENTRE_TENTATIVAS = 30  # segundos
TIMEOUT_DOWNLOAD = 180  # segundos para o arquivo terminar de baixar
ESPERA_APOS_EXPORTAR = 20  # segundos antes de abrir a Central pela 1ª vez
FOLGA_DO_RELOGIO = timedelta(minutes=10)  # relógio da Empregare × do runner

JS_LER_LINHAS = """
const linhas = document.querySelectorAll('.tabulator-row');
return Array.from(linhas).map(function (r) {
    const txt = function (campo) {
        const c = r.querySelector('[tabulator-field="' + campo + '"]');
        return c ? c.textContent.trim() : '';
    };
    const link = r.querySelector('a[href*="/Exports/Download/"]');
    return {
        id: txt('id'),
        vaga: txt('vagaCodigo'),
        origem: txt('localTexto'),
        data: txt('dataCadastro'),
        situacao: txt('statusCliente'),
        href: link ? link.getAttribute('href') : ''
    };
});
"""

JS_ROLAR = """
const h = document.querySelector('.tabulator-tableholder');
if (!h) { return [0, 0]; }
h.scrollTop = arguments[0];
return [h.scrollTop, h.scrollHeight - h.clientHeight];
"""

# Lista de candidatos da vaga (candidaturas). Nada aqui devolve dado pessoal ao log:
# o Python lê só contagens e o HTML, de onde tira código e link.
# Estrutura do portal (conferida em 10/2026): a lista chega por AJAX depois do load,
# em div.curriculo-append > div.list-group.candidatura-group#curriculo-pagina-N (15 por
# página, a seguinte entra ao rolar até o fim); cada candidato é um div.curriculo-list-item
# com a.link-curriculo (link de detalhes) e li[data-pessoa-id] (o CÓDIGO do Excel).
SELETOR_ITEM_DA_LISTA = ".curriculo-list-item"
SELETOR_LINK_DA_LISTA = ".curriculo-list-item a.link-curriculo"
SELETOR_LINK_DETALHE = 'a[href*="/empresa/curriculo/detalhes"]'

JS_CONTAR_LINKS = f"""
const daLista = document.querySelectorAll('{SELETOR_LINK_DA_LISTA}').length;
return daLista || document.querySelectorAll('{SELETOR_LINK_DETALHE}').length;
"""

JS_PRIMEIRO_LINK = f"""
const a = document.querySelector('{SELETOR_LINK_DETALHE}');
return a ? a.getAttribute('href') : '';
"""

JS_ABA_TODOS = """
const abas = document.querySelectorAll(
  '.nav a, .nav button, [role="tablist"] a, [role="tablist"] button, [role="tab"], .nav-tabs a, .tabs a'
);
for (const aba of abas) {
  const texto = (aba.textContent || '').replace(/\\s+/g, ' ').trim();
  if (!/^todos\\b/i.test(texto)) { continue; }
  const item = aba.closest('li');
  const ativa = aba.classList.contains('active') || aba.getAttribute('aria-selected') === 'true'
    || (item && item.classList.contains('active'));
  if (!ativa) { aba.click(); return true; }
  return false;
}
return false;
"""

JS_ROLAR_LISTA = f"""
const itens = document.querySelectorAll('{SELETOR_ITEM_DA_LISTA}');
if (itens.length) {{ itens[itens.length - 1].scrollIntoView({{block: 'end'}}); }}
window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
const vistos = new Set();
document.querySelectorAll('{SELETOR_LINK_DETALHE}').forEach(function (a) {{
  let p = a.parentElement;
  while (p && p !== document.body) {{
    if (!vistos.has(p) && p.scrollHeight > p.clientHeight + 10
        && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) {{
      vistos.add(p);
      p.scrollTop = p.scrollHeight;
    }}
    p = p.parentElement;
  }}
}});
const mais = Array.from(document.querySelectorAll('button, a')).find(function (b) {{
  const t = (b.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  return b.offsetParent !== null && !b.disabled
    && /^(carregar|ver|mostrar|exibir) mais/.test(t);
}});
if (mais) {{ mais.click(); return true; }}
return false;
"""

JS_PROXIMA_PAGINA = """
const desabilitado = function (el) {
  const item = el.closest('li');
  return el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true'
    || (item && item.classList.contains('disabled'));
};
const opcoes = Array.from(document.querySelectorAll(
  'a[rel="next"], .pagination .next a, .pagination li.next a, .pagination a, .pagination button, '
  + '[aria-label*="róxim" i], .paginate_button.next'
));
const proxima = opcoes.find(function (el) {
  if (desabilitado(el) || el.offsetParent === null) { return false; }
  const t = (el.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const rotulo = (el.getAttribute('aria-label') || '').toLowerCase();
  return el.getAttribute('rel') === 'next' || el.matches('.next a, li.next a, .paginate_button.next')
    || /^(próxim[ao]|seguinte|›|»|>)$/.test(t) || /próxim/.test(rotulo);
});
if (proxima) { proxima.click(); return true; }
return false;
"""


class ErroDeLogin(Exception):
    pass


def credenciais():
    email = os.environ.get("EMPREGARE_EMAIL", "").strip()
    senha = os.environ.get("EMPREGARE_SENHA", "")
    faltam = [n for n, v in (("EMPREGARE_EMAIL", email), ("EMPREGARE_SENHA", senha)) if not v]
    if faltam:
        raise SystemExit(
            f"Falta {' e '.join(faltam)} no ambiente. No GitHub: Settings → Secrets and "
            "variables → Actions (veja docs/robo-empregare.md)."
        )
    return email, senha


# ── Central de Exportações: regras puras ────────────────────────────────────


def ler_data_da_central(texto):
    """'05/10/2026 08:01' (ou com segundos) → datetime; outro formato → None."""
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?", str(texto or ""))
    if not m:
        return None
    d, mes, a, h, mi, s = m.groups()
    try:
        return datetime(int(a), int(mes), int(d), int(h or 0), int(mi or 0), int(s or 0))
    except ValueError:
        return None


def escolher_exportacao(linhas, codigo, desde=None):
    """
    A exportação mais recente da vaga já disponível, feita a partir de `desde`
    (início da execução, com folga). Devolve (linha, motivo).
    """
    da_vaga = [l for l in linhas if l.get("vaga") == str(codigo)]
    if desde is not None:
        recentes = []
        for l in da_vaga:
            quando = ler_data_da_central(l.get("data"))
            if quando is None or quando >= desde - FOLGA_DO_RELOGIO:
                recentes.append(l)
        da_vaga = recentes
    if not da_vaga:
        return None, "ainda não listada"
    disponiveis = [l for l in da_vaga if SITUACAO_DISPONIVEL in l.get("situacao", "") and l.get("href")]
    if not disponiveis:
        situacoes = ", ".join(sorted({l.get("situacao", "").split("\n")[0] for l in da_vaga if l.get("situacao")}))
        return None, situacoes or "sem situação"
    candidatas = [l for l in disponiveis if ORIGEM_EXPORTACAO in l.get("origem", "")] or disponiveis
    escolhida = max(candidatas, key=lambda l: (ler_data_da_central(l.get("data")) or datetime.min, l.get("id", "")))
    return escolhida, "ok"


# ── Links da vaga e dos candidatos: regras puras ────────────────────────────

_CAMINHO_CANDIDATURAS = re.compile(r"/empresa/vagas/candidaturas/([^/?#\s\"'<>]+)(?=$|[/?#\s\"'])")
# Mesmo formato que o banco aceita (CK_EMPREGVAGA_COVAGAINTERNO).
_ID_INTERNO = re.compile(r"^[A-Za-z0-9_.~=-]{1,96}\|{0,3}$")
_SO_CODIGO = re.compile(r"^[0-9]+\|*$")
# Mesmo formato que o banco aceita (CK_EMPREGCAND_DSLINKDETALHE).
_LINK_DETALHE = re.compile(r"^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$")
_CODIGO_DO_CANDIDATO = re.compile(r"^[A-Za-z0-9._-]{1,60}$")
_TAGS_SEM_FIM = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def id_interno_da_vaga(endereco):
    """
    '/empresa/vagas/candidaturas/Ab1cD2eF3g|?m=2' → 'Ab1cD2eF3g|'. O código
    numérico (que dá "Sem permissão") ou outro formato → None.
    """
    m = _CAMINHO_CANDIDATURAS.search(unquote(str(endereco or "")))
    if not m:
        return None
    ident = m.group(1)
    if _SO_CODIGO.match(ident) or not _ID_INTERNO.match(ident):
        return None
    return ident


def link_de_detalhe(endereco):
    """Link absoluto da página de detalhes do candidato, ou None se não for um."""
    texto = str(endereco or "").strip()
    if texto.startswith("/"):
        texto = URL_BASE + texto
    if len(texto) > 600 or "tokenCandidato=" not in texto or not _LINK_DETALHE.match(texto):
        return None
    return texto


class _Arvore(HTMLParser):
    """Árvore mínima do HTML (tag, atributos, filhos, pai), tolerante a tag sem fim."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = {"tag": "#raiz", "attrs": {}, "filhos": [], "pai": None}
        self.atual = self.raiz

    def handle_starttag(self, tag, attrs):
        no = {"tag": tag, "attrs": dict(attrs), "filhos": [], "pai": self.atual}
        self.atual["filhos"].append(no)
        if tag not in _TAGS_SEM_FIM:
            self.atual = no

    def handle_startendtag(self, tag, attrs):
        self.atual["filhos"].append({"tag": tag, "attrs": dict(attrs), "filhos": [], "pai": self.atual})

    def handle_endtag(self, tag):
        no = self.atual
        while no is not None and no["tag"] != tag:
            no = no["pai"]
        if no is not None and no["pai"] is not None:
            self.atual = no["pai"]


def _classes(no):
    return (no["attrs"].get("class") or "").split()


def _descendentes(no):
    pilha = list(reversed(no["filhos"]))
    while pilha:
        atual = pilha.pop()
        yield atual
        pilha.extend(reversed(atual["filhos"]))


def _codigo_do_no(no):
    return (no["attrs"].get("data-pessoa-id") or no["attrs"].get("data-pessoaid") or "").strip()


def ler_lista_de_candidatos(html):
    """
    Candidatos da lista de candidaturas: ([{"codigo", "link"}], descartados), na
    ordem da página. Com a estrutura do portal (div.curriculo-list-item), cada
    item dá um par: o href do a.link-curriculo e o data-pessoa-id do li do mesmo
    item. Sem ela, a leitura genérica. `descartados` = itens com link fora do
    formato aceito pelo banco (só para contar no log).
    """
    arvore = _Arvore()
    arvore.feed(str(html or ""))
    arvore.close()
    itens = [n for n in _descendentes(arvore.raiz) if "curriculo-list-item" in _classes(n)]
    if not itens:
        return _ler_generico(arvore), 0
    candidatos = []
    descartados = 0
    for item in itens:
        dentro = list(_descendentes(item))
        ancoras = [n for n in dentro if n["tag"] == "a" and "link-curriculo" in _classes(n)] or [
            n for n in dentro if n["tag"] == "a" and "/empresa/curriculo/detalhes" in (n["attrs"].get("href") or "")
        ]
        if not ancoras:
            continue
        link = link_de_detalhe(ancoras[0]["attrs"].get("href"))
        codigos = {c for c in (_codigo_do_no(n) for n in [item, *dentro]) if c}
        codigo = next(iter(codigos)) if len(codigos) == 1 else None
        if not link:
            descartados += 1
        elif codigo and _CODIGO_DO_CANDIDATO.match(codigo):
            candidatos.append({"codigo": codigo, "link": link})
    return candidatos, descartados


def ler_candidatos_do_html(html):
    """
    Candidatos da lista de candidaturas: [{"codigo", "link"}], na ordem da página
    (ver ler_lista_de_candidatos). Na leitura genérica, o código é o
    data-pessoa-id do bloco do candidato: do próprio link, de um ancestral ou de
    um vizinho no mesmo bloco (o menor bloco que tem um só data-pessoa-id). Link
    sem código, com código ambíguo ou fora do formato fica de fora.
    """
    return ler_lista_de_candidatos(html)[0]


def _ler_generico(arvore):
    # data-pessoa-id de cada subárvore, de baixo para cima (sem recursão: a lista pode ser longa).
    ordem = []
    pilha = [arvore.raiz]
    while pilha:
        no = pilha.pop()
        ordem.append(no)
        pilha.extend(no["filhos"])
    ids_por_no = {}
    for no in reversed(ordem):
        ids = set()
        proprio = _codigo_do_no(no)
        if proprio:
            ids.add(proprio)
        for filho in no["filhos"]:
            ids |= ids_por_no[id(filho)]
        ids_por_no[id(no)] = ids

    candidatos = []
    pilha = [arvore.raiz]
    while pilha:
        no = pilha.pop()
        pilha.extend(reversed(no["filhos"]))
        if no["tag"] != "a":
            continue
        link = link_de_detalhe(no["attrs"].get("href"))
        if not link:
            continue
        bloco = no
        while bloco is not None and not ids_por_no[id(bloco)]:
            bloco = bloco["pai"]
        ids = ids_por_no[id(bloco)] if bloco is not None else set()
        if len(ids) != 1:
            continue
        codigo = next(iter(ids))
        if _CODIGO_DO_CANDIDATO.match(codigo):
            candidatos.append({"codigo": codigo, "link": link})
    return candidatos


def juntar_candidatos(acumulado, novos):
    """Acrescenta em `acumulado` ({código: link}) os novos; vale o primeiro link de cada código. Devolve quantos entraram."""
    entraram = 0
    for c in novos:
        if c["codigo"] not in acumulado:
            acumulado[c["codigo"]] = c["link"]
            entraram += 1
    return entraram


def carregar_lista_inteira(
    contar,
    rolar,
    prazo=None,
    total=None,
    espera=ESPERA_POR_MAIS,
    rodadas_sem_novidade=RODADAS_SEM_NOVIDADE,
    intervalo=0.5,
    dormir=time.sleep,
    agora=time.monotonic,
):
    """
    Rolagem infinita: rola até o fim e espera (até `espera` s) a contagem crescer;
    para quando não cresce em `rodadas_sem_novidade` rolagens seguidas, quando
    chega ao `total` esperado (se conhecido), no prazo ou no limite de rolagens.
    Devolve a contagem final.
    """
    atual = contar()
    seguidas = 0
    for _ in range(LIMITE_DE_ROLAGENS):
        if (total and atual >= total) or (prazo is not None and agora() >= prazo):
            break
        rolar()
        fim = agora() + espera
        cresceu = False
        while agora() < fim:
            dormir(intervalo)
            novo = contar()
            if novo > atual:
                atual, cresceu = novo, True
                break
        seguidas = 0 if cresceu else seguidas + 1
        if seguidas >= rodadas_sem_novidade:
            break
    return atual


def percorrer_paginas(ler_pagina, proxima_pagina, limite=LIMITE_DE_PAGINAS, prazo=None, agora=time.monotonic):
    """
    Lê página por página até uma página não trazer candidato novo, não haver
    próxima, ou estourar o limite de páginas ou o prazo. Devolve {código: link}.
    """
    candidatos = {}
    for _ in range(limite):
        if not juntar_candidatos(candidatos, ler_pagina()):
            break
        if prazo is not None and agora() >= prazo:
            break
        if not proxima_pagina():
            break
    return candidatos


# ── Navegador ───────────────────────────────────────────────────────────────


class PortalEmpregare:
    """O Chrome logado no portal. Use com `with`: fecha o navegador no fim."""

    def __init__(self, pasta_de_download, registrar=print):
        self.pasta = pasta_de_download
        self.registrar = registrar
        self.driver = None
        self.ids_das_vagas = {}  # código da vaga → identificador interno (do link de candidaturas)
        self.tempo_em_links = 0.0  # segundos gastos lendo listas de candidatos (ORCAMENTO_DOS_LINKS)
        self.descartados = 0  # links fora do formato na última lista lida (só contagem)

    def __enter__(self):
        self.driver = self._iniciar()
        return self

    def __exit__(self, *_):
        try:
            if self.driver:
                self.driver.quit()
        except Exception:
            pass

    def _iniciar(self):
        import tempfile

        from selenium import webdriver

        perfil = tempfile.mkdtemp(prefix="chrome-empregare-")
        opcoes = webdriver.ChromeOptions()
        for argumento in (
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1920,1080",
            "--log-level=3",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            f"--user-data-dir={perfil}",
        ):
            opcoes.add_argument(argumento)
        if os.environ.get("CHROME_BIN"):
            opcoes.binary_location = os.environ["CHROME_BIN"]
        opcoes.add_experimental_option("excludeSwitches", ["enable-logging"])
        opcoes.add_experimental_option(
            "prefs",
            {
                "download.default_directory": self.pasta,
                "download.prompt_for_download": False,
                "download.directory_upgrade": True,
                "safebrowsing.enabled": True,
            },
        )
        driver = webdriver.Chrome(options=opcoes)
        driver.set_page_load_timeout(90)
        return driver

    # ── utilitários ──

    def _esperar(self, segundos):
        from selenium.webdriver.support.ui import WebDriverWait

        return WebDriverWait(self.driver, segundos)

    def clicar(self, elemento):
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elemento)
        self.driver.execute_script("arguments[0].click();", elemento)

    # ── login e vagas ──

    def entrar(self, email, senha):
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        d = self.driver
        d.get(URL_LOGIN)
        self._esperar(20).until(EC.presence_of_element_located((By.ID, "loginEmail"))).send_keys(email)
        self._esperar(20).until(EC.element_to_be_clickable((By.ID, "btn-login-avancar"))).click()
        time.sleep(1)
        self._esperar(20).until(EC.presence_of_element_located((By.ID, "loginSenha"))).send_keys(senha)
        self._esperar(20).until(EC.element_to_be_clickable((By.ID, "btn-login-acessar"))).click()
        try:
            self._esperar(30).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/empresa/vagas"]')))
        except TimeoutException as erro:
            if "/login" in (d.current_url or ""):
                raise ErroDeLogin(
                    "A Empregare não aceitou o login: confira EMPREGARE_EMAIL e EMPREGARE_SENHA "
                    "nos secrets do repositório."
                ) from erro
        time.sleep(2)

    def abrir_vagas_anunciadas(self):
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        try:
            link = self._esperar(15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/empresa/vagas"]'))
            )
            self.clicar(link)
        except TimeoutException:
            self.driver.get(URL_VAGAS)
        self._esperar(20).until(EC.presence_of_element_located((By.ID, "Palavras")))
        time.sleep(1)

    def _marcar_checkbox(self, id_campo):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        campo = self._esperar(20).until(EC.presence_of_element_located((By.ID, id_campo)))
        if campo.is_selected():
            return True
        rotulos = self.driver.find_elements(By.CSS_SELECTOR, f'label[for="{id_campo}"]')
        if rotulos:
            self.clicar(rotulos[0])
            time.sleep(0.5)
        if not campo.is_selected():
            self.clicar(campo)
            time.sleep(0.5)
        if not campo.is_selected():
            self.driver.execute_script(
                "arguments[0].checked = true;arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
                campo,
            )
            time.sleep(0.5)
        return campo.is_selected()

    def _selecionar_questionario(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import Select

        selects = [s for s in self.driver.find_elements(By.ID, "questionarioID") if s.is_displayed()]
        if not selects:
            return
        select = Select(selects[0])
        if select.first_selected_option.get_attribute("value"):
            return
        for opcao in select.options:
            if opcao.get_attribute("value"):
                select.select_by_value(opcao.get_attribute("value"))
                break

    def exportar_vaga(self, codigo):
        """Pede a exportação "Candidatos da vaga (Excel)" da vaga. True se pediu."""
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.support import expected_conditions as EC

        presente = EC.presence_of_element_located
        try:
            busca = self._esperar(20).until(presente((By.ID, "Palavras")))
            busca.send_keys(Keys.CONTROL + "a")
            busca.send_keys(Keys.DELETE)
            busca.send_keys(str(codigo))
            busca.send_keys(Keys.ENTER)
            time.sleep(3)

            processo = self._esperar(20).until(
                presente(
                    (
                        By.XPATH,
                        '//a[contains(@href,"/empresa/vagas/candidaturas/") and contains(.,"Processo Seletivo")]',
                    )
                )
            )
            self._guardar_id_da_vaga(codigo, lambda: processo.get_attribute("href"))
            self.clicar(processo)
            time.sleep(3)
            if str(codigo) not in self.ids_das_vagas:
                self._guardar_id_da_vaga(codigo, lambda: self.driver.current_url)

            relatorio = self._esperar(20).until(
                presente(
                    (
                        By.XPATH,
                        '//button[contains(@class,"dropdown-toggle") and contains(.,"Relatório e Indicadores")]',
                    )
                )
            )
            self.clicar(relatorio)
            time.sleep(1)

            exportar = self._esperar(20).until(
                presente((By.XPATH, '//a[contains(normalize-space(.),"Exportar Candidatos")]'))
            )
            self.clicar(exportar)

            self._esperar(20).until(EC.visibility_of_element_located((By.ID, "btn-exportar-candidatos")))
            self._marcar_checkbox("ExportarQuestionarioResposta")
            time.sleep(1)
            self._selecionar_questionario()
            self._marcar_checkbox("ExportarCompetenciaResposta")
            time.sleep(1)

            self.clicar(self._esperar(20).until(presente((By.ID, "btn-exportar-candidatos"))))
            try:
                ok = self._esperar(10).until(presente((By.CSS_SELECTOR, "button.confirm, button.swal2-confirm")))
                self.clicar(ok)
            except TimeoutException:
                pass
            time.sleep(3)
            self.abrir_vagas_anunciadas()
            return True
        except Exception as erro:
            self.registrar(f"Vaga {codigo}: não consegui pedir a exportação ({resumo_do_erro(erro)}).")
            try:
                self.abrir_vagas_anunciadas()
            except Exception:
                pass
            return False

    # ── Links da vaga e dos candidatos ──

    def _guardar_id_da_vaga(self, codigo, ler_endereco):
        """Guarda o identificador interno lido do endereço; nunca levanta (a exportação não depende disto)."""
        try:
            ident = id_interno_da_vaga(ler_endereco())
        except Exception:
            ident = None
        if ident:
            self.ids_das_vagas[str(codigo)] = ident
        return ident

    def capturar_candidatos(self, codigo, total=None):
        """
        Links da vaga para o banco: {"vaga_interno": id, "candidatos": {código: link}},
        ou None sem o identificador interno da vaga. Nunca levanta: falha vira aviso
        (só contagens no log) e a exportação segue. Volta para Vagas Anunciadas.
        """
        ident = self.ids_das_vagas.get(str(codigo))
        if not ident:
            self.registrar(f"Vaga {codigo}: sem o identificador interno da vaga; links dos candidatos não capturados.")
            return None
        candidatos = {}
        self.descartados = 0
        restante = ORCAMENTO_DOS_LINKS - self.tempo_em_links
        if restante <= 0:
            self.registrar(f"Vaga {codigo}: tempo dos links esgotado nesta execução; só o identificador da vaga.")
            return {"vaga_interno": ident, "candidatos": candidatos}
        inicio = time.monotonic()
        try:
            prazo = inicio + min(TEMPO_LIMITE_DA_LISTA, restante)
            self._abrir_candidaturas(ident)
            candidatos = percorrer_paginas(
                lambda: self._carregar_e_ler_pagina(prazo, total), self._proxima_pagina, prazo=prazo
            )
            if time.monotonic() >= prazo:
                self.registrar(
                    f"Vaga {codigo}: a lista de candidatos passou de {TEMPO_LIMITE_DA_LISTA}s; ficou o que deu."
                )
            fora = f" ({self.descartados} com link fora do formato)" if self.descartados else ""
            self.registrar(f"Vaga {codigo}: {len(candidatos)} link(s) de candidato capturado(s){fora}.")
        except Exception as erro:
            self.registrar(
                f"Vaga {codigo}: não consegui ler a lista de candidatos ({resumo_do_erro(erro)}); "
                f"segue com {len(candidatos)} link(s)."
            )
        finally:
            self.tempo_em_links += time.monotonic() - inicio
            try:
                self.abrir_vagas_anunciadas()
            except Exception:
                pass
        return {"vaga_interno": ident, "candidatos": candidatos}

    def _esperar_a_lista(self):
        """Espera o AJAX trazer a 1ª página (.curriculo-list-item a.link-curriculo). False se não veio."""
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        try:
            self._esperar(ESPERA_PELA_LISTA).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, SELETOR_LINK_DA_LISTA))
            )
            return True
        except TimeoutException:
            return False

    def _abrir_candidaturas(self, ident):
        """Candidaturas da vaga, na aba Todos quando ela existe; espera o AJAX da lista."""
        self.driver.get(URL_CANDIDATURAS + ident)
        veio = self._esperar_a_lista()
        if self.driver.execute_script(JS_ABA_TODOS):
            time.sleep(3)  # a aba pode recarregar a página
            veio = self._esperar_a_lista()
        if not veio:
            time.sleep(ESPERA_DA_LISTA)  # vaga sem candidato ou tela diferente: a leitura genérica ainda tenta

    def _carregar_e_ler_pagina(self, prazo, total=None):
        """Rola até a lista parar de crescer (rolagem infinita) e lê os candidatos carregados."""
        carregar_lista_inteira(
            lambda: self.driver.execute_script(JS_CONTAR_LINKS) or 0,
            lambda: self.driver.execute_script(JS_ROLAR_LISTA),
            prazo=prazo,
            total=total,
            espera=ESPERA_POR_MAIS,
            intervalo=INTERVALO_DA_LISTA,
        )
        candidatos, descartados = ler_lista_de_candidatos(self.driver.page_source)
        self.descartados = max(self.descartados, descartados)
        return candidatos

    def _proxima_pagina(self):
        """Clica na próxima página da lista, se houver. True se mudou de página."""
        primeiro = self.driver.execute_script(JS_PRIMEIRO_LINK)
        if not self.driver.execute_script(JS_PROXIMA_PAGINA):
            return False
        fim = time.monotonic() + 20
        while time.monotonic() < fim:
            time.sleep(ESPERA_DA_LISTA)
            if self.driver.execute_script(JS_PRIMEIRO_LINK) != primeiro:
                return True
        return False

    # ── Central de Exportações ──

    def abrir_central(self):
        from selenium.common.exceptions import TimeoutException
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        try:
            config = self._esperar(15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/empresa/configuracoes"]'))
            )
            self.clicar(config)
            central = self._esperar(15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/empresa/exportacoes"]'))
            )
            self.clicar(central)
        except TimeoutException:
            self.driver.get(URL_EXPORTACOES)
        try:
            self._esperar(30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".tabulator-row, .tabulator-tableholder"))
            )
        except TimeoutException:
            self.registrar("A tabela da Central de Exportações demorou a carregar.")
        time.sleep(2)

    def ler_central(self):
        encontradas = {}

        def coletar():
            for linha in self.driver.execute_script(JS_LER_LINHAS) or []:
                if linha.get("vaga"):
                    encontradas[linha.get("id") or (linha["vaga"] + linha.get("data", ""))] = linha

        coletar()
        posicao = 0
        for _ in range(200):
            posicao += 400
            atual, maximo = self.driver.execute_script(JS_ROLAR, posicao)
            time.sleep(0.4)
            coletar()
            if maximo <= 0 or atual >= maximo:
                break
        self.driver.execute_script(JS_ROLAR, 0)
        return list(encontradas.values())

    def _apontar_downloads(self, pasta):
        from selenium.common.exceptions import WebDriverException

        os.makedirs(pasta, exist_ok=True)
        try:
            self.driver.execute_cdp_cmd(
                "Browser.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": pasta, "eventsEnabled": True},
            )
        except WebDriverException:
            self.driver.execute_cdp_cmd("Page.setDownloadBehavior", {"behavior": "allow", "downloadPath": pasta})

    def baixar(self, linha, pasta):
        """Baixa a exportação da linha para `pasta`. Devolve o caminho ou None."""
        from selenium.webdriver.common.by import By

        self._apontar_downloads(pasta)
        antes = arquivos_prontos(pasta)
        href = linha["href"]
        try:
            self.clicar(self.driver.find_element(By.CSS_SELECTOR, f'a[href="{href}"]'))
        except Exception:
            url = href if href.startswith("http") else URL_BASE + href
            self.driver.execute_script(
                "const a = document.createElement('a');"
                "a.href = arguments[0]; a.target = '_self';"
                "document.body.appendChild(a); a.click(); a.remove();",
                url,
            )
        arquivo = esperar_download(pasta, antes)
        return os.path.join(pasta, arquivo) if arquivo else None


def arquivos_prontos(pasta):
    return {f for f in os.listdir(pasta) if not f.endswith((".crdownload", ".tmp"))}


def esperar_download(pasta, antes, limite=TIMEOUT_DOWNLOAD, agora=time.time, dormir=time.sleep):
    fim = agora() + limite
    while agora() < fim:
        em_andamento = any(f.endswith(".crdownload") for f in os.listdir(pasta))
        novos = arquivos_prontos(pasta) - antes
        if novos and not em_andamento:
            return sorted(novos)[0]
        dormir(1)
    return None
