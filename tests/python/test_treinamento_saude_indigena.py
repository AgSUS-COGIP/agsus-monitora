"""
Edital de treinamento da Saúde Indígena (991/2099): a pré-classificação que a migration
20261009120000 grava é a que o Python calcula (o mesmo processar_edital do job) sobre os
30 fictícios com a regra do Edital 111/2026 (SI26-PARINTINS) —
tests/fixtures/avaliacao-documental/treinamento-saude-indigena.json.
Mudou o cálculo, a regra ou os fictícios? Rode
scripts/pre_classificacao/gerar_treinamento.py --area saude-indigena e recrie a função
numa migration nova. Nada fala com o Supabase.

    python -m pytest tests/python
"""

import json
import pathlib
import re
import sys
import unittest
from collections import Counter

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))

import gerar_treinamento as gerador  # noqa: E402

AREA = "saude-indigena"
CFG = gerador.AREAS[AREA]
FIXTURE = json.loads(CFG["fixture"].read_text(encoding="utf-8"))
MIGRATION = CFG["migration"].read_text(encoding="utf-8")


def linhas():
    return {linha["codigo"]: linha for vaga in FIXTURE["resultado"]["vagas"].values() for linha in vaga["linhas"]}


class TestPreClassificacaoDoTreinamentoSI(unittest.TestCase):
    def test_o_python_da_o_resultado_guardado(self):
        self.assertEqual(gerador.calcular(FIXTURE["entrada"]), FIXTURE["resultado"])

    def test_a_migration_grava_o_mesmo_resultado(self):
        self.assertEqual(gerador.bloco_da_migration(MIGRATION, AREA), FIXTURE["resultado"])

    def test_os_blocos_das_duas_areas_nao_se_confundem(self):
        self.assertNotIn("-- pre-classificacao-do-treinamento:inicio", MIGRATION)
        with self.assertRaises(ValueError):
            gerador.bloco_da_migration(MIGRATION, "projetos")

    def test_a_regra_e_a_do_111_conferida(self):
        regra = FIXTURE["entrada"]["edital"]["regra"]
        self.assertEqual(regra["situacao"], "CONFERIDA")
        self.assertEqual(regra["configuracao"]["modelo"], "SI26-PARINTINS")
        self.assertEqual(regra["configuracao"]["edital_rotulo"], "Edital 991/2099 (TREINAMENTO)")
        self.assertEqual(regra["configuracao"]["lote"]["base"], "MULTIPLO_VAGAS")
        # As perguntas ligadas aos blocos casam com os enunciados do questionário da migration.
        blocos = {b["codigo"]: b for b in regra["configuracao"]["blocos"]}
        for codigo in ("IDENTIDADE", "ESCOLARIDADE", "ETNICO", "FORMACAO", "EXPERIENCIA", "COTA_PP", "COTA_PCD"):
            self.assertTrue(blocos[codigo]["perguntas"], codigo)
            for pergunta in blocos[codigo]["perguntas"]:
                self.assertIn(pergunta, MIGRATION, pergunta)

    def test_contagens(self):
        r = FIXTURE["resultado"]["edital"]
        self.assertEqual(
            (r["vagas"], r["inscritos"], r["eliminados"], r["ranqueados"], r["no_lote"], r["base_da_nota"]),
            (3, 30, 4, 26, 24, "ART"),
        )
        self.assertEqual(
            Counter(linha["situacao"] for linha in linhas().values()), {"NO_LOTE": 24, "ELIMINADO": 4, "RANQUEADO": 2}
        )
        tamanhos = {v: d["resumo"]["tamanho"] for v, d in FIXTURE["resultado"]["vagas"].items()}
        self.assertEqual(tamanhos, {"9909910001": 15, "9909910002": 20, "9909910003": 10})

    def test_os_casos(self):
        ls = linhas()
        # Eliminação automática: cancelado, questionário pendente/em andamento, reprovado na Empregare.
        self.assertEqual(ls["TREINO-17"]["motivo_codigo"], "CANCELADO")
        self.assertEqual(ls["TREINO-19"]["motivo_codigo"], "QUESTIONARIO")
        self.assertEqual(ls["TREINO-15"]["motivo_codigo"], "QUESTIONARIO")
        self.assertEqual(ls["TREINO-27"]["motivo_codigo"], "REPROVADO_EMPREGARE")
        # Abaixo da linha de corte do lote (AIS: 5 × 2 vagas).
        self.assertEqual((ls["TREINO-25"]["situacao"], ls["TREINO-26"]["situacao"]), ("RANQUEADO", "RANQUEADO"))
        # Indígena com aldeia no topo (14 + formação + experiência); a modalidade declarada.
        self.assertEqual((ls["TREINO-21"]["posicao"], ls["TREINO-21"]["nota"]), (1, 28))
        self.assertEqual(
            {c: ls[c]["modalidade"] for c in ("TREINO-16", "TREINO-18", "TREINO-28", "TREINO-21", "TREINO-23")},
            {"TREINO-16": "PP", "TREINO-18": "PCD", "TREINO-28": "PQ", "TREINO-21": "PI", "TREINO-23": "AC"},
        )
        # Empate (8,4): o mais velho na frente.
        self.assertEqual(ls["TREINO-28"]["nota"], ls["TREINO-30"]["nota"])
        self.assertLess(ls["TREINO-30"]["posicao"], ls["TREINO-28"]["posicao"])

    def test_os_15_de_antes_continuam_iguais(self):
        # As respostas dos 15 primeiros (os da entrevista) não mudaram: mesma ART de antes.
        art = {
            "TREINO-01": 1,
            "TREINO-03": 15.2,
            "TREINO-06": 10,
            "TREINO-08": 15.6,
            "TREINO-12": 22.4,
            "TREINO-14": 21.4,
        }
        ls = linhas()
        self.assertEqual({c: ls[c]["art"] for c in art}, art)

    def test_so_ficticios(self):
        texto = json.dumps(FIXTURE, ensure_ascii=False)
        for c in (c for v in FIXTURE["entrada"]["candidatos"].values() for c in v["candidatos"]):
            self.assertRegex(c["codigo"], r"^TREINO-[0-9]{2}$")
        cpfs = set(re.findall(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", texto + MIGRATION))
        self.assertLessEqual(cpfs, {"000.000.000-00"})
        emails = set(re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", texto))
        self.assertTrue(all(e.endswith("@exemplo.invalid") for e in emails), emails)


if __name__ == "__main__":
    unittest.main()
