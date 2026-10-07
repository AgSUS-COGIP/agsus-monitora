"""
Edital de treinamento de Projetos (992/2099): a pré-classificação que a migration
20261008110000 grava é a que o Python calcula (o mesmo processar_edital do job)
sobre os 40 fictícios — tests/fixtures/avaliacao-documental/treinamento-projetos.json.
Mudou o cálculo, a regra ou os fictícios? Rode scripts/pre_classificacao/gerar_treinamento.py
e recrie a função numa migration nova. Nada fala com o Supabase.

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

FIXTURE = json.loads(gerador.FIXTURE.read_text(encoding="utf-8"))
MIGRATION = gerador.MIGRATION.read_text(encoding="utf-8")


def linhas():
    return {linha["codigo"]: linha for vaga in FIXTURE["resultado"]["vagas"].values() for linha in vaga["linhas"]}


class TestPreClassificacaoDoTreinamento(unittest.TestCase):
    def test_o_python_da_o_resultado_guardado(self):
        self.assertEqual(gerador.calcular(FIXTURE["entrada"]), FIXTURE["resultado"])

    def test_a_migration_grava_o_mesmo_resultado(self):
        self.assertEqual(gerador.bloco_da_migration(MIGRATION), FIXTURE["resultado"])

    def test_a_regra_da_entrada_e_a_copiada_na_migration(self):
        trecho = MIGRATION.split("$regra93$")[1]
        self.assertEqual(json.loads(trecho), FIXTURE["entrada"]["edital"]["regra"]["configuracao"])
        self.assertEqual(FIXTURE["entrada"]["edital"]["regra"]["situacao"], "CONFERIDA")

    def test_contagens(self):
        r = FIXTURE["resultado"]["edital"]
        self.assertEqual(
            (r["vagas"], r["inscritos"], r["eliminados"], r["ranqueados"], r["no_lote"], r["divergencias"]),
            (5, 40, 11, 29, 21, 2),
        )
        self.assertEqual(
            Counter(linha["situacao"] for linha in linhas().values()), {"NO_LOTE": 21, "ELIMINADO": 11, "RANQUEADO": 8}
        )

    def test_os_casos_reais(self):
        ls = linhas()
        self.assertEqual((ls["TREINO-P07"]["situacao"], ls["TREINO-P07"]["nota"]), ("NO_LOTE", 15))
        self.assertEqual((ls["TREINO-P31"]["situacao"], ls["TREINO-P31"]["nota"]), ("NO_LOTE", 15))
        self.assertEqual((ls["TREINO-P36"]["situacao"], ls["TREINO-P36"]["nota"]), ("RANQUEADO", 14))
        # ART alterada depois: vale a declarada e a divergência aparece.
        self.assertEqual(
            (ls["TREINO-P04"]["art"], ls["TREINO-P04"]["nota"], ls["TREINO-P04"]["divergente"]), (30, 20, True)
        )
        self.assertEqual(
            (ls["TREINO-P20"]["art"], ls["TREINO-P20"]["nota"], ls["TREINO-P20"]["divergente"]), (15, 20, True)
        )
        # Resposta fora do mapa: a nota vem da ART.
        self.assertEqual((ls["TREINO-P21"]["origem_nota"], ls["TREINO-P21"]["nota"]), ("ART", 22))
        # O Critério CORES fica eliminado (a coordenação inclui pela tela).
        self.assertEqual((ls["TREINO-P08"]["motivo_codigo"], ls["TREINO-P08"]["declarada"]), ("QUESTIONARIO", 38))
        self.assertEqual(ls["TREINO-P06"]["motivo_codigo"], "CANCELADO")
        # Empates: idoso, maior idade, experiência declarada.
        self.assertLess(ls["TREINO-P12"]["posicao"], ls["TREINO-P11"]["posicao"])
        self.assertLess(ls["TREINO-P40"]["posicao"], ls["TREINO-P33"]["posicao"])
        self.assertLess(ls["TREINO-P34"]["posicao"], ls["TREINO-P35"]["posicao"])

    def test_so_ficticios(self):
        texto = json.dumps(FIXTURE, ensure_ascii=False)
        for c in (c for v in FIXTURE["entrada"]["candidatos"].values() for c in v["candidatos"]):
            self.assertRegex(c["codigo"], r"^TREINO-P[0-9]{2}$")
        # Nenhum CPF (só o 000.000.000-00 da pergunta) e nenhum e-mail fora de @exemplo.invalid.
        cpfs = set(re.findall(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", texto + MIGRATION))
        self.assertLessEqual(cpfs, {"000.000.000-00"})
        emails = set(re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", texto))
        self.assertTrue(all(e.endswith("@exemplo.invalid") for e in emails), emails)


if __name__ == "__main__":
    unittest.main()
