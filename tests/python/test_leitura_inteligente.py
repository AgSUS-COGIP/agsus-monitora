"""
Leitura mais inteligente dos arquivos (extrator 2026.10.4): CTPS pela posição dos campos, CNPJ validado,
cargo sem jornada, sobreposição só do mesmo empregador, soma sem sobreposição, data de emissão, fotos
arrumadas com OpenCV. Todos os documentos são SINTÉTICOS (sinteticos_leitura.py): nada real no repositório.
"""

import io
import json
import re
import shutil
from datetime import date

import pytest
import sinteticos_leitura as s

from monitora.avaliacao_documental.leitura_de_arquivos.ctps import cnpj_no_texto, cnpj_valido
from monitora.avaliacao_documental.leitura_de_arquivos.experiencia import (
    cargo_e_jornada,
    mesmo_empregador,
    sobrepostos,
    vinculos,
)
from monitora.avaliacao_documental.leitura_de_arquivos.extracao import Pagina, data_dos_metadados
from monitora.avaliacao_documental.leitura_de_arquivos.layout import Palavra
from monitora.avaliacao_documental.leitura_de_arquivos.leitura import dias_dos_vinculos, ler_documento
from monitora.avaliacao_documental.pontuacao import dias_dos_intervalos

pytest.importorskip("reportlab")
pytest.importorskip("pdfplumber")

HOJE = date(2026, 10, 9)
NOME = s.NOME_FICTICIO
TEM_TESSERACT = shutil.which("tesseract") is not None


def _codigos(item):
    return [a["codigo"] for a in item["alertas"]]


def _pdf(linhas):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=A4)
    y = 800
    for linha in linhas:
        if isinstance(linha, tuple):  # (x, texto) na mesma altura da anterior
            c.drawString(linha[0], y + 18, linha[1])
            continue
        c.setFont("Helvetica", 10)
        c.drawString(40, y, linha)
        y -= 18
    c.showPage()
    c.save()
    return saida.getvalue()


# ── CNPJ ─────────────────────────────────────────────────────────────────────


def test_cnpj_com_digito_verificador():
    assert cnpj_valido(s.cnpj_ficticio(12345678))
    assert cnpj_valido("11.222.333/0001-81")
    assert not cnpj_valido("11.222.333/0001-82")
    assert not cnpj_valido("11.111.111/1111-11")
    # CNPJ alfanumérico (a partir de julho de 2026): o exemplo da Receita Federal.
    assert cnpj_valido("12.ABC.345/01DE-35")
    assert cnpj_no_texto("CNPJ: 11.222.333/0001-81 - EMPRESA")[0] == "11.222.333/0001-81"
    assert cnpj_no_texto("CPF 123.456.789-09")[0] is None


# ── cargo ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("de MEDICO DO TRABALHO 4 HORAS 20", ("Médico do trabalho", None, 20)),
        ("MÉDICO - 10HS", ("Médico", None, 10)),
        ("MEDICO DO TRABALHO 4 HORAS", ("Médico do trabalho", None, 20)),
        ("ENFERMEIRO 30 HORAS SEMANAIS", ("Enfermeiro", None, 30)),
        ("Enfermeira 20h", ("Enfermeira", None, 20)),
        ("MEDICO (6 HORAS DIARIAS)", ("Médico", None, 30)),
        ("001-TECNICO DE ENFERMAGEM 3222-05", ("Técnico de enfermagem", "3222-05", None)),
        ("ENFERMEIRA", ("Enfermeira", None, None)),
        ("40 HORAS", (None, None, 40)),
    ],
)
def test_cargo_sem_prefixo_nem_jornada_com_a_carga_a_parte(bruto, esperado):
    assert cargo_e_jornada(bruto) == esperado


# ── CTPS Digital pela posição ────────────────────────────────────────────────


