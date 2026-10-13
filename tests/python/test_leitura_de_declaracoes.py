"""
Declarações de vínculo / tempo de serviço (extrator 2026.10.6): o emissor é o empregador (timbre, frase, rodapé,
CNPJ), uma seção por declaração, fim "até a presente data" → atual e sem nada → fim não informado, carga só
ligada a "horas semanais"/"carga horária"/"jornada", datas por extenso com o mês estragado pelo OCR e o vínculo
que começa depois da emissão descartado. Tudo SINTÉTICO (sinteticos_leitura.py): nada real no repositório.
"""

import io
import shutil
import unicodedata
from datetime import date

import pytest
import sinteticos_leitura as s

from monitora.avaliacao_documental.leitura_de_arquivos import VERSAO_DO_EXTRATOR
from monitora.avaliacao_documental.leitura_de_arquivos.declaracoes import (
    carga_declarada,
    emissor_da_pagina,
    limpar_nome,
    mascarar_ignorados,
    nome_de_instituicao,
    numero_por_extenso,
    parece_lixo,
    secoes,
)
from monitora.avaliacao_documental.leitura_de_arquivos.experiencia import _carga_capturada_duas_vezes, vinculos
from monitora.avaliacao_documental.leitura_de_arquivos.extracao import Pagina
from monitora.avaliacao_documental.leitura_de_arquivos.layout import Palavra
from monitora.avaliacao_documental.leitura_de_arquivos.leitura import ler_documento
from monitora.avaliacao_documental.leitura_de_arquivos.texto import datas_no_texto, dobrar, mes_parecido

pytest.importorskip("reportlab")
pdfplumber = pytest.importorskip("pdfplumber")

HOJE = date(2026, 10, 13)
NOME = s.NOME_FICTICIO
TEM_TESSERACT = shutil.which("tesseract") is not None


def _normal(texto):
    t = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    return " ".join("".join(c if c.isalnum() else " " for c in t).split())


def _por_inicio(itens):
    return {i["inicio"]: i for i in itens}


def test_versao_do_extrator_subiu():
    assert VERSAO_DO_EXTRATOR == "2026.10.8"


# ── o caso do arquivo com várias declarações ────────────────────────────────


@pytest.fixture(scope="module")
def varias():
    conteudo, gabarito = s.declaracoes_de_vinculo()
    return ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None), gabarito


def test_cada_declaracao_com_o_emissor_dela(varias):
    resultado, gabarito = varias
    itens = _por_inicio(resultado["itens"])
    assert len(resultado["itens"]) == len(gabarito) == 6
    for g in gabarito:
        item = itens[g["inicio"]]
        assert _normal(item["empregador"]) == _normal(g["empregador"]), g
        assert "SEM_EMPREGADOR" not in [a["codigo"] for a in item["alertas"]]
    # O endereço do timbre ("Rua 26 de Agosto… Centro") nunca é o empregador.
    assert not any("Rua" in (i["empregador"] or "") for i in resultado["itens"])


def test_fim_atual_ou_nao_informado_nunca_ambiguo(varias):
    resultado, gabarito = varias
    itens = _por_inicio(resultado["itens"])
    for g in gabarito:
        item = itens[g["inicio"]]
        assert item["fim"] == g["fim"], g
        assert item["atual"] is g["atual"], g
        # Ou tem fim, ou é atual, ou diz que o fim não foi informado.
        assert item["fim"] or item["atual"] or item.get("fim_nao_informado") is True
    fundacao = itens["2020-03-10"]  # "atuou como Médica desde 10/03/2020" e nada mais
    assert fundacao["fim_nao_informado"] is True and fundacao["dias"] == 0


def test_atual_conta_ate_a_emissao_da_propria_declaracao(varias):
    resultado, _ = varias
    itens = _por_inicio(resultado["itens"])
    assert itens["2022-08-24"]["dias_ate"] == "2026-10-10"  # "Exemplópolis, 10 de outubro de 2026"
    assert itens["2022-08-24"]["dias_ate_fonte"] == "EMISSAO"
    assert itens["2024-09-01"]["dias_ate"] == "2026-09-28"  # "Vila Exemplo - EX, 28 de setembro de 2026"
    assert itens["2021-04-05"]["dias_ate"] == "2026-10-01"  # "1º de outubro de 2026"


