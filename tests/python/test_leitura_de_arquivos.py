"""
Leitura automática dos arquivos (monitora.avaliacao_documental.leitura_de_arquivos).

Todos os documentos são SINTÉTICOS, gerados aqui (reportlab, Pillow, zipfile):
nenhum documento real entra no repositório. Nomes e CPF são fictícios (o CPF
123.456.789-09 é o de exemplo, com dígitos válidos). O OCR de verdade (Tesseract)
só roda onde estiver instalado (o workflow instala); nos outros casos, um OCR
falso devolve o texto, para testar o caminho da imagem.
"""

import io
import shutil
import zipfile
from datetime import date

import pytest

from monitora.avaliacao_documental.leitura_de_arquivos import VERSAO_DO_EXTRATOR, texto
from monitora.avaliacao_documental.leitura_de_arquivos.extracao import formato_do_conteudo, ler_paginas
from monitora.avaliacao_documental.leitura_de_arquivos.leitura import (
    bloco_do_anexo,
    esperado_do_bloco,
    ler_documento,
    minimo_de_horas,
)
from monitora.avaliacao_documental.leitura_de_arquivos.pessoas import (
    cpf_confere,
    cpfs_do_texto,
    hash_do_cpf,
    nome_confere,
)

reportlab = pytest.importorskip("reportlab")
pytest.importorskip("pdfplumber")

HOJE = date(2026, 10, 9)
NOME = "Maria Exemplo da Silva"
CPF = "12345678909"
SAL = "sal-de-teste"
HASH = hash_do_cpf(SAL, CPF)


