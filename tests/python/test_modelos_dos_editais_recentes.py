"""
Modelos da regra lidos dos editais recentes (docs/analises-no-monitora/
regras-dos-editais-recentes.md) na conta oficial em Python
(python/monitora/avaliacao_documental/): os MESMOS casos de lote e de
Provisória que o vitest roda (tests/modelos-dos-editais-recentes.test.js),
lidos de tests/fixtures/avaliacao-documental/casos-dos-modelos-recentes.json.

A pontuação da ficha ainda não existe em Python (fase F4); quando existir,
os casos de "pontuacao" do mesmo arquivo valem aqui também.

    python -m pytest tests/python
"""

import json
import pathlib
import unittest

from monitora.avaliacao_documental import nota_declarada as nd
from monitora.avaliacao_documental import pre_classificacao as pc

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "avaliacao-documental"
CASOS = json.loads((_FIXTURES / "casos-dos-modelos-recentes.json").read_text(encoding="utf-8"))
MODELOS_SI = ("SI26-100", "SI26-ALSE", "SI26-MRSA", "SI26-PARINTINS")


def modelo(codigo):
    return json.loads((_FIXTURES / "modelos" / f"{codigo}.json").read_text(encoding="utf-8"))


class LoteDosModelos(unittest.TestCase):
    def test_tamanho_do_lote_igual_ao_javascript(self):
        for caso in CASOS["lote"]:
            with self.subTest(f"{caso['modelo']} {caso['vaga']['codigo']}"):
                lote = pc.normalizar_regra(modelo(caso["modelo"]))["lote"]
                r = pc.tamanho_do_lote(lote, caso["vaga"])
                self.assertEqual(
                    {"tamanho": r["tamanho"], "descricao": r["descricao"], "aviso": r["aviso"]},
                    caso["esperado"],
                )

    def test_reposicao_publicada_e_linha_anda_na_saude_indigena(self):
        for codigo in MODELOS_SI:
            with self.subTest(codigo):
                lote = pc.normalizar_regra(modelo(codigo))["lote"]
                self.assertTrue(lote["linha_anda"])
                self.assertTrue(lote["publica_reposicao"])
                self.assertTrue(lote["inclui_empatados"])


class ProvisoriaDosModelos(unittest.TestCase):
    def test_desempate_da_provisoria_igual_ao_javascript(self):
        for caso in CASOS["provisoria"]:
            with self.subTest(caso["nome"]):
                r = pc.pre_classificar_vaga(
                    pc.normalizar_regra(modelo(caso["modelo"])),
                    CASOS["provisoria_vaga"],
                    CASOS["provisoria_candidatos"],
                    anterior={},
                    ultimo_lote=0,
                    refazer=False,
                    hoje=CASOS["hoje"],
                )
                self.assertEqual({l["id"]: l["posicao"] for l in r["linhas"]}, caso["esperado"])


class NotaDeclaradaDoSi26100(unittest.TestCase):
    def test_o_si26_100_corrigido_le_o_questionario_como_antes(self):
        respostas = {
            "Pergunta 15 - Outras formações (especialização, mestrado, doutorado)": "Especialização na área à qual concorre",
            "Pergunta 6 - Você é indígena e mora em aldeia?": "Sou indígena; Moro em aldeia",
        }
        r = nd.calcular_nota_declarada(modelo("SI26-100"), respostas)
        self.assertEqual(r["total"], 15)
        self.assertEqual(r["parciais"], {"FORMACAO": 1, "ETNICO": 14})

    def test_os_modelos_novos_nao_tem_nota_declarada_ainda(self):
        for codigo in ("SI26-ALSE", "SI26-MRSA", "SI26-PARINTINS", "PROJ26-RIO-DOCE"):
            with self.subTest(codigo):
                self.assertEqual(nd.calcular_nota_declarada(modelo(codigo), {})["total"], 0)


if __name__ == "__main__":
    unittest.main()
