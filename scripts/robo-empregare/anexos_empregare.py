"""
Os ANEXOS do questionário de cada candidato na Empregare.

A exportação da Empregare não traz o link dos anexos (só "Sim"/"--"). O
caminho real (investigado em 08/10/2026, só leitura, e conferido no front
da Empregare, chunk 8152 — questionarioResposta.detalhes): na lista de
candidaturas, cada candidato tem a.progress-link[data-resposta] (um por
questionário; data-modo-resposta 3 é a entrevista virtual, fora), com
data-token e data-vagaTitulo; o item tem data-id (a pessoa) e
data-tokenCandidato. O clique faz GET XHR
/Company/VacancyTests/GetRespostaDetails/<respostaID>?token=<token>, que
devolve JSON: {sucesso, questionario: {id, totalPerguntas, respostas:
[{PerguntaID, Ordem, Pergunta, TipoResposta, Resposta, RespostaID…}]}}. No
anexo (TipoResposta 4), Resposta é o nome do arquivo, e o front monta:
  - "Visualizar Arquivo": /Company/VacancyTests/GetViewerLogArquivo?arquivo=
    <Resposta>&nome=Case&token=<token>&questionarioRespostaID=<RespostaID>&
    perguntaID=<PerguntaID> (estável, abre com login e REGISTRA a visualização);
  - impressão: /Company/VacancyTests/PrintResult?respostaID=<questionario.id>&
    pessoa=<data-id>&vaga=<título da vaga>.
A Ordem bate com o "Pergunta N" da exportação.

  - CAPTURAR (modo normal com --anexos): para cada candidato e resposta, o GET
    com a sessão do Chrome (fetch na página); lê o JSON
    (ler_detalhes_da_resposta), monta os links, casa com a coluna do Excel
    pela Ordem (confirmada pelo enunciado) e grava por gravar_anexos_empregare
    (migration 20261008160000_anexos_do_questionario_na_empregare.sql). O robô
    NUNCA abre os arquivos e nunca loga o nome deles. No log, só contagens.
  - SONDAR (modo `sondar`, só leitura): a estrutura das abas e dos clicáveis
    do candidato e o GET de GetRespostaDetails (status, respostas, tipos,
    anexos, Ordens), tudo contado ou com o padrão mascarado. Nunca nome, CPF,
    e-mail, nome de arquivo, token nem URL completa; nunca clica em "Zerar
    Tentativas", "Excluir Respostas" nem compartilhar.

Testes: tests/python/test_anexos_empregare.py (JSON sintético). Guia: docs/robo-empregare.md.
"""

import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from html import unescape as html_unescape
from urllib.parse import parse_qsl, quote, unquote, urljoin, urlsplit

from monitora.mascaramento import mascarar, resumo_do_erro

URL_BASE = "https://corporate.empregare.com"
MASCARA = "<MASCARADO>"

ESPERA_PELO_QUESTIONARIO = 12  # segundos até a aba mostrar perguntas ou arquivos
INTERVALO = 0.5
ESPERA_DA_PAGINA = 2  # segundos depois de abrir a página do candidato
TEMPO_DO_HEAD = 15
LIMITE_DA_SONDAGEM = 3  # candidatos
ANEXOS_POR_CANDIDATO_NO_LOG = 10
TAMANHO_DO_LOTE = 200  # respostas por chamada da RPC

ANCORA = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,60}$")

# ── JavaScript (só estrutura; o Python mascara tudo antes do log) ───────────

JS_VISIVEL = """
const visivel = function (el) { return !!(el && (el.offsetParent || el.getClientRects().length)); };
const texto = function (el) { return (el ? (el.innerText || el.textContent || '') : '').replace(/\\s+/g, ' ').trim(); };
"""

_RE_ARQUIVO_JS = (
    "/download|arquivo|anexo|upload|\\/files?\\/|\\.(pdf|jpe?g|png|gif|bmp|tiff?|docx?|odt|xlsx?|zip|rar|heic|webp)"
    "(\\?|#|$)|amazonaws|cloudfront|blob\\.core|storage\\.googleapis|drive\\.google/i"
)

JS_CONTAR_QUESTIONARIO = (
    JS_VISIVEL
    + f"""
const reArq = {_RE_ARQUIVO_JS};
const links = Array.from(document.querySelectorAll('a[href], [data-url], [data-href]')).filter(function (a) {{
  return reArq.test(a.getAttribute('href') || a.getAttribute('data-url') || a.getAttribute('data-href') || '');
}}).length;
const perguntas = document.querySelectorAll('[class*="pergunta" i], [class*="question" i]').length;
return links + perguntas;
"""
)

# A leitura da aba (no documento ou num iframe da mesma origem). arguments[0]: máximo de arquivos.
JS_LER_QUESTIONARIO = (
    JS_VISIVEL
    + f"""
const maximo = arguments[0] || 50;
const reArq = {_RE_ARQUIVO_JS};
const reUrl = /(https?:\\/\\/[^\\s'"<>)]+|\\/[A-Za-z0-9_\\-\\/.%~+|]*\\?[^\\s'"<>)]*|\\/[A-Za-z0-9_\\-\\/.%~+|]{{3,}})/g;
const atributos = ['href', 'data-url', 'data-href', 'data-src', 'data-arquivo', 'data-file', 'data-link', 'onclick', 'src'];
const absoluto = function (u) {{ try {{ return new URL(u, location.href).href; }} catch (e) {{ return ''; }} }};
const descrever = function (el) {{
  if (!el || el === document.body) {{ return 'body'; }}
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + Array.from(el.classList).slice(0, 4).map(function (c) {{ return '.' + c; }}).join('');
}};

const candidatosAPainel = Array.from(document.querySelectorAll(
  '[id*="questionario" i], [class*="questionario" i], [id*="questionnaire" i], .tab-pane.active, .tab-pane.show'
)).filter(visivel);
candidatosAPainel.sort(function (a, b) {{
  const qa = /question/i.test(a.id + ' ' + a.className) ? 1 : 0;
  const qb = /question/i.test(b.id + ' ' + b.className) ? 1 : 0;
  return (qb - qa) || (texto(b).length - texto(a).length);
}});
const modais = Array.from(document.querySelectorAll('.modal.in, .modal.show')).filter(visivel);
const painel = modais[0] || candidatosAPainel[0] || document.body;

const todosBlocos = Array.from(painel.querySelectorAll(
  '[class*="pergunta" i], [class*="question" i]:not([class*="questionario" i]):not([class*="questionnaire" i])'
));
const blocos = todosBlocos.filter(function (b) {{
  return !todosBlocos.some(function (o) {{ return o !== b && b.contains(o); }});
}});
const textoDoPainel = texto(painel);
const porTexto = (textoDoPainel.match(/pergunta\\s*\\d{{1,3}}/gi) || []).length;

const contar = function (s) {{ try {{ return document.querySelectorAll(s).length; }} catch (e) {{ return -1; }} }};
const seletores = {{}};
['.pergunta', '.resposta', '[class*="pergunta" i]', '[class*="resposta" i]', '[class*="question" i]',
 '[class*="anexo" i]', '[class*="arquivo" i]', 'a[download]', 'a[href*="download" i]', 'a[href*="arquivo" i]',
 'a[href*="anexo" i]', 'a[href$=".pdf" i]', '[data-url]', '[data-href]', '[onclick*="download" i]',
 '[onclick*="arquivo" i]', 'a[target="_blank"]', 'iframe', 'table', 'ol > li', '.panel', '.card'
].forEach(function (s) {{ seletores[s] = contar(s); }});

const classes = new Set();
painel.querySelectorAll('[class]').forEach(function (el) {{
  el.classList.forEach(function (c) {{ if (/pergunt|quest|respost|anexo|arquivo|upload|download|file/i.test(c)) {{ classes.add(c); }} }});
}});

const semLinks = function (el) {{
  const copia = el.cloneNode(true);
  copia.querySelectorAll('a, button, script, style').forEach(function (x) {{ x.remove(); }});
  return texto(copia);
}};
const enunciadoDe = function (el) {{
  let bloco = el.parentElement;
  for (let i = 0; bloco && bloco !== document.body && i < 10; i++) {{
    if (semLinks(bloco).length >= 12) {{ break; }}
    bloco = bloco.parentElement;
  }}
  if (!bloco) {{ return ''; }}
  const cabecas = Array.from(bloco.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, label, legend, dt, th, strong, b, .pergunta, [class*="pergunta" i], [class*="titulo" i], [class*="enunciado" i]'
  )).filter(function (c) {{ return !c.contains(el) && !c.closest('a, button') && texto(c).length >= 5; }});
  return (cabecas.length ? texto(cabecas[0]) : semLinks(bloco)).slice(0, 600);
}};
const ancoraDe = function (el) {{
  let p = el;
  while (p && p !== document.body) {{
    if (p.id && /^[A-Za-z][A-Za-z0-9_-]{{0,60}}$/.test(p.id)) {{ return p.id; }}
    if (p === painel) {{ break; }}
    p = p.parentElement;
  }}
  return '';
}};

const vistos = new Set();
const arquivos = [];
painel.querySelectorAll('a, button, [data-url], [data-href], [data-arquivo], [data-file], [onclick], iframe, embed, object')
  .forEach(function (el) {{
    if (arquivos.length >= maximo) {{ return; }}
    atributos.forEach(function (atr) {{
      const bruto = el.getAttribute(atr);
      if (!bruto) {{ return; }}
      const valores = atr === 'onclick' ? (bruto.match(reUrl) || []) : [bruto];
      valores.forEach(function (v) {{
        if (/^(javascript:|#|mailto:|tel:)/i.test(v)) {{ return; }}
        if (!/^https?:/i.test(v) && v.indexOf('/') < 0) {{ return; }}  // nome de arquivo solto: não é link
        if (!reArq.test(v) && !el.hasAttribute('download')) {{ return; }}
        const href = absoluto(v);
        if (!href || vistos.has(href) || arquivos.length >= maximo) {{ return; }}
        vistos.add(href);
        const bloco = blocos.findIndex(function (b) {{ return b.contains(el); }});
        arquivos.push({{
          href: href,
          tag: el.tagName.toLowerCase(),
          atributo: atr,
          download: el.hasAttribute('download'),
          texto_do_link: texto(el).length,
          enunciado: enunciadoDe(el),
          ordem: bloco >= 0 ? bloco + 1 : null,
          ancora: ancoraDe(el)
        }});
      }});
    }});
  }});

const imprimir = Array.from(document.querySelectorAll('a[href*="/questionarios/imprimir/" i]'))
  .map(function (a) {{ return a.href; }});
const iframes = Array.from(document.querySelectorAll('iframe')).map(function (f) {{ return absoluto(f.getAttribute('src') || ''); }});
return {{
  caminho: location.pathname,
  titulo: (document.title || '').slice(0, 120),
  painel: descrever(painel),
  perguntas_por_classe: blocos.length,
  perguntas_por_texto: porTexto,
  seletores: seletores,
  classes: Array.from(classes).slice(0, 40),
  arquivos: arquivos,
  imprimir: imprimir.slice(0, 5),
  iframes: iframes.slice(0, 5)
}};
"""
)

