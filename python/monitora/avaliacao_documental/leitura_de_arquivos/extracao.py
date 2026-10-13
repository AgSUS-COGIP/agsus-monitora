"""
O texto de cada página do arquivo, pelo tipo REAL (os primeiros bytes, não a
extensão do nome):

    PDF       pdfplumber, com a posição de cada palavra (`layout`); a página
              sem texto selecionável (escaneada) vai para o OCR (renderizada a
              300 dpi pelo pypdfium2 que o pdfplumber traz)
    JPG/PNG   OCR (Tesseract, português) depois de girar pela EXIF e ampliar
              imagem pequena
    OCR       a imagem arrumada pelo OpenCV (`imagem`: tamanho, perspectiva,
              sombra, inclinação); com confiança baixa, a orientação pela OSD
              do Tesseract (de lado, de cabeça para baixo) e os modos --psm 4,
              6 e 11 e a versão binarizada, ficando a leitura com mais texto
              confiável; as palavras saem com a posição (`layout`). Sem
              OpenCV, como antes: com confiança baixa, de novo a 400 dpi
    DOCX      o XML do Word (zipfile)
    TXT       UTF-8 ou Latin-1
    resto     NAO_SUPORTADO (DOC antigo, ZIP, RAR, PPTX…)

`ler_paginas` devolve as páginas (com as palavras e a posição, quando há), o
método (TEXTO ou OCR, o que predominou), a confiança média do OCR (0 a 1) e a
data de criação do PDF (metadados), limite dos dias do vínculo atual quando o
documento não diz a data de emissão. Limites: MAXIMO_DE_PAGINAS páginas lidas e
MAXIMO_DE_PAGINAS_NO_OCR com OCR (o resto conta como não lido e vira alerta).
pdfplumber, Pillow e pytesseract são importados só aqui, na hora (OpenCV, em `imagem`).
"""

import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date

from . import imagem as _imagem
from .layout import palavras_do_pdfplumber, palavras_do_tesseract
from .texto import letras, preparar

MAXIMO_DE_PAGINAS = 40
MAXIMO_DE_PAGINAS_NO_OCR = 30
MINIMO_DE_LETRAS_DA_PAGINA = 40  # menos que isso no texto do PDF: a página é imagem (OCR)
RESOLUCAO_DO_OCR = 300
RESOLUCAO_DA_SEGUNDA_LEITURA = 400
CONFIANCA_PARA_RELER = 0.60  # OCR abaixo disso: no PDF, tenta de novo com resolução maior
CONFIANCA_BOA = 0.80  # OCR com isso ou mais: a primeira leitura basta (não tenta os outros modos)
CONFIANCA_DA_ORIENTACAO = 1.5  # orientation_conf da OSD a partir da qual se gira sem olhar outra versão
MODOS_EXTRAS = (4, 6, 11)  # --psm tentados quando a primeira leitura (3) é fraca
LADO_MINIMO_DA_IMAGEM = 1600  # px: imagem menor é ampliada antes do OCR
IDIOMA_DO_OCR = "por"


@dataclass
class Pagina:
    numero: int
    texto: str
    metodo: str  # TEXTO | OCR
    confianca: float | None = None
    palavras: list | None = None  # layout.Palavra (posição de cada palavra), quando houver


@dataclass
class Leitura:
    formato: str  # PDF | IMAGEM | DOCX | TXT | OUTRO
    paginas: list = field(default_factory=list)
    total_de_paginas: int = 0
    paginas_sem_leitura: int = 0
    erro: str | None = None  # código curto (sem dado pessoal)
    data_do_arquivo: date | None = None  # a criação do PDF (metadados), quando houver

    @property
    def metodo(self):
        ocr = sum(1 for p in self.paginas if p.metodo == "OCR")
        if not self.paginas:
            return None
        return "OCR" if ocr * 2 >= len(self.paginas) or (ocr and not self.texto_util_sem_ocr()) else "TEXTO"

    def texto_util_sem_ocr(self):
        return any(p.metodo == "TEXTO" and letras(p.texto) >= MINIMO_DE_LETRAS_DA_PAGINA for p in self.paginas)

    @property
    def confianca(self):
        valores = [p.confianca for p in self.paginas if p.confianca is not None]
        return round(sum(valores) / len(valores), 3) if valores else None

    @property
    def texto(self):
        return "\n\f\n".join(p.texto for p in self.paginas)


class OcrIndisponivel(RuntimeError):
    """O Tesseract não está instalado (o workflow instala; na máquina local, pule o OCR)."""


