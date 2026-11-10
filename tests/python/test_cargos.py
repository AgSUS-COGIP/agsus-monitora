"""
Tabela de cargos (20261104150000): a normalização em Python × banco, a carga da migration × a
planilha, as regras do casamento, a correção dos apelidos e a inclusão do cargo 88 (PSICOLOGO).

    python -m pytest tests/python/test_cargos.py
"""

import json
import pathlib
import unittest

from monitora.cargos.casamento import ALTA, MEDIA, SEM, casar, ler_catalogo
from monitora.cargos.normalizacao import DE, PARA, normalizar
from monitora.cargos.previa import (
    AREA_SI,
    CONTA_DO_SETOR,
    agrupar,
    apelidos_da_correcao,
    casar_todas,
    resumo,
    sql_da_correcao,
)
from monitora.cargos.sql import literal_sql

_RAIZ = pathlib.Path(__file__).resolve().parents[2]


def _ler(caminho):
    return (_RAIZ / caminho).read_text(encoding="utf-8").replace("\r\n", "\n")


CASOS_NORMALIZACAO = json.loads(_ler("tests/fixtures/cargos/normalizacao.json"))["casos"]
CATALOGO = ler_catalogo()


class Normalizacao(unittest.TestCase):
    def test_igual_ao_banco(self):
        for caso in CASOS_NORMALIZACAO:
            self.assertEqual(normalizar(caso["entrada"]), caso["banco"], caso["entrada"])

    def test_tabela_do_translate(self):
        self.assertEqual(len(DE), len(set(DE)))
        self.assertGreater(len(DE), len(PARA))

    def test_nulo_e_vazio(self):
        self.assertIsNone(normalizar(None))
        self.assertIsNone(normalizar(" - . "))

    def test_literal_sql_sem_invisivel(self):
        self.assertEqual(literal_sql("D'ÁGUA"), "'D''ÁGUA'")
        self.assertEqual(literal_sql("A" + chr(0x200B)), "E'A" + chr(92) + "u200b'")


class Casamento(unittest.TestCase):
    CASOS = [
        ("ENFERMEIRO", ALTA, 63, "EXATA"),
        ("ENFERMEIRA", ALTA, 63, "LIMPEZA"),
        ("ENFERMEIRO (A)", ALTA, 63, "LIMPEZA"),
        ("TECNICO(A) DE ENFERMAGEM", ALTA, 95, "LIMPEZA"),
        ("TECNICA DE ENFERMAGEM - DSEI YANOMAMI - 73 VAGAS (48 AC + CR)", ALTA, 95, "PREFIXO"),
        ("TECNICO EM ENFERMAGEM", ALTA, 95, "SINONIMO"),
        ("TECNICO DE SAUDE BUCAL (TSB)", ALTA, 100, "SINONIMO"),
        ("AISAN", ALTA, 22, "SINONIMO"),
        ("TECNICO EM NUTRICAO DIETETICA", ALTA, 99, "CONECTIVOS"),
        ("AGENTE DE COMBATE AS ENDEMIAS -DSEI ALTAMIRA - 2 VAGAS", ALTA, 26, "PREFIXO"),
        ("ASSISTENTE SOCIAL 30H - DSEI YANOMAMI - CADASTRO RESERVA", ALTA, 47, "PREFIXO"),
        ("ASSISTENTE ADMINISTRATIVO - EXCLUSIVA PARA PPIQ", ALTA, 45, "LIMPEZA"),
        ("CARGO 9: TECNICO DE LABORATORIO (NIVEL TECNICO)", ALTA, 96, "LIMPEZA"),
        ("ANALISTA TECNICO - DADOS - SEDE", ALTA, 33, "PREFIXO"),
        ("BIOQUIMICA", ALTA, 54, "LIMPEZA"),
        ("PSICOLOGO", ALTA, 88, "EXATA"),
        ("PSICOLOGA - DSEI XAVANTE - 3 VAGAS", ALTA, 88, "PREFIXO"),
        ("MOTORISTA", SEM, None, None),
        # Médico e dentista distinguem 20H/40H.
        ("MEDICO 40H", ALTA, 74, "EXATA"),
        ("MEDICO (20H) - CADASTRO RESERVA", ALTA, 73, "LIMPEZA"),
        ("MEDICA - 40 HORAS SEMANAIS - DSEI XINGU", ALTA, 74, "PREFIXO"),
        ("CIRURGIAO-DENTISTA ( 40H)", ALTA, 58, "LIMPEZA"),
        ("ODONTOLOGO 20H - DSEI XINGU", ALTA, 57, "PREFIXO"),
        ("MEDICO - DSEI XINGU", SEM, None, None),
        ("CIRURGIAO DENTISTA - DSEI XAVANTE - 2 VAGAS", SEM, None, None),
        ("MEDICO 30H", SEM, None, None),
        # Ambíguo ou fora da planilha: no máximo sugestão.
        ("ANALISTA ADMINISTRATIVO - DSEI YANOMAMI", MEDIA, 104, "PREFIXO"),
        ("ANALISTA TECNICO - DSEI X", MEDIA, 9999, "PREFIXO"),
        ("APOIADOR TECNICO EM SAUDE INDIGENA", MEDIA, 39, "CONTIDO"),
        ("MONITOR DE AGUA E SANEAMENTO - SEDE", MEDIA, 82, "SIMILARIDADE"),
        ("MEDICO DE FAMILIA E COMUNIDADE", ALTA, 76, "SINONIMO"),
        ("MEDICO DE FAMILIA E COMUNIDADE (MFC) - TELETRABALHO - 20H - AMPLA CONCORRENCIA", ALTA, 76, "PREFIXO"),
        ("MEDICO ESPECIALISTA - MFC", ALTA, 76, "EXATA"),
        # Nome anterior continua casando com o cargo renomeado.
        ("TECNICO DE ENFERMAGEM", ALTA, 95, "EXATA"),
        ("TECNICO EM ENFERMAGEM 40H", ALTA, 95, "EXATA"),
        ("ASSISTENTE SOCIAL", ALTA, 47, "EXATA"),
        ("AUXILIAR DE GESTAO - AGSUS - AUXILIAR DE GESTAO", SEM, None, None),
        ("176158", SEM, None, None),
    ]

    def test_regras(self):
        for grafia, nivel, codigo, regra in self.CASOS:
            c = casar(normalizar(grafia), CATALOGO)
            self.assertEqual((c.nivel, c.codigo, c.regra), (nivel, codigo, regra), grafia)
            if nivel == ALTA:
                self.assertGreaterEqual(c.confianca, 0.9)
            if nivel == MEDIA:
                self.assertLess(c.confianca, 0.9)

    def test_falta_carga_horaria_e_observada(self):
        c = casar(normalizar("Cirurgião Dentista - DSEI Xingu"), CATALOGO)
        self.assertEqual(c.observacao, "FALTA_CARGA_HORARIA")

    def test_vazio(self):
        self.assertEqual(casar(None, CATALOGO).nivel, SEM)