@pytest.mark.parametrize("desenho", ["rotulos", "tabela", "grade"])
def test_ctps_digital_do_medico_em_cada_desenho(desenho):
    conteudo, gabarito = s.ctps_digital(s.CONTRATOS_DO_MEDICO, desenho)
    r = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    itens = r["itens"]
    assert r["documento"] == "CTPS"
    assert [(i["empregador"], i["cnpj"], i["inicio"], i["fim"]) for i in itens] == [
        (g["empregador"], g["cnpj"], g["inicio"], g["fim"]) for g in gabarito
    ]
    assert [(i["cargo"], i["carga_semanal"]) for i in itens] == [(g["cargo"], g["carga"]) for g in gabarito]
    # Nenhum "Empregador não lido", nenhuma sobreposição falsa (empregadores diferentes), nenhum alerta de emissão.
    assert all(_codigos(i) == [] for i in itens)
    caixa, sesi = itens[0], itens[1]
    assert caixa["concomitante"] is True and sesi["concomitante"] is True
    assert "dias em comum" in caixa["informacao"]
    # O CNPJ formatado passa pela rede de segurança do banco (nada com cara de CPF: \d{3}.\d{3}.\d{3}-\d{2}).
    assert not re.search(r"\d{3}\.?\d{3}\.?\d{3}-?\d{2}", json.dumps(r["itens"]))
    # O atual vai até o "Documento gerado em 01/10/2026 às 14:22" do rodapé.
    assert (caixa["atual"], caixa["dias_ate"], caixa["dias_ate_fonte"]) == (True, "2026-10-01", "EMISSAO")


def test_ctps_grade_ignora_as_datas_de_alteracoes_e_ferias():
    conteudo, _ = s.ctps_digital(s.CONTRATOS_DO_MEDICO[:1], "grade", alteracoes=True)
    (item,) = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    # "Data de início: 02/01/2025 / Data de fim: 31/01/2025" das férias não viram outro vínculo nem o fim deste.
    assert (item["inicio"], item["fim"], item["atual"]) == ("2022-08-24", None, True)


def test_ctps_so_com_cnpj_fica_com_o_cnpj_como_empregador():
    conteudo, gabarito = s.ctps_digital(s.CONTRATOS_DA_ENFERMEIRA, "grade", sem_razao_social=(1,))
    itens = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert itens[1]["empregador"] == f"CNPJ {s.CONTRATOS_DA_ENFERMEIRA[1]['cnpj']}" == gabarito[1]["empregador"]
    assert (itens[1]["cargo"], itens[1]["cbo"]) == ("Enfermeiro", "2235-05")


def test_cpf_de_empregador_pessoa_fisica_nunca_e_guardado():
    conteudo = _pdf(
        [
            "Carteira de Trabalho Digital",
            "Contratos de trabalho",
            "Empregador: JOAO EXEMPLO DE SOUZA",
            "CNPJ/CEI/CPF: 987.654.321-00",
            "Data de admissão: 01/02/2020",
            "Data de desligamento: 31/12/2020",
            "Ocupação: EMPREGADA DOMESTICA",
            "Documento gerado em 01/10/2026 às 10:00",
        ]
    )
    r = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    (item,) = r["itens"]
    assert "cnpj" not in item
    assert "987.654.321-00" not in json.dumps(r, ensure_ascii=False)
    assert (item["inicio"], item["fim"]) == ("2020-02-01", "2020-12-31")


def test_cnpj_com_digito_errado_nao_e_guardado():
    conteudo = _pdf(
        [
            "Carteira de Trabalho Digital",
            "Razão social: CLINICA EXEMPLO LTDA",
            "CNPJ: 11.222.333/0001-82",
            "Data de admissão: 01/02/2020",
        ]
    )
    (item,) = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["empregador"] == "CLINICA EXEMPLO LTDA" and "cnpj" not in item