def test_carga_so_quando_ligada_a_horas_semanais(varias):
    resultado, gabarito = varias
    itens = _por_inicio(resultado["itens"])
    for g in gabarito:
        assert itens[g["inicio"]]["carga_semanal"] == g["carga"], g
    # Sem carga declarada: nada de herdar o "20 horas semanais" da outra declaração, nem o 60 do treinamento,
    # nem o 26 da data/endereço.
    assert itens["2020-03-10"]["carga_semanal"] is None
    assert itens["2020-03-10"]["carga_nao_encontrada"] is True
    # "plantões de 12 horas": plantonista, sem carga semanal.
    sesi = itens["2024-09-01"]
    assert sesi["plantonista"] is True and sesi["plantao_horas"] == 12 and sesi["carga_semanal"] is None
    assert not sesi.get("carga_nao_encontrada")


def test_cnpj_do_emissor_vai_para_o_vinculo(varias):
    resultado, gabarito = varias
    itens = _por_inicio(resultado["itens"])
    for g in gabarito:
        if g["inicio"] in ("2024-09-01", "2020-03-10", "2021-04-05"):  # frase, rodapé, só CNPJ
            assert itens[g["inicio"]]["cnpj"] == g["cnpj"]
    assert itens["2021-04-05"]["empregador"] == f"CNPJ {s.cnpj_ficticio(36741852)}"


def test_nada_de_cpf_nem_nome_da_pessoa_nos_itens(varias):
    resultado, _ = varias
    texto = str(resultado["itens"]) + str(resultado["alertas"]) + resultado["resumo"]
    assert s.CPF_FICTICIO not in texto and "12345678909" not in texto
    assert "MARIA" not in texto.upper()


def test_declaracao_de_duas_paginas_e_uma_secao_so():
    conteudo, _ = s.declaracoes_de_vinculo([s.DECLARACOES[4]])
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        from monitora.avaliacao_documental.leitura_de_arquivos.layout import palavras_do_pdfplumber

        paginas = [
            Pagina(i, p.extract_text(), "TEXTO", palavras=palavras_do_pdfplumber(p), tamanho=(p.width, p.height))
            for i, p in enumerate(pdf.pages, start=1)
        ]
    grupos = secoes(paginas)
    assert len(grupos) == 1 and len(grupos[0].paginas) == 2
    assert grupos[0].emissor.fonte == "TIMBRE"
    item = vinculos(paginas, hoje=HOJE)[0]
    assert item["empregador"] == "CLÍNICA SÃO LUCAS DE EXEMPLO LTDA"
    assert (item["inicio"], item["fim"], item["carga_semanal"]) == ("2018-10-01", "2021-03-26", 30)


# ── emissor sem posição (DOCX/TXT) e pelas frases ───────────────────────────


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        (
            "PREFEITURA MUNICIPAL DE EXEMPLO\nSecretaria de Saúde\nDECLARAÇÃO\nDeclaramos que a servidora exerce o "
            "cargo de Enfermeira desde 01/02/2019.",
            "PREFEITURA MUNICIPAL DE EXEMPLO",
        ),
        (
            "DECLARAÇÃO\nDeclaro para os devidos fins que a profissional foi contratada pela Clínica Boa Saúde "
            "Exemplo Ltda, para exercer a função de Enfermeira, no período de 01/02/2019 a 30/06/2021.",
            "Clínica Boa Saúde Exemplo Ltda",
        ),
        (
            "DECLARAÇÃO\nDeclaramos que a profissional trabalhou no Hospital Santa Exemplo, como Técnica de "
            "Enfermagem, de 01/02/2019 até 30/06/2021.",
            "Hospital Santa Exemplo",
        ),
        (
            "CERTIDÃO DE TEMPO DE SERVIÇO - Fundação Exemplo\nprestou serviços de 01/01/2019 a 31/12/2020.",
            "Fundação Exemplo",
        ),
    ],
)
def test_emissor_pelo_texto(texto, esperado):
    assert emissor_da_pagina(Pagina(1, texto, "TEXTO")).empregador == esperado
    item = vinculos([Pagina(1, texto, "TEXTO")], hoje=HOJE)[0]
    assert item["empregador"] == esperado


