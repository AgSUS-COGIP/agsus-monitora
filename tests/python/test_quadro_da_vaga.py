"""
A cópia em Python de private."FC_TOKENS_VAGA" e private."FC_QUADRO_DA_VAGA"
(python/monitora/classificacao/quadro_da_vaga.py) contra as saídas do banco guardadas em
tests/fixtures/quadro-da-vaga/casos-do-banco.json. A paridade com as vagas reais é conferida no
ensaio de 20261103181500 (seção PARIDADE, scripts/conferencias/paridade_do_quadro.py).

    python -m pytest tests/python/test_quadro_da_vaga.py
"""

import json
import pathlib
import unittest

from monitora.classificacao.quadro_da_vaga import preparar_quadros, quadro_da_vaga, tokens_da_vaga

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
CASOS = json.loads((_RAIZ / "tests/fixtures/quadro-da-vaga/casos-do-banco.json").read_text(encoding="utf-8"))
EDITAL = "edital-ficticio"


class Tokens(unittest.TestCase):
    def test_iguais_aos_do_banco(self):
        for texto, esperado in CASOS["tokens"].items():
            with self.subTest(texto=texto):
                self.assertEqual(tokens_da_vaga(texto), frozenset(esperado))

    def test_nulo_e_vazio(self):
        self.assertEqual(tokens_da_vaga(None), frozenset())


class Quadro(unittest.TestCase):
    def test_iguais_aos_do_banco(self):
        quadros = preparar_quadros([{**q, "edital": EDITAL} for q in CASOS["quadros"]])
        for nome, esperado in CASOS["casos"]:
            with self.subTest(nome=nome):
                self.assertEqual(quadro_da_vaga(quadros[EDITAL], nome), esperado)

    def test_edital_sem_quadro(self):
        self.assertIsNone(quadro_da_vaga(None, "Enfermeiro"))
        self.assertIsNone(quadro_da_vaga([], "Enfermeiro"))


if __name__ == "__main__":
    unittest.main()