def test_ctps_mesmo_empregador_com_alteracao_em_aberto_vira_um_contrato():
    cnpj = s.cnpj_ficticio(33719485)
    conteudo = _pdf(
        [
            "Carteira de Trabalho Digital",
            "Razão social: CAIXA DE EXEMPLO",
            f"CNPJ: {cnpj}",
            "Data de admissão: 24/08/2022",
            "Razão social: CAIXA DE EXEMPLO",
            f"CNPJ: {cnpj}",
            "Data de admissão: 02/04/2026",
            "Documento gerado em 01/10/2026 às 10:00",
        ]
    )
    (item,) = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (item["inicio"], item["fim"], item["atual"], item["alteracoes"]) == ("2022-08-24", None, True, 1)
    assert _codigos(item) == []


def test_ctps_fisica_com_duas_paginas_lado_a_lado_pela_posicao():
    """A foto da carteira aberta: duas páginas de contrato, rótulos à esquerda de cada uma (OCR falso com posição)."""

    def palavras_da_linha(x, y, texto):
        saida, cursor = [], x
        for palavra in texto.split():
            largura = 18 * len(palavra)
            saida.append(Palavra(palavra, cursor, cursor + largura, y, y + 30))
            cursor += largura + 12
        return saida

    esquerda = [
        ("Empregador", "HOSPITAL REGIONAL EXEMPLO LTDA"),
        ("Cargo", "MEDICO CLINICO"),
        ("C.B.O. nº", "2251-25"),
        ("Data admissão", "01 de fevereiro de 2016"),
        ("Saída", "31 de dezembro de 2019"),
    ]
    direita = [
        ("Empregador", "FUNDACAO MUNICIPAL DE SAUDE DE EXEMPLO"),
        ("Cargo", "MEDICO 20H SEMANAIS"),
        ("C.B.O. nº", "2251-25"),
        ("Data admissão", "10 de martão de 2020"),  # o mês mal lido pelo OCR
        ("Saída", "30 de junho de 2022"),
    ]
    palavras, linhas_do_texto = [], []
    for n, ((r1, v1), (r2, v2)) in enumerate(zip(esquerda, direita, strict=True)):
        y = 200 + 80 * n
        palavras += palavras_da_linha(40, y, r1) + palavras_da_linha(420, y, v1)
        palavras += palavras_da_linha(1500, y, r2) + palavras_da_linha(1880, y, v2)
        linhas_do_texto.append(f"{r1} {v1} {r2} {v2}")
    texto = "CONTRATO DE TRABALHO\nEsp. do estabelecimento Hospital\n" + "\n".join(linhas_do_texto)
    pagina = Pagina(1, texto, "OCR", 0.9, palavras)
    a, b = vinculos([pagina], hoje=HOJE)
    assert (a["empregador"], a["inicio"], a["fim"], a["cargo"]) == (
        "HOSPITAL REGIONAL EXEMPLO LTDA",
        "2016-02-01",
        "2019-12-31",
        "Médico clínico",
    )
    assert (b["empregador"], b["inicio"], b["fim"], b["carga_semanal"]) == (
        "FUNDACAO MUNICIPAL DE SAUDE DE EXEMPLO",
        "2020-03-10",
        "2022-06-30",
        20,
    )


# ── sobreposição e soma sem sobreposição ─────────────────────────────────────


def test_sobreposicao_so_do_mesmo_empregador_por_cnpj_ou_razao_social():
    cnpj_a, cnpj_a_filial, cnpj_b = s.cnpj_ficticio(11111112), s.cnpj_ficticio(11111112, 2), s.cnpj_ficticio(22222223)
    base = {"tipo": "VINCULO", "atual": False}
    itens = [
        {**base, "empregador": "Hospital A Ltda", "cnpj": cnpj_a, "inicio": "2020-01-01", "fim": "2021-12-31"},
        {**base, "empregador": "HOSPITAL A", "cnpj": cnpj_a_filial, "inicio": "2021-06-01", "fim": "2022-12-31"},
        {**base, "empregador": "Clínica B", "cnpj": cnpj_b, "inicio": "2020-06-01", "fim": "2020-12-31"},
    ]
    assert sobrepostos(itens, HOJE) == {0: "PERIODO_SOBREPOSTO", 1: "PERIODO_SOBREPOSTO", 2: "PERIODO_CONCOMITANTE"}
    assert mesmo_empregador(
        {"empregador": "SERVICO SOCIAL DA INDUSTRIA"}, {"empregador": "Serviço Social da Indústria - SESI"}
    )
    assert not mesmo_empregador({"empregador": "Hospital"}, {"empregador": "Hospital São Lucas"})
    assert not mesmo_empregador({"empregador": "X", "cnpj": cnpj_a}, {"empregador": "X", "cnpj": cnpj_b})