# HEAD com a sessão do navegador (só mesma origem). Devolve status, 'redireciona' ou 'erro'.
JS_HEAD_COM_SESSAO = """
const pronto = arguments[arguments.length - 1];
fetch(arguments[0], {method: 'HEAD', credentials: 'include', redirect: 'manual'})
  .then(function (r) { pronto(r.type === 'opaqueredirect' ? 'redireciona' : r.status); })
  .catch(function () { pronto('erro'); });
"""


# ── Regras puras: padrão do link, assinatura, enunciado ─────────────────────

_SEGMENTO_SEGURO = re.compile(r"^[A-Za-z_]{1,24}$")
_HOST_SEGURO = re.compile(r"^[a-z][a-z0-9-]{0,40}$")
_PARAMETRO_SEGURO = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,40}$")
_ASSINATURA = re.compile(
    r"(?i)(signature|^sig$|expires?|^exp$|token|^x-amz-|^x-goog-|^se$|^sv$|^st$|^sp$|^sr$|hash|^key$|policy|credential)"
)
_EXTENSAO = re.compile(r"\.([A-Za-z0-9]{2,5})$")


def _host_mascarado(host):
    partes = []
    for p in (host or "").lower().split("."):
        if _HOST_SEGURO.match(p) and not re.search(r"\d{5,}", p):
            partes.append(p)
        else:
            partes.append(MASCARA)
    return ".".join(partes)


def padrao_do_link(endereco, base=URL_BASE):
    """
    O PADRÃO do link para o log: esquema, host, só os trechos do caminho que são
    uma palavra (o resto, inclusive ids, tokens e nome de arquivo, vira
    <MASCARADO>), a extensão do arquivo e os NOMES dos parâmetros (valores
    mascarados). Ex.: https://arquivos.exemplo/anexos/<MASCARADO> (extensão
    .pdf; parâmetros: X-Amz-Expires=<MASCARADO>).
    """
    texto = str(endereco or "").strip()
    if not texto:
        return "—"
    if texto.lower().startswith(("javascript:", "data:", "blob:", "mailto:")):
        return f"<{texto.split(':', 1)[0].lower()}:…>"
    try:
        u = urlsplit(urljoin(base + "/", texto))
    except ValueError:
        return "<link ilegível>"
    if u.scheme not in ("http", "https"):
        return f"<{u.scheme or 'sem esquema'}>"
    segmentos = u.path.split("/")[1:]
    caminho = "/" + "/".join(s if (not s or _SEGMENTO_SEGURO.match(s)) else MASCARA for s in segmentos)
    porta = f":{u.port}" if u.port else ""
    saida = f"{u.scheme}://{_host_mascarado(u.hostname)}{porta}{caminho}"
    nomes = []
    for nome, _valor in parse_qsl(u.query, keep_blank_values=True):
        nomes.append(f"{nome if _PARAMETRO_SEGURO.match(nome) else MASCARA}={MASCARA}")
    if nomes:
        saida += "?" + "&".join(nomes[:12]) + ("&…" if len(nomes) > 12 else "")
    if u.fragment:
        saida += "#" + (u.fragment if ANCORA.match(u.fragment) else MASCARA)
    extensao = _EXTENSAO.search(unquote(segmentos[-1])) if segmentos else None
    if extensao:
        saida += f" (extensão .{extensao.group(1).lower()})"
    return saida


def parametros_de_assinatura(endereco):
    """Nomes dos parâmetros do link que indicam assinatura ou validade (X-Amz-Signature, Expires, token…)."""
    try:
        u = urlsplit(str(endereco or ""))
    except ValueError:
        return []
    return [n for n, _v in parse_qsl(u.query, keep_blank_values=True) if _ASSINATURA.search(n)]


_ARQUIVO_NO_TEXTO = re.compile(r"\S+\.(pdf|jpe?g|png|gif|bmp|tiff?|docx?|odt|xlsx?|zip|rar|heic|webp)\b", re.I)
_PARECE_ENUNCIADO = re.compile(
    r"(?i)(anex|envi|comprov|document|certific|diploma|declara|arquivo|upload|carteira|registro|"
    r"identidade|rg\b|cpf\b|curr[ií]culo|t[ií]tulo|experi[eê]ncia|forma[cç][aã]o|\?)"
)


def limpar_enunciado(texto, maximo=2000):
    """O enunciado sem nome de arquivo, sem espaços repetidos e no tamanho do banco."""
    t = _ARQUIVO_NO_TEXTO.sub("", str(texto or ""))
    t = re.sub(r"\s+", " ", t).strip()
    return t[:maximo]


def enunciado_para_o_log(texto, maximo=160):
    """
    O enunciado no log só se parecer enunciado de edital (pede anexo, documento,
    comprovante…): sem nome de arquivo e mascarado. Senão, só o tamanho.
    """
    t = limpar_enunciado(texto)
    if not t:
        return "(sem enunciado)"
    if not _PARECE_ENUNCIADO.search(t):
        return f"(texto que não parece enunciado, {len(t)} caracteres)"
    t = mascarar(t)
    return "«" + (t[: maximo - 1] + "…" if len(t) > maximo else t) + "»"


def numero_da_pergunta(texto):
    """'Pergunta 4 - Anexe…' ou '4) Anexe…' → 4; sem número → None."""
    t = str(texto or "").strip()
    m = re.search(r"(?i)pergunta\s*(\d{1,3})", t) or re.match(r"^(\d{1,3})\s*[-.)–:]\s*\S", t)
    if not m:
        return None
    n = int(m.group(1))
    return n if 1 <= n <= 999 else None


ABAS_CONHECIDAS = (
    "currículo",
    "curriculo",
    "questionários",
    "questionarios",
    "questionário",
    "questionario",
    "histórico",
    "historico",
    "anexos",
    "documentos",
    "arquivos",
    "avaliações",
    "avaliacoes",
    "testes",
    "comentários",
    "comentarios",
    "entrevistas",
    "mensagens",
    "dados",
    "perfil",
    "competências",
    "competencias",
    "experiências",
    "formação",
    "observações",
    "etapas",
    "candidaturas",
    "timeline",
    "resumo",
    "vagas",
)


def nome_da_aba(rotulo):
    """Rótulo de aba só se for nome conhecido (com contagem, se houver); senão 'outra'."""
    texto = re.sub(r"\s+", " ", str(rotulo or "")).strip()
    m = re.match(r"^(\d{1,4})?\s*([A-Za-zÀ-ÿ ]+?)\s*\(?(\d{0,4})\)?$", texto)
    if not m or m.group(2).strip().lower() not in ABAS_CONHECIDAS:
        return "outra"
    contagem = m.group(1) or m.group(3)
    return m.group(2).strip().capitalize() + (f" ({contagem})" if contagem else "")


def _palavras(lista, maximo=40):
    return [c for c in (lista or []) if re.fullmatch(r"[A-Za-z][A-Za-z_-]{0,40}", str(c))][:maximo]


def _ancora_ou_mascara(valor):
    v = str(valor or "").strip()
    if not v:
        return "—"
    if re.search(r"\d{5,}", v):
        return MASCARA
    if v.startswith("#") and ANCORA.match(v[1:]):
        return v
    return v if ANCORA.match(v) else MASCARA


# ── Teste do link sem cookies ───────────────────────────────────────────────


def _tipo_de_conteudo(valor):
    """'application/pdf; charset=…' → 'application/pdf' (só o tipo, para o log)."""
    tipo = str(valor or "").split(";")[0].strip().lower()
    return tipo if re.fullmatch(r"[a-z0-9.+-]{1,40}/[a-z0-9.+-]{1,60}", tipo) else ("?" if tipo else "")


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def testar_sem_cookies(endereco, abrir=None, tempo=TEMPO_DO_HEAD):
    """
    GET de 1 byte (Range: bytes=0-0) sem cookies nem sessão, sem seguir
    redirecionamento e sem ler o corpo. Devolve {"status": int|None, "tipo":
    content-type, "destino": padrão do Location ou None, "erro": nome}. GET
    recusado (405/416/501) tenta um HEAD.
    """
    if not str(endereco or "").startswith(("http://", "https://")):
        return {"status": None, "destino": None, "erro": "sem http"}
    abrir = abrir or urllib.request.build_opener(_SemRedirecionar).open
    for metodo, cabecalhos in (("GET", {"Range": "bytes=0-0"}), ("HEAD", {})):
        pedido = urllib.request.Request(
            endereco, method=metodo, headers={"User-Agent": "Mozilla/5.0 (robo MONITORA)", **cabecalhos}
        )
        try:
            with abrir(pedido, timeout=tempo) as resposta:
                cabecalho = getattr(resposta, "headers", None)
                tipo = _tipo_de_conteudo(cabecalho.get("Content-Type") if cabecalho else "")
                return {"status": resposta.status, "tipo": tipo, "destino": None, "erro": None}
        except urllib.error.HTTPError as erro:
            if metodo == "GET" and erro.code in (405, 416, 501):
                continue
            local = erro.headers.get("Location") if erro.headers else None
            destino = padrao_do_link(urljoin(endereco, local)) if local else None
            return {"status": erro.code, "destino": destino, "erro": None}
        except Exception as erro:
            return {"status": None, "destino": None, "erro": type(erro).__name__}
    return {"status": None, "destino": None, "erro": "sem resposta"}


def classificar_link(endereco, teste):
    """
    {"assinado": bool, "publico": bool, "exige_sessao": bool, "texto": "..."} a
    partir dos parâmetros do link e do GET sem cookies.
    """
    assinado = bool(parametros_de_assinatura(endereco))
    status = (teste or {}).get("status")
    destino = (teste or {}).get("destino") or ""
    publico = isinstance(status, int) and 200 <= status < 300
    exige_sessao = status in (401, 403) or (
        isinstance(status, int) and 300 <= status < 400 and re.search(r"(?i)login|entrar|signin|auth", destino)
    )
    if publico:
        texto = "público, mas assinado (expira)" if assinado else "público"
    elif exige_sessao:
        texto = "exige sessão" + (" (ou a assinatura expirou)" if assinado else "")
    elif status is None:
        texto = f"sem resposta ({(teste or {}).get('erro') or '?'})"
    else:
        texto = f"status {status}"
    return {"assinado": assinado, "publico": publico, "exige_sessao": bool(exige_sessao), "texto": texto}