def test_rotulo_empregador_do_formulario_vale_antes_do_emissor():
    texto = (
        "RH TERCEIRIZADO EXEMPLO LTDA\nDECLARAÇÃO DE VÍNCULO\nEmpregador: HOSPITAL MUNICIPAL DE EXEMPLO\n"
        "Cargo: Enfermeiro\nData de admissão: 01/03/2020\nDesligamento: 31/12/2022"
    )
    item = vinculos([Pagina(1, texto, "TEXTO")], hoje=HOJE)[0]
    assert item["empregador"] == "HOSPITAL MUNICIPAL DE EXEMPLO"
    assert item["fim"] == "2022-12-31"


# ── fim ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("frase", "fim", "atual"),
    [
        ("exerce desde 01/02/2019 até a presente data o cargo de Enfermeira", None, True),
        ("atua como Enfermeira desde 01/02/2019", None, True),
        ("foi admitida em 01/02/2019 e encontra-se em exercício", None, True),
        ("ingressou em 01/02/2019, permanecendo no quadro", None, True),
        ("trabalhou no período de 01/02/2019 a 30/06/2021", "2021-06-30", False),
        ("trabalhou de 01/02/2019 até 30/06/2021", "2021-06-30", False),
        ("foi admitida em 01/02/2019, tendo sido desligada em 30/06/2021", "2021-06-30", False),
        ("atuou como Enfermeira desde 01/02/2019", None, False),
    ],
)
def test_fim_da_declaracao(frase, fim, atual):
    texto = f"HOSPITAL EXEMPLO LTDA\nDECLARAÇÃO\nDeclaramos que a profissional {frase}.\nExemplópolis, 10/10/2026"
    item = vinculos([Pagina(1, texto, "TEXTO")], hoje=HOJE)[0]
    assert (item["inicio"], item["fim"], item["atual"]) == ("2019-02-01", fim, atual)
    assert bool(item.get("fim_nao_informado")) is (fim is None and not atual)


def test_vinculo_que_comeca_depois_da_emissao_e_descartado_com_alerta_leve():
    linhas = [
        "HOSPITAL EXEMPLO LTDA",
        "DECLARAÇÃO",
        "Declaramos que a profissional trabalha nesta instituição desde 01/02/2019 até a presente data e,",
        "na unidade de Vila Exemplo, desde 01/12/2026.",
        "Exemplópolis, 10 de outubro de 2026",
    ]
    r = ler_documento("\n".join(linhas).encode(), "VINCULOS", hoje=HOJE, ocr=None)
    assert [i["inicio"] for i in r["itens"]] == ["2019-02-01"]
    assert "DATA_APOS_EMISSAO" in [a["codigo"] for a in r["alertas"]]


# ── carga ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("texto", "horas", "plantao"),
    [
        ("com carga horária de 20 horas semanais", 20, None),
        ("cumprindo 30h/semana", 30, None),
        ("com 40 horas por semana", 40, None),
        ("carga horária semanal de 36 horas", 36, None),
        ("Carga horária: 44 horas", 44, None),
        ("jornada de 40 horas", 40, None),
        ("jornada de 6 horas diárias", 30, None),
        ("24 h semanais", 24, None),
        ("em regime de plantões de 12 horas", None, 12),
        ("curso com carga horária total de 360 horas", None, None),
        ("carga horária de 120 horas", None, None),
        ("residente na Rua 26 de Agosto, CEP 26.000-000, desde 26/08/2020", None, None),
        ("treinamento de 26 horas", None, None),
    ],
)
def test_carga_declarada(texto, horas, plantao):
    carga = carga_declarada(dobrar(texto))
    if horas is None and plantao is None:
        assert carga is None
    else:
        assert (carga.horas, carga.plantao) == (horas, plantao)


def test_mesma_captura_de_carga_em_emissores_diferentes_vira_null():
    a = {"_carga": ("s", 120), "_emissor": "hospitala", "carga_semanal": 26}
    b = {"_carga": ("s", 120), "_emissor": "clinicab", "carga_semanal": 26}
    c = {"_carga": ("t", 80), "_emissor": "clinicab", "carga_semanal": 20}
    _carga_capturada_duas_vezes([a, b, c])
    assert (a["carga_semanal"], b["carga_semanal"], c["carga_semanal"]) == (None, None, 20)


