"""
A conta da ficha em Python (python/monitora/avaliacao_documental/pontuacao.py):
os MESMOS casos dourados do vitest (tests/fixtures/avaliacao-documental/
casos-de-pontuacao.json, tests/lib/avaliacao-documental-pontuacao.test.js),
incluindo a nota ajustada com justificativa da fase F4, e a conferência em
lote do que a ficha gravou. Nada fala com o Supabase.

    python -m pytest tests/python
"""

import json
import pathlib
import unittest

from monitora.avaliacao_documental import pontuacao as pt

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "avaliacao-documental"
CASOS = json.loads((_FIXTURES / "casos-de-pontuacao.json").read_text(encoding="utf-8"))


def regra_do_caso(caso):
    """A regra do caso: parecer_da_regra põe as opções do parecer por cima."""
    regra = CASOS["regras"][caso["regra"]]
    if not caso.get("parecer_da_regra"):
        return regra
    return {**regra, "parecer": {**regra["parecer"], **caso["parecer_da_regra"]}}


class CasosDourados(unittest.TestCase):
    def test_todos_os_casos(self):
        for caso in CASOS["casos"]:
            with self.subTest(caso["nome"]):
                r = pt.calcular_avaliacao(regra_do_caso(caso), caso["candidato"], caso.get("opcoes"))
                esperado = caso["esperado"]
                self.assertEqual(r["resultado"], esperado["resultado"])
                self.assertEqual(r["nota_final"], esperado["nota_final"])
                self.assertEqual(r["nota_apurada"], esperado["nota_apurada"])
                self.assertEqual(r["parciais"], esperado["parciais"])
                self.assertEqual(r["eliminatorios"], esperado["eliminatorios"])
                self.assertEqual(r["encaminhamentos"], esperado["encaminhamentos"])
                self.assertEqual(r["parecer"], esperado["parecer"])
                for campo in ("calculados", "ajustes", "pontos_informativos"):
                    if campo in esperado:
                        self.assertEqual(r[campo], esperado[campo])
                if "experiencia" in esperado:
                    for chave, valor in esperado["experiencia"].items():
                        self.assertEqual(r["experiencia"][chave], valor, chave)

    def test_ha_casos_da_ficha(self):
        self.assertGreaterEqual(sum(1 for c in CASOS["casos"] if c["nome"].startswith("ficha:")), 3)


class Detalhes(unittest.TestCase):
    def test_numero_do_parecer_arredonda_a_metade_para_cima(self):
        self.assertEqual(pt.numero_do_parecer(2.25, 1), "2,3")
        self.assertEqual(pt.numero_do_parecer(20, 1), "20,0")
        self.assertEqual(pt.numero_do_parecer(8, 2), "8,00")
        self.assertEqual(pt.numero_do_parecer(1234.5, 1), "1.234,5")

    def test_sobreposicao_e_dia_seguinte(self):
        self.assertEqual(
            pt.dias_dos_intervalos(
                [{"inicio": "2024-01-01", "fim": "2024-06-30"}, {"inicio": "2024-07-01", "fim": "2024-12-31"}]
            ),
            366,
        )
        self.assertEqual(pt.dias_dos_intervalos([{"inicio": "2024-02-30", "fim": "2024-03-01"}]), 0)

    def test_ajuste_respeita_o_teto_do_nivel(self):
        regra = CASOS["regras"]["PROJ26-CURRICULAR"]
        cursos = next(b for b in regra["blocos"] if b["codigo"] == "CURSOS")
        self.assertEqual(pt.teto_do_bloco(cursos, "superior"), 5)
        self.assertEqual(pt.teto_do_bloco(cursos, "tecnico"), 10)

    def test_bloco_que_nao_se_aplica_ao_cargo_nao_elimina(self):
        # O registro no conselho não se aplica ao Motorista D (114/2026, Anexo I): como o vitest.
        regra = json.loads(json.dumps(CASOS["regras"]["E114-POR-CARGO"]))
        motorista = next(d for d in regra["por_cargo"] if d["codigo"] == "MOTORISTA_D")
        candidato = {
            "nivel": "medio",
            "vaga": "182528",
            "modalidade": "AC",
            "blocos": {"REGISTRO_CONSELHO": {"situacao": "NAO_ENVIADO", "motivos": ["SEM_REGISTRO"]}},
        }

        def do_registro(r):
            return [t for t in r["eliminatorios"] if "conselho de classe" in t]

        self.assertEqual(
            do_registro(pt.calcular_avaliacao(regra, candidato, {"notaMinima": 0})),
            ["Item 6.4: Não apresentou registro ativo no conselho de classe exigido para a vaga."],
        )
        motorista["blocos"]["REGISTRO_CONSELHO"] = {"nao_se_aplica": True}
        da_vaga = pt.regra_da_vaga(pt.normalizar_regra(regra), candidato)
        registro = next(b for b in da_vaga["blocos"] if b["codigo"] == "REGISTRO_CONSELHO")
        self.assertIs(registro["nao_se_aplica"], True)
        r = pt.calcular_avaliacao(regra, candidato, {"notaMinima": 0})
        self.assertEqual(do_registro(r), [])