def formato_do_conteudo(conteudo):
    """PDF, IMAGEM, DOCX, TXT ou OUTRO pelos primeiros bytes."""
    cabeca = bytes(conteudo[:8])
    if cabeca.startswith(b"%PDF"):
        return "PDF"
    if cabeca.startswith(b"\xff\xd8\xff") or cabeca.startswith(b"\x89PNG") or cabeca[:4] in (b"II*\x00", b"MM\x00*"):
        return "IMAGEM"
    if cabeca.startswith(b"RIFF") and bytes(conteudo[8:12]) == b"WEBP":
        return "IMAGEM"
    if cabeca.startswith(b"PK"):
        try:
            with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
                return "DOCX" if "word/document.xml" in z.namelist() else "OUTRO"
        except zipfile.BadZipFile:
            return "OUTRO"
    amostra = bytes(conteudo[:4000])
    if amostra and b"\x00" not in amostra:
        try:
            amostra.decode("utf-8")
            return "TXT"
        except UnicodeDecodeError:
            imprimiveis = sum(1 for b in amostra if b >= 32 or b in (9, 10, 13))
            return "TXT" if imprimiveis / len(amostra) > 0.95 else "OUTRO"
    return "OUTRO"


def ocr_tesseract(imagem):
    """(texto, confiança 0–1, palavras com posição) de uma imagem PIL pelo Tesseract em português.

    A imagem é arrumada antes (`imagem.variantes`: tamanho, perspectiva, sombra, inclinação). A primeira
    leitura (--psm 3, a página inteira) basta quando a confiança é boa; senão, gira pela orientação que o
    Tesseract detecta (OSD: de lado, de cabeça para baixo) e tenta os outros modos (--psm 4 colunas, 6 bloco,
    11 texto esparso, bom para carimbo e formulário) e a versão binarizada, e fica com a que leu MAIS texto
    confiável (a soma da confiança das palavras boas, não a média: o modo esparso lê pouco e "confiante")."""
    candidatas = _imagem.variantes(imagem)
    base = candidatas["cinza"]
    melhor = _ocr_uma_vez(base, 3)
    if melhor.confianca >= CONFIANCA_BOA:
        return melhor.texto, melhor.confianca, melhor.palavras
    graus = _graus_da_orientacao(base, candidatas.get("binarizada"))
    if graus:
        base = _girar(base, graus)
        melhor = max(melhor, _ocr_uma_vez(base, 3), key=_pontos)
        if melhor.confianca >= CONFIANCA_BOA:
            return melhor.texto, melhor.confianca, melhor.palavras
        if "binarizada" in candidatas:
            candidatas["binarizada"] = _girar(candidatas["binarizada"], graus)
    tentativas = [(base, psm) for psm in MODOS_EXTRAS]
    if "binarizada" in candidatas:
        tentativas.append((candidatas["binarizada"], 6))
    for imagem_da_vez, psm in tentativas:
        leitura = _ocr_uma_vez(imagem_da_vez, psm)
        if _pontos(leitura) > _pontos(melhor):
            melhor = leitura
        if melhor.confianca >= CONFIANCA_BOA:
            break
    return melhor.texto, melhor.confianca, melhor.palavras


def _pontos(leitura):
    return (leitura.pontos, leitura.confianca)


def _girar(imagem, graus):
    return imagem.rotate(-graus, expand=True, fillcolor=255) if graus % 360 else imagem


def _graus_da_orientacao(*imagens):
    """Quantos graus girar para a imagem ficar em pé, pela OSD do Tesseract (na primeira das `imagens` em que a
    OSD tem confiança; a binarizada às vezes decide quando o cinza não); 0 se já está em pé ou a OSD falhou."""
    melhor = (0.0, 0)
    for imagem in (i for i in imagens if i is not None):
        try:
            import pytesseract

            osd = pytesseract.image_to_osd(imagem, config="--psm 0", output_type=pytesseract.Output.DICT)
        except Exception:  # pragma: no cover - sem osd.traineddata, pouco texto etc.
            continue
        confianca, graus = float(osd.get("orientation_conf") or 0), int(osd.get("rotate") or 0) % 360
        if confianca >= CONFIANCA_DA_ORIENTACAO:
            return graus
        melhor = max(melhor, (confianca, graus))
    return melhor[1] if melhor[0] >= CONFIANCA_DA_ORIENTACAO / 3 else 0


@dataclass
class _LeituraOcr:
    texto: str
    confianca: float
    palavras: list
    pontos: float


