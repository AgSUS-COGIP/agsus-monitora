"""
Robustez da leitura dos arquivos (python/monitora/avaliacao_documental/leitura_de_arquivos/extracao.py):
TIFF de várias páginas (cada página lida, não a última repetida), limite de pixels antes do OCR,
`timeout` do Tesseract e os prazos por página e por arquivo (o arquivo que estoura vira ERRO, não trava o
lote). Imagens e PDFs sintéticos; OCR falso (nada de Tesseract nem de documento real).
"""

import io
import sys
import types

import pytest

from monitora.avaliacao_documental.leitura_de_arquivos import extracao
from monitora.avaliacao_documental.leitura_de_arquivos.leitura import ler_documento

Image = pytest.importorskip("PIL.Image")


def _quadro(cor, tamanho=(300, 200)):
    return Image.new("L", tamanho, color=cor)


def _tiff(*cores, tamanho=(300, 200)):
    quadros = [_quadro(c, tamanho) for c in cores]
    saida = io.BytesIO()
    quadros[0].save(saida, format="TIFF", save_all=True, append_images=quadros[1:])
    return saida.getvalue()


class Relogio:
    def __init__(self):
        self.agora = 0.0

    def __call__(self):
        return self.agora


# ── TIFF / WebP de várias páginas ────────────────────────────────────────────


def test_tiff_de_varias_paginas_le_cada_pagina():
    """Antes, a lista guardava o mesmo objeto do iterador do Pillow (parado no último quadro): as três páginas
    saíam iguais à última."""
    vistas = []

    def ocr(imagem):
        vistas.append(imagem.getpixel((0, 0)))
        return f"pagina de cor {imagem.getpixel((0, 0))}", 0.9

    leitura = extracao.ler_paginas(_tiff(10, 120, 240), ocr=ocr)
    assert leitura.erro is None
    assert leitura.total_de_paginas == 3
    assert vistas == [10, 120, 240]
    assert [p.numero for p in leitura.paginas] == [1, 2, 3]


def test_tiff_com_mais_paginas_que_o_limite_conta_as_nao_lidas(monkeypatch):
    monkeypatch.setattr(extracao, "MAXIMO_DE_PAGINAS_NO_OCR", 2)
    leitura = extracao.ler_paginas(_tiff(10, 20, 30, 40), ocr=lambda imagem: ("texto", 0.9))
    assert leitura.total_de_paginas == 4
    assert len(leitura.paginas) == 2
    assert leitura.paginas_sem_leitura == 2


# ── limite de pixels ─────────────────────────────────────────────────────────


def test_imagem_enorme_e_reduzida_antes_do_ocr():
    tamanhos = []

    def ocr(imagem):
        tamanhos.append(imagem.size)
        return "texto", 0.9

    saida = io.BytesIO()
    _quadro(200, (9000, 1500)).save(saida, format="PNG")
    extracao.ler_paginas(saida.getvalue(), ocr=ocr)
    (tamanho,) = tamanhos
    assert max(tamanho) == extracao.LADO_MAXIMO_DA_IMAGEM
    assert tamanho[1] == round(1500 * extracao.LADO_MAXIMO_DA_IMAGEM / 9000)


def test_jpeg_enorme_tambem_e_reduzido():
    tamanhos = []
    saida = io.BytesIO()
    Image.new("RGB", (8200, 3000), color=(200, 200, 200)).save(saida, format="JPEG")
    extracao.ler_paginas(saida.getvalue(), ocr=lambda imagem: (tamanhos.append(imagem.size), ("t", 0.9))[1])
    assert max(tamanhos[0]) <= extracao.LADO_MAXIMO_DA_IMAGEM


def test_pagina_gigante_do_pdf_e_renderizada_no_limite():
    """Página de 2000 × 2000 pontos a 300 dpi daria 8.333 px de lado: agora sai com no máximo 4.000."""
    pytest.importorskip("pdfplumber")
    canvas = pytest.importorskip("reportlab.pdfgen.canvas")
    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=(2000, 2000))
    c.rect(100, 100, 300, 300, fill=1)  # sem texto: a página vai ao OCR
    c.showPage()
    c.save()
    tamanhos = []

    def ocr(imagem):
        tamanhos.append(imagem.size)
        return "texto", 0.9

    leitura = extracao.ler_paginas(saida.getvalue(), ocr=ocr)
    assert leitura.erro is None and tamanhos
    assert max(tamanhos[0]) <= extracao.LADO_MAXIMO_DA_IMAGEM