def test_mesmo_empregador_sobreposto_e_alerta_forte_e_diferentes_so_informacao():
    conteudo = _pdf(
        [
            "CERTIDAO DE TEMPO DE SERVICO - Fundacao Exemplo",
            "Maria Exemplo da Silva prestou servicos de 01/01/2019 a 31/12/2020",
            "e de 01/06/2020 a 30/06/2021.",
        ]
    )
    itens = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert all("PERIODO_SOBREPOSTO" in _codigos(i) for i in itens)
    assert all("duplicidade" in a["texto"] for i in itens for a in i["alertas"] if a["codigo"] == "PERIODO_SOBREPOSTO")


def test_resumo_soma_a_uniao_dos_periodos_e_diz_os_dias_em_comum():
    vinculos_lidos = [
        {"tipo": "VINCULO", "inicio": "2020-01-01", "fim": "2020-12-31", "atual": False},
        {"tipo": "VINCULO", "inicio": "2020-07-01", "fim": "2021-06-30", "atual": False},
        {"tipo": "VINCULO", "inicio": "2026-01-01", "fim": None, "atual": True, "dias_ate": "2026-01-31"},
    ]
    uniao, em_comum = dias_dos_vinculos(vinculos_lidos, HOJE)
    # A mesma conta da pontuação (pontuacao.dias_dos_intervalos com unir=True).
    assert uniao == dias_dos_intervalos(
        [{"inicio": "2020-01-01", "fim": "2021-06-30"}, {"inicio": "2026-01-01", "fim": "2026-01-31"}]
    )
    assert uniao == 547 + 31
    assert em_comum == 184  # 01/07/2020 a 31/12/2020
    conteudo, _ = s.ctps_digital(s.CONTRATOS_DO_MEDICO, "grade")
    r = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    uniao, em_comum = dias_dos_vinculos(r["itens"], HOJE)
    assert em_comum > 0 and sum(i["dias"] for i in r["itens"]) == uniao + em_comum
    assert f"{uniao:,} dias".replace(",", ".") in r["resumo"]
    assert f"{em_comum:,} dias em comum não somam".replace(",", ".") in r["resumo"]


# ── data de emissão ──────────────────────────────────────────────────────────


def test_vinculo_atual_sem_emissao_conta_ate_a_leitura_sem_alerta():
    conteudo = _pdf(
        ["Carteira de Trabalho Digital", "Razão social: CLINICA EXEMPLO LTDA", "Data de admissão: 01/02/2026"]
    )
    (item,) = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert (item["dias_ate"], item["dias_ate_fonte"]) == ("2026-10-09", "LEITURA")
    assert item["dias"] == (HOJE - date(2026, 2, 1)).days + 1
    assert _codigos(item) == []


def test_emissao_pelo_metadado_do_pdf_e_data_futura_nao_vale():
    assert data_dos_metadados({"CreationDate": "D:20260930142233-03'00'"}) == date(2026, 9, 30)
    assert data_dos_metadados({}) is None
    pagina = Pagina(
        1, "Carteira de Trabalho Digital\nRazão social: CLINICA EXEMPLO LTDA\nData de admissão: 01/02/2026", "TEXTO"
    )
    (item,) = vinculos([pagina], hoje=HOJE, data_do_arquivo=date(2026, 9, 30))
    assert (item["dias_ate"], item["dias_ate_fonte"]) == ("2026-09-30", "ARQUIVO")
    # OCR que leu 2028 por 2026 no rodapé: data depois da leitura não serve de limite.
    futura = Pagina(1, pagina.texto + "\nDocumento gerado em 01/10/2028 às 10:00", "TEXTO")
    (item,) = vinculos([futura], hoje=HOJE)
    assert (item["dias_ate"], item["dias_ate_fonte"]) == ("2026-10-09", "LEITURA")