# ── datas por extenso e OCR ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("1º de setembro de 2026", date(2026, 9, 1)),
        ("1° de agosto de 2022", date(2022, 8, 1)),
        ("10 de seternbro de 2026", date(2026, 9, 10)),
        ("5 de outubr0 de 2026", date(2026, 10, 5)),
        ("3 de rnarço de 2021", date(2021, 3, 3)),
        ("8 de abri1 de 2018", date(2018, 4, 8)),
        ("2 de jutho de 2020", None),  # junho ou julho? não chuta
        ("5 de casa de 2020", None),
    ],
)
def test_datas_por_extenso_com_mes_estragado(texto, esperado):
    datas = datas_no_texto(dobrar(texto))
    assert (datas[0].primeiro_dia() if datas else None) == esperado


def test_mes_parecido():
    assert mes_parecido("dezernbro") == 12
    assert mes_parecido("fevereir") == 2
    assert mes_parecido("xyzw") is None


def _ocr_falso_das_paginas(conteudo):
    """Um OCR de mentira: devolve, página a página, o texto do PDF original com os erros típicos do OCR (mês com
    "rn" por "m", "0" por "o", "°" por "º") e as palavras com a posição (sem o tamanho da página, como no OCR)."""
    trocas = (("setembro", "seternbro"), ("outubro", "outubr0"), ("abril", "abri1"), ("º", "°"))
    paginas = []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for p in pdf.pages:
            texto = p.extract_text()
            palavras = []
            for w in p.extract_words():
                t = w["text"]
                for de, para in trocas:
                    t = t.replace(de, para)
                palavras.append(Palavra(t, w["x0"], w["x1"], w["top"], w["bottom"]))
            for de, para in trocas:
                texto = texto.replace(de, para)
            paginas.append(("~ ° |\n" + texto, 0.62, palavras))
    fila = list(paginas)
    return lambda _imagem: fila.pop(0)


def test_declaracoes_escaneadas_com_ocr_ruidoso():
    original, gabarito = s.declaracoes_de_vinculo()
    escaneado, _ = s.declaracoes_como_foto()
    r = ler_documento(escaneado, "VINCULOS", NOME, hoje=HOJE, ocr=_ocr_falso_das_paginas(original))
    assert r["metodo"] == "OCR"
    itens = _por_inicio(r["itens"])
    for g in gabarito:
        item = itens[g["inicio"]]
        assert _normal(item["empregador"]) == _normal(g["empregador"]), g
        assert (item["fim"], item["atual"], item["carga_semanal"]) == (g["fim"], g["atual"], g["carga"]), g
    # "1° de setembro de 2024" e "28 de seternbro de 2026" (o local e data) saem certos.
    assert itens["2024-09-01"]["dias_ate"] == "2026-09-28"


@pytest.mark.skipif(not TEM_TESSERACT, reason="Tesseract não instalado (o workflow do robô instala)")
def test_declaracoes_escaneadas_com_tesseract():
    escaneado, gabarito = s.declaracoes_como_foto()
    r = ler_documento(escaneado, "VINCULOS", NOME, hoje=HOJE)
    itens = _por_inicio(r["itens"])
    casados = [(g, itens[g["inicio"]]) for g in gabarito if g["inicio"] in itens]
    assert len(casados) >= 4
    assert sum(_normal(i["empregador"]).startswith(_normal(g["empregador"])[:12]) for g, i in casados) >= 3
    assert sum((i["fim"], i["atual"]) == (g["fim"], g["atual"]) for g, i in casados) >= 3


def test_palavra_solta_depois_de_empresa_nao_vira_empregador():
    texto = (
        "HOSPITAL EXEMPLO LTDA\nDECLARAÇÃO\nDeclaramos que a profissional foi admitida nesta empresa em 01/10/2018 "
        "como Técnica de Enfermagem, com jornada de 6 horas diárias, permanecendo até a presente data.\n"
        "Exemplópolis, 10 de outubro de 2026"
    )
    item = vinculos([Pagina(1, texto, "TEXTO")], hoje=HOJE)[0]
    assert item["empregador"] == "HOSPITAL EXEMPLO LTDA"
    assert (item["atual"], item["carga_semanal"], item["dias_ate"]) == (True, 30, "2026-10-10")


# ── limpeza do empregador (extrator 2026.10.7: o caso do médico relido) ──────


@pytest.fixture(scope="module")
def caso_do_medico():
    conteudo, gabarito = s.declaracoes_de_vinculo(s.CASO_DO_MEDICO)
    return ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None), gabarito