def em_lotes(lista, tamanho=TAMANHO_DO_LOTE):
    for i in range(0, len(lista), tamanho):
        yield lista[i : i + tamanho]


# ── Navegador ───────────────────────────────────────────────────────────────


def _esperar_questionario(driver, limite=ESPERA_PELO_QUESTIONARIO, dormir=time.sleep, agora=time.monotonic):
    fim = agora() + limite
    while agora() < fim:
        try:
            if (driver.execute_script(JS_CONTAR_QUESTIONARIO) or 0) > 0:
                return True
        except Exception:
            pass
        dormir(INTERVALO)
    return False


def ler_questionario(driver, maximo=50):
    """A leitura da aba no documento; sem arquivo nele, nos iframes da mesma origem (até 3)."""
    leitura = driver.execute_script(JS_LER_QUESTIONARIO, maximo) or {}
    if leitura.get("arquivos"):
        return leitura
    try:
        quadros = driver.find_elements("tag name", "iframe")[:3]
    except Exception:
        quadros = []
    for i, quadro in enumerate(quadros, 1):
        try:
            driver.switch_to.frame(quadro)
            dentro = driver.execute_script(JS_LER_QUESTIONARIO, maximo) or {}
        except Exception:
            dentro = {}
        finally:
            try:
                driver.switch_to.default_content()
            except Exception:
                pass
        if dentro.get("arquivos"):
            dentro["no_iframe"] = i
            dentro.setdefault("imprimir", leitura.get("imprimir") or [])
            return dentro
    return leitura


def testar_com_sessao(driver, endereco):
    """HEAD com a sessão do navegador, só na mesma origem (outra origem: CORS)."""
    if not str(endereco or "").startswith(URL_BASE + "/"):
        return "outra origem"
    try:
        driver.set_script_timeout(TEMPO_DO_HEAD)
        return driver.execute_async_script(JS_HEAD_COM_SESSAO, endereco)
    except Exception as erro:
        return f"erro ({type(erro).__name__})"


# ── Sondagem (log só com estrutura) ─────────────────────────────────────────


def linhas_da_leitura(rotulo, leitura, testes):
    """
    As linhas de log de uma leitura da aba (ou da visão imprimir), já seguras:
    painel, contagens, seletores, classes e, por arquivo, enunciado (se parecer
    enunciado), padrão do link mascarado, assinatura e os status dos testes.
    `testes`: {href: {"sem_cookies": {...}, "com_sessao": ...}}.
    """
    leitura = leitura or {}
    arquivos = leitura.get("arquivos") or []
    seletores = " · ".join(
        f"{s} {n}" for s, n in (leitura.get("seletores") or {}).items() if isinstance(n, int) and n > 0
    )
    linhas = [
        f"{rotulo}: página {padrao_do_link(leitura.get('caminho'))}; painel "
        f"{_descricao_segura(leitura.get('painel'))}"
        + (f" (dentro do iframe {leitura['no_iframe']})" if leitura.get("no_iframe") else ""),
        f"{rotulo}: perguntas por classe {leitura.get('perguntas_por_classe', '?')}, "
        f"por texto «Pergunta N» {leitura.get('perguntas_por_texto', '?')}; arquivos {len(arquivos)}; "
        f"links «imprimir» {len(leitura.get('imprimir') or [])}; iframes {len(leitura.get('iframes') or [])}",
        f"{rotulo}: seletores com resultado: {seletores or 'nenhum'}",
        f"{rotulo}: classes: {', '.join(_palavras(leitura.get('classes'))) or '—'}",
        f"{rotulo}: anexos por pergunta/bloco: {anexos_por_pergunta(arquivos) or '—'}",
    ]
    for href in (leitura.get("imprimir") or [])[:2]:
        linhas.append(f"{rotulo}: link imprimir {padrao_do_link(href)}")
    for href in (leitura.get("iframes") or [])[:3]:
        linhas.append(f"{rotulo}: iframe {padrao_do_link(href)}")
    for i, a in enumerate(arquivos[:ANEXOS_POR_CANDIDATO_NO_LOG], 1):
        href = a.get("href")
        t = testes.get(href) or {}
        classe = classificar_link(href, t.get("sem_cookies"))
        sem = t.get("sem_cookies") or {}
        assinatura = parametros_de_assinatura(href)
        numero = numero_da_pergunta(a.get("enunciado"))
        linhas.append(
            f"{rotulo}, arquivo {i}: pergunta {numero or '?'} (bloco {a.get('ordem') or '?'}) · enunciado "
            f"{enunciado_para_o_log(a.get('enunciado'))} · elemento {_palavra(a.get('tag'))}[{_palavra(a.get('atributo'))}]"
            f" (download: {'sim' if a.get('download') else 'não'}; texto do link: "
            f"{'sim' if a.get('texto_do_link') else 'não'}; âncora: {'sim' if a.get('ancora') else 'não'})"
        )
        linhas.append(
            f"{rotulo}, arquivo {i}: link {padrao_do_link(href)} · assinado/expira: "
            f"{'sim (' + ', '.join(_palavras(assinatura, 6)) + ')' if assinatura else 'não'} · GET sem cookies: "
            f"{sem.get('status') or sem.get('erro') or '?'}"
            + (f" → {sem['destino']}" if sem.get("destino") else "")
            + f" · HEAD com sessão: {t.get('com_sessao', '?')} · leitura: {classe['texto']}"
        )
    if len(arquivos) > ANEXOS_POR_CANDIDATO_NO_LOG:
        linhas.append(f"{rotulo}: (+{len(arquivos) - ANEXOS_POR_CANDIDATO_NO_LOG} arquivo(s) não detalhados)")
    return [mascarar(linha) for linha in linhas]


def _palavra(valor):
    v = str(valor or "")
    return v if re.fullmatch(r"[a-z][a-z0-9-]{0,20}", v) else "?"


def _descricao_segura(descricao):
    """'div#questionarios.tab-pane.active' com id/classes que não forem palavra mascarados."""
    texto = str(descricao or "")
    if not texto:
        return "?"
    partes = re.split(r"([#.])", texto)
    saida = []
    for p in partes:
        if p in ("#", "."):
            saida.append(p)
        else:
            saida.append(p if re.fullmatch(r"[A-Za-z][A-Za-z_-]{0,40}", p) else MASCARA)
    return "".join(saida)[:160]


def _nome_da_funcao(onclick):
    m = re.match(r"^\s*([A-Za-z_$][\w$.]{0,40})\s*\(", str(onclick or ""))
    return m.group(1) if m else ("—" if not onclick else "?")


def _testar_arquivos(driver, leitura, testar=testar_sem_cookies):
    testes = {}
    for a in ((leitura or {}).get("arquivos") or [])[:ANEXOS_POR_CANDIDATO_NO_LOG]:
        href = a.get("href")
        if href and href not in testes and not registra_visualizacao(href):
            testes[href] = {"sem_cookies": testar(href), "com_sessao": testar_com_sessao(driver, href)}
    return testes


# ── Sondagem 2: as abas uma a uma, os atributos dos arquivos e o acesso ─────

# As abas da página do candidato com tudo que as identifica (o rótulo pode ser só
# ícone/tooltip). Guarda os elementos em window.__abasMonitora para clicar pelo índice.
JS_DESCREVER_ABAS = (
    JS_VISIVEL
    + """
const todas = Array.from(document.querySelectorAll('[data-toggle="tab"], [data-bs-toggle="tab"]')).filter(function (a) {
  const alvo = a.getAttribute('href') || a.getAttribute('data-target') || a.getAttribute('data-bs-target') || '';
  return visivel(a) && alvo.charAt(0) === '#';
});
const abas = Array.from(new Set(todas)).slice(0, 40);
window.__abasMonitora = abas;
return abas.map(function (a, i) {
  const ic = a.querySelector('i[class*="fa"], span[class*="fa"], i[class*="icon"], span[class*="glyphicon"]');
  const li = a.closest('li');
  return {
    i: i,
    tag: a.tagName.toLowerCase(),
    texto: texto(a).slice(0, 40),
    href: a.getAttribute('href') || '',
    alvo: a.getAttribute('data-target') || a.getAttribute('data-bs-target') || '',
    controla: a.getAttribute('aria-controls') || '',
    titulo: a.getAttribute('title') || (li && li.getAttribute('title')) || '',
    rotulo: a.getAttribute('aria-label') || '',
    dica: a.getAttribute('data-original-title') || a.getAttribute('data-bs-original-title') || a.getAttribute('data-title') || '',
    icone: ic ? String(ic.className) : '',
    toggle: a.getAttribute('data-toggle') || a.getAttribute('data-bs-toggle') || '',
    ativa: a.classList.contains('active') || (li !== null && li.classList.contains('active'))
  };
});
"""
)

JS_CLICAR_ABA = """
const a = (window.__abasMonitora || [])[arguments[0]];
if (!a) { return false; }
a.scrollIntoView({block: 'center'});
a.click();
return true;
"""

# O painel ativo depois do clique: contagens só (perguntas, arquivos, data-url…).
JS_RESUMO_DO_PAINEL = (
    JS_VISIVEL
    + f"""
const reArq = {_RE_ARQUIVO_JS};
const panes = Array.from(document.querySelectorAll('.tab-pane.active, .tab-pane.show, .tab-pane.in')).filter(visivel);
panes.sort(function (a, b) {{ return texto(b).length - texto(a).length; }});
const p = panes[0] || document.body;
const q = function (s) {{ try {{ return p.querySelectorAll(s).length; }} catch (e) {{ return -1; }} }};
const arquivos = Array.from(p.querySelectorAll('a[href], [data-url], [data-arquivo], [data-href]')).filter(function (el) {{
  return reArq.test([el.getAttribute('href'), el.getAttribute('data-url'), el.getAttribute('data-arquivo'),
    el.getAttribute('data-href')].join(' '));
}}).length;
return {{
  painel: p === document.body ? 'body' : p.tagName.toLowerCase() + (p.id ? '#' + p.id : '')
    + Array.from(p.classList).slice(0, 4).map(function (c) {{ return '.' + c; }}).join(''),
  texto: texto(p).length,
  perguntas: q('[class*="pergunta" i]') + q('[class*="question" i]'),
  por_texto: (texto(p).match(/pergunta\\s*\\d{{1,3}}/gi) || []).length,
  arquivos: arquivos,
  data_url: q('[data-url]'),
  data_arquivo: q('[data-arquivo]'),
  tabelas: q('table'),
  paineis: q('.panel, .card')
}};
"""
)

