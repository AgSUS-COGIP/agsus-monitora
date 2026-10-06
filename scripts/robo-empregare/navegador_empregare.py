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
"""

import os
import re
import time
from datetime import datetime, timedelta

from monitora.mascaramento import resumo_do_erro

URL_BASE = "https://corporate.empregare.com"
URL_LOGIN = URL_BASE + "/empresa/login"
URL_VAGAS = URL_BASE + "/empresa/vagas"
URL_EXPORTACOES = URL_BASE + "/empresa/exportacoes"

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


# ── Navegador ───────────────────────────────────────────────────────────────


class PortalEmpregare:
    """O Chrome logado no portal. Use com `with`: fecha o navegador no fim."""

    def __init__(self, pasta_de_download, registrar=print):
        self.pasta = pasta_de_download
        self.registrar = registrar
        self.driver = None

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
            self.clicar(processo)
            time.sleep(3)

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
