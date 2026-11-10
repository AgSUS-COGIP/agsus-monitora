"""
Testes da leitura da retificação do cronograma (api/anexos-do-edital.py,
`extrair_retificacao`). Os PDFs são SINTÉTICOS, gerados aqui com reportlab no
desenho das retificações da AgSUS (título "Nª RETIFICAÇÃO DO CRONOGRAMA",
"Onde se lê:" e "Leia-se:" com a tabela Atividades | Datas prováveis, linhas
alteradas em negrito, rodapé do SEI e assinatura eletrônica). Nunca documento
real.

    python -m pytest tests/python/test_retificacao_do_cronograma.py
"""

import importlib.util
import io
import pathlib

import pytest

pytest.importorskip("pdfplumber")
pytest.importorskip("reportlab")

_ARQUIVO = pathlib.Path(__file__).resolve().parents[2] / "api" / "anexos-do-edital.py"
_spec = importlib.util.spec_from_file_location("anexos_do_edital_retificacao", _ARQUIVO)
ax = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ax)

UNIDADE = "DSEI EXEMPLO DO SUL"

ONDE = [
    ("Publicação do Edital", "08/09"),
    ("Impugnação do Edital", "09 a 11/09"),
    ("Período de inscrição e Envio dos Documentos", "16 a 20/09"),
    ("Convocação para a Entrevista", "09/10"),
    ("Período de Entrevistas", "13/10 a 17/11"),
    ("Resultado Preliminar das Entrevistas", "19/11"),
    ("Resultado final do Processo Seletivo", "27/11"),
]

LEIA = [
    ("Publicação do Edital", "08/09", False),
    ("Impugnação do Edital", "09 a 11/09", False),
    ("Período de inscrição e Envio dos Documentos", "16 a 20/09", False),
    ("Publicação da Lista Geral de Classificação Provisória", "22/09", True),
    ("Convocação para a Entrevista", "09/10", False),
    ("Período de Entrevistas", "13/10 a 18/11", True),
    ("Resultado Preliminar das Entrevistas", "24/11", True),
    ("Prazo para recursos referentes ao resultado preliminar", "31/10 e 01/11", True),
    ("Resultado final do Processo Seletivo", "03/12", True),
]