# Os elementos com data-url/data-arquivo (o link real pode estar aí e vir por XHR):
# nomes dos atributos e valores crus (o Python só loga o padrão mascarado).
JS_ATRIBUTOS_DE_ARQUIVO = """
const raiz = (arguments[0] && document.querySelector(arguments[0])) || document;
const els = Array.from(raiz.querySelectorAll('[data-url], [data-arquivo], [data-file], [data-href], [data-download]')).slice(0, 12);
return els.map(function (el) {
  const pane = el.closest('.tab-pane');
  const atributos = Array.from(el.attributes)
    .filter(function (a) { return /^(data-|href$|onclick$|src$|target$|download$)/i.test(a.name); })
    .map(function (a) {
      let abs = '';
      if (/^(https?:|\\/)/i.test(a.value) || (a.value.indexOf('/') > 0 && !/\\s/.test(a.value))) {
        try { abs = new URL(a.value, location.href).href; } catch (e) { abs = ''; }
      }
      return [a.name, a.value.slice(0, 600), abs];
    });
  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList).slice(0, 6),
    aba: pane && pane.id ? pane.id : '',
    atributos: atributos
  };
});
"""

# GET de 1 byte com a sessão do navegador (mesma origem); só status, tipo e se foi ao login.
JS_GET_COM_SESSAO = """
const pronto = arguments[arguments.length - 1];
const ctl = new AbortController();
fetch(arguments[0], {method: 'GET', credentials: 'include', headers: {'Range': 'bytes=0-0'}, signal: ctl.signal})
  .then(function (r) {
    const disp = r.headers.get('content-disposition') || '';
    let login = false;
    try { login = /login|entrar|signin|acesso/i.test(new URL(r.url).pathname); } catch (e) { login = false; }
    const info = {status: r.status, tipo: r.headers.get('content-type') || '',
      disposicao: /attachment/i.test(disp) ? 'attachment' : (/inline/i.test(disp) ? 'inline' : ''),
      redirecionou: r.redirected, login: login};
    try { ctl.abort(); } catch (e) {}
    pronto(info);
  })
  .catch(function (e) { pronto({erro: String((e && e.name) || 'erro')}); });
"""

ICONES_DE_QUESTIONARIO = re.compile(
    r"(?i)\bfa-(list-alt|question|question-circle|clipboard|clipboard-list|clipboard-check|check-square-o|"
    r"check-square|tasks|list-ul|list-ol|wpforms|pencil-square-o|edit)\b"
)
_SINAL_DE_QUESTIONARIO = re.compile(r"(?i)question|formul")
_PALAVRAS_DE_INTERFACE = re.compile(
    r"(?i)^(question|formul|anex|document|arquiv|curr[ií]c|hist[oó]r|mensag|avalia|test|entrevist|coment|"
    r"dado|perfil|compet|experi|forma[cç]|observa|etapa|vaga|candidat|resumo|informa|contato|endere|"
    r"agenda|tarefa|nota|parecer|v[ií]deo|foto|imprim|baixar|download|enviar|ver|abrir)"
)


def pontuar_aba(desc):
    """3: href/alvo/título/rótulo fala de questionário ou formulário; 2: ícone típico; 0: nada."""
    textos = [desc.get(k) or "" for k in ("texto", "href", "alvo", "controla", "titulo", "rotulo", "dica")]
    if any(_SINAL_DE_QUESTIONARIO.search(t) for t in textos):
        return 3
    if ICONES_DE_QUESTIONARIO.search(desc.get("icone") or ""):
        return 2
    return 0


def _rotulo_seguro(texto):
    """Rótulo/título de interface só se for nome conhecido ou palavra de interface; senão 'outra (N letras)'."""
    t = re.sub(r"\s+", " ", str(texto or "")).strip()
    if not t:
        return ""
    conhecido = nome_da_aba(t)
    if conhecido != "outra":
        return conhecido
    if len(t) <= 40 and re.fullmatch(r"[A-Za-zÀ-ÿ ()0-9]+", t) and _PALAVRAS_DE_INTERFACE.match(t):
        return mascarar(t)
    return f"outra ({len(t)} letras)"


def _alvo_seguro(valor):
    """'#tabQuestionario' fica; id com dígitos longos ou outro caminho vira padrão mascarado."""
    v = str(valor or "").strip()
    if not v:
        return "—"
    if v.startswith("#") or ANCORA.match(v):
        return _ancora_ou_mascara(v)
    if v.lower().startswith("javascript:"):
        return "javascript:"
    return padrao_do_link(v)


def _icone_seguro(classes):
    return " ".join(c for c in str(classes or "").split() if re.fullmatch(r"(fa|bi|glyphicon|icon)[a-z0-9-]{0,40}", c))


def navega_para_fora(desc):
    """A aba é um link para outra página (não troca painel): não clicar na sondagem."""
    href = str(desc.get("href") or "").strip()
    if desc.get("toggle") or desc.get("alvo") or desc.get("controla"):
        return False
    return bool(href) and not href.startswith("#") and not href.lower().startswith("javascript:")


def linha_da_aba_descrita(rotulo, desc, resumo=None):
    """Uma linha segura por aba: href/alvo/aria-controls (ids mascarados), títulos, ícone e o painel."""
    partes = [
        f"{rotulo}: aba {desc.get('i')} ({_palavra(desc.get('tag'))}{', ativa' if desc.get('ativa') else ''})",
        f"texto {_rotulo_seguro(desc.get('texto')) or '—'}",
        f"href {_alvo_seguro(desc.get('href'))}",
        f"alvo {_alvo_seguro(desc.get('alvo'))}",
        f"aria-controls {_alvo_seguro(desc.get('controla'))}",
        f"title {_rotulo_seguro(desc.get('titulo')) or '—'}",
        f"aria-label {_rotulo_seguro(desc.get('rotulo')) or '—'}",
        f"tooltip {_rotulo_seguro(desc.get('dica')) or '—'}",
        f"ícone {_icone_seguro(desc.get('icone')) or '—'}",
        f"toggle {_palavra(desc.get('toggle')) if desc.get('toggle') else '—'}",
        f"pontos {pontuar_aba(desc)}",
    ]
    if resumo is not None:
        if resumo.get("erro"):
            partes.append(f"clique: {resumo['erro']}")
        else:
            partes.append(
                f"painel {_descricao_segura(resumo.get('painel'))} (texto {resumo.get('texto', '?')} car.; "
                f"perguntas {resumo.get('perguntas', '?')}; «Pergunta N» {resumo.get('por_texto', '?')}; "
                f"arquivos {resumo.get('arquivos', '?')}; data-url {resumo.get('data_url', '?')}; "
                f"data-arquivo {resumo.get('data_arquivo', '?')}; tabelas {resumo.get('tabelas', '?')}; "
                f".panel/.card {resumo.get('paineis', '?')})"
            )
    return mascarar(" · ".join(partes))


def descrever_valor(nome, valor, absoluto=""):
    """O valor de um atributo para o log: padrão de link, nome de arquivo (só extensão), número ou tamanho."""
    v = str(valor or "").strip()
    if not v:
        return "<vazio>"
    if nome.lower() == "onclick":
        urls = re.findall(r"(https?://[^\s'\"<>)]+|/[A-Za-z0-9_\-/.%~+|?=&]{3,})", v)
        return f"função {_nome_da_funcao(v)}" + (
            f", links: {', '.join(padrao_do_link(u) for u in urls[:3])}" if urls else ""
        )
    if absoluto or v.lower().startswith(("http://", "https://", "/")):
        tipo = "absoluto" if v.lower().startswith("http") else ("caminho" if v.startswith("/") else "relativo")
        return f"{tipo} {padrao_do_link(absoluto or v)}"
    extensao = _EXTENSAO.search(v)
    if extensao:
        return f"<nome de arquivo, extensão .{extensao.group(1).lower()}, {len(v)} caracteres>"
    if re.fullmatch(r"\d{1,30}", v):
        return f"<número, {len(v)} dígitos>"
    if re.fullmatch(r"[a-z][a-z_-]{0,20}", v):
        return v
    return f"<texto, {len(v)} caracteres>"


def linhas_dos_atributos(rotulo, elementos):
    """Uma linha por elemento com data-url/data-arquivo: tag, classes, aba, nomes dos atributos e padrão dos valores."""
    linhas = [mascarar(f"{rotulo}: elementos com data-url/data-arquivo: {len(elementos or [])}")]
    for i, el in enumerate((elementos or [])[:12], 1):
        atributos = []
        for item in el.get("atributos") or []:
            nome, valor, absoluto = (list(item) + ["", "", ""])[:3]
            nome = str(nome)
            if not re.fullmatch(r"[a-z][a-z0-9-]{0,40}", nome):
                nome = MASCARA
            atributos.append(f"{nome}={descrever_valor(nome, valor, absoluto)}")
        linhas.append(
            mascarar(
                f"{rotulo}: elemento {i}: {_palavra(el.get('tag'))}"
                f"{''.join('.' + c for c in _palavras(el.get('classes'), 6))}"
                f" (aba {_ancora_ou_mascara(el.get('aba'))}) · " + " · ".join(atributos)
            )
        )
    return linhas


def links_dos_atributos(elementos, maximo=3):
    """Os valores absolutos (data-url, data-href…) que dá para testar."""
    saida = []
    for el in elementos or []:
        for item in el.get("atributos") or []:
            nome, _valor, absoluto = (list(item) + ["", "", ""])[:3]
            if absoluto and str(absoluto).startswith(("http://", "https://")) and absoluto not in saida:
                saida.append(absoluto)
    return saida[:maximo]


def get_com_sessao(driver, endereco):
    """GET de 1 byte com a sessão do navegador (só mesma origem): {status, tipo, disposicao, redirecionou, login}."""
    if not str(endereco or "").startswith(URL_BASE + "/"):
        return {"erro": "outra origem"}
    try:
        driver.set_script_timeout(TEMPO_DO_HEAD)
        return driver.execute_async_script(JS_GET_COM_SESSAO, endereco) or {}
    except Exception as erro:
        return {"erro": type(erro).__name__}