def test_emissao_pelo_carimbo_de_data_e_hora_ou_assinatura_digital():
    base = "Carteira de Trabalho Digital\nRazão social: CLINICA EXEMPLO LTDA\nData de admissão: 01/02/2026\n"
    (item,) = vinculos([Pagina(1, base + "Consulta 15/09/2026 10:31:02", "TEXTO")], hoje=HOJE)
    assert item["dias_ate"] == "2026-09-15"
    (item,) = vinculos(
        [Pagina(1, base + "Assinado com certificado. Data: 2026.09.20 11:02:33 -03'00'", "TEXTO")], hoje=HOJE
    )
    assert item["dias_ate"] == "2026-09-20"


# ── certificados pela posição ────────────────────────────────────────────────


def test_certificado_com_carga_horaria_embaixo_do_rotulo():
    conteudo = _pdf(
        [
            "CERTIFICADO",
            "Certificamos que Maria Exemplo da Silva participou da capacitação.",
            "Curso                                   Carga horária",
            "Vigilância em Saúde Indígena            60 horas",
            "Exemplo, 10/08/2025",
        ]
    )
    (item,) = ler_documento(conteudo, "CURSOS", NOME, hoje=HOJE, ocr=None)["itens"]
    assert item["horas"] == 60
    assert item["curso"] == "Vigilância em Saúde Indígena"


# ── fotos (OCR de verdade: só onde o Tesseract está instalado) ───────────────


@pytest.mark.skipif(not TEM_TESSERACT, reason="Tesseract não instalado (o workflow instala)")
@pytest.mark.parametrize("distorcao", [{"angulo": 6.0, "sombra": 0.3}, {"girar": 90}])
def test_foto_de_ctps_digital_torta_com_sombra_ou_deitada(distorcao):
    pytest.importorskip("cv2")
    foto, gabarito = s.foto_de_ctps_digital(s.CONTRATOS_DO_MEDICO[:2], **distorcao)
    r = ler_documento(foto, "VINCULOS", NOME, hoje=HOJE)
    assert r["metodo"] == "OCR"
    achados = {i["inicio"]: i for i in r["itens"]}
    for g in gabarito:
        assert achados[g["inicio"]]["empregador"] == g["empregador"]
        assert achados[g["inicio"]]["cnpj"] == g["cnpj"]


def test_inclinacao_medida_pelo_opencv():
    cv2 = pytest.importorskip("cv2")
    import numpy as np
    from PIL import Image

    from monitora.avaliacao_documental.leitura_de_arquivos import imagem

    conteudo, _ = s.ctps_digital(s.CONTRATOS_DO_MEDICO[:2], "grade", alteracoes=False)
    pagina = s.paginas_como_imagem(conteudo, resolucao=120)[0].convert("L")
    torta = pagina.rotate(5, resample=Image.BICUBIC, expand=True, fillcolor=255)
    cinza = np.array(torta)
    # O ângulo devolvido é o que endireita (a página girou 5° no sentido anti-horário: -5°).
    assert abs(imagem.angulo_da_inclinacao(cv2, np, cinza) + 5) < 1.0
    endireitada = imagem.desinclinar(cv2, np, cinza)
    assert abs(imagem.angulo_da_inclinacao(cv2, np, endireitada)) < 1.0
    variantes = imagem.variantes(torta)
    assert set(variantes) == {"cinza", "binarizada"} and max(variantes["cinza"].size) >= imagem.LADO_MINIMO
