"""
O ARQUIVO de um anexo do questionário na Empregare, para a leitura automática.

O robô grava por anexo o link "Visualizar Arquivo"
(/Company/VacancyTests/GetViewerLogArquivo?arquivo=<nome>&nome=Case&token=…),
que abre o visualizador da Empregare e REGISTRA a visualização. Para ler, o
robô abre direto o visualizador (/Company/Viewer?arquivo=<nome>&nome=Case, o
mesmo que o link abre), com a sessão do Chrome já logada, e procura nele o
arquivo de verdade, nesta ordem:

  1. a própria resposta já é o arquivo (PDF/imagem, não HTML);
  2. o botão "Baixar Arquivo" (href, data-url, data-href ou a URL no onclick);
  3. o que o visualizador embute (iframe, embed, object, img), inclusive o
     endereço dentro de um visualizador do Google ou do Office (?url= / ?src=);
  4. qualquer endereço no HTML que traga o nome do arquivo.

Endereço da Empregare: GET pela própria página (fetch com a sessão); de outro
domínio (armazenamento do arquivo): GET sem cookie. O arquivo fica SÓ na
memória do robô (nunca em disco, artifact ou log) e é descartado depois da
leitura. No log, só contagens e códigos de erro; os links passam por
mascarar() (o nome do arquivo e os tokens viram <token>).

Testes: tests/python/test_leitura_de_arquivos_robo.py (HTML sintético).
"""

import base64
import re
import urllib.error
import urllib.request
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote, unquote, urljoin, urlsplit

URL_BASE = "https://corporate.empregare.com"
CAMINHO_DO_VISUALIZADOR = "/Company/Viewer"
TAMANHO_MAXIMO = 25 * 1024 * 1024  # bytes
TEMPO_DO_DOWNLOAD = 60  # segundos por pedido
_ARQUIVO = re.compile(r"^[A-Za-z0-9 _.()~+=-]{1,300}$")
_URL_NO_TEXTO = re.compile(r"""(https?://[^\s'"<>()]+|/[A-Za-z0-9_\-/.%~+]*\?[^\s'"<>()]*)""")
_VISUALIZADOR_EXTERNO = re.compile(r"docs\.google\.com/(?:viewer|gview)|view\.officeapps\.live\.com|officeapps", re.I)

# fetch com a sessão (mesma origem). arguments[0]: url, arguments[1]: limite em bytes.
JS_BAIXAR = """
const pronto = arguments[arguments.length - 1];
const url = arguments[0];
const limite = arguments[1];
const ctrl = new AbortController();
const relogio = setTimeout(function () { ctrl.abort(); }, 60000);
fetch(url, {method: 'GET', credentials: 'include', redirect: 'follow', signal: ctrl.signal})
  .then(function (r) {
    return r.arrayBuffer().then(function (buf) {
      clearTimeout(relogio);
      let login = false;
      try { login = /login|entrar|signin/i.test(new URL(r.url).pathname); } catch (e) { login = false; }
      const base = {status: r.status, tipo: r.headers.get('content-type') || '', tamanho: buf.byteLength,
                    login: login, final: r.url};
      if (buf.byteLength > limite) { base.grande = true; return pronto(base); }
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      base.base64 = btoa(bin);
      return pronto(base);
    });
  })
  .catch(function (e) { clearTimeout(relogio); pronto({status: null, erro: String((e && e.name) || 'erro')}); });
"""


class ErroNoArquivo(Exception):
    """Não deu para baixar: o código (curto, sem dado pessoal) vai para a leitura (situação ERRO)."""

    def __init__(self, codigo):
        super().__init__(codigo)
        self.codigo = codigo


def nome_do_arquivo(link):
    """O parâmetro `arquivo` do link da Empregare (o nome que ela guardou), ou None."""
    try:
        valor = (parse_qs(urlsplit(str(link or "")).query).get("arquivo") or [""])[0]
    except ValueError:
        return None
    valor = unquote(valor).strip()
    return valor if _ARQUIVO.match(valor) else None


