"""
Os ANEXOS do questionário de cada candidato na Empregare (aba Questionários).

A exportação da Empregare não traz o link dos arquivos anexados (só "Sim"/"--"),
e o link de detalhes do candidato (DS_LINK_DETALHE) abre o currículo. Os
arquivos ficam na página de detalhes, aba Questionários (ou na visão
"imprimir", /empresa/questionarios/imprimir/<id>|). Este módulo:

  - SONDAR (modo `sondar` do workflow, só leitura): abre 1 a 3 candidatos de
    uma vaga e escreve no log só a ESTRUTURA da aba Questionários: seletores,
    quantas perguntas, por anexo o enunciado (texto do edital, não é dado
    pessoal; só sai se parecer enunciado) e o PADRÃO do link do arquivo com
    tudo que pareça token/id/nome de arquivo trocado por <MASCARADO>, se o link
    é assinado/expira e o status de um GET sem cookies. Nunca nome, CPF,
    e-mail, nome de arquivo nem URL completa.
  - CAPTURAR (modo normal com --anexos, opcional até validarmos): por
    candidato com link de detalhe, guarda por pergunta de anexo o link do
    arquivo; se o arquivo exigir sessão ou expirar, o link da página do
    questionário com âncora. Grava em TB_EMPREGARE_ANEXO pela RPC
    gravar_anexos_empregare (migration 20261008160000_anexos_da_empregare.sql).
    Os links levam tokens: no log, só contagens.

A leitura da página é genérica (o formato da aba ainda não foi conferido):
procura a aba pelo texto "Questionário", o painel pelo id/classe e os links de
arquivo por href/data-url/onclick com cara de arquivo (download, .pdf…). Quando
o log do `sondar` mostrar a estrutura real, ajuste os JS_… e os seletores aqui.

Testes: tests/python/test_anexos_empregare.py. Guia: docs/robo-empregare.md.
"""

import re
import time
import urllib.error
import urllib.request
from urllib.parse import parse_qsl, unquote, urljoin, urlsplit

from monitora.mascaramento import mascarar, resumo_do_erro

URL_BASE = "https://corporate.empregare.com"
MASCARA = "<MASCARADO>"

ESPERA_PELO_QUESTIONARIO = 12  # segundos até a aba mostrar perguntas ou arquivos
INTERVALO = 0.5
ESPERA_DA_PAGINA = 2  # segundos depois de abrir a página do candidato
TEMPO_DO_HEAD = 15
LIMITE_DA_SONDAGEM = 3  # candidatos
ANEXOS_POR_CANDIDATO_NO_LOG = 10
ORCAMENTO_DOS_ANEXOS = 30 * 60  # segundos na execução inteira (o workflow tem 120 min)
TEMPO_LIMITE_DOS_ANEXOS = 10 * 60  # segundos por vaga
DIAS_DE_VALIDADE = 7  # candidato com anexos capturados há menos que isso vai para o fim da fila
TAMANHO_DO_LOTE = 500

# Arquivo que pede login (sem cookies dá 401/403 ou manda para o login) vira o
# link da página do questionário: o mesmo tratamento do link que expira.
ARQUIVO_COM_SESSAO_VIRA_PAGINA = True

# Mesmo formato que o banco aceita (CK_EMPREGANEXO_DSLINK) e que a ficha confere
# (src/lib/avaliacao-documental/anexo-na-empregare.ts).
LINK_DO_ARQUIVO = re.compile(r"^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^\s\"'<>`\\]*$")
LINK_DA_PAGINA = re.compile(r"^https://corporate\.empregare\.com/[A-Za-z0-9_.~=&%|+/:?#-]*$")
TAMANHO_DO_LINK = 1000
ANCORA = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,60}$")

# ── JavaScript (só estrutura; o Python mascara tudo antes do log) ───────────

JS_VISIVEL = """
const visivel = function (el) { return !!(el && (el.offsetParent || el.getClientRects().length)); };
const texto = function (el) { return (el ? (el.innerText || el.textContent || '') : '').replace(/\\s+/g, ' ').trim(); };
"""