def _ocr_uma_vez(imagem, psm=3):
    try:
        import pytesseract
    except ImportError as erro:  # pragma: no cover - depende do ambiente
        raise OcrIndisponivel("pytesseract ausente") from erro
    try:
        dados = pytesseract.image_to_data(
            imagem, lang=IDIOMA_DO_OCR, config=f"--psm {psm}", output_type=pytesseract.Output.DICT
        )
    except pytesseract.TesseractNotFoundError as erro:  # pragma: no cover - depende do ambiente
        raise OcrIndisponivel("tesseract ausente") from erro
    linhas, confiancas, pontos = {}, [], 0.0
    for i, palavra in enumerate(dados.get("text") or []):
        palavra = (palavra or "").strip()
        if not palavra:
            continue
        try:
            conf = float(dados["conf"][i])
        except (TypeError, ValueError):
            conf = -1
        if conf >= 0:
            confiancas.append(conf)
            if conf >= 60 and sum(c.isalnum() for c in palavra) >= 2:
                pontos += conf / 100
        chave = (dados["block_num"][i], dados["par_num"][i], dados["line_num"][i])
        linhas.setdefault(chave, []).append(palavra)
    texto = "\n".join(" ".join(p) for _, p in sorted(linhas.items()))
    confianca = round(sum(confiancas) / len(confiancas) / 100, 3) if confiancas else 0.0
    return _LeituraOcr(texto, confianca, palavras_do_tesseract(dados), pontos)


def _chamar_ocr(ocr, imagem):
    """(texto, confiança, palavras) do OCR; o OCR pode devolver só (texto, confiança) (o falso dos testes)."""
    resultado = ocr(imagem)
    if len(resultado) >= 3:
        return resultado[0], resultado[1], resultado[2]
    return resultado[0], resultado[1], None


def _preparar_imagem(imagem):
    from PIL import ImageOps

    imagem = ImageOps.exif_transpose(imagem)
    if imagem.mode not in ("L", "RGB"):
        imagem = imagem.convert("RGB")
    maior = max(imagem.size)
    if maior and maior < LADO_MINIMO_DA_IMAGEM:
        fator = LADO_MINIMO_DA_IMAGEM / maior
        imagem = imagem.resize((round(imagem.width * fator), round(imagem.height * fator)))
    return imagem.convert("L")


def data_dos_metadados(metadados):
    """A data de criação do PDF (CreationDate "D:20261001142233-03'00'") ou None."""
    bruto = str((metadados or {}).get("CreationDate") or "")
    m = re.search(r"(?:D:)?(\d{4})(\d{2})(\d{2})", bruto)
    if not m:
        return None
    try:
        valor = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return valor if 2000 <= valor.year <= 2100 else None


def _ler_pdf(conteudo, ocr, leitura):
    import pdfplumber

    releitura = ocr is not ocr_tesseract or not _imagem.disponivel()
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        leitura.total_de_paginas = len(pdf.pages)
        leitura.data_do_arquivo = data_dos_metadados(pdf.metadata)
        com_ocr = 0
        for i, pagina in enumerate(pdf.pages[:MAXIMO_DE_PAGINAS], start=1):
            texto = preparar(pagina.extract_text() or "")
            if letras(texto) >= MINIMO_DE_LETRAS_DA_PAGINA:
                leitura.paginas.append(Pagina(i, texto, "TEXTO", palavras=palavras_do_pdfplumber(pagina)))
                continue
            if ocr is None or com_ocr >= MAXIMO_DE_PAGINAS_NO_OCR:
                leitura.paginas_sem_leitura += 1
                if texto:
                    leitura.paginas.append(Pagina(i, texto, "TEXTO"))
                continue
            imagem = pagina.to_image(resolution=RESOLUCAO_DO_OCR).original
            texto_ocr, confianca, palavras = _chamar_ocr(ocr, _preparar_imagem(imagem))
            # A 400 dpi de novo só sem a arrumação do OpenCV: com ela, ocr_tesseract já amplia e tenta os modos.
            if confianca is not None and confianca < CONFIANCA_PARA_RELER and releitura:
                maior = pagina.to_image(resolution=RESOLUCAO_DA_SEGUNDA_LEITURA).original
                texto_maior, confianca_maior, palavras_maior = _chamar_ocr(ocr, _preparar_imagem(maior))
                if (confianca_maior or 0) > confianca:
                    texto_ocr, confianca, palavras = texto_maior, confianca_maior, palavras_maior
            com_ocr += 1
            leitura.paginas.append(Pagina(i, preparar(texto_ocr), "OCR", confianca, palavras))
        leitura.paginas_sem_leitura += max(0, leitura.total_de_paginas - MAXIMO_DE_PAGINAS)