def test_caso_do_medico_sem_duplicado_nem_lixo(caso_do_medico):
    resultado, gabarito = caso_do_medico
    assert len(resultado["itens"]) == len(gabarito) == 3
    itens = _por_inicio(resultado["itens"])
    for g in gabarito:
        item = itens[g["inicio"]]
        assert item["empregador"] == g["empregador"], g
        assert (item["fim"], item["atual"], item["carga_semanal"]) == (g["fim"], g["atual"], g["carga"]), g


def test_timbre_ilegivel_fica_com_a_razao_social_do_mesmo_cnpj(caso_do_medico):
    resultado, _ = caso_do_medico
    item = _por_inicio(resultado["itens"])["2022-08-24"]
    # O timbre "Cariaira cle |DX" é recusado; o CNPJ da filial (rodapé) tem a raiz do da capa, que tem o nome.
    assert item["empregador"] == "CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO"
    assert item["cnpj"] == s.cnpj_ficticio(44719486, 54)
    # "26 (vinte) horas semanais": vale o extenso.
    assert item["carga_semanal"] == 20


def test_pagina_ilegivel_repetindo_o_vinculo_nao_vira_outro(caso_do_medico):
    resultado, _ = caso_do_medico
    assert [i["inicio"] for i in resultado["itens"]].count("2024-09-02") == 1
    assert all(i["empregador"] for i in resultado["itens"])


@pytest.mark.parametrize(
    "lixo",
    ["Cariaira cle |DX", "Ae ras Wnt", "~ HSPTL ~", "ll |l ESCOLA", "Bnrst Qwd"],
)
def test_lixo_de_ocr_nao_e_empregador(lixo):
    assert parece_lixo(lixo) or nome_de_instituicao(lixo) is None
    assert nome_de_instituicao(lixo) is None


@pytest.mark.parametrize(
    ("bruto", "limpo"),
    [
        (
            "O Serviço Social da Indústria — SESI, Departamento Regional de Exemplo — Empresa Privada",
            "Serviço Social da Indústria — SESI, Departamento Regional de Exemplo",
        ),
        (
            "serviço em medicina do trabalho, como médico examinador, nesta empresa, GR CLINICA MEDICA",
            "GR CLINICA MEDICA",
        ),
        ("A CLÍNICA EXEMPLO LTDA, pessoa jurídica de direito privado", "CLÍNICA EXEMPLO LTDA"),
        ("HOSPITAL MUNICIPAL DE EXEMPLO - CNPJ 11.222.333/0001-81", "HOSPITAL MUNICIPAL DE EXEMPLO"),
        ("CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO", "CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DE EXEMPLO"),
    ],
)
def test_nome_sem_artigo_preambulo_nem_qualificador(bruto, limpo):
    assert nome_de_instituicao(bruto) == limpo


def test_nome_com_no_maximo_80_caracteres():
    longo = "FUNDAÇÃO DE SAÚDE EXEMPLO, Unidade Hospitalar Regional, Departamento de Medicina do Trabalho, Setor Norte"
    assert len(limpar_nome(longo)) <= 80
    assert limpar_nome(longo).startswith("FUNDAÇÃO DE SAÚDE EXEMPLO")


def test_vinculo_repetido_sem_empregador_de_outro_cargo_nao_e_juntado():
    texto_a = "HOSPITAL EXEMPLO LTDA\nDECLARAÇÃO\nDeclaramos que a profissional exerce o cargo de Enfermeira desde 01/02/2019."
    texto_b = "DECLARAÇÃO\nDeclaramos que a profissional exerce o cargo de Motorista desde 01/02/2019."
    itens = vinculos([Pagina(1, texto_a, "TEXTO"), Pagina(2, texto_b, "TEXTO")], hoje=HOJE)
    assert len(itens) == 2


@pytest.mark.parametrize(
    ("texto", "valor"),
    [("vinte", 20), ("vinte e quatro", 24), ("quarenta e quatro", 44), ("doze", 12), ("vinte e trinta", None)],
)
def test_numero_por_extenso(texto, valor):
    assert numero_por_extenso(texto) == valor


def test_carga_com_extenso_vale_o_extenso():
    assert carga_declarada(dobrar("carga horária de 26 (vinte) horas semanais")).horas == 20
    assert carga_declarada(dobrar("40 (quarenta) horas semanais")).horas == 40


# ── ficha de registro com férias (extrator 2026.10.8) ───────────────────────

FICHA_DO_SESI = next(d for d in s.CASO_DO_MEDICO if d.get("linhas"))


