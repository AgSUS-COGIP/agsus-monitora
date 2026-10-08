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
    atribuicoes = caso.get("atribuicoes")
    if caso.get("aspectos"):
        # Por competência, uma lista de notas por avaliador, na ordem dos aspectos
        # (a posição é o avaliador; None = sem nota dele).
        avaliacoes = [
            {
                "competencia": competencia,
                "avaliador": f"a{i + 1}",
                "aspectos": [{"aspecto": a["id"], "nota": n} for a, n in zip(roteiro["aspectos"], notas, strict=True)],
            }
            for competencia, por_avaliador in caso["aspectos"].items()
            for i, notas in enumerate(por_avaliador)
            if notas is not None
        ]
        return roteiro, caso["compareceu"], avaliacoes, atribuicoes
    avaliacoes = [
        {"competencia": competencia, "avaliador": f"a{i + 1}", "nota": nota}
        for competencia, notas in caso["notas"].items()
        for i, nota in enumerate(notas)
        if nota is not None
    ]
    return roteiro, caso["compareceu"], avaliacoes, atribuicoes


def _dec(valor):
    return None if valor is None else Decimal(str(valor))


class CasosDouradosDoCalculo(unittest.TestCase):
    def test_cada_caso_da_o_mesmo_resultado_do_javascript_e_do_banco(self):
        self.assertGreaterEqual(len(DADOS["casos"]), 10)
        self.assertGreaterEqual(len([c for c in DADOS["casos"] if c.get("aspectos")]), 3)
        self.assertGreaterEqual(len([c for c in DADOS["casos"] if c.get("atribuicoes")]), 3)
        for caso in DADOS["casos"]:
            with self.subTest(caso["nome"]):
                r = calculo.calcular_entrevista(*_entrada(caso))
                esperado = caso["esperado"]
                self.assertEqual([c["nota"] for c in r["competencias"]], [_dec(n) for n in esperado["notas"]])
                self.assertEqual(r["total"], _dec(esperado["total"]))
                self.assertEqual(r["parecer"], esperado["parecer"])


class AvaliadorPorCompetencia(unittest.TestCase):
    def test_lista_sem_competencia_do_roteiro_conta_como_todas(self):
        roteiro = DADOS["roteiros"]["niveis"]
        avaliacoes = [
            {"competencia": c, "avaliador": a, "nota": 3} for c in ("c1", "c2", "c3", "c4") for a in ("a1", "a2")
        ]
        avaliacoes[0]["nota"] = 5  # c1 de a1
        r = calculo.calcular_entrevista(roteiro, "S", avaliacoes, {"a2": ["outro-roteiro"]})
        self.assertEqual(r["competencias"][0]["nota"], Decimal(4))
        r = calculo.calcular_entrevista(roteiro, "S", avaliacoes, {"a2": ["c2"]})
        self.assertEqual(r["competencias"][0]["nota"], Decimal(5))
        self.assertEqual(r["competencias"][0]["quantidade"], 1)


class Aspectos(unittest.TestCase):
    def test_media_dos_aspectos_so_com_todos(self):
        aspectos = [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}]
        self.assertEqual(
            calculo.media_dos_aspectos(
                aspectos, [{"aspecto": "s1", "nota": 2}, {"aspecto": "s2", "nota": 2}, {"aspecto": "s3", "nota": 3}]
            ),
            Decimal(7) / Decimal(3),
        )
        self.assertIsNone(calculo.media_dos_aspectos(aspectos, [{"aspecto": "s1", "nota": 2}]))
        self.assertIsNone(calculo.media_dos_aspectos([], []))


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