def _ler_pdf_pelo_pdfium(conteudo, ocr, leitura):
    """Plano B do PDF: abre com o PDFium (pypdfium2, que já vem com o pdfplumber)."""
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(bytes(conteudo))
    try:
        leitura.total_de_paginas = len(pdf)
        com_ocr = 0
        for i in range(min(len(pdf), MAXIMO_DE_PAGINAS)):
            pagina = pdf[i]
            try:
                texto = preparar(pagina.get_textpage().get_text_range() or "")
            except Exception:
                texto = ""
            if letras(texto) >= MINIMO_DE_LETRAS_DA_PAGINA:
                leitura.paginas.append(Pagina(i + 1, texto, "TEXTO"))
                continue
            if ocr is None or com_ocr >= MAXIMO_DE_PAGINAS_NO_OCR:
                leitura.paginas_sem_leitura += 1
                continue
            imagem = pagina.render(scale=RESOLUCAO_DO_OCR / 72).to_pil()
            texto_ocr, confianca, palavras = _chamar_ocr(ocr, _preparar_imagem(imagem))
            com_ocr += 1
            leitura.paginas.append(Pagina(i + 1, preparar(texto_ocr), "OCR", confianca, palavras))
        leitura.paginas_sem_leitura += max(0, leitura.total_de_paginas - MAXIMO_DE_PAGINAS)
    finally:
        pdf.close()


def _ler_imagem(conteudo, ocr, leitura):
    from PIL import Image, ImageSequence

    with Image.open(io.BytesIO(conteudo)) as imagem:
        quadros = list(ImageSequence.Iterator(imagem))[:MAXIMO_DE_PAGINAS_NO_OCR]
        leitura.total_de_paginas = len(quadros)
        if ocr is None:
            leitura.paginas_sem_leitura = len(quadros)
            return
        for i, quadro in enumerate(quadros, start=1):
            texto, confianca, palavras = _chamar_ocr(ocr, _preparar_imagem(quadro.copy()))
            leitura.paginas.append(Pagina(i, preparar(texto), "OCR", confianca, palavras))


def _ler_docx(conteudo, leitura):
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    xml = re.sub(r"</w:p>|<w:br/>|<w:cr/>", "\n", xml)
    xml = re.sub(r"<w:tab/>", " ", xml)
    texto = re.sub(r"<[^>]+>", "", xml)
    for entidade, valor in (("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&apos;", "'"), ("&amp;", "&")):
        texto = texto.replace(entidade, valor)
    leitura.total_de_paginas = 1
    leitura.paginas.append(Pagina(1, preparar(texto), "TEXTO"))


def _ler_txt(conteudo, leitura):
    try:
        texto = bytes(conteudo).decode("utf-8")
    except UnicodeDecodeError:
        texto = bytes(conteudo).decode("latin-1")
    leitura.total_de_paginas = 1
    leitura.paginas.append(Pagina(1, preparar(texto), "TEXTO"))


def ler_paginas(conteudo, ocr=ocr_tesseract):
    """
    A `Leitura` do arquivo. `ocr`: função imagem → (texto, confiança); None não faz OCR.
    Arquivo corrompido ou protegido: `erro` com um código curto (sem dado pessoal).
    """
    formato = formato_do_conteudo(conteudo)
    leitura = Leitura(formato)
    try:
        if formato == "PDF":
            try:
                _ler_pdf(conteudo, ocr, leitura)
                if not leitura.total_de_paginas:
                    raise ValueError("pdf sem páginas no pdfplumber")
            except OcrIndisponivel:
                raise
            except Exception:
                # PDF que o pdfplumber não abre (estrutura quebrada, xref ruim, gerado por
                # celular/scanner): o PDFium é mais tolerante — página vira imagem e vai ao OCR.
                leitura = Leitura(formato)
                _ler_pdf_pelo_pdfium(conteudo, ocr, leitura)
        elif formato == "IMAGEM":
            _ler_imagem(conteudo, ocr, leitura)
        elif formato == "DOCX":
            _ler_docx(conteudo, leitura)
        elif formato == "TXT":
            _ler_txt(conteudo, leitura)
    except OcrIndisponivel:
        raise
    except Exception as erro:  # arquivo corrompido, senha, formato estranho: não derruba o lote
        leitura.erro = f"{formato.lower()}_{type(erro).__name__}"[:60]
    return leitura
