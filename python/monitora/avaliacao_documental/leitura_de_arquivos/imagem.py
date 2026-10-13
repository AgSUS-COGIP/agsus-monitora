"""
A FOTO (ou a página escaneada) arrumada para o OCR, com OpenCV — tudo local.

Foto de celular chega torta, com sombra, em perspectiva, de lado e pequena.
`variantes` devolve a imagem pronta em duas versões, e o OCR fica com a que
ler melhor:

    tamanho      o lado maior entre 2000 e 3300 px (≈ 300 dpi numa folha A4):
                 a imagem pequena é ampliada (cúbica) e a enorme, reduzida
                 (o Tesseract fica lento sem ler melhor)
    perspectiva  a folha fotografada sobre a mesa (o maior quadrilátero da
                 imagem, com mais de 35% da área) é recortada e endireitada
    sombra       o fundo (dilatação + mediana) é tirado do cinza: a sombra da
                 mão ou do celular some e o papel fica branco por igual
    inclinação   o ângulo das linhas de texto (minAreaRect dos pixels de tinta,
                 até 15°) é desfeito; de lado ou de cabeça para baixo fica
                 para a OSD do Tesseract (ocr_tesseract)
    binarização  adaptativa (gaussiana), boa para carimbo e papel manchado

    "cinza"        sem sombra, endireitada (o Tesseract binariza sozinho)
    "binarizada"   a mesma, binarizada

Sem OpenCV instalado (máquina local), `variantes` devolve só a imagem como
veio (o OCR continua funcionando, sem a arrumação).
"""

LADO_MINIMO = 2000
LADO_MAXIMO = 3300
INCLINACAO_MAXIMA = 15.0
AREA_MINIMA_DA_FOLHA = 0.35


def _opencv():
    try:
        import cv2
        import numpy as np
    except ImportError:  # pragma: no cover - depende do ambiente
        return None, None
    return cv2, np


def disponivel():
    return _opencv()[0] is not None


def _redimensionar(cv2, cinza):
    altura, largura = cinza.shape[:2]
    maior = max(altura, largura)
    if maior < LADO_MINIMO:
        fator = LADO_MINIMO / maior
        return cv2.resize(cinza, None, fx=fator, fy=fator, interpolation=cv2.INTER_CUBIC)
    if maior > LADO_MAXIMO:
        fator = LADO_MAXIMO / maior
        return cv2.resize(cinza, None, fx=fator, fy=fator, interpolation=cv2.INTER_AREA)
    return cinza


def _ordenar_cantos(np, pontos):
    pontos = pontos.reshape(4, 2).astype("float32")
    soma, diferenca = pontos.sum(axis=1), np.diff(pontos, axis=1).ravel()
    return np.array(
        [pontos[soma.argmin()], pontos[diferenca.argmin()], pontos[soma.argmax()], pontos[diferenca.argmax()]],
        dtype="float32",
    )


