"""
Testes de api/anexos-do-edital.py (só as funções puras; não precisa de PDF).

    python -m unittest discover -s tests/python
"""

import importlib.util
import pathlib
import unittest
from datetime import date

_ARQUIVO = pathlib.Path(__file__).resolve().parents[2] / "api" / "anexos-do-edital.py"
_spec = importlib.util.spec_from_file_location("anexos_do_edital", _ARQUIVO)
ax = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ax)


class Periodo(unittest.TestCase):
    def test_formatos_do_anexo_i(self):
        self.assertEqual(ax.ler_periodo("29/09"), ((29, 9, None), (29, 9, None)))
        self.assertEqual(ax.ler_periodo("30/09 a 02/10"), ((30, 9, None), (2, 10, None)))
        self.assertEqual(ax.ler_periodo("07 a 11/10"), ((7, 10, None), (11, 10, None)))
        self.assertEqual(ax.ler_periodo("24 e 25/10"), ((24, 10, None), (25, 10, None)))
        self.assertEqual(ax.ler_periodo("17/09/2026 a 19/09/2026"), ((17, 9, "2026"), (19, 9, "2026")))
        self.assertIsNone(ax.ler_periodo("A definir"))

    def test_ano_vira_em_janeiro(self):
        datas = ax.datas_com_ano(
            [ax.ler_periodo("15/12"), ax.ler_periodo("28/12 a 05/01"), ax.ler_periodo("20/01")],
            2026,
        )
        self.assertEqual(datas[0], (date(2026, 12, 15), date(2026, 12, 15)))
        self.assertEqual(datas[1], (date(2026, 12, 28), date(2027, 1, 5)))
        self.assertEqual(datas[2], (date(2027, 1, 20), date(2027, 1, 20)))

    def test_data_impossivel(self):
        self.assertEqual(ax.datas_com_ano([ax.ler_periodo("31/02")], 2026), [None])

    def test_29_de_fevereiro_na_virada_nao_derruba_o_cronograma(self):
        datas = ax.datas_com_ano([ax.ler_periodo("10/12"), ax.ler_periodo("29/02"), ax.ler_periodo("10/03")], 2028)
        self.assertEqual(datas[0], (date(2028, 12, 10), date(2028, 12, 10)))
        self.assertIsNone(datas[1])


class Cronograma(unittest.TestCase):
    def test_tabela_do_anexo_i(self):
        tabelas = [
            [
                ["Atividades", "Datas prováveis"],
                ["Publicação do Edital", "29/09"],
                ["Prazo de recurso referente ao resultado\nde Títulos", "24 e 25/10"],
                ["Resultado final", "A definir"],
            ]
        ]
        etapas = ax.extrair_cronograma(tabelas, 2026)
        self.assertEqual(len(etapas), 3)
        self.assertEqual(etapas[0]["data_inicio"], "2026-09-29")
        self.assertEqual(etapas[1]["atividade"], "Prazo de recurso referente ao resultado de Títulos")
        self.assertEqual((etapas[1]["data_inicio"], etapas[1]["data_fim"]), ("2026-10-24", "2026-10-25"))
        self.assertEqual(etapas[2]["data_inicio"], "")


class Quadro(unittest.TestCase):
    CABECALHO = [
        "Vagas",
        "Lotação",
        "Ampla\nConcorrência",
        "PcD",
        "Pretos e\nPardos",
        "Indígenas",
        "Quilombolas",
        "Total",
    ]

    def test_cargo_vale_para_as_lotacoes_e_continua_na_pagina_seguinte(self):
        tabelas = [
            [
                self.CABECALHO,
                ["Enfermeiro", "Polo Base\nDiauarum", "1", "CR", "CR", "CR", "CR", "1+CR"],
                [None, "Polo Base\nPavuru", "CR", "CR", "CR", "CR", "CR", "CR"],
            ],
            [
                [None, "Sede do\nDSEI", "2", "CR", "1", "CR", "CR", "3 + CR"],
                ["CR=Cadastro Reserva", None, None, None, None, None, None, None],
            ],
        ]
        vagas, modalidades = ax.extrair_quadro(tabelas)
        self.assertEqual(modalidades, ["Ampla Concorrência", "PcD", "Pretos e Pardos", "Indígenas", "Quilombolas"])
        self.assertEqual([v["lotacao"] for v in vagas], ["Polo Base Diauarum", "Polo Base Pavuru", "Sede do DSEI"])
        self.assertTrue(all(v["cargo"] == "Enfermeiro" for v in vagas))
        self.assertEqual([v["vagas_imediatas"] for v in vagas], [1, 0, 3])
        self.assertEqual(vagas[2]["modalidades"]["Pretos e Pardos"], 1)
        self.assertIsNone(vagas[1]["modalidades"]["Ampla Concorrência"])
        self.assertTrue(all(v["cadastro_reserva"] for v in vagas))

    def test_sem_lotacao(self):
        tabelas = [
            [
                ["Vagas", "Ampla\nConcorrência", "PcD", "Pretos e\nPardos", "Indígenas", "Quilombolas", "Total"],
                ["Técnico De\nEnfermagem", "1", "CR", "1", "CR", "CR", "2 + CR"],
            ]
        ]
        vagas, _ = ax.extrair_quadro(tabelas)
        self.assertEqual(vagas[0]["cargo"], "Técnico De Enfermagem")
        self.assertEqual(vagas[0]["lotacao"], "")
        self.assertEqual(vagas[0]["vagas_imediatas"], 2)

    def test_formato_de_projetos(self):
        tabelas = [
            [
                ["EDITAL DE PROCESSO SELETIVO SIMPLIFICADO Nº 93/2026", None, None, None],
                ["VAGA", "QUANTIDADE DE\nVAGAS", "REQUISITOS", "ATRIBUIÇÕES"],
                [
                    "TÉCNICO DE\nSEGURANÇA\nDO TRABALHO\n(Nível Médio)",
                    "06",
                    "Requisitos Obrigatórios:",
                    "Atribuições: …",
                ],
                [None, None, "● Registro", None],
            ]
        ]
        vagas, modalidades = ax.extrair_quadro(tabelas)
        self.assertEqual(modalidades, [])
        self.assertEqual(len(vagas), 1)
        self.assertEqual(vagas[0]["cargo"], "TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)")
        self.assertEqual(vagas[0]["vagas_imediatas"], 6)
        self.assertFalse(vagas[0]["cadastro_reserva"])


class Identificacao(unittest.TestCase):
    def test_titulo_do_anexo(self):
        self.assertEqual(
            ax.identificar("ANEXO I CRONOGRAMA DO PROCESSO SELETIVO - EDITAL Nº 117/2026 - DSEI XINGU\nAtividades"),
            ("117/2026", "DSEI XINGU", 2026),
        )
        self.assertEqual(ax.identificar("EDITAL N° 93/2026\nVAGA")[0:2], ("93/2026", ""))


if __name__ == "__main__":
    unittest.main()
