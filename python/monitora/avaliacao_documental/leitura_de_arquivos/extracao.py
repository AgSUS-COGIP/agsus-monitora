"""
O texto de cada página do arquivo, pelo tipo REAL (os primeiros bytes, não a
extensão do nome):

    PDF       pdfplumber; a página sem texto selecionável (escaneada) vai para o
              OCR (renderizada a 300 dpi pelo pypdfium2 que o pdfplumber traz)
    JPG/PNG   OCR (Tesseract, português) depois de girar pela EXIF e ampliar
              imagem pequena
    DOCX      o XML do Word (zipfile)
    TXT       UTF-8 ou Latin-1
    resto     NAO_SUPORTADO (DOC antigo, ZIP, RAR, PPTX…)

`ler_paginas` devolve as páginas, o método (TEXTO ou OCR, o que predominou) e
a confiança média do OCR (0 a 1). Limites: MAXIMO_DE_PAGINAS páginas lidas e
MAXIMO_DE_PAGINAS_NO_OCR com OCR (o resto conta como não lido e vira alerta).
pdfplumber, Pillow e pytesseract são importados só aqui, na hora.
"""

import io
import re
import zipfile
from dataclasses import dataclass, field

from .texto import letras, preparar

MAXIMO_DE_PAGINAS = 40
MAXIMO_DE_PAGINAS_NO_OCR = 15
MINIMO_DE_LETRAS_DA_PAGINA = 40  # menos que isso no texto do PDF: a página é imagem (OCR)
RESOLUCAO_DO_OCR = 300
LADO_MINIMO_DA_IMAGEM = 1600  # px: imagem menor é ampliada antes do OCR
IDIOMA_DO_OCR = "por"


@dataclass
class Pagina:
    numero: int
    texto: str
    metodo: str  # TEXTO | OCR
    confianca: float | None = None


@dataclass
class Leitura:
    formato: str  # PDF | IMAGEM | DOCX | TXT | OUTRO
    paginas: list = field(default_factory=list)
    total_de_paginas: int = 0
    paginas_sem_leitura: int = 0
    erro: str | None = None  # código curto (sem dado pessoal)

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
    """(texto, confiança 0–1) de uma imagem PIL pelo Tesseract em português."""
    try:
        import pytesseract
    except ImportError as erro:  # pragma: no cover - depende do ambiente
        raise OcrIndisponivel("pytesseract ausente") from erro
    try:
        dados = pytesseract.image_to_data(
            imagem, lang=IDIOMA_DO_OCR, config="--psm 3", output_type=pytesseract.Output.DICT
        )
    except pytesseract.TesseractNotFoundError as erro:  # pragma: no cover - depende do ambiente
        raise OcrIndisponivel("tesseract ausente") from erro
    linhas, confiancas = {}, []
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
        chave = (dados["block_num"][i], dados["par_num"][i], dados["line_num"][i])
        linhas.setdefault(chave, []).append(palavra)
    texto = "\n".join(" ".join(p) for _, p in sorted(linhas.items()))
    confianca = round(sum(confiancas) / len(confiancas) / 100, 3) if confiancas else 0.0
    return texto, confianca


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


def _ler_pdf(conteudo, ocr, leitura):
    import pdfplumber

    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        leitura.total_de_paginas = len(pdf.pages)
        com_ocr = 0
        for i, pagina in enumerate(pdf.pages[:MAXIMO_DE_PAGINAS], start=1):
            texto = preparar(pagina.extract_text() or "")
            if letras(texto) >= MINIMO_DE_LETRAS_DA_PAGINA:
                leitura.paginas.append(Pagina(i, texto, "TEXTO"))
                continue
            if ocr is None or com_ocr >= MAXIMO_DE_PAGINAS_NO_OCR:
                leitura.paginas_sem_leitura += 1
                if texto:
                    leitura.paginas.append(Pagina(i, texto, "TEXTO"))
                continue
            imagem = pagina.to_image(resolution=RESOLUCAO_DO_OCR).original
            texto_ocr, confianca = ocr(_preparar_imagem(imagem))
            com_ocr += 1
            leitura.paginas.append(Pagina(i, preparar(texto_ocr), "OCR", confianca))
        leitura.paginas_sem_leitura += max(0, leitura.total_de_paginas - MAXIMO_DE_PAGINAS)


def _ler_imagem(conteudo, ocr, leitura):
    from PIL import Image, ImageSequence

    with Image.open(io.BytesIO(conteudo)) as imagem:
        quadros = list(ImageSequence.Iterator(imagem))[:MAXIMO_DE_PAGINAS_NO_OCR]
        leitura.total_de_paginas = len(quadros)
        if ocr is None:
            leitura.paginas_sem_leitura = len(quadros)
            return
        for i, quadro in enumerate(quadros, start=1):
            texto, confianca = ocr(_preparar_imagem(quadro.copy()))
            leitura.paginas.append(Pagina(i, preparar(texto), "OCR", confianca))


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
            _ler_pdf(conteudo, ocr, leitura)
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
