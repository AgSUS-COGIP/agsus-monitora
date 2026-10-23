"""
O hash do retrato pelo CONTEÚDO (20261024130000): o Python, a tela e o banco
fazem a mesma conta (monitora/classificacao/hash_do_retrato.py,
src/lib/classificacao/hash-do-retrato.ts, private."FC_HASH_RETRATO_CLASSIFICACAO").

Teste cruzado: o motor Python gera de novo cada lista dos casos dourados
(tests/fixtures/classificacao/casos-do-motor.json) e o hash do retrato dele —
com as notas inteiras em 35.0 — é o da fixture tests/fixtures/classificacao/
hash-dos-retratos.json, que é o hash da lista que o motor.ts gera (o vitest
confere o lado da tela). Dados fictícios; nada fala com o Supabase.
"""

import hashlib
import json
import pathlib
import unittest

from monitora.classificacao import motor
from monitora.classificacao.hash_do_retrato import hash_do_retrato, numero_canonico, texto_canonico_do_retrato
from monitora.classificacao.retrato import instantaneo_da_lista

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "classificacao"
DOURADO = json.loads((_FIXTURES / "casos-do-motor.json").read_text(encoding="utf-8"))
HASHES = json.loads((_FIXTURES / "hash-dos-retratos.json").read_text(encoding="utf-8"))


def _retrato_do_python(caso, i):
    entrada = {"tipo": caso["tipo"], **DOURADO["editais"][caso["edital"]]}
    retrato = instantaneo_da_lista(
        motor.classificar(entrada), caso["editalDoRetrato"], entrada.get("regra"), i // 4 + 1
    )
    # Como o job manda ao banco: o json do Python (float inteiro vira 35.0).
    return json.loads(json.dumps(retrato, ensure_ascii=False))


class HashDoRetrato(unittest.TestCase):
    def test_35_e_35_0_dao_o_mesmo_hash(self):
        python = json.loads('{"nota": 35.0, "parciais": [7.50, 0.0]}')
        tela = {"nota": 35, "parciais": [7.5, 0]}
        self.assertEqual(hash_do_retrato(python), hash_do_retrato(tela))
        self.assertEqual(texto_canonico_do_retrato(python), '{"nota": 35, "parciais": [7.5, 0]}')
        self.assertEqual(hash_do_retrato({"nota": 35.0}), hashlib.sha256(b'{"nota": 35}').hexdigest())
        self.assertNotEqual(hash_do_retrato({"nota": 35.01}), hash_do_retrato(tela))
        # O texto "35.0" não é número e fica como está.
        self.assertEqual(texto_canonico_do_retrato({"s": "35.0"}), '{"s": "35.0"}')

    def test_texto_do_jsonb(self):
        self.assertEqual(
            texto_canonico_do_retrato({"bb": 1, "a": 2, "ab": [], "c": {}}), '{"a": 2, "c": {}, "ab": [], "bb": 1}'
        )
        self.assertEqual(texto_canonico_do_retrato({"é": 1, "z": 2}), '{"z": 2, "é": 1}')
        self.assertEqual(texto_canonico_do_retrato('a"b\\c\n\t\u0001/ç'), '"a\\"b\\\\c\\n\\t\\u0001/ç"')
        self.assertEqual(texto_canonico_do_retrato([None, True, False]), "[null, true, false]")
        self.assertEqual(numero_canonico(1e-7), "0.0000001")
        self.assertEqual(numero_canonico(1e21), "1000000000000000000000")
        self.assertEqual(numero_canonico(-0.0), "0")
        self.assertEqual(numero_canonico(-2.5), "-2.5")
        self.assertEqual(numero_canonico(123.456), "123.456")
        self.assertEqual(numero_canonico(100), "100")
        with self.assertRaises(ValueError):
            numero_canonico(float("nan"))

    def test_os_exemplos_da_fixture(self):
        for exemplo in HASHES["exemplos"]:
            with self.subTest(texto=exemplo["texto"][:40]):
                self.assertEqual(hash_do_retrato(json.loads(exemplo["texto"])), exemplo["hash"])

    def test_teste_cruzado_a_lista_do_python_tem_o_hash_da_tela(self):
        com_ponto_zero = 0
        for i, caso in enumerate(DOURADO["casos"]):
            with self.subTest(caso=caso["nome"]):
                retrato = _retrato_do_python(caso, i)
                if ".0," in json.dumps(retrato) or ".0}" in json.dumps(retrato):
                    com_ponto_zero += 1
                self.assertEqual(hash_do_retrato(retrato), HASHES["casos"][caso["nome"]])
        # O teste vale porque o Python escreve mesmo 35.0 (a forma que dava outro hash).
        self.assertGreater(com_ponto_zero, 0)


if __name__ == "__main__":
    unittest.main()