def pdf(*paginas):
    """Um PDF com texto selecionável: cada página é uma lista de linhas."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=A4)
    for linhas in paginas:
        y = 800
        for linha in linhas:
            c.setFont("Helvetica", 11)
            c.drawString(40, y, linha)
            y -= 18
        c.showPage()
    c.save()
    return saida.getvalue()


def pdf_so_imagem():
    """Um PDF escaneado: a página é só uma imagem, sem texto selecionável."""
    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    imagem = Image.new("RGB", (400, 200), "white")
    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=A4)
    c.drawImage(ImageReader(imagem), 40, 500, width=400, height=200)
    c.showPage()
    c.save()
    return saida.getvalue()


def png_com_texto(linhas):
    from PIL import Image, ImageDraw, ImageFont

    imagem = Image.new("RGB", (1800, 120 + 70 * len(linhas)), "white")
    desenho = ImageDraw.Draw(imagem)
    try:
        fonte = ImageFont.truetype("DejaVuSans.ttf", 44)
    except OSError:
        fonte = ImageFont.load_default(size=44)
    for i, linha in enumerate(linhas):
        desenho.text((40, 40 + 70 * i), linha, fill="black", font=fonte)
    saida = io.BytesIO()
    imagem.save(saida, format="PNG")
    return saida.getvalue()


def ocr_falso(texto_devolvido, confianca=0.9):
    return lambda _imagem: (texto_devolvido, confianca)


CERTIFICADOS = pdf(
    [
        "CERTIFICADO",
        "Certificamos que Maria Exemplo da Silva concluiu o curso Enfrentamento das",
        "Arboviroses, com carga horaria de 145 horas, oferecido pela Fundacao Oswaldo Cruz.",
        "Campo Grande, 12 de maio de 2023",
    ],
    ["Conteudo programatico", "Modulo 1 - Dengue", "Modulo 2 - Zika e Chikungunya"],
    [
        "CERTIFICADO DE CONCLUSAO",
        "A UNA-SUS certifica que MARIA E. DA SILVA participou do Curso de Atualizacao em Saude Indigena,",
        "realizado no periodo de 01/02/2022 a 30/03/2022, carga horaria: 60h",
    ],
    [
        "CERTIFICADO",
        "Certificamos que Maria Exemplo da Silva concluiu o curso Primeiros Socorros,",
        "com carga horaria de 20 horas. Universidade Federal de Exemplo, 03/08/2021.",
    ],
)

REGRA = {
    "blocos": [
        {"codigo": "IDENTIDADE", "tipo": "DOCUMENTO", "titulo": "Documento de identificação oficial com foto",
         "perguntas": ["Anexe o documento de identificação", "Anexe um documento de identificação"]},
        {"codigo": "ESCOLARIDADE", "tipo": "DOCUMENTO", "titulo": "Formação exigida pela vaga",
         "perguntas": ["Anexe a comprovação de Nível"]},
        {"codigo": "REGISTRO_CONSELHO", "tipo": "DOCUMENTO", "titulo": "Registro ativo no conselho de classe",
         "perguntas": ["Anexe o comprovante do seu registro profissional"]},
        {"codigo": "COTA_PP", "tipo": "COTA", "titulo": "Pretos e pardos", "perguntas": ["Candidatos às vagas destinadas"]},
        {"codigo": "FORMACAO", "tipo": "TITULOS", "titulo": "Titulação", "perguntas": ["Anexe seu comprovante de Titulação"]},
        {"codigo": "CURSOS", "tipo": "CURSOS", "titulo": "Cursos",
         "perguntas": ["Anexe os seus Certificados de Conclusão dos Cursos"],
         "faixas": [{"min_horas": 40, "max_horas": 60, "pontos": 1}, {"min_horas": 120, "max_horas": None, "pontos": 3}],
         "por_nivel": {"medio": {"faixas": [{"min_horas": 40, "max_horas": 60, "pontos": 2}]}}},
        {"codigo": "EXPERIENCIA", "tipo": "VINCULOS", "titulo": "Experiência",
         "perguntas": ["Anexe o comprovante de Experiência Profissional"]},
    ]
}  # fmt: skip


def test_versao_do_extrator_tem_formato_que_o_banco_aceita():
    import re

    assert re.fullmatch(r"[0-9A-Za-z._-]{1,20}", VERSAO_DO_EXTRATOR)


# ── texto e pessoas ──────────────────────────────────────────────────────────


def test_dobrar_mantem_o_tamanho_e_tira_acento():
    original = "Conclusão em Saúde Indígena"
    assert texto.dobrar(original) == "conclusao em saude indigena"
    assert len(texto.dobrar(original)) == len(original)


def test_datas_numericas_por_extenso_e_mes_ano():
    d = texto.datas_no_texto(texto.dobrar("de 01/02/2020 a 31 de janeiro de 2022; competência 03/2021, março/2019"))
    assert [(x.ano, x.mes, x.dia) for x in d] == [(2020, 2, 1), (2022, 1, 31), (2021, 3, None), (2019, 3, None)]
    assert d[2].ultimo_dia() == date(2021, 3, 31)


def test_data_invalida_nao_conta():
    assert texto.datas_no_texto("31/02/2020 e 10/13/2020") == []


@pytest.mark.parametrize(
    ("texto_do_documento", "esperado"),
    [
        ("Certificamos que MARIA EXEMPLO DA SILVA concluiu", True),
        ("Certificamos que Maria E. da Silva concluiu", True),
        ("Certificamos que Maria Exernplo da Silva concluiu", True),  # OCR: "rn" no lugar de "m"
        ("Certificamos que Maria Exemplo Souza concluiu o curso com João Silva", False),
        ("Certificamos que Joana Pereira concluiu o curso", False),
    ],
)
def test_nome_confere(texto_do_documento, esperado):
    assert nome_confere(NOME, texto_do_documento) is esperado


def test_nome_sem_texto_ou_sem_nome_nao_decide():
    assert nome_confere(NOME, "") is None
    assert nome_confere("", "Maria Exemplo da Silva") is None


def test_cpf_confere_so_pelo_hash():
    assert cpfs_do_texto("CPF: 123.456.789-09 e 111.111.111-11") == [CPF]
    assert cpf_confere("CPF 123.456.789-09", SAL, HASH) is True
    assert cpf_confere("CPF 529.982.247-25", SAL, HASH) is False
    assert cpf_confere("sem documento aqui", SAL, HASH) is None
    # Outro sal (outra execução) não casa: o hash não serve fora da execução.
    assert cpf_confere("CPF 123.456.789-09", "outro-sal", HASH) is False


# ── tipo do arquivo e páginas ───────────────────────────────────────────────


def test_formato_pelo_conteudo_e_nao_pelo_nome():
    assert formato_do_conteudo(CERTIFICADOS) == "PDF"
    assert formato_do_conteudo(png_com_texto(["oi"])) == "IMAGEM"
    zipado = io.BytesIO()
    with zipfile.ZipFile(zipado, "w") as z:
        z.writestr("a.txt", "x")
    assert formato_do_conteudo(zipado.getvalue()) == "OUTRO"
    assert formato_do_conteudo("Declaração simples".encode()) == "TXT"


def test_pdf_com_texto_nao_usa_ocr():
    def ocr_proibido(_):
        raise AssertionError("não deveria chamar o OCR")

    leitura = ler_paginas(CERTIFICADOS, ocr=ocr_proibido)
    assert leitura.total_de_paginas == 4
    assert leitura.metodo == "TEXTO"


# ── certificados ─────────────────────────────────────────────────────────────


def test_certificados_um_por_certificado_com_horas_curso_e_alertas():
    r = ler_documento(CERTIFICADOS, "CURSOS", NOME, SAL, HASH, minimo_horas=40, hoje=HOJE, ocr=None)
    assert r["situacao"] == "LIDO" and r["metodo"] == "TEXTO" and r["paginas"] == 4
    itens = r["itens"]
    assert [i["horas"] for i in itens] == [145, 60, 20]
    assert itens[0]["curso"] == "Enfrentamento das Arboviroses"
    assert itens[0]["instituicao"].startswith("Fundacao Oswaldo Cruz")
    assert itens[0]["conclusao"] == "2023-05-12"
    assert itens[0]["pagina"] == 1
    assert itens[1]["curso"] == "Atualizacao em Saude Indigena"
    assert itens[1]["conclusao"] == "2022-03-30"
    assert itens[1]["pagina"] == 3
    assert itens[2]["curso"] == "Primeiros Socorros"
    assert [a["codigo"] for a in itens[2]["alertas"]] == ["HORAS_ABAIXO_MINIMO"]
    assert itens[0]["alertas"] == [] and itens[1]["alertas"] == []
    assert r["nome_confere"] is True and r["cpf_confere"] is None
    assert r["resumo"] == "3 certificados · 145 h, 60 h, 20 h · nome confere"


def test_certificado_de_outra_pessoa_no_meio_do_arquivo():
    arquivo = pdf(
        [
            "CERTIFICADO",
            "Certificamos que Maria Exemplo da Silva concluiu o curso Vacinação, carga horária de 40 horas.",
        ],
        [
            "CERTIFICADO",
            "Certificamos que Joana Pereira Lima concluiu o curso Curativos, com carga horária de 80 horas.",
        ],
    )
    r = ler_documento(arquivo, "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert r["nome_confere"] is True
    assert [a["codigo"] for a in r["itens"][1]["alertas"]] == ["NOME_DIVERGENTE", "SEM_DATA"]


def test_data_futura_vira_alerta():
    arquivo = pdf(
        ["CERTIFICADO", "Certificamos que Maria Exemplo da Silva concluiu o curso Libras, 60 horas, em 10/01/2027."]
    )
    r = ler_documento(arquivo, "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert "DATA_FUTURA" in [a["codigo"] for a in r["itens"][0]["alertas"]]


# ── titulação ────────────────────────────────────────────────────────────────


def test_diploma_de_mestrado():
    arquivo = pdf(
        [
            "UNIVERSIDADE FEDERAL DE EXEMPLO",
            "DIPLOMA",
            "O Reitor confere a Maria Exemplo da Silva o titulo de Mestre em Saude Coletiva,",
            "por ter concluido o curso. Colou grau em 10/12/2019.",
            "CPF 123.456.789-09",
        ],
        ["Verso", "Registrado sob o numero 999 livro 3"],
    )
    r = ler_documento(arquivo, "TITULOS", NOME, SAL, HASH, hoje=HOJE, ocr=None)
    assert len(r["itens"]) == 1
    item = r["itens"][0]
    assert item["titulo"] == "MESTRADO"
    assert item["curso"] == "Saude Coletiva"
    assert item["instituicao"] == "UNIVERSIDADE FEDERAL DE EXEMPLO"
    assert item["data"] == "2019-12-10"
    assert r["cpf_confere"] is True and r["documento"] == "DIPLOMA"
    assert r["resumo"] == "Mestrado · nome confere · CPF confere"


def test_cpf_de_outra_pessoa_no_diploma():
    arquivo = pdf(["DIPLOMA", "Confere a Maria Exemplo da Silva o grau de Bacharel em Enfermagem. CPF 529.982.247-25"])
    r = ler_documento(arquivo, "TITULOS", NOME, SAL, HASH, hoje=HOJE, ocr=None)
    assert r["itens"][0]["titulo"] == "GRADUACAO"
    assert [a["codigo"] for a in r["alertas"]] == ["CPF_DIVERGENTE"]


# ── experiência ──────────────────────────────────────────────────────────────


def test_ctps_digital_com_dois_contratos_um_em_aberto():
    arquivo = pdf(
        [
            "Carteira de Trabalho Digital",
            "Nome: Maria Exemplo da Silva",
            "Contratos de trabalho",
            "Empregador: Hospital Regional de Exemplo Ltda",
            "Cargo: Tecnica de Enfermagem",
            "Data de admissao: 01/02/2018",
            "Data de desligamento: 31/01/2020",
            "Empregador: Prefeitura Municipal de Exemplo",
            "Ocupacao: Enfermeira",
            "Data de admissao: 01/03/2020",
            "Emitido em 15/09/2026",
        ]
    )
    r = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    assert r["documento"] == "CTPS"
    a, b = r["itens"]
    assert a["empregador"] == "Hospital Regional de Exemplo Ltda"
    assert a["cargo"] == "Tecnica de Enfermagem"
    assert (a["inicio"], a["fim"], a["atual"]) == ("2018-02-01", "2020-01-31", False)
    assert a["dias"] == 730
    assert b["empregador"] == "Prefeitura Municipal de Exemplo"
    assert b["cargo"] == "Enfermeira"
    assert (b["inicio"], b["atual"]) == ("2020-03-01", True)
    # Atual: fim fica vazio; os dias são contados até a data de emissão (só para o número exibido).
    assert (b["fim"], b["dias_ate"]) == (None, "2026-09-15")
    assert b["dias"] == (date(2026, 9, 15) - date(2020, 3, 1)).days + 1
    assert a["alertas"] == [] and b["alertas"] == []
    assert r["resumo"].startswith("2 vínculos · ")


def test_declaracao_em_texto_corrido():
    arquivo = pdf(
        [
            "PREFEITURA MUNICIPAL DE EXEMPLO",
            "Secretaria Municipal de Saude",
            "DECLARACAO",
            "Declaramos para os devidos fins que Maria Exemplo da Silva exerceu a funcao de Enfermeira",
            "no periodo de 01/03/2018 a 31/12/2020, com carga horaria de 40 horas semanais.",
            "Exemplo, 05 de janeiro de 2021.",
        ]
    )
    r = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    assert r["documento"] == "DECLARACAO"
    (v,) = r["itens"]
    assert v["empregador"] == "PREFEITURA MUNICIPAL DE EXEMPLO"
    assert v["cargo"] == "Enfermeira"
    assert (v["inicio"], v["fim"], v["carga_semanal"]) == ("2018-03-01", "2020-12-31", 40)
    assert v["dias"] == 1037


def test_declaracao_ate_a_presente_data():
    arquivo = pdf(
        [
            "HOSPITAL DE EXEMPLO S/A",
            "Declaramos que Maria Exemplo da Silva trabalha nesta instituicao no cargo de Enfermeira",
            "desde 10/06/2024 ate a presente data.",
            "Exemplo, 02/10/2026",
        ]
    )
    (v,) = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (v["inicio"], v["fim"], v["atual"], v["dias_ate"]) == ("2024-06-10", None, True, "2026-10-02")


def test_holerites_viram_um_periodo():
    arquivo = pdf(
        ["CLINICA EXEMPLO LTDA", "Demonstrativo de pagamento", "Competencia: 01/2022", "Maria Exemplo da Silva"],
        ["CLINICA EXEMPLO LTDA", "Demonstrativo de pagamento", "Competencia: 06/2022"],
    )
    r = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    (v,) = r["itens"]
    assert r["documento"] == "HOLERITE"
    assert (v["inicio"], v["fim"]) == ("2022-01-01", "2022-06-30")
    assert v["empregador"] == "CLINICA EXEMPLO LTDA"


def test_periodos_sobrepostos_no_mesmo_arquivo():
    arquivo = pdf(
        [
            "CERTIDAO DE TEMPO DE SERVICO - Fundacao Exemplo",
            "Maria Exemplo da Silva prestou servicos de 01/01/2019 a 31/12/2020",
            "e de 01/06/2020 a 30/06/2021.",
        ]
    )
    itens = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert len(itens) == 2
    assert all("PERIODO_SOBREPOSTO" in [a["codigo"] for a in i["alertas"]] for i in itens)


# ── identidade e registro ────────────────────────────────────────────────────


def test_identidade_so_o_tipo_e_o_nome():
    arquivo = pdf(["REPUBLICA FEDERATIVA DO BRASIL", "CARTEIRA DE IDENTIDADE", "NOME MARIA EXEMPLO DA SILVA"])
    r = ler_documento(arquivo, "IDENTIDADE", NOME, hoje=HOJE, ocr=None)
    assert r["itens"] == [{"tipo": "IDENTIDADE", "documento": "RG", "pagina": 1, "alertas": []}]
    assert r["resumo"] == "RG · nome confere"


def test_documento_que_nao_e_identidade():
    arquivo = pdf(["Comprovante de residencia", "Conta de luz de Maria Exemplo da Silva, vencimento 10/09/2026"])
    r = ler_documento(arquivo, "IDENTIDADE", NOME, hoje=HOJE, ocr=None)
    assert [a["codigo"] for a in r["alertas"]] == ["NADA_ENCONTRADO"]


def test_registro_no_conselho_vencido():
    arquivo = pdf(
        [
            "CONSELHO REGIONAL DE ENFERMAGEM - COREN",
            "Maria Exemplo da Silva",
            "Situacao: ATIVO",
            "Valido ate 31/12/2025",
        ]
    )
    (item,) = ler_documento(arquivo, "REGISTRO", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (item["conselho"], item["ativo"], item["validade"]) == ("COREN", True, "2025-12-31")
    assert [a["codigo"] for a in item["alertas"]] == ["REGISTRO_VENCIDO"]


# ── escaneados, imagens, formatos ────────────────────────────────────────────


def test_pdf_escaneado_sem_ocr_fica_ilegivel():
    r = ler_documento(pdf_so_imagem(), "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert r["situacao"] == "ILEGIVEL"
    assert [a["codigo"] for a in r["alertas"]] == ["DOCUMENTO_ILEGIVEL"]


def test_pdf_escaneado_vai_para_o_ocr():
    texto_lido = (
        "CERTIFICADO\nCertificamos que Maria Exemplo da Silva concluiu o curso Vacinas, carga horária de 80 horas."
    )
    r = ler_documento(pdf_so_imagem(), "CURSOS", NOME, hoje=HOJE, ocr=ocr_falso(texto_lido))
    assert r["metodo"] == "OCR" and r["confianca"] == 0.9
    assert r["itens"][0]["horas"] == 80


def test_imagem_com_ocr_falso():
    texto_lido = "CARTEIRA NACIONAL DE HABILITACAO\nNOME MARIA EXEMPLO DA SILVA"
    r = ler_documento(png_com_texto(["x"]), "IDENTIDADE", NOME, hoje=HOJE, ocr=ocr_falso(texto_lido, 0.8))
    assert r["formato"] == "IMAGEM" and r["metodo"] == "OCR"
    assert r["itens"][0]["documento"] == "CNH" and r["nome_confere"] is True


def test_ocr_de_baixa_qualidade_pede_conferencia():
    texto_lido = "CARTEIRA DE IDENTIDADE " + "MARIA EXEMPLO DA SILVA " * 30
    r = ler_documento(png_com_texto(["x"]), "IDENTIDADE", NOME, hoje=HOJE, ocr=ocr_falso(texto_lido, 0.3))
    assert "LEITURA_DUVIDOSA" in [a["codigo"] for a in r["alertas"]]


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract não instalado (o workflow instala)")
def test_ocr_de_verdade_numa_imagem():
    imagem = png_com_texto(
        [
            "CERTIFICADO",
            "Certificamos que Maria Exemplo da Silva",
            "concluiu o curso Vacinas,",
            "carga horaria de 80 horas.",
        ]
    )
    r = ler_documento(imagem, "CURSOS", NOME, hoje=HOJE)
    assert r["metodo"] == "OCR"
    assert r["itens"] and r["itens"][0]["horas"] == 80


def test_docx_e_zip():
    docx = io.BytesIO()
    with zipfile.ZipFile(docx, "w") as z:
        z.writestr(
            "word/document.xml",
            "<w:document><w:body><w:p><w:r><w:t>CERTIFICADO</w:t></w:r></w:p><w:p><w:r><w:t>"
            "Certificamos que Maria Exemplo da Silva concluiu o curso Libras, carga horária de 60 horas."
            "</w:t></w:r></w:p></w:body></w:document>",
        )
    r = ler_documento(docx.getvalue(), "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert r["formato"] == "DOCX" and r["itens"][0]["horas"] == 60
    zipado = io.BytesIO()
    with zipfile.ZipFile(zipado, "w") as z:
        z.writestr("certificado.pdf", CERTIFICADOS)
    r = ler_documento(zipado.getvalue(), "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert r["situacao"] == "NAO_SUPORTADO" and r["resumo"] == "Formato não lido (OUTRO)"


def test_pdf_corrompido_e_erro_sem_derrubar():
    r = ler_documento(b"%PDF-1.4 isto nao e um pdf", "CURSOS", NOME, hoje=HOJE, ocr=None)
    assert r["situacao"] == "ERRO" and r["erro"].startswith("pdf_")


def test_nada_do_texto_do_documento_no_resultado():
    r = ler_documento(CERTIFICADOS, "CURSOS", NOME, SAL, HASH, minimo_horas=40, hoje=HOJE, ocr=None)
    tudo = repr(r).lower()
    assert "maria" not in tudo and "silva" not in tudo
    assert "conteudo programatico" not in tudo


# ── a regra liga a pergunta do anexo ao item da ficha ────────────────────────


def test_bloco_e_o_que_procurar_pela_pergunta_do_anexo():
    casos = {
        "Pergunta 4 - Anexe o documento de identificação com foto, frente e verso": "IDENTIDADE",
        "Pergunta 6 - Anexe a comprovação de Nível Superior: (frente e verso": "TITULOS",
        "Pergunta 10 - Anexe o comprovante do seu registro profissional no Conselho": "REGISTRO",
        "Pergunta 14 - Anexe seu comprovante de Titulação Acadêmica.": "TITULOS",
        "Pergunta 16 - Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento :": "CURSOS",
        "Pergunta 12 - Anexe o comprovante de Experiência Profissional em atividades": "VINCULOS",
        "Pergunta 18 - Candidatos às vagas destinadas a Pretos ou Pardos": "GERAL",
        "Pergunta 30 - Outra coisa": "GERAL",
    }
    for coluna, esperado in casos.items():
        assert esperado_do_bloco(bloco_do_anexo(REGRA, coluna)) == esperado, coluna
    # Sem a coluna do Excel, o enunciado do anexo.
    assert bloco_do_anexo(REGRA, None, "Anexe seu comprovante de Titulação Acadêmica.")["codigo"] == "FORMACAO"


def test_minimo_de_horas_e_a_menor_faixa():
    cursos = next(b for b in REGRA["blocos"] if b["codigo"] == "CURSOS")
    assert minimo_de_horas(cursos) == 40
    assert minimo_de_horas({"faixas": []}) is None


# ── ajustes do piloto (93/2026): padrões vistos, reproduzidos com texto sintético ──


def pdf_so_imagem_com(n):
    """Um PDF escaneado com `n` páginas só de imagem."""
    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    imagem = Image.new("RGB", (400, 200), "white")
    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=A4)
    for _ in range(n):
        c.drawImage(ImageReader(imagem), 40, 500, width=400, height=200)
        c.showPage()
    c.save()
    return saida.getvalue()


def _campos_livres(itens):
    return " ".join(str(i.get(c) or "") for i in itens for c in ("curso", "cargo", "instituicao", "empregador"))


@pytest.mark.parametrize(
    ("linha_do_curso", "esperado"),
    [
        ("Bacharel em Enfermagem a “ Maria Exemplo da Silva brasileira, natural de Exemplo,", "Enfermagem"),
        ("Bacharel em Enfermagem Joao Pereira Santos, brasileiro,", "Enfermagem"),
        ("Bacharel em Enfermagem conferido a Maria Exemplo da Silva", "Enfermagem"),
        ("Tecnico em ENFERMAGEM EIXO TECNOLÓGICO: AMBIENTE E SAÚDE E = saúde", "ENFERMAGEM"),
        ("Especialista em\n06/04/2018", None),
    ],
)
def test_curso_do_diploma_sem_lixo_nem_nome_de_pessoa(linha_do_curso, esperado):
    arquivo = pdf(
        [
            "UNIVERSIDADE ESTADUAL DE EXEMPLO",
            "O Reitor da Universidade Estadual de Exemplo, no uso de suas atribuicoes, confere o titulo de",
            *linha_do_curso.split("\n"),
            "e outorga-lhe o presente Diploma. Exemplo, 12 de agosto de 2021.",
        ]
    )
    r = ler_documento(arquivo, "TITULOS", NOME, hoje=HOJE, ocr=None)
    (item,) = r["itens"]
    assert item["curso"] == esperado
    livres = texto.dobrar(_campos_livres(r["itens"]))
    for nome in ("maria", "silva", "joao", "pereira", "santos", "brasileir"):
        assert nome not in livres


def test_diploma_frente_e_verso_vira_um_titulo_e_assinatura_nao_e_doutorado():
    arquivo = pdf(
        [
            "CENTRO UNIVERSITARIO DE EXEMPLO",
            "O Centro Universitario de Exemplo confere a Maria Exemplo da Silva o titulo de",
            "Especialista em Saude da Familia, curso de pos-graduacao lato sensu,",
            "e outorga-lhe o presente certificado. Exemplo, 08 de outubro de 2019.",
        ],
        [
            "Certificado registrado sob o numero 1234, livro 2, folha 30.",
            "Curso de pos-graduacao lato sensu em Saude da Familia. Processo 5678, em 08/10/2019.",
            "Doutor(a) Joao Exemplo Pereira",
            "Prof. Dr. em Educacao Jose Exemplo - Coordenador do Doutorado em Educacao",
            "Reitor",
        ],
    )
    r = ler_documento(arquivo, "TITULOS", NOME, hoje=HOJE, ocr=None)
    (item,) = r["itens"]
    assert item["titulo"] == "ESPECIALIZACAO" and item["data"] == "2019-10-08"
    assert item["curso"] == "Saude da Familia"
    assert r["resumo"].startswith("Especialização · ")
    assert "Doutorado" not in r["resumo"]


def test_diploma_lido_duas_vezes_no_arquivo_vira_um_so():
    frente = [
        "UNIVERSIDADE FEDERAL DE EXEMPLO",
        "A Universidade Federal de Exemplo confere a Maria Exemplo da Silva o grau de",
        "Bacharel em Enfermagem. Colou grau em 15 de marco de 2016.",
    ]
    r = ler_documento(pdf(frente, frente), "TITULOS", NOME, hoje=HOJE, ocr=None)
    (item,) = r["itens"]
    assert (item["titulo"], item["data"], item["curso"]) == ("GRADUACAO", "2016-03-15", "Enfermagem")


CTPS_DO_PILOTO = [
    "Carteira de Trabalho Digital",
    "Nome: Maria Exemplo da Silva",
    "Empregador: Agencia de Exemplo do SUS",
    "Cargo: 001-TECNICO DE ENFERMAGEM 3222-05",
    "Data de admissao: 05/12/2025",
    "Cargo exercido: 3222-05",
    "Inicio do contrato 05/12/2025 Termino 30/12/2025",
    "Empregador: Fundacao Exemplo de Saude",
    "Cargo: TECNICO DE ENFERMAGEM",
    "Data de admissao: 01/10/2018",
    "Data de desligamento: 05/12/2025",
    "Empregador: Clinica Exemplo Ltda",
    "Cargo: ENFERMEIRA",
    "Data de admissao: 01/03/2024",
    "Data de desligamento: 30/06/2025",
    "As datas de admissao e desligamento seguem o eSocial. Emitido em 12/02/2026",
]


def test_ctps_atual_sem_fim_cargo_sem_codigo_e_sobreposicao_de_verdade():
    r = ler_documento(pdf(CTPS_DO_PILOTO), "VINCULOS", NOME, hoje=HOJE, ocr=None)
    agencia, fundacao, clinica = r["itens"]  # o rodapé "emitido em" e o repetido sem empregador saem
    assert agencia["empregador"] == "Agencia de Exemplo do SUS"
    assert (agencia["atual"], agencia["fim"], agencia["dias_ate"]) == (True, None, "2026-02-12")
    assert agencia["dias"] == (date(2026, 2, 12) - date(2025, 12, 5)).days + 1
    assert (agencia["cargo"], agencia["cbo"]) == ("Técnico de enfermagem", "3222-05")
    assert fundacao["cargo"] == "Técnico de enfermagem" and fundacao["atual"] is False
    assert clinica["cargo"] == "Enfermeira"
    codigos = [[a["codigo"] for a in i["alertas"]] for i in r["itens"]]
    # O atual começa no dia em que o anterior acabou: não é sobreposição.
    assert "PERIODO_SOBREPOSTO" not in sum(codigos, [])
    assert codigos[0] == []
    # Dois empregos ao mesmo tempo: aviso leve, não erro.
    assert "PERIODO_CONCOMITANTE" in codigos[1] and "PERIODO_CONCOMITANTE" in codigos[2]


def test_ctps_com_rotulos_no_cabecalho_da_tabela():
    arquivo = pdf(
        [
            "Carteira de Trabalho Digital",
            "Empregador: Hospital de Exemplo Ltda",
            "Data de admissao Data de desligamento",
            "01/02/2018 31/01/2020",
            "Emitido em 12/02/2026",
        ]
    )
    (v,) = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (v["inicio"], v["fim"], v["atual"]) == ("2018-02-01", "2020-01-31", False)


@pytest.mark.parametrize(
    ("cargo", "esperado"),
    [
        ("001-TECNICO DE ENFERMAGEM 3222-05", ("Técnico de enfermagem", "3222-05")),
        ("002-Enfermeiro 2235-05", ("Enfermeiro", "2235-05")),
        ("exercido 2235-05", (None, "2235-05")),
        ("Sup. Saude Ocupacional 2235-30", ("Sup. Saude Ocupacional", "2235-30")),
        ("ENFERMEIRA", ("Enfermeira", None)),
    ],
)
def test_cargo_sem_codigo_e_cbo_a_parte(cargo, esperado):
    from monitora.avaliacao_documental.leitura_de_arquivos.experiencia import limpar_cargo

    assert limpar_cargo(cargo) == esperado


def test_mesmo_empregador_com_periodos_sobrepostos_continua_erro():
    arquivo = pdf(
        [
            "CERTIDAO DE TEMPO DE SERVICO - Fundacao Exemplo",
            "Maria Exemplo da Silva prestou servicos de 01/01/2019 a 31/12/2020",
            "e de 31/12/2020 a 30/06/2021, e de 01/06/2021 a 31/12/2021.",
        ]
    )
    itens = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    codigos = [[a["codigo"] for a in i["alertas"]] for i in itens]
    assert codigos[0] == []  # acaba no dia em que o seguinte começa
    assert codigos[1] == ["PERIODO_SOBREPOSTO"] and codigos[2] == ["PERIODO_SOBREPOSTO"]


@pytest.mark.parametrize(
    "linhas",
    [
        ["Conselho Regional de Enfermagem - COREN", "Maria Exemplo da Silva", "Validade: 07/07/1979",
         "Expedicao: 10/05/2015"],
        ["Conselho Regional de Enfermagem - COREN", "Maria Exemplo da Silva", "Validade 07/07/1979"],
        ["Conselho Regional de Enfermagem - COREN", "Maria Exemplo da Silva", "Data de nascimento: 07/07/2001",
         "Validade"],
        ["Conselho Regional de Enfermagem - COREN", "Maria Exemplo da Silva", "Nascimento 07/07/1979",
         "Inscricao ativa"],
    ],
)  # fmt: skip
def test_registro_nao_toma_nascimento_por_validade(linhas):
    (item,) = ler_documento(pdf(linhas), "REGISTRO", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["validade"] is None
    assert "REGISTRO_VENCIDO" not in [a["codigo"] for a in item["alertas"]]


def test_registro_com_validade_depois_da_emissao():
    arquivo = pdf(["COREN - Conselho Regional de Enfermagem", "Maria Exemplo da Silva",
                   "Data de emissao: 10/01/2024", "Valido ate 31/12/2027"])  # fmt: skip
    (item,) = ler_documento(arquivo, "REGISTRO", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["validade"] == "2027-12-31" and item["alertas"] == []


@pytest.mark.parametrize(
    ("frase", "horas"),
    [
        ("com carga horaria: 40h/a", 40),
        ("com duracao de 40 horas", 40),
        ("totalizando 40 horas/aula", 40),
        ("CH: 40", 40),
        ("C.H. 40", 40),
        ("em 40hrs", 40),
        ("com carga horaria de 40 (quarenta) horas", 40),
        ("Carga Horaria: 60", 60),
        ("com quarenta horas", 40),
        ("com cento e vinte horas de atividades", 120),
    ],
)
def test_carga_horaria_em_outras_grafias(frase, horas):
    arquivo = pdf(["CERTIFICADO", "Certificamos que Maria Exemplo da Silva concluiu o curso Vacinas,", frase + ".",
                   "Exemplo, 10/05/2024"])  # fmt: skip
    (item,) = ler_documento(arquivo, "CURSOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["horas"] == horas
    assert "SEM_CARGA_HORARIA" not in [a["codigo"] for a in item["alertas"]]


def test_sem_carga_horaria_so_quando_nao_ha():
    arquivo = pdf(["CERTIFICADO", "Certificamos que Maria Exemplo da Silva concluiu o curso Vacinas,",
                   "realizado das 8h as 12h. Exemplo, 10/05/2024"])  # fmt: skip
    (item,) = ler_documento(arquivo, "CURSOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["horas"] is None
    assert "SEM_CARGA_HORARIA" in [a["codigo"] for a in item["alertas"]]


def test_pdf_escaneado_de_vinte_paginas_e_lido_inteiro():
    texto_lido = (
        "CERTIFICADO\nCertificamos que Maria Exemplo da Silva concluiu o curso Vacinas, carga horária de 40 horas."
    )
    r = ler_documento(pdf_so_imagem_com(20), "CURSOS", NOME, hoje=HOJE, ocr=ocr_falso(texto_lido))
    assert "PAGINAS_NAO_LIDAS" not in [a["codigo"] for a in r["alertas"]]
    assert len(r["itens"]) == 20


def test_pagina_com_ocr_fraco_e_relida_com_resolucao_maior():
    vistas = []

    def ocr(imagem):
        vistas.append(imagem.width)
        if len(vistas) == 1:
            return "CERTIFICADO\nC3rt1f1c4m0s", 0.3
        return "CERTIFICADO\nCertificamos que Maria Exemplo da Silva concluiu o curso Vacinas, com 40 horas.", 0.9

    r = ler_documento(pdf_so_imagem(), "CURSOS", NOME, hoje=HOJE, ocr=ocr)
    assert len(vistas) == 2 and vistas[1] > vistas[0]
    assert r["itens"][0]["horas"] == 40 and r["confianca"] == 0.9


@pytest.mark.parametrize(
    ("linhas", "documento"),
    [
        (["CONTA DE ENERGIA ELETRICA", "Cliente: Joao Exemplo Pereira", "Consumo em kWh: 230",
          "Vencimento 10/09/2026"], "COMPROVANTE_RESIDENCIA"),
        (["JUSTICA ELEITORAL", "TITULO DE ELEITOR", "Maria Exemplo da Silva", "Zona 12 Secao 34"], "TITULO_ELEITOR"),
        (["UNIVERSIDADE FEDERAL DE EXEMPLO", "HISTORICO ESCOLAR", "Maria Exemplo da Silva",
          "Disciplinas cursadas e componentes curriculares"], "HISTORICO_ESCOLAR"),
        (["REPUBLICA FEDERATIVA DO BRASIL", "CERTIDAO DE NASCIMENTO", "Maria Exemplo da Silva"], "CERTIDAO_CIVIL"),
        (["CONSELHO REGIONAL DE MEDICINA - CRM", "Certidao de inscricao", "Maria Exemplo da Silva"], "REGISTRO_CRM"),
        (["CLINICA EXEMPLO LTDA", "CONTRACHEQUE", "Maria Exemplo da Silva", "Mes/ano 03/2024"], "HOLERITE"),
    ],
)  # fmt: skip
def test_tipo_do_documento_sem_item(linhas, documento):
    r = ler_documento(pdf(linhas), "GERAL", NOME, hoje=HOJE, ocr=None)
    assert r["documento"] == documento


def test_comprovante_de_residencia_em_nome_de_outra_pessoa_nao_diverge():
    arquivo = pdf(["CONTA DE ENERGIA ELETRICA", "Cliente: Joao Exemplo Pereira", "Consumo em kWh: 230",
                   "Vencimento 10/09/2026 Rua de Exemplo, 100"])  # fmt: skip
    r = ler_documento(arquivo, "GERAL", NOME, hoje=HOJE, ocr=None)
    assert r["nome_confere"] is None
    assert [a["codigo"] for a in r["alertas"]] == []


def test_ocr_fraco_sem_o_nome_pede_conferencia_e_nao_diverge():
    texto_lido = "CARTEIRA DE IDENTIDADE\nNOME MAR1A EXFMPL0 DA S1LVA\n" + "REGISTRO GERAL 12 SSP " * 25
    r = ler_documento(png_com_texto(["x"]), "IDENTIDADE", NOME, hoje=HOJE, ocr=ocr_falso(texto_lido, 0.6))
    codigos = [a["codigo"] for a in r["alertas"]]
    assert "NOME_A_CONFERIR" in codigos and "NOME_DIVERGENTE" not in codigos
    assert r["nome_confere"] is None


def test_documento_legivel_que_deve_ter_o_nome_e_nao_tem_diverge():
    arquivo = pdf(["REPUBLICA FEDERATIVA DO BRASIL", "CARTEIRA DE IDENTIDADE", "NOME JOAO EXEMPLO PEREIRA"])
    r = ler_documento(arquivo, "IDENTIDADE", NOME, hoje=HOJE, ocr=None)
    assert r["nome_confere"] is False
    assert "NOME_DIVERGENTE" in [a["codigo"] for a in r["alertas"]]


DECLARACAO_DE_VINCULO = [
    "PREFEITURA MUNICIPAL DE EXEMPLO",
    "DECLARACAO",
    "Declaro para os devidos fins que Maria Exemplo da Silva foi contratada em 01/02/2020 para exercer",
    "a funcao de Enfermeira, e trabalhou nesta instituicao ate 30/04/2021.",
    "Exemplo, 10 de maio de 2021.",
]


@pytest.mark.parametrize("esperado", ["VINCULOS", "GERAL"])
def test_declaracao_de_tempo_de_servico_gera_vinculo(esperado):
    r = ler_documento(pdf(DECLARACAO_DE_VINCULO), esperado, NOME, hoje=HOJE, ocr=None)
    assert r["documento"] == "DECLARACAO"
    (v,) = r["itens"]
    assert v["tipo"] == "VINCULO"
    assert (v["empregador"], v["cargo"]) == ("PREFEITURA MUNICIPAL DE EXEMPLO", "Enfermeira")
    assert (v["inicio"], v["fim"], v["atual"]) == ("2020-02-01", "2021-04-30", False)


def test_declaracao_admitida_e_demitida():
    arquivo = pdf(["HOSPITAL DE EXEMPLO LTDA", "Declaramos que Maria Exemplo da Silva foi admitida em 01/02/2020",
                   "no cargo de Tecnica de Enfermagem e demitida em 15/03/2022."])  # fmt: skip
    (v,) = ler_documento(arquivo, "GERAL", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (v["inicio"], v["fim"], v["atual"]) == ("2020-02-01", "2022-03-15", False)


def test_campo_livre_nunca_leva_o_nome_do_candidato():
    from monitora.avaliacao_documental.leitura_de_arquivos.pessoas import sem_nome_de_pessoa

    assert sem_nome_de_pessoa("Enfermagem a Maria Exemplo da Silva", NOME) == "Enfermagem"
    assert sem_nome_de_pessoa("Hospital Central Maria Exemplo", NOME, estrito=False) == "Hospital Central"
    assert sem_nome_de_pessoa("Fundacao Oswaldo Cruz", NOME, estrito=False) == "Fundacao Oswaldo Cruz"
    assert sem_nome_de_pessoa("Maria Exemplo da Silva", NOME) is None
    assert sem_nome_de_pessoa("Saude da Familia", NOME) == "Saude da Familia"


# ── segunda rodada (lote novo do 93/2026) ────────────────────────────────────


def test_cargo_com_de_na_frente():
    from monitora.avaliacao_documental.leitura_de_arquivos.experiencia import limpar_cargo

    assert limpar_cargo("de TECNICO DE ENFERMAGEM") == ("Técnico de enfermagem", None)
    assert limpar_cargo("de Técnico") == ("Técnico", None)


def test_ctps_emissao_rotulada_no_topo_e_vizinho_com_o_mesmo_cargo():
    arquivo = pdf(
        [
            "Carteira de Trabalho Digital",
            "Documento emitido em 27/07/2026",
            "Empregador: Caixa de Exemplo dos Funcionarios",
            "Cargo: MEDICO DO TRABALHO 4 HORAS 20",
            "Data de admissao: 02/04/2026",
            "Cargo de MEDICO DO TRABALHO 4 HORAS 20",
            "Data de admissao: 24/08/2022",
            "Data de desligamento: 01/04/2026",
            "Nascimento 07/07/1979",
        ]
    )
    r = ler_documento(arquivo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    atual, anterior = r["itens"]
    assert (atual["atual"], atual["fim"], atual["dias_ate"]) == (True, None, "2026-07-27")
    assert anterior["empregador"] == "Caixa de Exemplo dos Funcionarios"
    assert anterior["cargo"] == "Médico do trabalho 4 horas 20"
    assert [a["codigo"] for a in atual["alertas"]] == []


def test_vinculos_com_empregador_nao_lido_sao_concomitantes_e_nao_sobrepostos():
    from monitora.avaliacao_documental.leitura_de_arquivos.experiencia import sobrepostos

    itens = [
        {"tipo": "VINCULO", "empregador": "Hospital A", "inicio": "2020-01-01", "fim": None, "atual": True},
        {"tipo": "VINCULO", "empregador": None, "inicio": "2024-01-01", "fim": None, "atual": True},
        {"tipo": "VINCULO", "empregador": "Hospital A", "inicio": "2021-01-01", "fim": "2021-12-31", "atual": False},
    ]
    assert sobrepostos(itens, HOJE) == {0: "PERIODO_SOBREPOSTO", 1: "PERIODO_CONCOMITANTE", 2: "PERIODO_SOBREPOSTO"}


def test_curso_do_certificado_para_na_barra_e_instituicao_nao_e_esta():
    arquivo = pdf(
        [
            "CERTIFICADO",
            "Certificamos que Maria Exemplo da Silva concluiu o curso Primeiros Socorros | Curso Online | 2023,",
            "com carga horaria de 10 horas, emitido por esta instituicao. Exemplo, 04/01/2026",
        ]
    )
    (item,) = ler_documento(arquivo, "CURSOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["curso"] == "Primeiros Socorros"
    assert not (item["instituicao"] or "").lower().startswith("esta")


def test_curso_do_diploma_para_em_conformidade():
    arquivo = pdf(
        [
            "CENTRO UNIVERSITARIO DE EXEMPLO",
            "confere a Maria Exemplo da Silva o titulo de Especialista em ERGONOMIA em conformidade coma Resolucao",
            "CNE/CES n 1. Exemplo, 10 de marco de 2020.",
        ]
    )
    (item,) = ler_documento(arquivo, "TITULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["curso"] == "ERGONOMIA"