LINHAS = [
    {"grafia": "Enfermeiro (a)", "tabela": "TB_CANDIDATO_APROVADO", "area": AREA_SI, "ocorrencias": 300},
    {"grafia": "ENFERMEIRO (A) ", "tabela": "TB_ENTREVISTA", "area": AREA_SI, "ocorrencias": 2},
    {"grafia": "Enfermeiro", "tabela": "TB_ENTREVISTA", "area": AREA_SI, "ocorrencias": 50},
    {
        "grafia": "Assistente Administrativo - PCD",
        "tabela": "TB_CANDIDATO_APROVADO",
        "area": "projetos",
        "ocorrencias": 9,
    },
    {"grafia": "Motorista", "tabela": "TB_CANDIDATO_APROVADO", "area": AREA_SI, "ocorrencias": 20},
    {"grafia": "Analista Administrativo - DSEI X", "tabela": "TB_SELECAO_VAGA", "area": AREA_SI, "ocorrencias": 3},
    {"grafia": "", "tabela": "TB_SELECAO_VAGA", "area": AREA_SI, "ocorrencias": 7},
]


class Previa(unittest.TestCase):
    def setUp(self):
        self.grupos = casar_todas(agrupar(LINHAS), CATALOGO)

    def test_agrupa_pela_grafia_normalizada(self):
        g = self.grupos[0]
        self.assertEqual((g.grafia, g.ocorrencias, len(g.originais)), ("ENFERMEIRO (A)", 302, 2))
        self.assertEqual(dict(g.tabelas), {"TB_CANDIDATO_APROVADO": 300, "TB_ENTREVISTA": 2})
        self.assertEqual(len(self.grupos), 5)

    def test_resumo(self):
        r = resumo(self.grupos)
        self.assertEqual(r["geral"]["total"]["ocorrencias"], 384)
        self.assertEqual(r["geral"]["niveis"][ALTA]["ocorrencias"], 361)
        self.assertEqual(r[AREA_SI]["total"]["ocorrencias"], 375)
        self.assertEqual(r[AREA_SI]["niveis"][ALTA]["ocorrencias"], 352)
        self.assertEqual(r[AREA_SI]["niveis"][MEDIA]["ocorrencias"], 3)
        self.assertEqual(r[AREA_SI]["niveis"][SEM]["ocorrencias"], 20)

    def test_correcao_so_alta_da_si_e_sem_exata(self):
        self.assertEqual([g.grafia for g in apelidos_da_correcao(self.grupos)], ["ENFERMEIRO (A)"])
        sql = sql_da_correcao(self.grupos)
        self.assertIn("  ('ENFERMEIRO (A)', 63, 'LIMPEZA', 0.980)", sql)
        self.assertIn("v_esperado integer := 1;", sql)
        self.assertIn(CONTA_DO_SETOR, sql)