def endireitar_perspectiva(cv2, np, cinza):
    """A folha fotografada recortada e endireitada; a imagem como veio se não houver folha clara."""
    altura, largura = cinza.shape[:2]
    escala = 800 / max(altura, largura)
    pequena = cv2.resize(cinza, None, fx=escala, fy=escala, interpolation=cv2.INTER_AREA) if escala < 1 else cinza
    escala = min(escala, 1.0)
    bordas = cv2.Canny(cv2.GaussianBlur(pequena, (5, 5), 0), 50, 150)
    bordas = cv2.dilate(bordas, np.ones((3, 3), np.uint8), iterations=2)
    contornos, _ = cv2.findContours(bordas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    area_total = pequena.shape[0] * pequena.shape[1]
    for contorno in sorted(contornos, key=cv2.contourArea, reverse=True)[:5]:
        area = cv2.contourArea(contorno)
        if area < AREA_MINIMA_DA_FOLHA * area_total:
            break
        aproximado = cv2.approxPolyDP(contorno, 0.02 * cv2.arcLength(contorno, True), True)
        if len(aproximado) != 4 or area > 0.97 * area_total:
            continue
        cantos = _ordenar_cantos(np, aproximado) / escala
        (a, b, c, d) = cantos
        nova_largura = int(max(np.linalg.norm(b - a), np.linalg.norm(c - d)))
        nova_altura = int(max(np.linalg.norm(d - a), np.linalg.norm(c - b)))
        if nova_largura < 200 or nova_altura < 200:
            continue
        destino = np.array(
            [[0, 0], [nova_largura - 1, 0], [nova_largura - 1, nova_altura - 1], [0, nova_altura - 1]], dtype="float32"
        )
        matriz = cv2.getPerspectiveTransform(cantos, destino)
        return cv2.warpPerspective(cinza, matriz, (nova_largura, nova_altura), borderValue=255)
    return cinza


def tirar_sombra(cv2, np, cinza):
    """O cinza com o fundo (sombra, papel amarelado) tirado: papel branco por igual, tinta escura."""
    fundo = cv2.dilate(cinza, np.ones((7, 7), np.uint8))
    fundo = cv2.medianBlur(fundo, 21)
    diferenca = 255 - cv2.absdiff(cinza, fundo)
    diferenca = cv2.normalize(diferenca, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    # O ruído do papel (o granulado da foto, ampliado pela normalização) vira branco: atrapalha a OSD e o OCR.
    _, limpa = cv2.threshold(diferenca, 225, 255, cv2.THRESH_TRUNC)
    return cv2.normalize(limpa, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)


def angulo_da_inclinacao(cv2, np, cinza):
    """O ângulo (graus) das linhas de texto, entre -15° e 15°; 0 se não der para medir."""
    tinta = cv2.threshold(cinza, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    # Junta as letras de cada linha num borrão horizontal: o retângulo mínimo dele dá a inclinação.
    largura = max(15, cinza.shape[1] // 60)
    borrao = cv2.morphologyEx(tinta, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (largura, 3)))
    contornos, _ = cv2.findContours(borrao, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    angulos, pesos = [], []
    for contorno in contornos:
        (_, _), (w, h), angulo = cv2.minAreaRect(contorno)
        if w < h:
            w, h = h, w
            angulo += 90
        if w < cinza.shape[1] * 0.08 or h <= 0 or w / h < 4:
            continue
        angulo = ((angulo + 90) % 180) - 90
        if abs(angulo) <= INCLINACAO_MAXIMA:
            angulos.append(angulo)
            pesos.append(w)
    if not angulos:
        return 0.0
    ordem = np.argsort(angulos)
    acumulado = np.cumsum(np.array(pesos)[ordem])
    return float(np.array(angulos)[ordem][np.searchsorted(acumulado, acumulado[-1] / 2)])


def desinclinar(cv2, np, cinza):
    angulo = angulo_da_inclinacao(cv2, np, cinza)
    if abs(angulo) < 0.3:
        return cinza
    altura, largura = cinza.shape[:2]
    matriz = cv2.getRotationMatrix2D((largura / 2, altura / 2), angulo, 1.0)
    cos, sen = abs(matriz[0, 0]), abs(matriz[0, 1])
    nova_largura, nova_altura = int(altura * sen + largura * cos), int(altura * cos + largura * sen)
    matriz[0, 2] += nova_largura / 2 - largura / 2
    matriz[1, 2] += nova_altura / 2 - altura / 2
    return cv2.warpAffine(
        cinza, matriz, (nova_largura, nova_altura), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT,
        borderValue=255,
    )  # fmt: skip


def binarizar(cv2, cinza):
    bloco = max(15, (min(cinza.shape[:2]) // 60) | 1)
    return cv2.adaptiveThreshold(cinza, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, bloco, 12)


def variantes(imagem):
    """{"cinza": PIL, "binarizada": PIL} arrumadas para o OCR; só {"cinza": imagem} sem OpenCV."""
    cv2, np = _opencv()
    if cv2 is None:
        return {"cinza": imagem.convert("L")}
    from PIL import Image

    cinza = np.array(imagem.convert("L"))
    cinza = _redimensionar(cv2, cinza)
    cinza = endireitar_perspectiva(cv2, np, cinza)
    cinza = tirar_sombra(cv2, np, cinza)
    cinza = desinclinar(cv2, np, cinza)
    return {"cinza": Image.fromarray(cinza), "binarizada": Image.fromarray(binarizar(cv2, cinza))}