# Rótulos das abas da página do candidato (o Python reduz a nomes conhecidos).
JS_ABAS_DO_CANDIDATO = (
    JS_VISIVEL
    + """
return Array.from(document.querySelectorAll('.nav a, .nav-tabs a, [role="tab"], .tabs a, ul.nav li > a, .nav button'))
  .filter(visivel).map(function (a) { return texto(a).slice(0, 40); }).slice(0, 30);
"""
)

# Clica na aba Questionários. Devolve como ela é (tag, href, alvo, classes) sem texto livre.
JS_ABRIR_QUESTIONARIOS = (
    JS_VISIVEL
    + """
const sinal = function (el) {
  const ic = el.querySelector('i[class*="fa"], span[class*="fa"]');
  return [texto(el), el.getAttribute('href'), el.getAttribute('data-target'), el.getAttribute('data-bs-target'),
    el.getAttribute('aria-controls'), el.getAttribute('title'), el.getAttribute('aria-label'),
    el.getAttribute('data-original-title'), el.getAttribute('data-bs-original-title'), ic ? ic.className : '']
    .join(' ');
};
const alvos = Array.from(document.querySelectorAll('a, button, [role="tab"], li')).filter(function (el) {
  return visivel(el) && texto(el).length < 60 && /question[aá]rio|questionnaire|formul[aá]rio/i.test(sinal(el));
});
alvos.sort(function (a, b) { return texto(a).length - texto(b).length; });
const aba = alvos.find(function (e) { return e.matches('a, button, [role="tab"]'); }) || alvos[0];
if (!aba) { return {achou: false, total: 0}; }
const info = {
  achou: true,
  total: alvos.length,
  tag: aba.tagName.toLowerCase(),
  href: aba.getAttribute('href') || '',
  alvo: aba.getAttribute('data-target') || aba.getAttribute('data-bs-target') || aba.getAttribute('aria-controls') || '',
  classes: String(aba.className || ''),
  id: aba.id || '',
  onclick: (aba.getAttribute('onclick') || '').slice(0, 200)
};
aba.scrollIntoView({block: 'center'});
aba.click();
return info;
"""
)

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
const painel = candidatosAPainel[0] || document.body;

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


# ── O que vai para o banco ──────────────────────────────────────────────────


def link_do_arquivo(endereco):
    """Link do arquivo no formato que o banco aceita, ou None."""
    t = str(endereco or "").strip()
    return t if len(t) <= TAMANHO_DO_LINK and LINK_DO_ARQUIVO.match(t) else None


def link_da_pagina(detalhe, imprimir=None, ancora=None, aba=None):
    """
    O link da página do questionário: a visão "imprimir" se houver; senão a
    página de detalhes. Com a âncora da pergunta (id do bloco) ou da aba.
    """
    marca = next((a for a in (ancora, str(aba or "").lstrip("#")) if a and ANCORA.match(a)), None)
    for base in (imprimir, detalhe):
        t = str(base or "").strip().split("#")[0]
        if not t:
            continue
        candidato = t + (f"#{marca}" if marca else "")
        if len(candidato) <= TAMANHO_DO_LINK and LINK_DA_PAGINA.match(candidato):
            return candidato
    return None


def anexos_do_candidato(leitura, detalhe, classificar):
    """
    Da leitura da aba (JS_LER_QUESTIONARIO) para as linhas do banco, uma por
    pergunta: [{"pergunta", "enunciado", "tipo", "link"}]. `classificar(href)`
    → classificar_link(...). Sem número de pergunta (nem no texto nem pela
    ordem do bloco), o arquivo fica de fora. Vale o primeiro arquivo de cada
    pergunta. Devolve (linhas, sem_numero).
    """
    imprimir = next(iter((leitura or {}).get("imprimir") or []), None)
    linhas = {}
    sem_numero = 0
    for a in (leitura or {}).get("arquivos") or []:
        numero = numero_da_pergunta(a.get("enunciado")) or a.get("ordem")
        if not isinstance(numero, int) or not 1 <= numero <= 999:
            sem_numero += 1
            continue
        if numero in linhas:
            continue
        href = a.get("href")
        arquivo = link_do_arquivo(href)
        tipo, link = "ARQUIVO", arquivo
        if arquivo:
            c = classificar(arquivo)
            serve = not c["assinado"] and (c["publico"] or (c["exige_sessao"] and not ARQUIVO_COM_SESSAO_VIRA_PAGINA))
            if not serve:
                tipo, link = "QUESTIONARIO", None
        if not link:
            tipo = "QUESTIONARIO"
            link = link_da_pagina(detalhe, imprimir, a.get("ancora"), (leitura or {}).get("aba"))
        if not link:
            continue
        linhas[numero] = {
            "pergunta": numero,
            "enunciado": limpar_enunciado(a.get("enunciado")) or None,
            "tipo": tipo,
            "link": link,
        }
    return [linhas[n] for n in sorted(linhas)], sem_numero


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