class Conferencia(unittest.TestCase):
    def setUp(self):
        self.caso = next(c for c in CASOS["casos"] if c["nome"].startswith("ficha: experiência ajustada"))
        self.regra = CASOS["regras"][self.caso["regra"]]

    def test_ficha_gravada_igual_confere(self):
        gravado = dict(self.caso["esperado"])
        self.assertEqual(pt.conferir_ficha(self.regra, self.caso["candidato"], gravado, self.caso["opcoes"]), [])

    def test_ficha_gravada_diferente_aponta_o_campo(self):
        gravado = {
            **self.caso["esperado"],
            "nota_final": 31,
            "parciais": {**self.caso["esperado"]["parciais"], "EXPERIENCIA": 22},
        }
        campos = [
            d["campo"] for d in pt.conferir_ficha(self.regra, self.caso["candidato"], gravado, self.caso["opcoes"])
        ]
        self.assertIn("nota_final", campos)
        self.assertIn("parciais.EXPERIENCIA", campos)


class PontosInformativos(unittest.TestCase):
    """Inapto por requisito com parecer.mostrar_pontos_quando_inapto: nota 0, informativa gravada e conferida."""

    def setUp(self):
        self.caso = next(c for c in CASOS["casos"] if c.get("parecer_da_regra"))
        self.regra = regra_do_caso(self.caso)

    def test_ficha_gravada_com_a_informativa_confere(self):
        gravado = dict(self.caso["esperado"])
        self.assertEqual(pt.conferir_ficha(self.regra, self.caso["candidato"], gravado, self.caso["opcoes"]), [])

    def test_ficha_gravada_sem_a_informativa_aponta_o_campo(self):
        gravado = {k: v for k, v in self.caso["esperado"].items() if k != "pontos_informativos"}
        campos = [
            d["campo"] for d in pt.conferir_ficha(self.regra, self.caso["candidato"], gravado, self.caso["opcoes"])
        ]
        self.assertEqual(campos, ["pontos_informativos"])

    def test_opcao_desligada_nao_tem_a_informativa(self):
        r = pt.calcular_avaliacao(CASOS["regras"][self.caso["regra"]], self.caso["candidato"], self.caso["opcoes"])
        self.assertIsNone(r["pontos_informativos"])
        self.assertEqual((r["resultado"], r["nota_final"], r["nota_apurada"]), ("INAPTO_REQUISITO", 0, 10))
        self.assertNotIn("para fins informativos", r["parecer"])

    def test_modelo_padrao_quando_a_regra_nao_traz_o_texto(self):
        regra = {**self.regra, "parecer": {**self.regra["parecer"], "pontos_informativos": ""}}
        r = pt.calcular_avaliacao(regra, self.caso["candidato"], self.caso["opcoes"])
        self.assertTrue(
            r["parecer"].endswith(
                "Pontuação apurada dos títulos, para fins informativos: 10,0 pontos "
                "(Titulação 8,0; Cursos 2,0; Experiência 0,0)."
            )
        )


if __name__ == "__main__":
    unittest.main()
