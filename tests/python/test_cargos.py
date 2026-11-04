"""
Tabela de cargos (20261104150000): a normalização em Python × banco, a carga da migration × a
planilha, as regras do casamento, a correção dos apelidos e a inclusão do cargo 88 (PSICOLOGO).

    python -m pytest tests/python/test_cargos.py
"""

import csv
import json
import pathlib
import re
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


MIGRATION = _ler("supabase/migrations/20261104150000_tabela_de_cargos.sql")
CORRECAO = _ler("supabase/correcoes/20261104-apelidos-de-cargo.sql")
ENSAIO_CORRECAO = _ler("supabase/ensaios/20261104-apelidos-de-cargo.sql")
PSICOLOGO = _ler("supabase/correcoes/20261104-cargo-psicologo.sql")
ENSAIO_PSICOLOGO = _ler("supabase/ensaios/20261104-cargo-psicologo.sql")
CASOS_NORMALIZACAO = json.loads(_ler("tests/fixtures/cargos/normalizacao.json"))["casos"]
CATALOGO = ler_catalogo()


class Normalizacao(unittest.TestCase):
    def test_igual_ao_banco(self):
        for caso in CASOS_NORMALIZACAO:
            self.assertEqual(normalizar(caso["entrada"]), caso["banco"], caso["entrada"])

    def test_mesma_tabela_do_translate_da_migration(self):
        self.assertIn(f"translate(p_texto, {literal_sql(DE)}, {literal_sql(PARA)})", MIGRATION)
        self.assertEqual(len(DE), len(set(DE)))
        self.assertGreater(len(DE), len(PARA))

    def test_nulo_e_vazio(self):
        self.assertIsNone(normalizar(None))
        self.assertIsNone(normalizar(" - . "))

    def test_literal_sql_sem_invisivel(self):
        self.assertEqual(literal_sql("D'ÁGUA"), "'D''ÁGUA'")
        self.assertEqual(literal_sql("A" + chr(0x200B)), "E'A" + chr(92) + "u200b'")
        self.assertTrue(all(c.isprintable() or c == "\n" for c in MIGRATION))


class CargaDaMigration(unittest.TestCase):
    def test_os_91_da_migration_e_o_88_da_correcao(self):
        with open(_RAIZ / "python/monitora/cargos/cargos_si_sip.csv", encoding="utf-8", newline="") as f:
            planilha = [(int(r["CODIGO"]), r["NOME"], r["SINTETICO"]) for r in csv.DictReader(f, delimiter=";")]
        na_migration = [
            (int(c), n.replace("''", "'"), s)
            for c, n, s in re.findall(r"^    \((\d+), '((?:[^']|'')*)', '([SN])'\)", MIGRATION, re.M)
        ]
        # A planilha exportada não trazia PSICOLOGO (SIP 88): a migration (já aplicada) tem 91, e
        # a correção 20261104-cargo-psicologo.sql inclui o 88.
        self.assertIn("values (88, 88, 'PSICOLOGO', 'saude-indigena', 'N', auth.uid(), auth.uid());", PSICOLOGO)
        self.assertEqual(sorted(na_migration + [(88, "PSICOLOGO", "N")]), planilha)
        self.assertEqual(len(planilha), 92)
        self.assertEqual([c for c, _, s in planilha if s == "S"], [9994, 9995, 9996, 9997, 9999])
        self.assertEqual(len(CATALOGO.cargos), 92)


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
        ("MEDICO DE FAMILIA E COMUNIDADE", SEM, None, None),
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


