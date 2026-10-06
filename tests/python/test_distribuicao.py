"""
Distribuição das fichas em Python (python/monitora/avaliacao_documental/distribuicao.py):
os MESMOS casos dourados do vitest —
tests/fixtures/avaliacao-documental/casos-de-distribuicao.json
(tests/lib/avaliacao-documental-distribuicao.test.js). Nada fala com o Supabase.
"""

import json
import pathlib
import unittest

from monitora.avaliacao_documental import distribuicao as d

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "avaliacao-documental"
CASOS = json.loads((_FIXTURES / "casos-de-distribuicao.json").read_text(encoding="utf-8"))["casos"]


class CasosDouradosDaDistribuicao(unittest.TestCase):
    def test_cada_caso_da_o_mesmo_resultado_do_javascript(self):
        for caso in CASOS:
            with self.subTest(caso["nome"]):
                e = caso["entrada"]
                r = d.distribuir_fichas(e["fichas"], e["analistas"], e["criterio"], e["limite_por_analista"])
                self.assertEqual(r, caso["esperado"])

    def test_300_fichas_3_analistas(self):
        fichas = [{"id": f"f{i}", "vaga": "10"} for i in range(300)]
        analistas = [{"usuario": u, "vagas": None, "limite": None, "pendentes": 0} for u in "abc"]
        self.assertEqual(d.distribuir_fichas(fichas, analistas)["por_analista"], {"a": 100, "b": 100, "c": 100})


class AtribuicoesDosNovos(unittest.TestCase):
    BASE = {
        "modo": "DISTRIBUICAO_INICIAL",
        "novos": "MENOS_PENDENTES",
        "criterio": "PARTES_IGUAIS",
        "limite_por_analista": None,
        "distribuicao_iniciada": True,
        "analistas": [
            {"usuario": "a", "vagas": None, "limite": None, "pendentes": 4},
            {"usuario": "b", "vagas": None, "limite": None, "pendentes": 1},
        ],
        "a_abrir": [{"candidato": "c1", "vaga": "10"}, {"candidato": "c2", "vaga": "10"}],
    }

    def test_vai_para_quem_tem_menos_pendentes(self):
        self.assertEqual(
            d.atribuicoes_dos_novos(self.BASE),
            [{"candidato": "c1", "usuario": "b"}, {"candidato": "c2", "usuario": "b"}],
        )

    def test_nada_antes_da_distribuicao_ou_em_pegar_proximo(self):
        self.assertEqual(d.atribuicoes_dos_novos({**self.BASE, "distribuicao_iniciada": False}), [])
        self.assertEqual(d.atribuicoes_dos_novos({**self.BASE, "modo": "PEGAR_PROXIMO"}), [])
        self.assertEqual(d.atribuicoes_dos_novos({**self.BASE, "novos": "PEGAR_PROXIMO"}), [])
        self.assertEqual(d.atribuicoes_dos_novos(None), [])


if __name__ == "__main__":
    unittest.main()
