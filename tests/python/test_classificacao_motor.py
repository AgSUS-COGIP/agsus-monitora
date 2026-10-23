"""
A classificação em Python (python/monitora/classificacao/) dá a MESMA saída do
motor da tela (src/lib/classificacao/motor.ts) nos casos dourados de
tests/fixtures/classificacao/casos-do-motor.json — gerados pelo motor.ts
(scripts/classificacao/gerar-casos-do-motor.mjs) e conferidos também pelo
vitest (tests/lib/classificacao-casos-do-motor.test.js). Dados fictícios;
nada fala com o Supabase.
"""

import json
import math
import pathlib
import unittest

from monitora.classificacao import motor
from monitora.classificacao.numeros import arredondar, dias_de_vida, escalar, formatar_nota, idade_na_data, numero_br
from monitora.classificacao.semantica_js import comparar_base, comparar_numerico, formatar_pt_br

_FIXTURE = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "classificacao" / "casos-do-motor.json"
DADOS = json.loads(_FIXTURE.read_text(encoding="utf-8"))


def _diferencas(esperado, obtido, caminho="", saida=None, limite=15):
    """As primeiras diferenças entre dois json (números com a tolerância do JS: 3 == 3.0)."""
    saida = [] if saida is None else saida
    if len(saida) >= limite:
        return saida
    if isinstance(esperado, dict) and isinstance(obtido, dict):
        for chave in sorted(set(esperado) | set(obtido)):
            if chave not in obtido:
                saida.append(f"{caminho}.{chave}: falta no Python")
            elif chave not in esperado:
                saida.append(f"{caminho}.{chave}: sobra no Python")
            else:
                _diferencas(esperado[chave], obtido[chave], f"{caminho}.{chave}", saida, limite)
    elif isinstance(esperado, list) and isinstance(obtido, list):
        if len(esperado) != len(obtido):
            saida.append(f"{caminho}: {len(esperado)} itens no motor.ts × {len(obtido)} no Python")
        for i, (a, b) in enumerate(zip(esperado, obtido, strict=False)):
            _diferencas(a, b, f"{caminho}[{i}]", saida, limite)
    elif isinstance(esperado, bool) or isinstance(obtido, bool):
        if esperado is not obtido:
            saida.append(f"{caminho}: {esperado!r} × {obtido!r}")
    elif isinstance(esperado, int | float) and isinstance(obtido, int | float):
        if not math.isclose(esperado, obtido, rel_tol=0, abs_tol=0):
            saida.append(f"{caminho}: {esperado!r} × {obtido!r}")
    elif esperado != obtido:
        saida.append(f"{caminho}: {esperado!r} × {obtido!r}")
    return saida


def _json(valor):
    return json.loads(json.dumps(valor, ensure_ascii=False))


class CasosDouradosDoMotor(unittest.TestCase):
    def test_os_casos_cobrem_as_quatro_listas_e_os_cinco_editais(self):
        self.assertEqual(len(DADOS["casos"]), 20)
        self.assertEqual({c["tipo"] for c in DADOS["casos"]}, {"PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL"})

    def test_python_da_a_mesma_saida_do_motor_da_tela(self):
        for caso in DADOS["casos"]:
            with self.subTest(caso=caso["nome"]):
                entrada = {"tipo": caso["tipo"], **DADOS["editais"][caso["edital"]]}
                obtido = _json(motor.classificar(entrada))
                diferencas = _diferencas(caso["saida"], obtido)
                self.assertEqual(diferencas, [], "\n".join(diferencas))


class SemanticaDoJs(unittest.TestCase):
    def test_numeros_como_o_motor(self):
        self.assertEqual(numero_br("1.234,5"), 1234.5)
        self.assertEqual(numero_br("12,5"), 12.5)
        self.assertIsNone(numero_br("12,5,3"))
        self.assertIsNone(numero_br(True))
        self.assertEqual(arredondar(1.005, 2), 1.01)
        self.assertEqual(arredondar(52.009, 2, "TRUNCAR"), 52.0)
        self.assertEqual(escalar(52.005, 2), 5201)

    def test_formatacao_pt_br_do_intl(self):
        self.assertEqual(formatar_nota(1.005, 2), "1,01")
        self.assertEqual(formatar_nota(2.5, 0), "3")
        self.assertEqual(formatar_nota(-0.001, 2), "-0,00")
        self.assertEqual(formatar_nota(None), "—")
        self.assertEqual(formatar_pt_br(1234, 0, agrupar=True), "1.234")

    def test_29_de_fevereiro(self):
        self.assertEqual(idade_na_data("1964-02-29", "2024-02-28"), 59)
        self.assertEqual(idade_na_data("1964-02-29", "2024-02-29"), 60)
        self.assertIsNone(idade_na_data("1965-02-29", "2024-02-29"))
        self.assertEqual(dias_de_vida("2024-02-28", "2024-03-01"), 2)

    def test_ordem_alfabetica_do_pt_br(self):
        nomes = ["b", "a b", "a-b", "ab", "a'b", "A", "á", "a", "Ab", "a.b", "a1", "a10", "a2"]
        import functools

        ordem = sorted(nomes, key=functools.cmp_to_key(comparar_base))
        # Medido no Node 24 (localeCompare "pt-BR", sensitivity "base").
        self.assertEqual(ordem, ["A", "á", "a", "a b", "a-b", "a.b", "a'b", "a1", "a10", "a2", "ab", "Ab", "b"])
        numerica = sorted(
            ["10", "9", "1a", "A1", "a1", "b", "ação", "acao"], key=functools.cmp_to_key(comparar_numerico)
        )
        self.assertEqual(numerica, ["1a", "9", "10", "a1", "A1", "acao", "ação", "b"])


if __name__ == "__main__":
    unittest.main()
