"""
Documentos SINTÉTICOS para medir a leitura dos arquivos (nunca documento real).

Gera, com reportlab, Pillow e (se houver) OpenCV:

    CTPS Digital em PDF com texto, em três desenhos de página (o app já mudou
    de cara mais de uma vez): "rotulos" (Rótulo: valor), "tabela" (rótulo à
    esquerda, valor à direita) e "grade" (o nome do empregador em destaque
    sem rótulo, o CNPJ embaixo, rótulos pequenos com o valor embaixo, seções
    de alterações salariais e férias com datas que não são admissão, rodapé
    "Documento gerado em … às …")
    CTPS Digital "impressa como imagem" (o PDF virou foto: OCR)
    foto de celular de uma página (inclinada, em perspectiva, com sombra,
    ruído e JPEG) e a mesma deitada (90°)
    CTPS física: duas páginas de contrato lado a lado, rótulos impressos e
    valores "à mão" (fonte itálica), fotografada

Cada gerador devolve (bytes, gabarito): o gabarito é a lista dos vínculos
esperados {empregador, cnpj, inicio, fim, cargo, carga}. Nomes, CPF e CNPJs
são fictícios (os CNPJs têm dígitos verificadores válidos, gerados aqui).
Rode a medição com: python tests/python/avaliar_leitura_sintetica.py
"""

import io
import random

NOME_FICTICIO = "Maria Exemplo da Silva"
CPF_FICTICIO = "123.456.789-09"


def cnpj_ficticio(raiz, filial=1):
    """Um CNPJ com dígitos verificadores válidos a partir de uma raiz de 8 dígitos."""
    base = f"{raiz:08d}{filial:04d}"
    for tamanho in (12, 13):
        pesos = [(i % 8) + 2 for i in range(tamanho)][::-1]
        soma = sum(int(c) * p for c, p in zip(base[:tamanho], pesos, strict=True))
        base += str(0 if soma % 11 < 2 else 11 - soma % 11)
    return f"{base[:2]}.{base[2:5]}.{base[5:8]}/{base[8:12]}-{base[12:]}"


def _br(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso else None


# Os contratos do caso da reclamação: médico com dois vínculos ao mesmo tempo (20 h e 10 h), empregadores
# diferentes, e dois vínculos antigos encerrados.
CONTRATOS_DO_MEDICO = [
    {
        "empregador": "CAIXA DE ASSISTENCIA DOS FUNCIONARIOS DE EXEMPLO",
        "cnpj": cnpj_ficticio(33719485),
        "inicio": "2022-08-24",
        "fim": None,
        "cargo_impresso": "MEDICO DO TRABALHO 4 HORAS",
        "cargo": "Médico do trabalho",
        "carga": 20,
        "cbo": "2251-40",
    },
    {
        "empregador": "SERVICO SOCIAL DA INDUSTRIA - SESI EXEMPLO",
        "cnpj": cnpj_ficticio(3777341, 12),
        "inicio": "2024-09-02",
        "fim": None,
        "cargo_impresso": "MÉDICO - 10HS",
        "cargo": "Médico",
        "carga": 10,
        "cbo": "2251-25",
    },
    {
        "empregador": "HOSPITAL REGIONAL EXEMPLO LTDA",
        "cnpj": cnpj_ficticio(12345678),
        "inicio": "2016-02-01",
        "fim": "2019-12-31",
        "cargo_impresso": "MEDICO CLINICO",
        "cargo": "Médico clínico",
        "carga": None,
        "cbo": "2251-25",
    },
    {
        "empregador": "FUNDACAO MUNICIPAL DE SAUDE DE EXEMPLO",
        "cnpj": cnpj_ficticio(7654321),
        "inicio": "2020-03-10",
        "fim": "2022-06-30",
        "cargo_impresso": "MEDICO 20H SEMANAIS",
        "cargo": "Médico",
        "carga": 20,
        "cbo": "2251-25",
    },
]

CONTRATOS_DA_ENFERMEIRA = [
    {
        "empregador": "CLINICA SAO LUCAS DE EXEMPLO LTDA",
        "cnpj": cnpj_ficticio(45678912),
        "inicio": "2018-10-01",
        "fim": "2021-03-26",
        "cargo_impresso": "TECNICO DE ENFERMAGEM",
        "cargo": "Técnico de enfermagem",
        "carga": None,
        "cbo": "3222-05",
    },
    {
        "empregador": "AGENCIA EXEMPLO DE SAUDE",
        "cnpj": cnpj_ficticio(36741852),
        "inicio": "2021-04-05",
        "fim": None,
        "cargo_impresso": "001-ENFERMEIRO 2235-05",
        "cargo": "Enfermeiro",
        "carga": None,
        "cbo": "2235-05",
    },
]


def _gabarito(contratos, sem_razao_social=()):
    saida = []
    for i, c in enumerate(contratos):
        saida.append(
            {
                "empregador": f"CNPJ {c['cnpj']}" if i in sem_razao_social else c["empregador"],
                "cnpj": c["cnpj"],
                "inicio": c["inicio"],
                "fim": c["fim"],
                "cargo": c["cargo"],
                "carga": c["carga"],
            }
        )
    return saida


def _canvas():
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    saida = io.BytesIO()
    return saida, canvas.Canvas(saida, pagesize=A4), A4


def _cabecalho(c, altura, y=None):
    y = y or altura - 50
    c.setFont("Helvetica-Bold", 15)
    c.drawString(40, y, "Carteira de Trabalho Digital")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y - 28, "Dados pessoais")
    c.setFont("Helvetica", 10)
    c.drawString(40, y - 44, f"Nome civil: {NOME_FICTICIO}")
    c.drawString(300, y - 44, f"CPF: {CPF_FICTICIO}")
    c.drawString(40, y - 58, "Data de nascimento: 07/07/1979")
    c.drawString(300, y - 58, "Nacionalidade: Brasileira")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y - 86, "Contratos de trabalho")
    return y - 110