def test_resolucao_limitada():
    assert extracao.resolucao_limitada(595, 842, 300) == 300  # A4 a 300 dpi: 3.508 px, cabe
    assert extracao.resolucao_limitada(2000, 1000, 300) == pytest.approx(4000 * 72 / 2000)
    assert extracao.resolucao_limitada(0, 0, 300) == 300


# ── prazos ───────────────────────────────────────────────────────────────────


def test_arquivo_que_estoura_o_prazo_vira_erro():
    relogio = Relogio()

    def ocr_lento(imagem):
        relogio.agora += 200
        return "texto lido", 0.9

    leitura = extracao.ler_paginas(_tiff(10, 20, 30), ocr=ocr_lento, prazo=300, relogio=relogio)
    assert leitura.erro == extracao.ERRO_DE_PRAZO
    assert leitura.paginas == []


def test_documento_que_estoura_o_prazo_e_gravado_como_erro(monkeypatch):
    relogio = Relogio()
    original = extracao.ler_paginas

    def ler_paginas(conteudo, ocr):
        return original(conteudo, ocr=ocr, prazo=100, relogio=relogio)

    def ocr_lento(imagem):
        relogio.agora += 150
        return "texto lido", 0.9

    from monitora.avaliacao_documental.leitura_de_arquivos import leitura as modulo

    monkeypatch.setattr(modulo, "ler_paginas", ler_paginas)
    resultado = ler_documento(_tiff(10, 20), "CURSOS", ocr=ocr_lento)
    assert resultado["situacao"] == "ERRO"
    assert resultado["erro"] == extracao.ERRO_DE_PRAZO


class TesseractFalso(types.ModuleType):
    """pytesseract falso: guarda o `timeout` de cada chamada; a confiança baixa obriga as tentativas extras."""

    class Output:
        DICT = "dict"

    class TesseractNotFoundError(Exception):
        pass

    def __init__(self, relogio, gasto=0, estoura=False):
        super().__init__("pytesseract")
        self.relogio, self.gasto, self.estoura = relogio, gasto, estoura
        self.timeouts, self.osd = [], []

    def image_to_data(self, imagem, lang=None, config=None, output_type=None, timeout=0):
        self.timeouts.append(timeout)
        self.relogio.agora += self.gasto
        if self.estoura:
            raise RuntimeError("Tesseract process timeout")
        return {
            "text": ["texto", "fraco"],
            "conf": ["30", "30"],
            "block_num": [1, 1],
            "par_num": [1, 1],
            "line_num": [1, 1],
            "word_num": [1, 2],
            "left": [0, 50],
            "top": [0, 0],
            "width": [40, 40],
            "height": [10, 10],
        }

    def image_to_osd(self, imagem, config=None, output_type=None, timeout=0):
        self.osd.append(timeout)
        return {"orientation_conf": 0, "rotate": 0}


@pytest.fixture
def sem_opencv(monkeypatch):
    monkeypatch.setattr(extracao._imagem, "variantes", lambda imagem: {"cinza": imagem.convert("L")})


def test_tesseract_recebe_timeout_em_toda_chamada(monkeypatch, sem_opencv):
    relogio = Relogio()
    falso = TesseractFalso(relogio)
    monkeypatch.setitem(sys.modules, "pytesseract", falso)
    extracao.ocr_tesseract(_quadro(255), prazo=relogio() + 1000, relogio=relogio)
    assert len(falso.timeouts) == 1 + len(extracao.MODOS_EXTRAS)
    assert all(0 < t <= extracao.TEMPO_DO_TESSERACT for t in falso.timeouts + falso.osd)
    assert falso.osd


def test_prazo_da_pagina_corta_as_tentativas_extras(monkeypatch, sem_opencv):
    relogio = Relogio()
    falso = TesseractFalso(relogio, gasto=extracao.PRAZO_DA_PAGINA)
    monkeypatch.setitem(sys.modules, "pytesseract", falso)
    texto, confianca, _ = extracao.ocr_tesseract(
        _quadro(255), prazo=relogio() + extracao.PRAZO_DA_PAGINA, relogio=relogio
    )
    assert texto == "texto fraco" and confianca == 0.3
    assert len(falso.timeouts) == 1  # a primeira leitura gastou o prazo inteiro: sem OSD nem outros modos
    assert falso.osd == []


def test_tesseract_que_estoura_o_tempo_vira_erro_do_arquivo(monkeypatch, sem_opencv):
    relogio = Relogio()
    monkeypatch.setitem(sys.modules, "pytesseract", TesseractFalso(relogio, estoura=True))
    leitura = extracao.ler_paginas(_tiff(10, 20), relogio=relogio)
    assert leitura.erro == extracao.ERRO_DE_PRAZO
