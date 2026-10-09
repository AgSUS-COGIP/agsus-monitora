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
    assert b["fim"] == "2026-09-15"  # a data de emissão fecha o vínculo em aberto
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
    assert (v["inicio"], v["fim"], v["atual"]) == ("2024-06-10", "2026-10-02", True)


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