def ctps_digital(contratos, desenho="grade", sem_razao_social=(), gerado_em="2026-10-01", alteracoes=True):
    """(PDF com texto, gabarito) de uma CTPS Digital no `desenho` pedido."""
    saida, c, (_, altura) = _canvas()
    y = _cabecalho(c, altura)

    def nova_pagina_se_preciso(necessario):
        nonlocal y
        if y - necessario < 70:
            c.showPage()
            y = altura - 60

    for i, k in enumerate(contratos):
        nova_pagina_se_preciso(200)
        razao = None if i in sem_razao_social else k["empregador"]
        fim = _br(k["fim"]) or "-"
        if desenho == "rotulos":
            linhas = [
                f"Razão social: {razao}" if razao else None,
                f"CNPJ/CEI/CPF: {k['cnpj']}",
                f"Data de admissão: {_br(k['inicio'])}",
                f"Data de desligamento: {fim}",
                f"Ocupação: {k['cargo_impresso']}",
                f"CBO: {k['cbo']}",
                "Tipo de contrato: Prazo indeterminado",
                "Remuneração inicial: R$ 7.350,00",
            ]
            for linha in (x for x in linhas if x):
                c.setFont("Helvetica", 10)
                c.drawString(40, y, linha)
                y -= 15
        elif desenho == "tabela":
            pares = [
                ("Empregador", razao or ""),
                ("CNPJ", k["cnpj"]),
                ("Admissão", _br(k["inicio"])),
                ("Desligamento", fim),
                ("Cargo", k["cargo_impresso"]),
                ("CBO", k["cbo"]),
                ("Remuneração inicial", "R$ 7.350,00"),
            ]
            for rotulo, valor in pares:
                if not valor:
                    continue
                c.setFont("Helvetica-Bold", 9)
                c.drawString(40, y, rotulo)
                c.setFont("Helvetica", 10)
                c.drawString(200, y, valor)
                y -= 15
        else:  # grade
            if razao:
                c.setFont("Helvetica-Bold", 11)
                c.drawString(40, y, razao)
                y -= 15
            c.setFont("Helvetica", 9)
            c.drawString(40, y, f"CNPJ: {k['cnpj']}")
            y -= 20
            for (r1, v1), (r2, v2) in (
                (("Data de admissão", _br(k["inicio"])), ("Data de desligamento", fim)),
                (("Ocupação", k["cargo_impresso"]), ("CBO", k["cbo"])),
                (("Tipo de contrato", "Prazo indeterminado"), ("Remuneração inicial", "R$ 7.350,00")),
            ):
                c.setFont("Helvetica", 7.5)
                c.drawString(40, y, r1)
                c.drawString(320, y, r2)
                c.setFont("Helvetica", 10)
                c.drawString(40, y - 12, v1)
                c.drawString(320, y - 12, v2)
                y -= 30
            if alteracoes:
                c.setFont("Helvetica-Bold", 9)
                c.drawString(40, y, "Alterações salariais")
                c.setFont("Helvetica", 9)
                c.drawString(40, y - 13, "Data da alteração: 01/05/2025   Remuneração: R$ 8.100,00   Motivo: Reajuste")
                c.setFont("Helvetica-Bold", 9)
                c.drawString(40, y - 30, "Férias")
                c.setFont("Helvetica", 9)
                c.drawString(40, y - 43, "Data de início: 02/01/2025   Data de fim: 31/01/2025")
                y -= 56
        y -= 18
    c.setFont("Helvetica", 8)
    c.drawString(40, 40, f"Documento gerado em {_br(gerado_em)} às 14:22 - Ministério do Trabalho e Emprego")
    c.showPage()
    c.save()
    return saida.getvalue(), _gabarito(contratos, sem_razao_social)