def abrir_no_navegador(portal, endereco, espera=4):
    """
    Abre o link na janela do robô e vê no que deu: o caminho final (padrão), se
    foi ao login, o content-type do documento e se baixou arquivo (só a extensão).
    """
    import os

    d = portal.driver
    pasta = getattr(portal, "pasta", None)
    antes = set(os.listdir(pasta)) if pasta and os.path.isdir(pasta) else set()
    try:
        d.get(endereco)
    except Exception as erro:
        return {"erro": type(erro).__name__}
    time.sleep(espera)
    try:
        info = (
            d.execute_script(
                "return {tipo: document.contentType || '', caminho: location.href, "
                "login: /login|entrar|signin|acesso/i.test(location.pathname), "
                "pdf: !!document.querySelector('embed[type=\"application/pdf\"], pdf-viewer')};"
            )
            or {}
        )
    except Exception as erro:
        info = {"erro": type(erro).__name__}
    novos = (set(os.listdir(pasta)) - antes) if pasta and os.path.isdir(pasta) else set()
    extensoes = sorted({(_EXTENSAO.search(n).group(1).lower() if _EXTENSAO.search(n) else "?") for n in novos})
    info["download"] = extensoes
    return info


def linha_do_acesso(rotulo, i, endereco, sessao, aberto):
    """Status do GET com sessão e o resultado de abrir no navegador, sem a URL."""
    s = sessao or {}
    a = aberto or {}
    partes = [f"{rotulo}, acesso {i}: link {padrao_do_link(endereco)}"]
    if s.get("erro"):
        partes.append(f"GET com sessão: {s['erro']}")
    else:
        partes.append(
            f"GET com sessão: {s.get('status', '?')} {_tipo_de_conteudo(s.get('tipo')) or '—'}"
            f"{' (' + s['disposicao'] + ')' if s.get('disposicao') else ''}"
            f"; redirecionou {'sim' if s.get('redirecionou') else 'não'}; login {'sim' if s.get('login') else 'não'}"
        )
    if aberto is not None:
        if a.get("erro"):
            partes.append(f"abrir: {a['erro']}")
        else:
            partes.append(
                f"abrir: {padrao_do_link(a.get('caminho'))} · tipo {_tipo_de_conteudo(a.get('tipo')) or '—'}"
                f" · visualizador de PDF {'sim' if a.get('pdf') else 'não'}"
                f" · login {'sim' if a.get('login') else 'não'}"
                f" · download {', '.join('.' + e for e in a.get('download') or []) or 'não'}"
            )
    return mascarar(" · ".join(partes))


def varrer_abas(portal, rotulo, espera=1.5):
    """
    Descreve cada aba da página e, nas que trocam de painel, clica e resume o
    painel. Devolve (linhas, descrições, índice da melhor aba ou None).
    """
    d = portal.driver
    descricoes = d.execute_script(JS_DESCREVER_ABAS) or []
    linhas = [mascarar(f"{rotulo}: abas encontradas {len(descricoes)}")]
    resumos = {}
    for desc in descricoes[:25]:
        resumo = None
        if not navega_para_fora(desc):
            try:
                if d.execute_script(JS_CLICAR_ABA, desc.get("i")):
                    time.sleep(espera)
                    resumo = d.execute_script(JS_RESUMO_DO_PAINEL) or {}
                    resumos[desc.get("i")] = resumo
            except Exception as erro:
                resumo = {"erro": type(erro).__name__}
        linhas.append(linha_da_aba_descrita(rotulo, desc, resumo))
    melhor = escolher_aba(descricoes, resumos)
    linhas.append(
        mascarar(f"{rotulo}: aba escolhida para o questionário: {melhor if melhor is not None else 'nenhuma'}")
    )
    return linhas, descricoes, melhor


def escolher_aba(descricoes, resumos):
    """A aba com mais pontos (href/título/ícone); empate ou nada: a de painel com mais perguntas/arquivos."""

    def peso(desc):
        r = resumos.get(desc.get("i")) or {}
        conteudo = (r.get("por_texto") or 0) * 10 + (r.get("perguntas") or 0) * 3 + (r.get("arquivos") or 0)
        return (pontuar_aba(desc), conteudo)

    candidatas = [d for d in descricoes if pontuar_aba(d) > 0 or (resumos.get(d.get("i")) or {}).get("por_texto")]
    if not candidatas:
        return None
    return max(candidatas, key=peso).get("i")


# ── Sondagem 3: o que dá para clicar num painel, modais de respostas e a vaga ─

# Elementos clicáveis de uma raiz: seletor, "pessoa:<código>" (o item do candidato na
# lista de candidaturas), "painel" (aba ativa ou modal aberto). arguments[1]: código da
# vaga (marca o bloco que o cita). Guarda em window.__clicaveisMonitora para clicar.
JS_CLICAVEIS = (
    JS_VISIVEL
    + """
const pedido = String(arguments[0] || 'painel');
const codigo = String(arguments[1] || '');
let raiz = null;
if (pedido.indexOf('pessoa:') === 0) {
  const el = document.querySelector('[data-pessoa-id="' + pedido.slice(7) + '"]');
  raiz = el ? (el.closest('.curriculo-list-item') || el) : null;
} else if (pedido === 'painel') {
  const modais = Array.from(document.querySelectorAll('.modal.in, .modal.show')).filter(visivel);
  const panes = Array.from(document.querySelectorAll('.tab-pane.active, .tab-pane.show, .tab-pane.in')).filter(visivel);
  panes.sort(function (a, b) { return texto(b).length - texto(a).length; });
  raiz = modais[0] || panes[0] || null;
} else {
  raiz = document.querySelector(pedido);
}
if (!raiz) { window.__clicaveisMonitora = []; return {raiz: false, itens: []}; }
const els = Array.from(new Set(Array.from(raiz.querySelectorAll(
  'a, button, [onclick], [data-url], [data-toggle="modal"], [data-bs-toggle="modal"], [role="button"]'
)))).slice(0, 400);
window.__clicaveisMonitora = els;
const absoluto = function (u) { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
return {raiz: true, itens: els.map(function (el, i) {
  const ic = el.querySelector('i, span[class*="bi-"], span[class*="fa"]');
  let bloco = false;
  if (codigo) {
    let p = el;
    for (let k = 0; p && k < 8; k++) { if (texto(p).indexOf(codigo) >= 0) { bloco = true; break; } p = p.parentElement; }
  }
  const href = el.getAttribute('href') || '';
  return {
    i: i,
    tag: el.tagName.toLowerCase(),
    visivel: visivel(el),
    texto: texto(el).slice(0, 60),
    titulo: el.getAttribute('title') || el.getAttribute('data-original-title') || el.getAttribute('aria-label') || '',
    href: href,
    abs: href && !/^(#|javascript:)/i.test(href) ? absoluto(href) : '',
    onclick: (el.getAttribute('onclick') || '').slice(0, 300),
    icone: (ic ? String(ic.className) : '') + ' ' + String(el.className || ''),
    atributos: Array.from(el.attributes).filter(function (a) { return /^data-/i.test(a.name); }).map(function (a) {
      const abs = /^(https?:|\\/)/i.test(a.value) ? absoluto(a.value) : '';
      return [a.name, a.value.slice(0, 600), abs];
    }),
    bloco_da_vaga: bloco
  };
})};
"""
)

JS_CLICAR_CLICAVEL = """
const el = (window.__clicaveisMonitora || [])[arguments[0]];
if (!el) { return false; }
el.scrollIntoView({block: 'center'});
el.click();
return true;
"""

JS_FECHAR_MODAL = """
const m = Array.from(document.querySelectorAll('.modal.in, .modal.show'));
m.forEach(function (x) {
  const b = x.querySelector('[data-dismiss="modal"], [data-bs-dismiss="modal"], .close, .btn-close');
  if (b) { b.click(); }
});
return m.length;
"""

_SINAL_DE_RESPOSTAS = re.compile(r"(?i)question|respost|formul|imprim|visualiz")
ICONES_DE_RESPOSTAS = re.compile(
    r"(?i)\b(bi-file-earmark-text|bi-download|bi-eye|bi-printer|fa-list-alt|fa-eye|fa-print|fa-download|"
    r"fa-file-text|fa-file-text-o|fa-question-circle|fa-clipboard)\b"
)
# Nunca clicar no que pode mudar algo na Empregare.
_PERIGOSO = re.compile(
    r"(?i)reprov|aprov|exclu|remov|mover|enviar|salvar|desclass|contrat|arquivar|cancel|apagar|delet|"
    r"transfer|agendar|convidar|bloque|marcar|avaliar|classific|alterar|editar|incluir|adicionar|sair|logout|"
    r"zerar|resetar|limpar|compartilh|whatsapp|copiar|e-mail|email|GetViewerLogArquivo"
)


def pontuar_clicavel(item):
    """2: fala de questionário/respostas/formulário/imprimir; 1: ícone típico; 0: nada."""
    valores = [item.get("texto"), item.get("titulo"), item.get("href"), item.get("onclick")]
    valores += [f"{a[0]}={a[1]}" for a in item.get("atributos") or [] if len(a) >= 2]
    if any(_SINAL_DE_RESPOSTAS.search(str(v or "")) for v in valores + [item.get("icone")]):
        return 2
    if ICONES_DE_RESPOSTAS.search(item.get("icone") or ""):
        return 1
    return 0


def perigoso(item):
    valores = [str(item.get(k) or "") for k in ("texto", "titulo", "onclick", "href")]
    valores += [f"{a[0]}={a[1]}" for a in item.get("atributos") or [] if len(a) >= 2]
    return bool(_PERIGOSO.search(" ".join(valores)))


def url_do_clicavel(item):
    """URL da mesma origem (área da empresa) para abrir só para ler: href ou data-url/data-href."""
    candidatos = [item.get("abs")] + [a[2] for a in item.get("atributos") or [] if len(a) >= 3]
    for u in candidatos:
        if u and str(u).startswith(URL_BASE + "/empresa/") and not re.search(r"(?i)logout|sair", str(u)):
            return u
    return None


def abre_modal(item):
    atributos = {str(a[0]).lower(): str(a[1]) for a in item.get("atributos") or [] if len(a) >= 2}
    return (
        atributos.get("data-toggle") == "modal"
        or atributos.get("data-bs-toggle") == "modal"
        or atributos.get("data-target", "").startswith("#")
        or bool(item.get("onclick"))
        or (str(item.get("href") or "").startswith("#") and len(str(item.get("href"))) > 1)
        or str(item.get("href") or "").lower().startswith("javascript")
        or "abrir-" in str(item.get("icone") or "")
    )


