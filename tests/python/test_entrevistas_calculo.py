"""
Cálculo da entrevista em Python (python/monitora/entrevistas/calculo.py): os MESMOS
casos dourados do vitest — tests/fixtures/entrevistas/casos-de-calculo.json
(tests/entrevistas-calculo-dourado.test.js). Nada fala com o Supabase.
"""

import json
import pathlib
import unittest
from decimal import Decimal

from monitora.entrevistas import calculo

_FIXTURE = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "entrevistas" / "casos-de-calculo.json"
DADOS = json.loads(_FIXTURE.read_text(encoding="utf-8"))


def _entrada(caso):
    roteiro = dict(DADOS["roteiros"][caso["roteiro"]])
    if "nota_minima_total" in caso:
        roteiro["nota_minima_total"] = caso["nota_minima_total"]
    avaliacoes = [
        {"competencia": competencia, "avaliador": f"a{i + 1}", "nota": nota}
        for competencia, notas in caso["notas"].items()
        for i, nota in enumerate(notas)
    ]
    return roteiro, caso["compareceu"], avaliacoes


def _dec(valor):
    return None if valor is None else Decimal(str(valor))


class CasosDouradosDoCalculo(unittest.TestCase):
    def test_cada_caso_da_o_mesmo_resultado_do_javascript_e_do_banco(self):
        self.assertGreaterEqual(len(DADOS["casos"]), 10)
        for caso in DADOS["casos"]:
            with self.subTest(caso["nome"]):
                r = calculo.calcular_entrevista(*_entrada(caso))
                esperado = caso["esperado"]
                self.assertEqual([c["nota"] for c in r["competencias"]], [_dec(n) for n in esperado["notas"]])
                self.assertEqual(r["total"], _dec(esperado["total"]))
                self.assertEqual(r["parecer"], esperado["parecer"])


class Numeros(unittest.TestCase):
    def test_le_numero_da_planilha_e_da_tela(self):
        self.assertEqual(calculo.numero("1,5"), Decimal("1.5"))
        self.assertEqual(calculo.numero("1.234,5"), Decimal("1234.5"))
        self.assertEqual(calculo.numero(2), Decimal(2))
        self.assertIsNone(calculo.numero(""))
        self.assertIsNone(calculo.numero("abc"))
        self.assertIsNone(calculo.numero(True))

    def test_arredonda_meio_para_cima_como_o_numeric(self):
        self.assertEqual(calculo.arredondar(Decimal("2.335")), Decimal("2.34"))
        self.assertEqual(calculo.arredondar(Decimal("4.375")), Decimal("4.38"))
        self.assertEqual(calculo.arredondar(Decimal("-0.125")), Decimal("-0.13"))

    def test_minimo_percentual_sem_arredondar(self):
        c = {"minimo": 10.84, "tipo_minimo": "PERCENTUAL", "nota_maxima": 10, "peso": 1}
        self.assertEqual(calculo.minimo_em_pontos(c), Decimal("1.084"))
        self.assertEqual(calculo.minimo_em_pontos({"minimo": 2}), Decimal(2))
        self.assertIsNone(calculo.minimo_em_pontos({}))


if __name__ == "__main__":
    unittest.main()