def abrir_questionario_do_candidato(portal, detalhe):
    """Abre a página de detalhes, clica na aba Questionários e espera. Devolve (abas, aba, apareceu)."""
    d = portal.driver
    portal._voltar_para_a_janela()
    d.get(detalhe)
    time.sleep(ESPERA_DA_PAGINA)
    try:
        abas = d.execute_script(JS_ABAS_DO_CANDIDATO) or []
    except Exception:
        abas = []
    aba = d.execute_script(JS_ABRIR_QUESTIONARIOS) or {"achou": False}
    apareceu = _esperar_questionario(d)
    time.sleep(1)
    return abas, aba, apareceu


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


def linhas_da_aba(rotulo, abas, aba, apareceu):
    """As abas da página (só nomes conhecidos) e como é a aba Questionários."""
    nomes = [nome_da_aba(a) for a in abas or []]
    if not (aba or {}).get("achou"):
        descricao = "NÃO achei a aba Questionários"
    else:
        descricao = (
            f"aba Questionários: {_palavra(aba.get('tag'))} (candidatas {aba.get('total')}), "
            f"href {padrao_do_link(aba['href']) if aba.get('href') and not aba['href'].startswith('#') else _ancora_ou_mascara(aba.get('href'))}, "
            f"alvo {_ancora_ou_mascara(aba.get('alvo'))}, id {_ancora_ou_mascara(aba.get('id'))}, "
            f"classes {' '.join(_palavras(str(aba.get('classes') or '').split(), 8)) or '—'}, "
            f"onclick {_nome_da_funcao(aba.get('onclick'))}"
        )
    return [
        mascarar(f"{rotulo}: abas da página {len(nomes)} [{', '.join(nomes[:15])}]"),
        mascarar(f"{rotulo}: {descricao}; conteúdo apareceu: {'sim' if apareceu else 'não (esperei)'}"),
    ]


def _nome_da_funcao(onclick):
    m = re.match(r"^\s*([A-Za-z_$][\w$.]{0,40})\s*\(", str(onclick or ""))
    return m.group(1) if m else ("—" if not onclick else "?")


def _testar_arquivos(driver, leitura, testar=testar_sem_cookies):
    testes = {}
    for a in ((leitura or {}).get("arquivos") or [])[:ANEXOS_POR_CANDIDATO_NO_LOG]:
        href = a.get("href")
        if href and href not in testes:
            testes[href] = {"sem_cookies": testar(href), "com_sessao": testar_com_sessao(driver, href)}
    return testes


# ── Sondagem 2: as abas uma a uma, os atributos dos arquivos e o acesso ─────