class CorrecaoGravada(unittest.TestCase):
    """O arquivo da correção (gerado pela prévia) bate com as regras de hoje."""

    def setUp(self):
        self.valores = [
            (g.replace("''", "'"), int(c), r, float(v))
            for g, c, r, v in re.findall(r"^  \('((?:[^']|'')*)', (\d+), '([A-Z]+)', ([\d.]+)\)", CORRECAO, re.M)
        ]

    def test_contagem_e_assinatura(self):
        esperado = int(re.search(r"v_esperado integer := (\d+);", CORRECAO).group(1))
        self.assertEqual(len(self.valores), esperado)
        self.assertGreater(esperado, 1000)
        self.assertIn(f'"sub":"{CONTA_DO_SETOR}"', CORRECAO)
        self.assertIn("ST_ADMIN_GLOBAL", CORRECAO)
        self.assertTrue(CORRECAO.rstrip().endswith("commit;"))

    def test_cada_apelido_casa_com_alta_pelo_python(self):
        codigos = {c.codigo for c in CATALOGO.cargos}
        for grafia, codigo, regra, confianca in self.valores:
            self.assertEqual(normalizar(grafia), grafia)
            self.assertIn(codigo, codigos)
            c = casar(grafia, CATALOGO)
            self.assertEqual((c.nivel, c.codigo, c.regra, c.confianca), (ALTA, codigo, regra, confianca), grafia)
            self.assertNotEqual(regra, "EXATA")

    def test_ensaio_tem_migration_e_correcao_e_desfaz(self):
        corpo = MIGRATION[MIGRATION.index("\nbegin;\n") + 8 : MIGRATION.index("\nnotify pgrst")].strip()
        correcao = CORRECAO[CORRECAO.index("-- >>> correcao\n") + 16 : CORRECAO.index("\n-- <<< correcao")]
        self.assertIn(corpo, ENSAIO_CORRECAO)
        self.assertIn(correcao, ENSAIO_CORRECAO)
        self.assertTrue(ENSAIO_CORRECAO.rstrip().endswith("rollback;"))
        self.assertIsNone(re.search(r"^\s*commit\s*;", ENSAIO_CORRECAO, re.M | re.I))


class CorrecaoDoPsicologo(unittest.TestCase):
    """20261104-cargo-psicologo.sql: o cargo 88 e só apelidos novos dele, de alta confiança."""

    def setUp(self):
        self.valores = [
            (g.replace("''", "'"), int(c), r, float(v))
            for g, c, r, v in re.findall(r"^  \('((?:[^']|'')*)', (\d+), '([A-Z]+)', ([\d.]+)\)", PSICOLOGO, re.M)
        ]
        self.antigos = {g.replace("''", "'") for g in re.findall(r"^  \('((?:[^']|'')*)', \d+, ", CORRECAO, re.M)}

    def test_contagem_assinatura_e_so_novos(self):
        esperado = int(re.search(r"v_esperado integer := (\d+);", PSICOLOGO).group(1))
        self.assertEqual(len(self.valores), esperado)
        self.assertGreater(esperado, 100)
        self.assertIn(f'"sub":"{CONTA_DO_SETOR}"', PSICOLOGO)
        self.assertIn("O cargo 88 já está em TD_CARGO.", PSICOLOGO)
        self.assertFalse(self.antigos & {g for g, *_ in self.valores})
        self.assertTrue(PSICOLOGO.rstrip().endswith("commit;"))

    def test_cada_apelido_e_do_88_com_alta(self):
        for grafia, codigo, regra, confianca in self.valores:
            self.assertEqual(normalizar(grafia), grafia)
            self.assertEqual(codigo, 88)
            c = casar(grafia, CATALOGO)
            self.assertEqual((c.nivel, c.codigo, c.regra, c.confianca), (ALTA, 88, regra, confianca), grafia)

    def test_ensaio_responde_pelo_raise_e_desfaz(self):
        inicio = PSICOLOGO.index("-- >>> correcao") + len("-- >>> correcao") + 1
        correcao = PSICOLOGO[inicio : PSICOLOGO.index("-- <<< correcao") - 1]
        self.assertIn(correcao, ENSAIO_PSICOLOGO)
        self.assertIn("raise exception 'ENSAIO_OK %'", ENSAIO_PSICOLOGO)
        self.assertTrue(ENSAIO_PSICOLOGO.rstrip().endswith("rollback;"))
        self.assertIsNone(re.search(r"^\s*commit\s*;", ENSAIO_PSICOLOGO, re.M | re.I))


if __name__ == "__main__":
    unittest.main()