def test_caso_do_medico_com_ficha_de_ferias_fica_com_tres_vinculos(caso_do_medico):
    resultado, _ = caso_do_medico
    assert len(resultado["itens"]) == 3
    assert not any("Estabelecimento" in (i["empregador"] or "") for i in resultado["itens"])
    # Nada de período aquisitivo/gozo de férias, afastamento ou reajuste virando vínculo.
    inicios = {i["inicio"] for i in resultado["itens"]}
    assert not inicios & {"2025-11-06", "2025-01-10", "2025-10-01", "2025-04-01", "2025-05-01"}


def test_ficha_de_registro_sozinha_e_um_vinculo_so():
    conteudo, _ = s.declaracoes_de_vinculo([FICHA_DO_SESI])
    r = ler_documento(conteudo, "VINCULOS", NOME, hoje=HOJE, ocr=None)
    assert len(r["itens"]) == 1
    item = r["itens"][0]
    assert (item["empregador"], item["inicio"], item["carga_semanal"]) == (
        "SERVIÇO SOCIAL DA INDÚSTRIA — SESI",
        "2024-09-02",
        10,
    )


def test_mascara_ferias_afastamentos_e_lotacao_sem_mudar_as_posicoes():
    texto = "\n".join(
        [
            "Cargo: Enfermeira",
            "Data de admissão: 01/02/2019",
            "FÉRIAS",
            "Início      Fim       Dias",
            "01/02/2020  02/03/2020  30",
            "Afastamentos",
            "10/01/2021 a 20/01/2021",
            "Estabelecimento definido para HOSPITAL EXEMPLO",
            "Declaramos que exerceu de 01/02/2019 a 30/06/2022, sem afastamentos.",
        ]
    )
    mascarado = mascarar_ignorados(texto)
    assert len(mascarado) == len(texto)
    assert "01/02/2020" not in mascarado and "10/01/2021" not in mascarado and "Estabelecimento" not in mascarado
    assert "Data de admissão: 01/02/2019" in mascarado
    assert "exerceu de 01/02/2019 a 30/06/2022, sem afastamentos" in mascarado


def test_periodo_sem_cargo_nem_verbo_de_vinculo_nao_e_vinculo():
    texto = "HOSPITAL EXEMPLO LTDA\nRELATÓRIO\nReferência: 01/02/2020 a 29/02/2020.\nExemplópolis, 10/10/2026"
    assert vinculos([Pagina(1, texto, "TEXTO")], hoje=HOJE) == []


def test_mesmo_empregador_em_duas_paginas_com_o_mesmo_inicio_vira_um():
    a = "SERVIÇO SOCIAL DA INDÚSTRIA — SESI\nFICHA\nCargo: Médico do Trabalho\nData de admissão: 24/08/2022"
    b = (
        "SERVIÇO SOCIAL DA INDÚSTRIA — SESI, DEPARTAMENTO REGIONAL DE EXEMPLO\nDECLARAÇÃO\nDeclaramos que a "
        "profissional exerce o cargo de Médico desde 24/08/2022 até a presente data.\nExemplópolis, 12/02/2026"
    )
    itens = vinculos([Pagina(1, a, "TEXTO"), Pagina(2, b, "TEXTO")], hoje=HOJE)
    assert len(itens) == 1
    assert itens[0]["atual"] is True and itens[0]["dias_ate"] == "2026-02-12"


def test_sem_empregador_dentro_de_outro_vinculo_compativel_sai():
    a = (
        "HOSPITAL EXEMPLO LTDA\nDECLARAÇÃO\nDeclaramos que a profissional exerce o cargo de Médica do Trabalho "
        "desde 01/02/2019 até a presente data.\nExemplópolis, 10/10/2026"
    )
    b = "DECLARAÇÃO\nDeclaramos que exerceu o cargo de Médica do Trabalho no período de 01/04/2025 a 02/04/2026."
    c = "DECLARAÇÃO\nDeclaramos que exerceu o cargo de Motorista no período de 01/04/2025 a 02/04/2026."
    itens = vinculos([Pagina(1, a, "TEXTO"), Pagina(2, b, "TEXTO"), Pagina(3, c, "TEXTO")], hoje=HOJE)
    assert [(i["inicio"], i["cargo"]) for i in itens] == [
        ("2019-02-01", "Médica do Trabalho"),
        ("2025-04-01", "Motorista"),
    ]