def linha_do_clicavel(rotulo, item):
    """Um elemento clicável para o log: tag, rótulo/título (só interface), href/data-* mascarados, onclick, ícone."""
    atributos = []
    for a in (item.get("atributos") or [])[:8]:
        nome, valor, absoluto = (list(a) + ["", "", ""])[:3]
        nome = str(nome) if re.fullmatch(r"[a-z][a-z0-9-]{0,40}", str(nome)) else MASCARA
        atributos.append(f"{nome}={descrever_valor(nome, valor, absoluto)}")
    partes = [
        f"{rotulo}: clicável {item.get('i')} {_palavra(item.get('tag'))}{'' if item.get('visivel') else ' (oculto)'}",
        f"texto {_rotulo_seguro(item.get('texto')) or '—'}",
        f"title {_rotulo_seguro(item.get('titulo')) or '—'}",
        f"href {_alvo_seguro(item.get('href'))}",
        f"onclick {descrever_valor('onclick', item.get('onclick')) if item.get('onclick') else '—'}",
        f"ícone {_icone_seguro(item.get('icone')) or '—'}",
        f"bloco da vaga {'sim' if item.get('bloco_da_vaga') else 'não'}",
        f"pontos {pontuar_clicavel(item)}{' (perigoso: não clico)' if perigoso(item) else ''}",
    ]
    if atributos:
        partes.append(" ".join(atributos))
    return mascarar(" · ".join(partes))


def listar_clicaveis(driver, rotulo, raiz="painel", codigo_vaga="", so_relevantes=False, maximo=25):
    """Linhas dos clicáveis da raiz e os itens (para escolher o que abrir)."""
    r = driver.execute_script(JS_CLICAVEIS, raiz, codigo_vaga) or {}
    itens = r.get("itens") or []
    if not r.get("raiz"):
        return [mascarar(f"{rotulo}: (raiz não encontrada)")], []
    mostrar = [i for i in itens if pontuar_clicavel(i) > 0] if so_relevantes else itens
    linhas = [mascarar(f"{rotulo}: clicáveis {len(itens)}" + (f", relevantes {len(mostrar)}" if so_relevantes else ""))]
    linhas += [linha_do_clicavel(rotulo, i) for i in mostrar[:maximo]]
    return linhas, itens


class _Acessos:
    """Links a testar no fim (GET com sessão já feito na página; abrir no navegador navega)."""

    def __init__(self):
        self.vistos = []
        self.resultados = []

    def guardar(self, driver, hrefs):
        for href in hrefs:
            if registra_visualizacao(href):
                continue
            if href and href not in self.vistos and len(self.vistos) < 8:
                self.vistos.append(href)
                self.resultados.append((href, get_com_sessao(driver, href)))


def analisar_conteudo(portal, rotulo, testar, acessos, raiz_dos_atributos=None):
    """A leitura do painel/modal/página como antes, os atributos de arquivo e os links para testar."""
    d = portal.driver
    leitura = ler_questionario(d)
    linhas = linhas_da_leitura(rotulo, leitura, _testar_arquivos(d, leitura, testar))
    elementos = d.execute_script(JS_ATRIBUTOS_DE_ARQUIVO, raiz_dos_atributos) or []
    linhas += linhas_dos_atributos(rotulo, elementos)
    acessos.guardar(d, [a.get("href") for a in (leitura.get("arquivos") or [])[:3]] + links_dos_atributos(elementos))
    return linhas, leitura


def explorar_respostas(portal, rotulo, itens, testar, acessos, voltar_para, maximo=3):
    """
    Nos clicáveis relevantes (questionário/respostas/imprimir) e não perigosos:
    abre o link da mesma origem (só leitura) ou o modal, analisa e volta.
    """
    d = portal.driver
    linhas = []
    feitos = 0
    relevantes = sorted(
        [i for i in itens if pontuar_clicavel(i) > 0 and not perigoso(i)],
        key=lambda i: (-int(bool(i.get("bloco_da_vaga"))), -pontuar_clicavel(i)),
    )
    for item in relevantes:
        if feitos >= maximo:
            break
        url = url_do_clicavel(item)
        if url:
            feitos += 1
            linhas.append(mascarar(f"{rotulo}: abrindo o clicável {item.get('i')} ({padrao_do_link(url)})"))
            d.get(url)
            time.sleep(ESPERA_DA_PAGINA)
            novas, _ = analisar_conteudo(portal, f"{rotulo} › clicável {item.get('i')}", testar, acessos)
            linhas += novas
            voltar_para()
        elif abre_modal(item) and item.get("visivel"):
            feitos += 1
            if not d.execute_script(JS_CLICAR_CLICAVEL, item.get("i")):
                continue
            time.sleep(ESPERA_DA_PAGINA)
            novas, _ = analisar_conteudo(
                portal, f"{rotulo} › modal do clicável {item.get('i')}", testar, acessos, ".modal.in, .modal.show"
            )
            linhas += novas
            linhas.append(
                linha_das_ancoras(f"{rotulo} › modal do clicável {item.get('i')}", d.execute_script(JS_ANCORAS))
            )
            sub, _ = listar_clicaveis(d, f"{rotulo} › modal do clicável {item.get('i')}", "painel", maximo=15)
            linhas += sub
            d.execute_script(JS_FECHAR_MODAL)
            time.sleep(1)
    if not relevantes:
        linhas.append(mascarar(f"{rotulo}: nenhum clicável de questionário/respostas"))
    return linhas


ABAS_DETALHADAS = ("tabInscricoes", "tabAnexos", "tabCurriculo")


def sondar_candidato(portal, rotulo, detalhe, testar=testar_sem_cookies, codigo_vaga=""):
    """
    Linhas de log da estrutura de um candidato: as abas da página (só as do
    candidato: href "#…" com data-toggle=tab), o painel de cada uma; em
    #tabInscricoes, #tabAnexos e #tabCurriculo, os clicáveis, os atributos de
    arquivo e, nos clicáveis de questionário/respostas, o link (mesma origem)
    ou o modal aberto e analisado. No fim, o acesso aos links (GET de 1 byte
    sem cookies e com sessão; abre os dois primeiros no navegador). Nunca levanta.
    """
    linhas = []
    d = portal.driver
    acessos = _Acessos()

    def voltar():
        d.get(detalhe)
        time.sleep(ESPERA_DA_PAGINA)
        d.execute_script(JS_DESCREVER_ABAS)

    try:
        portal._voltar_para_a_janela()
        d.get(detalhe)
        time.sleep(ESPERA_DA_PAGINA)
        varredura, descricoes, _melhor = varrer_abas(portal, rotulo)
        linhas += varredura
        for nome in ABAS_DETALHADAS:
            desc = next((x for x in descricoes if str(x.get("href") or x.get("alvo") or "") == f"#{nome}"), None)
            if desc is None:
                linhas.append(mascarar(f"{rotulo}: aba #{nome} não encontrada"))
                continue
            d.execute_script(JS_DESCREVER_ABAS)
            d.execute_script(JS_CLICAR_ABA, desc.get("i"))
            time.sleep(1.5)
            sub = f"{rotulo} #{nome}"
            novas, _ = analisar_conteudo(portal, sub, testar, acessos, f"#{nome}")
            linhas += novas
            clicaveis, itens = listar_clicaveis(d, sub, f"#{nome}", codigo_vaga)
            linhas += clicaveis
            if nome == "tabInscricoes":
                linhas += explorar_respostas(portal, sub, itens, testar, acessos, voltar)
                voltar()
        linhas += linhas_dos_acessos(portal, rotulo, acessos, testar)
    except Exception as erro:
        linhas.append(f"{rotulo}: a sondagem parou ({resumo_do_erro(erro)}).")
    return linhas


def linhas_dos_acessos(portal, rotulo, acessos, testar, abrir=2):
    linhas = []
    for i, (href, sessao) in enumerate(acessos.resultados, 1):
        sem = testar(href)
        aberto = abrir_no_navegador(portal, href) if i <= abrir else None
        linhas.append(linha_do_acesso(rotulo, i, href, sessao, aberto))
        linhas.append(
            mascarar(
                f"{rotulo}, acesso {i}: GET sem cookies: {sem.get('status') or sem.get('erro') or '?'} "
                f"{sem.get('tipo') or ''}".rstrip()
                + (f" → {sem['destino']}" if sem.get("destino") else "")
            )
        )
    if not acessos.resultados:
        linhas.append(mascarar(f"{rotulo}: nenhum link de arquivo para testar"))
    return linhas


# Âncoras da página/modal: quantos ids e os padrões (dígitos viram <n>).
JS_ANCORAS = (
    JS_VISIVEL
    + """
const modais = Array.from(document.querySelectorAll('.modal.in, .modal.show')).filter(visivel);
const raiz = modais[0] || document.body;
const ids = Array.from(raiz.querySelectorAll('[id], a[name]')).map(function (e) { return e.id || e.getAttribute('name') || ''; });
const padroes = {};
ids.forEach(function (i) { const p = i.replace(/[0-9]+/g, '<n>'); padroes[p] = (padroes[p] || 0) + 1; });
return {total: ids.length, padroes: Object.keys(padroes).map(function (k) { return [k, padroes[k]]; })
  .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 15)};
"""
)


def linha_das_ancoras(rotulo, ancoras):
    """'âncoras: 40 ids; padrões: pergunta-<n> (12), …' (padrão fora do formato vira <MASCARADO>)."""
    a = ancoras or {}
    padroes = []
    for item in a.get("padroes") or []:
        nome, n = (list(item) + ["", 0])[:2]
        nome = str(nome)
        if not re.fullmatch(r"[A-Za-z<>_-]{1,60}", nome) or re.search(r"<n>.*<n>.*<n>", nome):
            nome = MASCARA
        padroes.append(f"{nome} ({n})")
    return mascarar(f"{rotulo}: âncoras: {a.get('total', '?')} ids; padrões: {', '.join(padroes) or '—'}")


def anexos_por_pergunta(arquivos):
    """'4: 1, 5: 2, ?: 1' — quantos arquivos por número de pergunta (ou bloco)."""
    contagem = {}
    for a in arquivos or []:
        chave = numero_da_pergunta(a.get("enunciado")) or a.get("ordem") or "?"
        contagem[chave] = contagem.get(chave, 0) + 1
    return ", ".join(f"{k}: {n}" for k, n in sorted(contagem.items(), key=lambda kv: (str(kv[0]) == "?", str(kv[0]))))