# As abas da página do candidato com tudo que as identifica (o rótulo pode ser só
# ícone/tooltip). Guarda os elementos em window.__abasMonitora para clicar pelo índice.
JS_DESCREVER_ABAS = (
    JS_VISIVEL
    + """
const todas = Array.from(document.querySelectorAll(
  '.nav a, .nav-tabs a, [role="tab"], [data-toggle="tab"], [data-bs-toggle="tab"], [data-toggle="pill"], ul.nav li > a, .nav button'
)).filter(visivel);
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
const els = Array.from(document.querySelectorAll('[data-url], [data-arquivo], [data-file], [data-href], [data-download]')).slice(0, 12);
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
    return " ".join(c for c in str(classes or "").split() if re.fullmatch(r"(fa|glyphicon|icon)[a-z0-9-]{0,40}", c))


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


def sondar_candidato(portal, rotulo, detalhe, testar=testar_sem_cookies):
    """
    Linhas de log da estrutura de um candidato: todas as abas (clica nas que
    trocam de painel), a leitura da aba escolhida (e da visão imprimir), os
    atributos data-url/data-arquivo e o acesso aos links (GET de 1 byte sem
    cookies e com sessão; por fim abre o primeiro no navegador). Nunca levanta.
    """
    linhas = []
    d = portal.driver
    try:
        portal._voltar_para_a_janela()
        d.get(detalhe)
        time.sleep(ESPERA_DA_PAGINA)
        varredura, _descricoes, melhor = varrer_abas(portal, rotulo)
        linhas += varredura
        if melhor is not None:
            d.execute_script(JS_CLICAR_ABA, melhor)
            _esperar_questionario(d)
            time.sleep(1)
        leitura = ler_questionario(d)
        linhas += linhas_da_leitura(
            f"{rotulo} (aba {melhor if melhor is not None else 'ativa'})", leitura, _testar_arquivos(d, leitura, testar)
        )
        elementos = d.execute_script(JS_ATRIBUTOS_DE_ARQUIVO) or []
        linhas += linhas_dos_atributos(rotulo, elementos)
        alvos = []
        for href in [a.get("href") for a in (leitura.get("arquivos") or [])[:3]] + links_dos_atributos(elementos):
            if href and href not in alvos:
                alvos.append(href)
        acessos = [(href, get_com_sessao(d, href)) for href in alvos[:5]]
        imprimir = next(iter(leitura.get("imprimir") or []), None)
        if imprimir:
            sem = testar(imprimir)
            linhas.append(
                mascarar(
                    f"{rotulo}: visão imprimir {padrao_do_link(imprimir)} · GET sem cookies: "
                    f"{sem.get('status') or sem.get('erro') or '?'}"
                    + (f" → {sem['destino']}" if sem.get("destino") else "")
                )
            )
            d.get(imprimir)
            time.sleep(ESPERA_DA_PAGINA)
            vista = ler_questionario(d)
            linhas += linhas_da_leitura(f"{rotulo} (imprimir)", vista, _testar_arquivos(d, vista, testar))
        for i, (href, sessao) in enumerate(acessos, 1):
            sem = testar(href)
            aberto = abrir_no_navegador(portal, href) if i <= 2 else None
            linhas.append(linha_do_acesso(rotulo, i, href, sessao, aberto))
            linhas.append(
                mascarar(
                    f"{rotulo}, acesso {i}: GET sem cookies: {sem.get('status') or sem.get('erro') or '?'} "
                    f"{sem.get('tipo') or ''}".rstrip()
                    + (f" → {sem['destino']}" if sem.get("destino") else "")
                )
            )
    except Exception as erro:
        linhas.append(f"{rotulo}: a sondagem parou ({resumo_do_erro(erro)}).")
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
    links = list((enderecos.get("candidatos") or {}).values())[:limite]
    registrar(f"Sondagem da vaga {codigo}: {len(links)} candidato(s) sondado(s) (limite {limite}).")
    for i, link in enumerate(links, 1):
        for linha in sondar_candidato(portal, f"Candidato {i}/{len(links)}", link):
            registrar(linha)
    return [
        f"Sondagem da vaga {codigo}: {len(links)} candidato(s) sondado(s). Só leitura: nada foi exportado nem gravado.",
        "A estrutura (seletores, perguntas, padrão dos links mascarado e status sem cookies) está no log do passo.",
    ]


# ── Captura (modo normal com --anexos) ──────────────────────────────────────


def ordenar_para_capturar(candidatos, ja_capturados):
    """Os que não têm anexo capturado há pouco vêm primeiro (a fila anda entre execuções)."""
    ja = set(ja_capturados or [])
    itens = list((candidatos or {}).items())
    return [c for c in itens if c[0] not in ja] + [c for c in itens if c[0] in ja]


def capturar_anexos(portal, codigo, candidatos, ja_capturados, registrar, prazo, testar=testar_sem_cookies):
    """
    Lê a aba Questionários de cada candidato com link de detalhe, até o
    `prazo` (monotonic). Devolve {código do candidato: [linhas]} só com quem
    tem algum anexo. No log, só contagens. Nunca levanta. Volta para Vagas Anunciadas.
    """
    capturados = {}
    lidos = sem_aba = falhas = sem_numero = 0
    tipos = {"ARQUIVO": 0, "QUESTIONARIO": 0}
    cache = {}

    def classificar(href):
        u = urlsplit(href)
        chave = (u.hostname, u.path.split("/")[1] if "/" in u.path else "")
        if chave not in cache:
            cache[chave] = testar(href)
        return classificar_link(href, cache[chave])

    fila = ordenar_para_capturar(candidatos, ja_capturados)
    esgotou = False
    for cod, detalhe in fila:
        if time.monotonic() >= prazo:
            esgotou = True
            break
        try:
            _abas, aba, _apareceu = abrir_questionario_do_candidato(portal, detalhe)
            if not aba.get("achou"):
                sem_aba += 1
                continue
            leitura = ler_questionario(portal.driver)
            leitura["aba"] = aba.get("alvo") or (aba.get("href") if str(aba.get("href", "")).startswith("#") else "")
            linhas, sem = anexos_do_candidato(leitura, detalhe, classificar)
            lidos += 1
            sem_numero += sem
            if linhas:
                capturados[cod] = linhas
                for linha in linhas:
                    tipos[linha["tipo"]] += 1
        except Exception:
            falhas += 1
    try:
        portal.abrir_vagas_anunciadas()
    except Exception:
        pass
    registrar(
        f"Vaga {codigo}: anexos lidos de {lidos} de {len(fila)} candidato(s) com link · "
        f"{len(capturados)} com anexo · links: {tipos['ARQUIVO']} do arquivo, {tipos['QUESTIONARIO']} da página"
        + (f" · {sem_aba} sem aba Questionários" if sem_aba else "")
        + (f" · {sem_numero} arquivo(s) sem número de pergunta" if sem_numero else "")
        + (f" · {falhas} falha(s)" if falhas else "")
        + (" · tempo esgotado (o resto na próxima execução)" if esgotou else "")
        + "."
    )
    return capturados


def anexos_capturados(config, codigo, chamar):
    """
    Códigos dos candidatos da vaga com anexo capturado há menos de
    DIAS_DE_VALIDADE dias. None se o banco não tem a migration (404).
    """
    from monitora import supabase_rpc

    try:
        r = chamar(config, "anexos_capturados_empregare", {"p_vaga": codigo, "p_dias": DIAS_DE_VALIDADE})
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) == 404:
            return None
        raise
    return [str(c) for c in (r or {}).get("candidatos") or []]


def gravar_anexos(config, sync, codigo, capturados, chamar, registrar):
    """
    Grava os anexos da vaga (gravar_anexos_empregare, em lotes). Falha não
    derruba a vaga: só avisa. Devolve quantos o banco gravou.
    """
    from monitora import supabase_rpc

    itens = [dict(linha, codigo=cod) for cod, linhas in sorted((capturados or {}).items()) for linha in linhas]
    if not itens:
        return 0
    gravados = 0
    try:
        for lote in em_lotes(itens):
            r = chamar(config, "gravar_anexos_empregare", {"p_sync": sync, "p_vaga": codigo, "p_anexos": lote})
            gravados += int((r or {}).get("gravados") or 0)
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) == 404:
            registrar("O banco ainda não guarda os anexos (falta a migration 20261008160000).")
        else:
            registrar(f"Vaga {codigo}: o banco recusou os anexos ({erro}).")
        return gravados
    except Exception as erro:
        registrar(f"Vaga {codigo}: a gravação dos anexos falhou ({resumo_do_erro(erro)}).")
        return gravados
    registrar(f"Vaga {codigo}: {gravados} link(s) de anexo gravado(s).")
    return gravados