def retificacao_pdf(
    *,
    numero="2ª",
    objeto="DO CRONOGRAMA",
    edital="105/2026",
    edital_no_corpo=None,
    onde=ONDE,
    leia=LEIA,
    quebrar_leia_em=None,
    sei="0123456",
    assinada="28/10/2026",
    titulo="RETIFICAÇÃO",
):
    """Bytes de uma retificação sintética. `quebrar_leia_em` leva o resto do Leia-se à página seguinte."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    saida = io.BytesIO()
    c = canvas.Canvas(saida, pagesize=A4)
    largura, altura = A4
    pagina = [1]

    def rodape():
        c.setFont("Helvetica", 7)
        c.drawString(
            40,
            25,
            f"Retificação {numero} Retificação - Cronograma ({sei}) SEI AGSUS.000001/2026-11 / pg. {pagina[0]}",
        )

    def nova_pagina():
        rodape()
        c.showPage()
        pagina[0] += 1
        return altura - 50

    def texto(y, conteudo, fonte="Helvetica", tamanho=10):
        c.setFont(fonte, tamanho)
        c.drawString(50, y, conteudo)
        return y - 16

    x0, x1, x2 = 50, 400, 540

    def linha_da_tabela(y, atividade, datas, negrito=False):
        c.rect(x0, y - 18, x2 - x0, 18)
        c.line(x1, y - 18, x1, y)
        c.setFont("Helvetica-Bold" if negrito else "Helvetica", 9)
        c.drawString(x0 + 4, y - 13, atividade)
        c.drawString(x1 + 4, y - 13, datas)
        return y - 18

    def tabela(y, linhas, quebra=None):
        y = linha_da_tabela(y, "Atividades", "Datas prováveis", negrito=True)
        for i, (atividade, datas, *resto) in enumerate(linhas):
            if quebra is not None and i == quebra:
                y = nova_pagina()
            y = linha_da_tabela(y, atividade, datas, negrito=bool(resto and resto[0]))
        return y - 14

    y = altura - 50
    y = texto(y, titulo, "Helvetica-Bold", 12)
    y = texto(y, f"{numero} RETIFICAÇÃO {objeto}", "Helvetica-Bold", 12)
    y = texto(y, f"PROCESSO SELETIVO SIMPLIFICADO – {UNIDADE} – EDITAL Nº {edital}", "Helvetica-Bold", 11)
    y = texto(y, "1. DISPOSIÇÕES PRELIMINARES")
    y = texto(y, f"Fica retificado o Anexo I – Cronograma do Edital nº {edital_no_corpo or edital}.")
    y = texto(y, "Onde se lê:", "Helvetica-Bold")
    y = texto(y, "ANEXO I")
    y = texto(y, f"CRONOGRAMA DO PROCESSO SELETIVO - EDITAL Nº {edital} - {UNIDADE}")
    y = tabela(y, onde)
    y = texto(y, "Leia-se:", "Helvetica-Bold")
    y = texto(y, "ANEXO I")
    y = texto(y, f"CRONOGRAMA DO PROCESSO SELETIVO - EDITAL Nº {edital} - {UNIDADE}")
    y = tabela(y, leia, quebrar_leia_em)
    y = texto(y, "3. DAS DISPOSIÇÕES FINAIS")
    y = texto(y, f"3.1. As demais cláusulas e condições do Edital nº {edital} permanecem inalteradas.")
    y = texto(y, "Documento assinado eletronicamente por Pessoa Exemplo, Diretor(a)")
    y = texto(y, f"de Atenção Integral à Saúde, em {assinada}, às 15:01, conforme horário oficial de Brasília.")
    texto(y, f"Referência: Processo nº AGSUS.000001/2026-11 SEI nº {sei}")
    rodape()
    c.save()
    return saida.getvalue()


def ler(**opcoes):
    return ax.extrair_retificacao(retificacao_pdf(**opcoes))


def por_atividade(resultado):
    return {e["atividade"]: e for e in resultado["leia_se"]}


# ── Datas ───────────────────────────────────────────────────────────────────


class TestDatas:
    def test_digitacao_corrigida(self):
        assert ax.corrigir_digitacao("05/ a 16/10") == "05 a 16/10"
        assert ax.corrigir_digitacao("17 a 19 /09") == "17 a 19/09"
        assert ax.corrigir_digitacao("10/09 a\n20/10") == "10/09 a 20/10"
        assert ax.corrigir_digitacao("09/10") == "09/10"

    def test_conector_e_avisos(self):
        periodo, conector, avisos = ax.ler_datas_da_retificacao("05/ a 16/10")
        assert periodo == ((5, 10, None), (16, 10, None))
        assert conector == "a"
        assert "Digitação estranha" in avisos[0]
        _, conector, avisos = ax.ler_datas_da_retificacao("24/09 e 07/10")
        assert conector == "e" and avisos == []

    def test_hora_nao_e_digitacao(self):
        periodo, _, avisos = ax.ler_datas_da_retificacao("23/06 a 02/07 às 14h")
        assert periodo == ((23, 6, None), (2, 7, None))
        assert avisos == []

    def test_duas_datas_soltas_viram_intervalo_com_aviso(self):
        [etapa] = ax.etapas_da_retificacao([("Convocação", "24/09 e 07/10", True)], 2026)
        assert (etapa["data_inicio"], etapa["data_fim"]) == ("2026-09-24", "2026-10-07")
        assert "duas datas soltas" in etapa["avisos"][0]

    def test_dias_seguidos_com_e_nao_avisam(self):
        etapas = ax.etapas_da_retificacao([("Recurso", "31/10 e 01/11", False), ("Outro", "24 e 25/10", False)], 2026)
        assert (etapas[0]["data_inicio"], etapas[0]["data_fim"]) == ("2026-10-31", "2026-11-01")
        assert all(not e["avisos"] for e in etapas)

    def test_datas_fora_de_ordem_sao_trocadas(self):
        [etapa] = ax.etapas_da_retificacao([("Convocação", "07/10 e 24/09", False)], 2026)
        assert (etapa["data_inicio"], etapa["data_fim"]) == ("2026-09-24", "2026-10-07")
        assert "fora de ordem" in etapa["avisos"][0]

    def test_virada_de_ano(self):
        etapas = ax.etapas_da_retificacao(
            [("A", "15/12", False), ("B", "28/12 a 05/01", False), ("C", "20/01", False)], 2026
        )
        assert [(e["data_inicio"], e["data_fim"]) for e in etapas] == [
            ("2026-12-15", "2026-12-15"),
            ("2026-12-28", "2027-01-05"),
            ("2027-01-20", "2027-01-20"),
        ]

    def test_etapa_sem_data(self):
        etapas = ax.etapas_da_retificacao([("A", "", False), ("B", "A definir", False)], 2026)
        assert etapas[0]["data_inicio"] == "" and etapas[0]["avisos"] == ["Etapa sem data no PDF."]
        assert etapas[1]["data_inicio"] == "" and "não reconhecida" in etapas[1]["avisos"][0]

    def test_rodape_do_sei_que_caiu_na_celula(self):
        assert ax.sem_rodape("26/06/2026 I AGSUS.002213/2026-") == "26/06/2026"
        assert ax.sem_rodape("Publicação do Edital ão 1ª RETIFICAÇÃO DO ANEXO I (0604884)") == "Publicação do Edital"
        assert ax.sem_rodape("cação 2ª Retificação do Anexo I - Cronograma (0698514) SEI A") == ""

    def test_agsus_no_texto_da_celula_nao_e_rodape(self):
        # Só o processo do SEI ("AGSUS.002213/…") é rodapé; o nome no texto fica.
        assert ax.sem_rodape("Divulgação do resultado no site da AgSUS.") == "Divulgação do resultado no site da AgSUS."
        assert ax.sem_rodape("Recurso pelo e-mail recurso@agsus.org.br") == "Recurso pelo e-mail recurso@agsus.org.br"


# ── PDF inteiro ─────────────────────────────────────────────────────────────


class TestPdf:
    def test_identificacao(self):
        r = ler()
        assert r["tipo"] == "retificacao"
        assert r["numero"] == 2
        assert r["rotulo"] == "2ª Retificação do Cronograma"
        assert r["edital"] == "105/2026"
        assert r["unidade"] == UNIDADE
        assert r["sei"] == "0123456"
        assert r["processo"] == "AGSUS.000001/2026-11"
        assert r["assinada_em"] == "2026-10-28"
        assert r["avisos"] == []

    def test_onde_se_le_e_leia_se_separados(self):
        r = ler()
        assert [e["atividade"] for e in r["onde_se_le"]] == [a for a, _ in ONDE]
        assert [e["atividade"] for e in r["leia_se"]] == [a for a, *_ in LEIA]
        assert r["onde_se_le"][4]["data_fim"] == "2026-11-17"
        assert r["leia_se"][5]["data_fim"] == "2026-11-18"

    def test_formatos_de_data_e_negrito(self):
        etapas = por_atividade(ler())
        assert (etapas["Publicação do Edital"]["data_inicio"], etapas["Publicação do Edital"]["data_fim"]) == (
            "2026-09-08",
            "2026-09-08",
        )
        impugnacao = etapas["Impugnação do Edital"]
        assert (impugnacao["data_inicio"], impugnacao["data_fim"]) == ("2026-09-09", "2026-09-11")
        recurso = etapas["Prazo para recursos referentes ao resultado preliminar"]
        assert (recurso["data_inicio"], recurso["data_fim"]) == ("2026-10-31", "2026-11-01")
        assert recurso["avisos"] == []
        assert [e["negrito"] for e in ler()["leia_se"]] == [n for *_, n in LEIA]

    def test_formatos_com_aviso(self):
        leia = [
            ("Publicação do Edital", "09/10", False),
            ("Impugnação do Edital", "10 a 13/10", False),
            ("Período de Entrevistas", "05/ a 16/10", True),
            ("Período de inscrição", "17 a 19 /10", False),
            ("Convocação para a Entrevista", "24/09 e 07/10", True),
            ("Período de recurso", "28/09 a 09/10", True),
            ("Resultado final", "", True),
        ]
        etapas = por_atividade(ler(leia=leia))
        assert (etapas["Período de Entrevistas"]["data_inicio"], etapas["Período de Entrevistas"]["data_fim"]) == (
            "2026-10-05",
            "2026-10-16",
        )
        assert "Digitação estranha" in etapas["Período de Entrevistas"]["avisos"][0]
        assert etapas["Período de inscrição"]["data_fim"] == "2026-10-19"
        assert "Digitação estranha" in etapas["Período de inscrição"]["avisos"][0]
        convocacao = etapas["Convocação para a Entrevista"]
        assert (convocacao["data_inicio"], convocacao["data_fim"]) == ("2026-09-24", "2026-10-07")
        assert "duas datas soltas" in convocacao["avisos"][0]
        assert etapas["Período de recurso"]["data_inicio"] == "2026-09-28"
        assert etapas["Período de recurso"]["data_fim"] == "2026-10-09"
        assert etapas["Resultado final"]["data_inicio"] == ""
        assert etapas["Resultado final"]["avisos"] == ["Etapa sem data no PDF."]

    def test_leia_se_que_continua_na_pagina_seguinte(self):
        r = ler(quebrar_leia_em=6)
        assert r["paginas"] == 2
        assert [e["atividade"] for e in r["leia_se"]] == [a for a, *_ in LEIA]
        assert r["leia_se"][-1]["data_inicio"] == "2026-12-03"
        assert r["leia_se"][-1]["negrito"] is True

    def test_virada_de_ano_no_pdf(self):
        leia = [
            ("Publicação do Edital", "01/12", False),
            ("Período de Entrevistas", "28/12 a 08/01", True),
            ("Resultado final", "20/01", True),
        ]
        r = ler(edital="130/2026", leia=leia)
        assert [(e["data_inicio"], e["data_fim"]) for e in r["leia_se"]] == [
            ("2026-12-01", "2026-12-01"),
            ("2026-12-28", "2027-01-08"),
            ("2027-01-20", "2027-01-20"),
        ]

    def test_retificacao_do_anexo_i(self):
        r = ler(numero="1ª", objeto="DO ANEXO I DO EDITAL DE PROCESSO SELETIVO")
        assert r["rotulo"] == "1ª Retificação do Anexo I"

    def test_edital_diferente_citado_no_corpo(self):
        r = ler(edital="118/2026", edital_no_corpo="105/2026")
        assert r["edital"] == "118/2026"
        assert r["editais_citados"] == ["118/2026", "105/2026"]
        assert any("105/2026" in a for a in r["avisos"])

    def test_pdf_que_nao_e_retificacao(self):
        r = ler(numero="", objeto="", titulo="COMUNICADO EXTERNO", leia=[], onde=[])
        assert r["leia_se"] == []
        assert 'Não achei a tabela do "Leia-se".' in r["avisos"]