def sondar_pela_vaga(portal, ident, codigo_vaga, codigos_dos_candidatos, testar=testar_sem_cookies):
    """
    Pela vaga: nas candidaturas (?m=0), os clicáveis de questionário da
    página (abre os da mesma origem, só leitura) e, de cada candidato sondado,
    os clicáveis do item (sem clicar) e o GET de GetRespostaDetails de cada
    resposta (sondar_detalhes).
    """
    d = portal.driver
    linhas = []
    acessos = _Acessos()
    rotulo = f"Vaga {codigo_vaga} (candidaturas)"
    try:
        portal._abrir_candidaturas(ident)

        def voltar():
            portal._abrir_candidaturas(ident)

        topo, itens = listar_clicaveis(d, f"{rotulo} página", "body", codigo_vaga, so_relevantes=True)
        linhas += topo
        linhas += explorar_respostas(portal, f"{rotulo} página", itens, testar, acessos, voltar, maximo=2)
        for n, cod in enumerate(codigos_dos_candidatos, 1):
            if not re.fullmatch(r"[A-Za-z0-9._-]{1,60}", str(cod)):
                continue
            voltar()
            sub = f"{rotulo} candidato {n}"
            itens_linhas, _itens = listar_clicaveis(d, sub, f"pessoa:{cod}", codigo_vaga, maximo=30)
            linhas += itens_linhas
            linhas += sondar_detalhes(d, sub, cod)
        linhas += linhas_dos_acessos(portal, rotulo, acessos, testar, abrir=1)
    except Exception as erro:
        linhas.append(f"{rotulo}: a sondagem parou ({resumo_do_erro(erro)}).")
    finally:
        try:
            portal.abrir_vagas_anunciadas()
        except Exception:
            pass
    return linhas


def sondar(portal, codigo, limite, registrar):
    """
    Modo sondar: localiza a vaga (só lê o link "Processo Seletivo", não
    exporta), lê a lista de candidatos e sonda os `limite` primeiros (1 a 3).
    Escreve tudo pelo `registrar` (mascarado). Devolve as linhas do resumo.
    """
    limite = max(1, min(int(limite or 1), LIMITE_DA_SONDAGEM))
    ident = portal.localizar_vaga(codigo)
    if not ident:
        registrar(f"Sondagem: não achei a vaga {codigo} em Vagas Anunciadas (ou o link Processo Seletivo).")
        return [f"Sondagem da vaga {codigo}: vaga não encontrada. Nada foi gravado."]
    enderecos = portal.capturar_candidatos(codigo) or {}
    escolhidos = list((enderecos.get("candidatos") or {}).items())[:limite]
    links = [link for _cod, link in escolhidos]
    registrar(f"Sondagem da vaga {codigo}: {len(links)} candidato(s) sondado(s) (limite {limite}).")
    for i, link in enumerate(links, 1):
        for linha in sondar_candidato(portal, f"Candidato {i}/{len(links)}", link, codigo_vaga=str(codigo)):
            registrar(linha)
    for linha in sondar_pela_vaga(portal, ident, str(codigo), [cod for cod, _link in escolhidos]):
        registrar(linha)
    return [
        f"Sondagem da vaga {codigo}: {len(links)} candidato(s) sondado(s). Só leitura: nada foi exportado nem gravado.",
        "A estrutura (seletores, perguntas, padrão dos links mascarado e status sem cookies) está no log do passo.",
    ]


# ── Detalhes da resposta (GetRespostaDetails): leitura e captura ──────────

CAMINHO_DOS_DETALHES = "/Company/VacancyTests/GetRespostaDetails/{}?token={}"
RESPOSTA = re.compile(r"^[0-9]{1,20}$")
TOKEN = re.compile(r"^[A-Za-z0-9_.~=%|+/-]{1,200}$")
# Os mesmos formatos que o banco aceita (CK_EMPREGANEXO_DSLINK, CK_EMPREGRESP_DSLINKIMPRESSAO)
# e que a ficha confere (src/lib/avaliacao-documental/anexo-na-empregare.ts).
LINK_DO_ARQUIVO = re.compile(
    r"^https://corporate\.empregare\.com/Company/VacancyTests/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$"
)
LINK_DA_IMPRESSAO = re.compile(
    r"^https://corporate\.empregare\.com/Company/VacancyTests/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$"
)
TAMANHO_DO_LINK = 1500
ORCAMENTO_DOS_ANEXOS = 30 * 60  # segundos na execução inteira (o workflow tem 120 min)
TEMPO_LIMITE_DOS_ANEXOS = 10 * 60  # segundos por vaga
PEDIDOS_POR_VEZ = 6  # GETs em paralelo na página
TAMANHO_DO_HTML = 3_000_000  # caracteres por resposta

# GETs de GetRespostaDetails com a sessão do Chrome (mesma origem). arguments[0]: caminhos.
JS_BUSCAR_DETALHES = """
const pronto = arguments[arguments.length - 1];
const caminhos = arguments[0] || [];
Promise.all(caminhos.map(function (c) {
  return fetch(c, {method: 'GET', credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}})
    .then(function (r) {
      return r.text().then(function (t) {
        let login = false;
        try { login = /login|entrar|signin/i.test(new URL(r.url).pathname); } catch (e) { login = false; }
        return {status: r.status, html: t.slice(0, 3000000), login: login};
      });
    })
    .catch(function (e) { return {status: null, html: '', erro: String((e && e.name) || 'erro')}; });
})).then(pronto);
"""


def registra_visualizacao(endereco):
    """O link "Visualizar Arquivo" registra a visualização: o robô nunca abre nem testa."""
    return "getviewerlogarquivo" in str(endereco or "").lower()


def link_absoluto(href):
    """Link absoluto da Empregare com os caracteres fora do formato codificados (espaço, acento…)."""
    texto = str(href or "").strip().replace("&amp;", "&")
    if not texto or texto.lower().startswith(("javascript:", "#", "mailto:")):
        return None
    absoluto = urljoin(URL_BASE + "/", texto).split("#")[0]
    return quote(absoluto, safe=":/?&=%|+~._-")


TIPO_ANEXO = 4  # TipoResposta do anexo no JSON (1 escolha única, 3 vídeo, 5 curta, 8 caixa, 9 múltipla)
_SEM_ARQUIVO = {"", "0", "1"}  # 0 "Não se aplica", 1 "Não possuo este documento" (o front mostra texto)
_ARQUIVO = re.compile(r"^[A-Za-z0-9 _.()~+=-]{1,300}$")


def _limpar_html(texto):
    """O enunciado sem tags e entidades, com espaços simples (o JSON pode trazer HTML/quebras)."""
    t = re.sub(r"<[^>]{0,500}>", " ", str(texto or ""))
    t = html_unescape(t).replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def arquivos_da_resposta(item):
    """Os nomes de arquivo da resposta de anexo (como o front: 0/1 e "Resposta não informada" não são arquivo)."""
    if str(item.get("AlternativaID") or "") == "1":
        return []
    bruto = str(item.get("Resposta") if item.get("Resposta") is not None else "").strip()
    if bruto in _SEM_ARQUIVO or "resposta não informada" in bruto.lower():
        return []
    return [a.strip() for a in re.split(r"[,;|]", bruto) if a.strip()]


def link_do_arquivo(arquivo, token, resposta_id, pergunta_id):
    """O "Visualizar Arquivo" como o front monta (chunk 8152): nome=Case, questionarioRespostaID = RespostaID da pergunta."""
    consulta = (
        f"arquivo={quote(str(arquivo), safe='._-')}&nome=Case&token={quote(str(token), safe='._-~')}"
        f"&questionarioRespostaID={resposta_id}&perguntaID={pergunta_id}"
    )
    link = f"{URL_BASE}/Company/VacancyTests/GetViewerLogArquivo?{consulta}"
    return link if len(link) <= TAMANHO_DO_LINK and LINK_DO_ARQUIVO.match(link) else None


def link_da_impressao(questionario_id, pessoa, vaga):
    """A impressão das respostas como o front monta: respostaID = id do questionário respondido, pessoa, vaga (título)."""
    if not RESPOSTA.match(str(questionario_id or "")) or not TOKEN.match(str(pessoa or "")) or not vaga:
        return None
    link = (
        f"{URL_BASE}/Company/VacancyTests/PrintResult?respostaID={questionario_id}"
        f"&pessoa={quote(str(pessoa), safe='._-~')}&vaga={quote(str(vaga), safe='')}"
    )
    return link if len(link) <= TAMANHO_DO_LINK and LINK_DA_IMPRESSAO.match(link) else None


def ler_detalhes_da_resposta(texto, token="", pessoa="", vaga=""):
    """
    O JSON de GetRespostaDetails ({sucesso, questionario: {id, totalPerguntas,
    respostas: [{PerguntaID, Ordem, Pergunta, TipoResposta, Resposta, RespostaID,
    AlternativaID…}]}}): {"sucesso", "perguntas", "respostas", "tipos": {tipo: n},
    "impressao", "anexos": [{"pergunta": PerguntaID, "ordem": Ordem, "arquivo": n,
    "enunciado", "link"}], "fora_do_formato"}. Nada é aberto; o nome do arquivo só
    vai no link (nunca no log).
    """
    vazio = {
        "sucesso": False,
        "perguntas": 0,
        "respostas": 0,
        "tipos": {},
        "impressao": None,
        "anexos": [],
        "fora_do_formato": 0,
        "json": False,
    }
    try:
        dados = json.loads(str(texto or "")[:TAMANHO_DO_HTML])
    except ValueError:
        return vazio
    if not isinstance(dados, dict):
        return vazio
    q = dados.get("questionario") if isinstance(dados.get("questionario"), dict) else {}
    itens = [r for r in (q.get("respostas") or []) if isinstance(r, dict)]
    tipos = {}
    anexos = []
    fora = 0
    for r in itens:
        tipo = r.get("TipoResposta")
        tipos[str(tipo)] = tipos.get(str(tipo), 0) + 1
        if str(tipo) != str(TIPO_ANEXO):
            continue
        pergunta = str(r.get("PerguntaID") or "")
        resposta_id = str(r.get("RespostaID") or "")
        ordem = r.get("Ordem")
        ordem = int(ordem) if isinstance(ordem, int) or str(ordem or "").isdigit() else None
        for n, arquivo in enumerate(arquivos_da_resposta(r), 1):
            link = (
                link_do_arquivo(arquivo, token, resposta_id, pergunta)
                if RESPOSTA.match(pergunta)
                and RESPOSTA.match(resposta_id)
                and _ARQUIVO.match(arquivo)
                and TOKEN.match(str(token or ""))
                else None
            )
            if not link:
                fora += 1
                continue
            anexos.append(
                {
                    "pergunta": pergunta,
                    "ordem": ordem if ordem is not None and 1 <= ordem <= 999 else None,
                    "arquivo": n,
                    "enunciado": limpar_enunciado(_limpar_html(r.get("Pergunta"))) or None,
                    "link": link,
                }
            )
    total = q.get("totalPerguntas")
    return {
        "sucesso": bool(dados.get("sucesso")),
        "perguntas": total if isinstance(total, int) else len(itens),
        "respostas": len(itens),
        "tipos": tipos,
        "impressao": link_da_impressao(q.get("id"), pessoa, vaga),
        "anexos": anexos,
        "fora_do_formato": fora,
        "json": True,
    }


