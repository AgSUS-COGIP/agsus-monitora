"""Regressoes do importador: tabelas de continuacao e referencia do ano."""

import importlib.util
from datetime import date
from pathlib import Path

import pytest

_ARQUIVO = Path(__file__).resolve().parents[2] / "api" / "anexos-do-edital.py"
_SPEC = importlib.util.spec_from_file_location("anexos_cronograma_regressao", _ARQUIVO)
ax = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(ax)


@pytest.mark.parametrize("cabecalho_repetido", [False, True])
def test_preserva_continuacao_em_outra_tabela(cabecalho_repetido):
    cabecalho = ["Atividades", "Datas provaveis"]
    segunda = [["Resultado", "10/11"]]
    if cabecalho_repetido:
        segunda.insert(0, cabecalho)
    etapas = ax.extrair_cronograma(
        [[cabecalho, ["Inscricoes", "01/11 a 05/11"]], segunda],
        2026,
    )
    assert [e["atividade"] for e in etapas] == ["Inscricoes", "Resultado"]
    assert etapas[1]["data_inicio"] == "2026-11-10"


def test_continuacao_sem_cabecalho_preserva_data_invalida_e_prazo_a_definir():
    etapas = ax.extrair_cronograma(
        [
            [["Atividades", "Datas"], ["Inscricoes", "01/02"]],
            [["Resultado", "31/02"], ["Homologacao", "A definir"]],
        ],
        2026,
    )
    assert len(etapas) == 3
    assert [e["data_inicio"] for e in etapas] == ["2026-02-01", "", ""]


def test_continuacao_pode_comecar_com_prazo_a_definir():
    etapas = ax.extrair_cronograma(
        [
            [["Atividades", "Datas"], ["Inscricoes", "01/11"]],
            [["Resultado", "A definir"], ["Homologacao", "10/11"]],
        ],
        2026,
    )
    assert len(etapas) == 3
    assert etapas[1]["data_inicio"] == ""
    assert etapas[2]["data_inicio"] == "2026-11-10"


@pytest.mark.parametrize("mesma_tabela", [False, True])
def test_quadro_de_vagas_nao_vira_etapa(mesma_tabela):
    cronograma = [["Atividades", "Datas"], ["Inscricoes", "01/11"]]
    quadro = [["Vagas", "Total"], ["Enfermeiro", "2"]]
    tabelas = [cronograma + quadro] if mesma_tabela else [cronograma, quadro]
    etapas = ax.extrair_cronograma(tabelas, 2026)
    assert [e["atividade"] for e in etapas] == ["Inscricoes"]
    vagas, _ = ax.extrair_quadro(tabelas)
    assert len(vagas) == 1
    assert vagas[0]["vagas_imediatas"] == 2


def test_tabela_de_requisitos_nao_e_continuacao():
    etapas = ax.extrair_cronograma(
        [
            [["Atividades", "Datas"], ["Inscricoes", "01/11"]],
            [["Cargo", "Requisitos"], ["Enfermeiro", "Curso superior"]],
            [["Documento", "10/11"]],
        ],
        2026,
    )
    assert [e["atividade"] for e in etapas] == ["Inscricoes"]


def test_tabela_com_largura_diferente_nao_e_continuacao():
    etapas = ax.extrair_cronograma(
        [
            [["Atividades", "Datas"], ["Inscricoes", "01/11"]],
            [["Documento", "Descricao", "10/11"]],
        ],
        2026,
    )
    assert len(etapas) == 1


@pytest.mark.parametrize("ano_explicito", ["2027", "27"])
def test_ano_explicito_atualiza_a_referencia(ano_explicito):
    datas = ax.datas_com_ano(
        [ax.ler_periodo(f"20/12/{ano_explicito}"), ax.ler_periodo("05/01"), ax.ler_periodo("10/01")],
        2026,
    )
    assert datas == [
        (date(2027, 12, 20), date(2027, 12, 20)),
        (date(2028, 1, 5), date(2028, 1, 5)),
        (date(2028, 1, 10), date(2028, 1, 10)),
    ]


def test_ano_explicito_sem_virada():
    datas = ax.datas_com_ano([ax.ler_periodo("20/11/2027"), ax.ler_periodo("25/11")], 2026)
    assert datas[1] == (date(2027, 11, 25), date(2027, 11, 25))


def test_virada_comum_permanece_correta():
    datas = ax.datas_com_ano([ax.ler_periodo("28/12 a 05/01"), ax.ler_periodo("10/01")], 2026)
    assert datas == [
        (date(2026, 12, 28), date(2027, 1, 5)),
        (date(2027, 1, 10), date(2027, 1, 10)),
    ]


def test_valida_bissexto_depois_da_virada():
    datas = ax.datas_com_ano([ax.ler_periodo("20/12/2027"), ax.ler_periodo("29/02")], 2026)
    assert datas[1] == (date(2028, 2, 29), date(2028, 2, 29))


def test_nao_bissexto_continua_invalido():
    datas = ax.datas_com_ano(
        [ax.ler_periodo("20/12/2028"), ax.ler_periodo("29/02"), ax.ler_periodo("10/03")],
        2026,
    )
    assert datas[1] is None
    assert datas[2] == (date(2029, 3, 10), date(2029, 3, 10))


def test_periodo_invalido_nao_contamina_o_ano_seguinte():
    datas = ax.datas_com_ano(
        [ax.ler_periodo("01/11/2027 a 31/02/2028"), ax.ler_periodo("05/01")],
        2026,
    )
    assert datas == [None, (date(2026, 1, 5), date(2026, 1, 5))]


def test_ano_explicito_nunca_e_substituido_pela_inferencia():
    datas = ax.datas_com_ano([ax.ler_periodo("20/12/2027"), ax.ler_periodo("05/01/2026")], 2026)
    assert datas[1] == (date(2026, 1, 5), date(2026, 1, 5))


def test_retificacao_reutiliza_o_ano_corrigido():
    etapas = ax.etapas_da_retificacao(
        [("Inscricoes", "20/12/2027", False), ("Resultado", "05/01", True)],
        2026,
    )
    assert etapas[1]["data_inicio"] == "2028-01-05"
    assert etapas[1]["negrito"] is True