def link_do_visualizador(link):
    """O visualizador da Empregare para o arquivo do link "Visualizar Arquivo"; None fora do formato."""
    arquivo = nome_do_arquivo(link)
    if not arquivo:
        return None
    return f"{URL_BASE}{CAMINHO_DO_VISUALIZADOR}?arquivo={quote(arquivo, safe='._-')}&nome=Case"


class _Leitor(HTMLParser):
    """Os endereços do visualizador: do botão "Baixar", embutidos e soltos no HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.baixar, self.embutidos = [], []
        self._abertos = []  # (tag, [urls]) dos links/botões ainda abertos, para ler o texto

    @staticmethod
    def _urls_dos_atributos(attrs):
        urls = []
        for nome in ("href", "data-url", "data-href", "data-src", "data-arquivo", "data-file", "data-link"):
            if attrs.get(nome):
                urls.append(attrs[nome])
        if attrs.get("onclick"):
            urls.extend(m.group(1) for m in _URL_NO_TEXTO.finditer(attrs["onclick"]))
            urls.extend(re.findall(r"""['"]([^'"]+\.(?:pdf|jpe?g|png|docx?)[^'"]*)['"]""", attrs["onclick"], re.I))
        return [u for u in urls if u and not u.lower().startswith(("javascript:", "#", "mailto:"))]

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag in ("iframe", "embed", "object", "img", "source"):
            for nome in ("src", "data", "data-src"):
                if a.get(nome):
                    self.embutidos.append(a[nome])
        if tag in ("a", "button"):
            rotulo = " ".join(a.get(n, "") for n in ("title", "aria-label", "download", "id", "class"))
            urls = self._urls_dos_atributos(a)
            if re.search(r"baixar|download", rotulo, re.I) and urls:
                self.baixar.extend(urls)
            self._abertos.append((tag, urls))

    def handle_endtag(self, tag):
        for i in range(len(self._abertos) - 1, -1, -1):
            if self._abertos[i][0] == tag:
                del self._abertos[i:]
                break

    def handle_data(self, data):
        if re.search(r"baixar|download", data, re.I):
            for _tag, urls in self._abertos:
                self.baixar.extend(urls)


def _de_visualizador_externo(url):
    """O endereço de dentro do visualizador do Google/Office (?url= / ?src=), ou None."""
    if not _VISUALIZADOR_EXTERNO.search(url):
        return None
    consulta = parse_qs(urlsplit(url).query)
    for chave in ("url", "src"):
        if consulta.get(chave):
            return consulta[chave][0]
    return None


def candidatos_de_download(html, arquivo, base=URL_BASE):
    """Os endereços do arquivo no HTML do visualizador, do mais provável ao menos, sem repetir."""
    leitor = _Leitor()
    try:
        leitor.feed(str(html or ""))
    except Exception:  # HTML quebrado: segue com o que leu
        pass
    texto = unescape(str(html or ""))
    soltos = [m.group(1) for m in _URL_NO_TEXTO.finditer(texto)]
    nome = (arquivo or "").lower()
    com_nome = [u for u in soltos if nome and nome in unquote(u).lower()]
    ordem = []
    for url in leitor.baixar + leitor.embutidos + com_nome:
        interno = _de_visualizador_externo(urljoin(base + "/", url))
        if interno:
            ordem.append(interno)
        ordem.append(url)
    saida = []
    for url in ordem:
        absoluto = urljoin(base + "/", unescape(url).strip()).split("#")[0]
        if not absoluto.startswith(("https://", "http://")) or _VISUALIZADOR_EXTERNO.search(absoluto):
            continue
        if CAMINHO_DO_VISUALIZADOR.lower() in urlsplit(absoluto).path.lower():
            continue  # o próprio visualizador
        if absoluto not in saida:
            saida.append(absoluto)
    return saida


def da_empregare(url):
    return urlsplit(url).netloc.lower() == urlsplit(URL_BASE).netloc


def eh_html(tipo, conteudo):
    if "html" in (tipo or "").lower():
        return True
    inicio = bytes(conteudo[:200]).lstrip().lower()
    return inicio.startswith((b"<!doctype html", b"<html", b"<head", b"<body"))


def _com_a_sessao(driver, url):
    driver.set_script_timeout(TEMPO_DO_DOWNLOAD + 30)
    r = driver.execute_async_script(JS_BAIXAR, url, TAMANHO_MAXIMO) or {}
    if r.get("login"):
        raise ErroNoArquivo("sessao_expirada")
    if r.get("grande"):
        raise ErroNoArquivo("arquivo_grande_demais")
    if r.get("status") != 200:
        raise ErroNoArquivo(f"http_{r.get('status') or 'sem_resposta'}")
    return r.get("tipo") or "", base64.b64decode(r.get("base64") or "")


def _sem_cookie(url, abrir=urllib.request.urlopen):
    pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (MONITORA leitura de arquivos)"})
    try:
        with abrir(pedido, timeout=TEMPO_DO_DOWNLOAD) as resposta:
            conteudo = resposta.read(TAMANHO_MAXIMO + 1)
            if len(conteudo) > TAMANHO_MAXIMO:
                raise ErroNoArquivo("arquivo_grande_demais")
            return resposta.headers.get("Content-Type", ""), conteudo
    except urllib.error.HTTPError as erro:
        raise ErroNoArquivo(f"http_{erro.code}") from None
    except (urllib.error.URLError, TimeoutError, ConnectionError) as erro:
        raise ErroNoArquivo("rede") from erro


def baixar(driver, link, sem_cookie=_sem_cookie):
    """
    Os bytes do arquivo do link "Visualizar Arquivo" (só na memória).
    Falhou: ErroNoArquivo com o código (link_fora_do_formato, http_404, sem_link_de_download…).
    """
    visualizador = link_do_visualizador(link)
    if not visualizador:
        raise ErroNoArquivo("link_fora_do_formato")
    tipo, conteudo = _com_a_sessao(driver, visualizador)
    if conteudo and not eh_html(tipo, conteudo):
        return conteudo
    candidatos = candidatos_de_download(conteudo.decode("utf-8", "replace"), nome_do_arquivo(link))
    if not candidatos:
        raise ErroNoArquivo("sem_link_de_download")
    ultimo = "download_falhou"
    for url in candidatos[:5]:
        try:
            tipo, bytes_ = _com_a_sessao(driver, url) if da_empregare(url) else sem_cookie(url)
        except ErroNoArquivo as erro:
            ultimo = erro.codigo
            continue
        if bytes_ and not eh_html(tipo, bytes_):
            return bytes_
        ultimo = "download_trouxe_html"
    raise ErroNoArquivo(ultimo)


def _caminho_generico(url):
    """O caminho sem o último trecho e sem números/identificadores (o log é público)."""
    pasta = urlsplit(url).path.rsplit("/", 1)[0]
    return re.sub(r"[0-9a-fA-F-]{8,}|\d{3,}", "#", pasta) + "/…"


def sondar_visualizador(driver, link):
    """Só a estrutura do visualizador para o log (modo sondar): status, tipo, quantos endereços e de onde."""
    visualizador = link_do_visualizador(link)
    if not visualizador:
        return {"erro": "link_fora_do_formato"}
    try:
        tipo, conteudo = _com_a_sessao(driver, visualizador)
    except ErroNoArquivo as erro:
        return {"erro": erro.codigo}
    if conteudo and not eh_html(tipo, conteudo):
        return {"visualizador": "arquivo direto", "tipo": tipo.split(";")[0], "bytes": len(conteudo)}
    leitor = _Leitor()
    html = conteudo.decode("utf-8", "replace")
    try:
        leitor.feed(html)
    except Exception:
        pass
    candidatos = candidatos_de_download(html, nome_do_arquivo(link))
    return {
        "visualizador": "html",
        "botao_baixar": len(leitor.baixar),
        "embutidos": len(leitor.embutidos),
        "candidatos": len(candidatos),
        "hosts": sorted({urlsplit(u).netloc for u in candidatos}),
        "caminhos": sorted({_caminho_generico(u) for u in candidatos})[:5],
    }