def normalizar_texto(valor):
    """Como normalizarTexto de nota-declarada.js: sem acento, minúsculo, espaços simples (&nbsp; vira espaço)."""
    t = re.sub(r"&nbsp;|&#160;", " ", str(valor or ""), flags=re.I)
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t.lower()).strip()


_PREFIXO_DA_PERGUNTA = re.compile(r"^pergunta ?[0-9]+ ?[-–—] ?")


def _confirma(alvo, nome):
    return nome == alvo or (len(alvo) >= 20 and len(nome) >= 20 and (nome.startswith(alvo) or alvo.startswith(nome)))


def coluna_da_pergunta(enunciado, colunas, ordem=None):
    """
    A coluna do Excel ("Pergunta N - enunciado") da pergunta: a "Pergunta <Ordem>"
    se o enunciado confirma (igual sem o prefixo, ou um começando pelo outro com
    20+ letras); senão pelo enunciado em todas. Ambígua ou nenhuma → None.
    """
    alvo = _PREFIXO_DA_PERGUNTA.sub("", normalizar_texto(enunciado))
    if ordem is not None:
        for c in colunas or []:
            nome = normalizar_texto(c)
            if re.match(rf"^pergunta ?{int(ordem)} ?[-–—]", nome) and _confirma(
                alvo, _PREFIXO_DA_PERGUNTA.sub("", nome)
            ):
                return c
    if len(alvo) < 5:
        return None
    nomes = [(c, _PREFIXO_DA_PERGUNTA.sub("", normalizar_texto(c))) for c in colunas or [] if c]
    iguais = [c for c, n in nomes if n == alvo]
    if len(iguais) == 1:
        return iguais[0]
    if iguais:
        return None
    if len(alvo) < 20:
        return None
    parecidas = [c for c, n in nomes if len(n) >= 20 and (n.startswith(alvo) or alvo.startswith(n))]
    return parecidas[0] if len(parecidas) == 1 else None


def buscar_detalhes(driver, pedidos):
    """GETs de GetRespostaDetails (JSON) com a sessão (pedidos: [(resposta, token)]). Devolve a lista do JS."""
    caminhos = [CAMINHO_DOS_DETALHES.format(r, quote(t, safe="")) for r, t in pedidos]
    driver.set_script_timeout(120)
    return driver.execute_async_script(JS_BUSCAR_DETALHES, caminhos) or []


def capturar_anexos(portal, codigo, respostas, registrar, prazo, agora=time.monotonic):
    """
    Para cada candidato ({código: {"pessoa", "respostas": [{"id", "token", "vaga"}]}}) e resposta, o GET de
    GetRespostaDetails com a sessão; devolve {código: [{"resposta", "impressao",
    "perguntas", "anexos"}]}. No log, só contagens. Nunca levanta.
    """
    pedidos = [
        (cod, r, dados.get("pessoa") or "")
        for cod, dados in (respostas or {}).items()
        for r in dados.get("respostas") or []
        if RESPOSTA.match(str(r.get("id"))) and TOKEN.match(str(r.get("token") or ""))
    ]
    capturados = {}
    lidas = falhas = anexos = sem_impressao = fora = 0
    esgotou = False
    for i in range(0, len(pedidos), PEDIDOS_POR_VEZ):
        if agora() >= prazo:
            esgotou = True
            break
        lote = pedidos[i : i + PEDIDOS_POR_VEZ]
        try:
            resultados = buscar_detalhes(portal.driver, [(r["id"], r["token"]) for _c, r, _p in lote])
        except Exception:
            falhas += len(lote)
            continue
        for (cod, r, pessoa), res in zip(lote, list(resultados) + [{}] * len(lote), strict=False):
            if (res or {}).get("status") != 200 or (res or {}).get("login"):
                falhas += 1
                continue
            lido = ler_detalhes_da_resposta(res.get("html"), r["token"], pessoa, r.get("vaga"))
            if not lido["sucesso"]:
                falhas += 1
                continue
            resposta = r["id"]
            lidas += 1
            anexos += len(lido["anexos"])
            sem_impressao += lido["impressao"] is None
            fora += lido["fora_do_formato"]
            capturados.setdefault(cod, []).append(
                {
                    "resposta": resposta,
                    "impressao": lido["impressao"],
                    "perguntas": lido["perguntas"],
                    "anexos": lido["anexos"],
                }
            )
    registrar(
        f"Vaga {codigo}: respostas de questionário lidas {lidas} de {len(pedidos)} "
        f"({len(capturados)} candidato(s)) · {anexos} anexo(s)"
        + (f" · {falhas} falha(s)" if falhas else "")
        + (f" · {sem_impressao} sem link de impressão" if sem_impressao else "")
        + (f" · {fora} link(s) fora do formato" if fora else "")
        + (" · tempo esgotado (o resto na próxima execução)" if esgotou else "")
        + "."
    )
    return capturados


def gravar_anexos(config, sync, codigo, capturados, colunas, chamar, registrar):
    """
    Grava as respostas e os anexos da vaga (gravar_anexos_empregare, em lotes),
    com a coluna do Excel de cada anexo. Falha não derruba a vaga: só avisa.
    Devolve quantos anexos o banco gravou. No log, só contagens.
    """
    from monitora import supabase_rpc

    itens = []
    casados = 0
    for cod, respostas in sorted((capturados or {}).items()):
        for r in respostas:
            anexos = []
            for a in r.get("anexos") or []:
                coluna = coluna_da_pergunta(a.get("enunciado"), colunas, a.get("ordem"))
                casados += coluna is not None
                anexos.append(dict(a, coluna=coluna))
            itens.append(
                {
                    "codigo": cod,
                    "resposta": r.get("resposta"),
                    "impressao": r.get("impressao"),
                    "perguntas": r.get("perguntas"),
                    "anexos": anexos,
                }
            )
    if not itens:
        return 0
    gravados = 0
    total = sum(len(i["anexos"]) for i in itens)
    try:
        for lote in em_lotes(itens):
            r = chamar(config, "gravar_anexos_empregare", {"p_sync": sync, "p_vaga": codigo, "p_respostas": lote})
            gravados += int((r or {}).get("anexos") or 0)
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) == 404:
            registrar("O banco ainda não guarda os anexos do questionário (falta a migration 20261008160000).")
        else:
            registrar(f"Vaga {codigo}: o banco recusou os anexos do questionário ({erro}).")
        return gravados
    except Exception as erro:
        registrar(f"Vaga {codigo}: a gravação dos anexos do questionário falhou ({resumo_do_erro(erro)}).")
        return gravados
    registrar(
        f"Vaga {codigo}: {len(itens)} resposta(s) e {gravados} anexo(s) gravados · "
        f"{casados} de {total} anexo(s) casados com a coluna do Excel."
    )
    return gravados


def sondar_detalhes(driver, rotulo, codigo_do_candidato):
    """
    Sondar: o GET de GetRespostaDetails (JSON) de cada resposta do candidato
    (modo ≠ 3), com a sessão. Só contagens, Ordens e padrões mascarados; nenhum
    arquivo é aberto e o nome do arquivo nunca vai ao log.
    """
    from navegador_empregare import ler_respostas_do_html

    try:
        fonte = driver.page_source or ""
    except Exception as erro:
        return [mascarar(f"{rotulo}: sem o HTML da lista ({type(erro).__name__})")]
    respostas, sem_token = ler_respostas_do_html(fonte)
    dados = respostas.get(str(codigo_do_candidato)) or {}
    lista = dados.get("respostas") or []
    linhas = [
        mascarar(
            f"{rotulo}: respostas de questionário (modo ≠ 3) {len(lista)}; pessoa {'sim' if dados.get('pessoa') else 'não'}; "
            f"título da vaga no link {'sim' if any(r.get('vaga') for r in lista) else 'não'}; itens sem token na lista {sem_token}"
        )
    ]
    if not lista:
        return linhas
    try:
        resultados = buscar_detalhes(driver, [(r["id"], r["token"]) for r in lista[:3]])
    except Exception as erro:
        return linhas + [mascarar(f"{rotulo}: GetRespostaDetails falhou ({type(erro).__name__})")]
    for i, (r, res) in enumerate(zip(lista[:3], resultados, strict=False), 1):
        res = res or {}
        lido = ler_detalhes_da_resposta(res.get("html") or "", r["token"], dados.get("pessoa"), r.get("vaga"))
        ordens = sorted({a["ordem"] for a in lido["anexos"] if a.get("ordem")})
        parecem = sum(1 for a in lido["anexos"] if _PARECE_ENUNCIADO.search(a.get("enunciado") or ""))
        tipos = ", ".join(f"{t}: {n}" for t, n in sorted(lido["tipos"].items()))
        linhas.append(
            mascarar(
                f"{rotulo}, resposta {i}: GET com sessão {res.get('status') or res.get('erro') or '?'}"
                f"{' (login!)' if res.get('login') else ''}; JSON {'sim' if lido['json'] else 'não'}; "
                f"sucesso {'sim' if lido['sucesso'] else 'não'}; totalPerguntas {lido['perguntas']}; "
                f"respostas {lido['respostas']}; tipos {tipos or '—'}; anexos {len(lido['anexos'])} "
                f"(tipo {TIPO_ANEXO} com arquivo) em {len({a['pergunta'] for a in lido['anexos']})} pergunta(s); "
                f"Ordens dos anexos: {', '.join(str(o) for o in ordens) or '—'}; enunciados que parecem enunciado "
                f"{parecem}; fora do formato {lido['fora_do_formato']}; impressão {'sim' if lido['impressao'] else 'não'}"
            )
        )
        for a in lido["anexos"][:15]:
            linhas.append(
                mascarar(
                    f"{rotulo}, resposta {i}: anexo da Ordem {a.get('ordem') or '?'} (arquivo {a['arquivo']}) · "
                    f"«Pergunta {a.get('ordem') or '?'}» · enunciado {enunciado_para_o_log(a.get('enunciado'))} · "
                    "arquivo não aberto"
                )
            )
        if lido["anexos"]:
            linhas.append(
                mascarar(f"{rotulo}, resposta {i}: padrão do link {padrao_do_link(lido['anexos'][0]['link'])}")
            )
        if lido["impressao"]:
            linhas.append(mascarar(f"{rotulo}, resposta {i}: impressão {padrao_do_link(lido['impressao'])}"))
    return linhas


def _contar(anexos):
    contagem = {}
    for a in anexos:
        contagem[a["pergunta"]] = contagem.get(a["pergunta"], 0) + 1
    return contagem