# ── imagens ──────────────────────────────────────────────────────────────────


def paginas_como_imagem(conteudo_pdf, resolucao=150):
    import pdfplumber

    with pdfplumber.open(io.BytesIO(conteudo_pdf)) as pdf:
        return [p.to_image(resolution=resolucao).original.convert("RGB") for p in pdf.pages]


def pdf_de_imagens(imagens):
    """Um PDF só de imagem (sem texto selecionável), uma página por imagem."""
    saida = io.BytesIO()
    imagens[0].save(saida, format="PDF", save_all=True, append_images=imagens[1:], resolution=150)
    return saida.getvalue()


def fotografar(imagem, semente=7, angulo=4.0, perspectiva=True, sombra=0.55, ruido=True, girar=0, largura=1400):
    """A imagem como uma foto de celular: sobre a mesa, em perspectiva, inclinada, com sombra, ruído e JPEG."""
    import numpy as np
    from PIL import Image, ImageFilter

    aleatorio = random.Random(semente)
    folha = imagem.convert("RGB")
    w, h = folha.size
    mesa = Image.new("RGB", (int(w * 1.25), int(h * 1.18)), (96, 84, 70))
    mesa.paste(folha, ((mesa.width - w) // 2, (mesa.height - h) // 2))
    foto = mesa.rotate(angulo, resample=Image.BICUBIC, expand=False, fillcolor=(96, 84, 70))
    matriz = np.array(foto).astype("float32")
    try:
        import cv2
    except ImportError:  # pragma: no cover
        cv2 = None
    if perspectiva and cv2 is not None:
        hh, ww = matriz.shape[:2]
        d = 0.06
        origem = np.float32([[0, 0], [ww, 0], [ww, hh], [0, hh]])
        destino = np.float32(
            [[ww * d, hh * d * 0.5], [ww * (1 - d * 0.4), 0], [ww, hh], [ww * d * 0.3, hh * (1 - d * 0.2)]]
        )
        matriz = cv2.warpPerspective(
            matriz, cv2.getPerspectiveTransform(origem, destino), (ww, hh), borderValue=(96, 84, 70)
        )
    if sombra:
        hh, ww = matriz.shape[:2]
        gx = np.linspace(sombra, 1.0, ww)[None, :]
        gy = np.linspace(1.0, 0.8, hh)[:, None]
        matriz *= (gx * gy)[..., None]
    if ruido:
        matriz += np.random.default_rng(semente).normal(0, 9, matriz.shape)
    foto = Image.fromarray(np.clip(matriz, 0, 255).astype("uint8"))
    foto = foto.filter(ImageFilter.GaussianBlur(radius=0.8 + aleatorio.random() * 0.4))
    if girar:
        foto = foto.rotate(girar, expand=True)
    fator = largura / max(foto.size)
    foto = foto.resize((round(foto.width * fator), round(foto.height * fator)))
    saida = io.BytesIO()
    foto.save(saida, format="JPEG", quality=62)
    return saida.getvalue()


def _fonte(tamanho, italica=False):
    from PIL import ImageFont

    for nome in ("DejaVuSans-Oblique.ttf", "ariali.ttf") if italica else ("DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default(size=tamanho)


def ctps_fisica(contratos, semente=3):
    """(foto JPEG, gabarito) de duas páginas de contrato de uma CTPS física, lado a lado."""
    from PIL import Image, ImageDraw

    meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
             "outubro", "novembro", "dezembro"]  # fmt: skip

    def por_extenso(iso):
        return f"{int(iso[8:10]):02d} de {meses[int(iso[5:7]) - 1]} de {iso[:4]}" if iso else ""

    pagina_w, pagina_h = 1100, 1500
    folha = Image.new("RGB", (pagina_w * 2 + 40, pagina_h), (250, 247, 238))
    desenho = ImageDraw.Draw(folha)
    impresso, mao = _fonte(30), _fonte(34, italica=True)
    for lado, k in enumerate(contratos[:2]):
        x = 30 + lado * (pagina_w + 20)
        y = 60
        desenho.text((x + 300, y), "CONTRATO DE TRABALHO", fill=(40, 40, 40), font=_fonte(36))
        y += 90
        linhas = [
            ("Empregador", k["empregador"]),
            ("CNPJ", k["cnpj"]),
            ("Rua", "Avenida Exemplo, 100"),
            ("Município", "Exemplo"),
            ("Esp. do estabelecimento", "Hospital"),
            ("Cargo", k["cargo_impresso"]),
            ("C.B.O. nº", k["cbo"]),
            ("Data admissão", por_extenso(k["inicio"])),
            ("Registro nº", "1234"),
            ("Remuneração especificada", "R$ 3.200,00"),
            ("Saída", por_extenso(k["fim"])),
        ]
        for rotulo, valor in linhas:
            desenho.text((x, y), rotulo, fill=(60, 60, 60), font=impresso)
            if valor:
                largura_do_rotulo = desenho.textlength(rotulo, font=impresso)
                desenho.text((x + largura_do_rotulo + 30, y - 4), valor, fill=(20, 30, 120), font=mao)
            desenho.line((x + 10, y + 42, x + pagina_w - 60, y + 42), fill=(170, 170, 170), width=2)
            y += 110
    gabarito = _gabarito(contratos[:2])
    return fotografar(folha, semente=semente, angulo=2.5, largura=2400), gabarito


def foto_de_ctps_digital(contratos, semente=11, **distorcao):
    """(foto JPEG da 1ª página de uma CTPS Digital impressa, gabarito); `distorcao` vai para `fotografar`."""
    conteudo, gabarito = ctps_digital(contratos, "grade", alteracoes=False)
    imagem = paginas_como_imagem(conteudo, resolucao=200)[0]
    distorcao.setdefault("largura", 2000)
    return fotografar(imagem, semente=semente, **distorcao), gabarito


# As distorções da medição do OCR: (nome, argumentos de `fotografar`).
DISTORCOES = [
    ("leve (2°, sombra fraca)", {"angulo": 2.0, "sombra": 0.8}),
    ("inclinada 8°", {"angulo": 8.0}),
    ("sombra forte", {"angulo": 3.0, "sombra": 0.25}),
    ("pequena (1000 px)", {"angulo": 3.0, "largura": 1000}),
    ("deitada (90°)", {"girar": 90}),
    ("de cabeça para baixo", {"girar": 180}),
]


def palavras_esperadas(contratos):
    """O que a foto deve render ao OCR: CNPJs, datas e as palavras do empregador e do cargo."""
    saida = []
    for c in contratos:
        saida.append(c["cnpj"])
        saida.append(_br(c["inicio"]))
        saida.extend(p for p in c["empregador"].split() if len(p) > 2)
        saida.extend(p for p in c["cargo_impresso"].split() if len(p) > 2)
    return saida


def ctps_digital_impressa_como_imagem(contratos):
    """(PDF só de imagem da CTPS Digital — "impressa" como foto —, gabarito)."""
    conteudo, gabarito = ctps_digital(contratos, "grade")
    return pdf_de_imagens(paginas_como_imagem(conteudo, resolucao=150)), gabarito


# ── declarações de vínculo / tempo de serviço ───────────────────────────────
#
# Cada declaração é uma página (ou mais) com o EMISSOR de um jeito: timbre no topo (nome em fonte grande,
# centralizado, e o endereço embaixo), só no rodapé (razão social e CNPJ em letra pequena), só no texto
# ("O SERVIÇO SOCIAL…, inscrito no CNPJ…, declara") ou só o CNPJ. O texto é corrido, com o fim do vínculo
# ("até a presente data", "no período de A a B", "desligada em") ou sem nada, a carga ("20 horas semanais",
# "jornada de 40 horas semanais", "plantões de 12 horas") ou números que não são carga (CEP, "Rua 26 de
# Agosto", "carga horária total de 60 horas" de treinamento), e o local e data no fim. Tudo fictício.

DECLARACOES = [
    {
        "emissor": "CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO",
        "cnpj": cnpj_ficticio(44719486),
        "timbre": True,
        "endereco": "Rua 26 de Agosto, 260 - Centro - CEP 26.260-000 - Exemplópolis/EX",
        "texto": (
            "Declaramos para os devidos fins que {nome}, CPF {cpf}, exerce desde 24/08/2022 até a presente data o "
            "cargo de Médico do Trabalho, com carga horária de 20 horas semanais, nesta instituição."
        ),
        "local": "Exemplópolis, 10 de outubro de 2026",
        "gabarito": {"inicio": "2022-08-24", "fim": None, "atual": True, "carga": 20, "cargo": "Médico do trabalho"},
    },
    {
        "emissor": "SERVIÇO SOCIAL DA INDÚSTRIA - SESI EXEMPLO",
        "cnpj": cnpj_ficticio(55777342, 12),
        "timbre": False,
        "texto": (
            "O SERVIÇO SOCIAL DA INDÚSTRIA - SESI EXEMPLO, inscrito no CNPJ sob o nº {cnpj}, declara para os devidos "
            "fins que {nome}, portadora do CPF {cpf}, presta serviços nesta entidade desde 1º de setembro de 2024, "
            "no cargo de Médico, em regime de plantões de 12 horas, encontrando-se em exercício até o momento."
        ),
        "local": "Vila Exemplo - EX, 28 de setembro de 2026",
        "gabarito": {"inicio": "2024-09-01", "fim": None, "atual": True, "carga": None, "cargo": "Médico"},
    },
    {
        "emissor": "HOSPITAL REGIONAL EXEMPLO LTDA",
        "cnpj": cnpj_ficticio(12345678),
        "timbre": True,
        "endereco": "Avenida Exemplo, 26 - CEP 26.000-260 - Telefone (26) 2626-2626",
        "texto": (
            "Declaramos, para fins de comprovação de experiência profissional, que {nome}, CPF {cpf}, trabalhou "
            "neste hospital no período de 01/02/2016 a 31/12/2019, na função de Médico Clínico, com jornada de "
            "40 horas semanais."
        ),
        "local": "Exemplópolis, 2 de outubro de 2026",
        "gabarito": {
            "inicio": "2016-02-01",
            "fim": "2019-12-31",
            "atual": False,
            "carga": 40,
            "cargo": "Médico clínico",
        },
    },
    {
        "emissor": "FUNDAÇÃO MUNICIPAL DE SAÚDE DE EXEMPLO",
        "cnpj": cnpj_ficticio(7654321),
        "timbre": False,
        "rodape": True,
        "texto": (
            "Declaro, a pedido da interessada, que {nome}, CPF {cpf}, atuou como Médica desde 10/03/2020 e "
            "concluiu o treinamento introdutório com carga horária total de 60 horas, em 26/04/2020."
        ),
        "local": "Exemplópolis, 26 de setembro de 2026",
        "gabarito": {"inicio": "2020-03-10", "fim": None, "atual": False, "carga": None, "cargo": "Médica"},
    },
    {
        "emissor": "CLÍNICA SÃO LUCAS DE EXEMPLO LTDA",
        "cnpj": cnpj_ficticio(45678912),
        "timbre": True,
        "endereco": "Rua das Flores, 10 - Exemplópolis/EX",
        "texto": (
            "Declaramos que {nome}, CPF {cpf}, foi admitida em 01/10/2018 para exercer a função de Técnica de "
            "Enfermagem, com carga horária semanal de 30 horas, cumprindo escala definida pela coordenação de "
            "enfermagem desta clínica, conforme os registros funcionais mantidos pelo setor de pessoal."
        ),
        # Continua na página seguinte (sem timbre): a saída e o local e data.
        "continuacao": (
            "Prosseguindo, informamos que a referida profissional foi desligada em 26/03/2021, a pedido, "
            "nada constando que desabone sua conduta."
        ),
        "local": "Exemplópolis, 5 de abril de 2026",
        "gabarito": {
            "inicio": "2018-10-01",
            "fim": "2021-03-26",
            "atual": False,
            "carga": 30,
            "cargo": "Técnica de enfermagem",
        },
    },
    {
        "emissor": None,
        "cnpj": cnpj_ficticio(36741852),
        "timbre": False,
        "rodape_so_cnpj": True,
        "texto": (
            "Declaramos para os devidos fins que {nome}, CPF {cpf}, trabalha como Enfermeira desde 05/04/2021, "
            "permanecendo no quadro de colaboradores, com carga horária de 36 horas semanais."
        ),
        "local": "Exemplópolis, 1º de outubro de 2026",
        "gabarito": {"inicio": "2021-04-05", "fim": None, "atual": True, "carga": 36, "cargo": "Enfermeira"},
    },
]


# O caso do médico relido com o extrator 2026.10.6 (o mesmo desenho, tudo fictício): a declaração da caixa de
# assistência com o timbre virando lixo de OCR na 2ª página (só o CNPJ de uma filial no rodapé; a razão social
# está na capa, com o CNPJ da matriz), a carga "26 (vinte) horas" (o dígito mal lido), o SESI com artigo e
# qualificadores ("O Serviço Social… — Empresa Privada"), uma página ilegível repetindo o vínculo do SESI e a
# clínica com o nome no fim de um pedaço de frase ("prestou serviço em …, nesta empresa, GR CLINICA…").
CASO_DO_MEDICO = [
    {
        "emissor": "CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO",
        "cnpj": cnpj_ficticio(44719486),
        "timbre": True,
        "rodape_so_cnpj": True,
        "endereco": "Setor Exemplo, Quadra 1 - Exemplópolis/EX",
        "texto": (
            "Ofício nº 123/2026. Encaminhamos, a pedido da interessada, a declaração de vínculo que segue na "
            "página seguinte, emitida pela área de gestão de pessoas."
        ),
        "local": "Exemplópolis, 12 de fevereiro de 2026",
        "gabarito": None,
    },
    {
        "emissor": "CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO",
        "cnpj": cnpj_ficticio(44719486, 54),
        "timbre": True,
        "timbre_lido": "Cariaira cle |DX",
        "rodape_so_cnpj": True,
        "texto": (
            "Declaramos para os devidos fins que {nome}, CPF {cpf}, exerce desde 24/08/2022 até a presente data o "
            "cargo de Médico do Trabalho, com carga horária de 26 (vinte) horas semanais."
        ),
        "local": "Exemplópolis, 12 de fevereiro de 2026",
        "gabarito": {"inicio": "2022-08-24", "fim": None, "atual": True, "carga": 20, "cargo": "Médico do Trabalho"},
    },
    {
        "emissor": "Serviço Social da Indústria — SESI, Departamento Regional de Exemplo",
        "cnpj": cnpj_ficticio(55777342, 12),
        "timbre": False,
        "texto": (
            "O Serviço Social da Indústria — SESI, Departamento Regional de Exemplo — Empresa Privada, inscrito no "
            "CNPJ sob o nº {cnpj}, declara que {nome}, CPF {cpf}, trabalha nesta entidade desde 02/09/2024, no "
            "cargo de Médico, com jornada de 10 horas semanais."
        ),
        "local": "Exemplópolis, 12 de fevereiro de 2026",
        "gabarito": {"inicio": "2024-09-02", "fim": None, "atual": True, "carga": 10, "cargo": "Médico"},
    },
    {
        "emissor": None,
        "cnpj": None,
        "timbre": True,
        "timbre_lido": "Ae ras Wnt",
        "texto": "Declaramos que {nome}, CPF {cpf}, exerce o cargo de Médico desde 02/09/2024.",
        "local": "Exemplópolis, 12 de fevereiro de 2026",
        "gabarito": None,  # a mesma do SESI, ilegível: não pode virar um vínculo a mais
    },
    {
        "emissor": "GR CLINICA MEDICA EXEMPLO",
        "cnpj": cnpj_ficticio(66285673),
        "timbre": False,
        "texto": (
            "Declaramos que {nome}, CPF {cpf}, prestou serviço em medicina do trabalho, como médico examinador, "
            "nesta empresa, GR CLINICA MEDICA EXEMPLO, inscrita no CNPJ {cnpj}, no período de 01/03/2022 a "
            "31/05/2023, com carga horária de 20 horas semanais."
        ),
        "local": "Exemplópolis, 12 de fevereiro de 2026",
        "gabarito": {
            "inicio": "2022-03-01",
            "fim": "2023-05-31",
            "atual": False,
            "carga": 20,
            "cargo": "Médico examinador",
        },
    },
]


def _gabarito_da_declaracao(d):
    if not d.get("gabarito"):
        return None
    g = dict(d["gabarito"])
    g["empregador"] = d["emissor"] or f"CNPJ {d['cnpj']}"
    g["cnpj"] = d["cnpj"]
    return g


def _paragrafo(c, texto, x, y, largura, fonte="Helvetica", tamanho=11, entrelinha=17):
    from reportlab.lib.utils import simpleSplit

    for linha in simpleSplit(texto, fonte, tamanho, largura):
        c.setFont(fonte, tamanho)
        c.drawString(x, y, linha)
        y -= entrelinha
    return y


def declaracoes_de_vinculo(declaracoes=None, nome=NOME_FICTICIO, cpf=CPF_FICTICIO):
    """(PDF com texto, gabarito): uma declaração por página (a de `continuacao` ocupa duas), cada uma de um
    emissor, com o timbre, o rodapé ou só o texto dizendo quem declara."""
    declaracoes = DECLARACOES if declaracoes is None else declaracoes
    saida, c, (largura, altura) = _canvas()
    for d in declaracoes:
        if d.get("timbre"):
            c.setFont("Helvetica-Bold", 16)
            # "timbre_lido": o que o OCR leu do timbre (logo virando lixo: "Cariaira cle |DX").
            c.drawCentredString(largura / 2, altura - 60, d.get("timbre_lido") or d["emissor"])
            c.setFont("Helvetica", 8.5)
            c.drawCentredString(largura / 2, altura - 76, d.get("endereco") or "")
            c.line(50, altura - 86, largura - 50, altura - 86)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(largura / 2, altura - 150, "DECLARAÇÃO")
        corpo = d["texto"].format(nome=nome.upper(), cpf=cpf, cnpj=d["cnpj"])
        y = _paragrafo(c, corpo, 70, altura - 200, largura - 140)
        if d.get("continuacao"):
            c.setFont("Helvetica", 8)
            c.drawString(70, 40, "continua na próxima página")
            c.showPage()
            y = _paragrafo(c, d["continuacao"], 70, altura - 120, largura - 140)
        y -= 30
        c.setFont("Helvetica", 11)
        c.drawRightString(largura - 70, y, d["local"])
        c.line(largura / 2 - 110, y - 70, largura / 2 + 110, y - 70)
        c.setFont("Helvetica", 9)
        c.drawCentredString(largura / 2, y - 84, "Responsável pelo Setor de Pessoal")
        if d.get("rodape"):
            c.setFont("Helvetica", 7.5)
            c.drawCentredString(largura / 2, 46, f"{d['emissor']} - CNPJ {d['cnpj']}")
            c.drawCentredString(largura / 2, 36, "Rua Projetada, 26 - Exemplópolis/EX - CEP 26.000-000")
        if d.get("rodape_so_cnpj"):
            c.setFont("Helvetica", 7.5)
            c.drawCentredString(largura / 2, 40, f"CNPJ {d['cnpj']}")
        c.showPage()
    c.save()
    return saida.getvalue(), [g for g in (_gabarito_da_declaracao(d) for d in declaracoes) if g]


def declaracoes_como_foto(declaracoes=None, semente=5):
    """(PDF só de imagem: cada página da declaração "escaneada" com ruído e inclinação leve, gabarito)."""
    from PIL import Image

    conteudo, gabarito = declaracoes_de_vinculo(declaracoes)
    fotos = []
    for k, imagem in enumerate(paginas_como_imagem(conteudo, resolucao=200)):
        jpeg = fotografar(imagem, semente=semente + k, angulo=1.5, perspectiva=False, sombra=0.85, largura=1700)
        fotos.append(Image.open(io.BytesIO(jpeg)).convert("RGB"))
    return pdf_de_imagens(fotos), gabarito
