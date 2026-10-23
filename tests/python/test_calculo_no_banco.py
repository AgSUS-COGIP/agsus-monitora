"""
O cálculo dos itens da ficha em Python com os MESMOS casos dourados da tela e do banco
(tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json; vitest em
tests/lib/avaliacao-documental-calculo-no-banco.test.js; banco no ensaio de
supabase/ensaios/20261023090000_calculo_conferido_no_banco.sql): calculados, parciais,
resultado e experiência, inclusive a data limite do bloco de vínculos (o fim das inscrições).
Também a conversão de dias em anos, meses (até 11) e dias e o fim do vínculo atual do robô.

    python -m pytest tests/python
"""

import json
import pathlib
import unittest
from datetime import date

from monitora.avaliacao_documental import pendencias_da_ficha as pf
from monitora.avaliacao_documental import pontuacao as pt
from monitora.avaliacao_documental import sugestoes_da_ficha as sug
from monitora.avaliacao_documental.leitura_de_arquivos import experiencia as ex

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "avaliacao-documental"
DOURADOS = json.loads((_FIXTURES / "casos-do-calculo-no-banco.json").read_text(encoding="utf-8"))


def regra_do_caso(caso):
    """A regra do arquivo, com a data limite do caso no bloco de vínculos."""
    regra = DOURADOS["regra"]
    if not caso.get("data_limite"):
        return regra
    blocos = [{**b, "data_limite": caso["data_limite"]} if b["tipo"] == "VINCULOS" else b for b in regra["blocos"]]
    return {**regra, "blocos": blocos}


class CasosDourados(unittest.TestCase):
    def test_todos_os_casos(self):
        doc = DOURADOS["documental"]
        opcoes = {"notaMinima": doc["nota_minima"], "notaMinimaPorNivel": doc["nota_minima_por_nivel"]}
        for caso in DOURADOS["casos"]:
            with self.subTest(caso["nome"]):
                r = pt.calcular_avaliacao(regra_do_caso(caso), caso["lancamento"], opcoes)
                esperado = caso["esperado"]
                self.assertEqual(r["calculados"], esperado["calculados"])
                self.assertEqual(r["parciais"], esperado["parciais"])
                self.assertEqual(r["resultado"], esperado["resultado"])
                for chave, valor in esperado["experiencia"].items():
                    self.assertEqual(r["experiencia"][chave], valor, chave)

    def test_pendencias_iguais_as_da_tela(self):
        doc = DOURADOS["documental"]
        opcoes = {"notaMinima": doc["nota_minima"], "notaMinimaPorNivel": doc["nota_minima_por_nivel"]}
        for caso in DOURADOS["casos"]:
            with self.subTest(caso["nome"]):
                regra = regra_do_caso(caso)
                av = pt.calcular_avaliacao(regra, caso["lancamento"], opcoes)
                pend = pf.pendencias_da_ficha(regra, caso["lancamento"], av, caso["declarada"], DOURADOS["hoje"])
                self.assertEqual(
                    [{"bloco": p["bloco"], "tipo": p["tipo"]} for p in pend], caso["esperado"]["pendencias"]
                )

    def test_ha_caso_com_data_limite(self):
        self.assertTrue(any(c.get("data_limite") for c in DOURADOS["casos"]))


class AnosMesesDias(unittest.TestCase):
    def test_meses_ate_onze(self):
        self.assertEqual(pt.anos_meses_dias(364), {"anos": 0, "meses": 11, "dias": 34})
        self.assertEqual(pt.anos_meses_dias(360), {"anos": 0, "meses": 11, "dias": 30})
        self.assertEqual(pt.anos_meses_dias(365), {"anos": 1, "meses": 0, "dias": 0})
        self.assertEqual(pt.anos_meses_dias(912), {"anos": 2, "meses": 6, "dias": 2})


class FimDoVinculoAtual(unittest.TestCase):
    HOJE = date(2026, 10, 22)
    LIMITE = date(2026, 10, 14)

    def test_vai_ate_a_data_limite_e_nao_ate_hoje(self):
        self.assertEqual(ex.fim_do_vinculo_atual(None, self.LIMITE, self.HOJE), (self.LIMITE, "DATA_LIMITE"))

    def test_emissao_antes_da_data_limite_vale(self):
        emissao = date(2026, 9, 1)
        self.assertEqual(ex.fim_do_vinculo_atual(emissao, self.LIMITE, self.HOJE), (emissao, "EMISSAO"))

    def test_nunca_depois_de_hoje(self):
        self.assertEqual(ex.fim_do_vinculo_atual(None, date(2026, 12, 31), self.HOJE), (self.HOJE, "DATA_LIMITE"))


class FimNoFuturo(unittest.TestCase):
    HOJE = date(2026, 10, 22)

    def test_dias_do_vinculo_nunca_passam_de_hoje(self):
        self.assertEqual(ex.dias_do_vinculo(date(2026, 10, 1), date(2027, 12, 31), self.HOJE), 22)

    def test_intervalos_para_somar_cortam_em_hoje(self):
        itens = [{"tipo": "VINCULO", "inicio": "2026-10-01", "fim": "2028-01-01"}]
        self.assertEqual(ex.intervalos_para_somar(itens, self.HOJE), [{"inicio": "2026-10-01", "fim": "2026-10-22"}])

    def test_sugestao_da_resposta_com_fim_no_futuro_fica_em_hoje(self):
        itens = sug.vinculos_das_respostas(["Hospital fictício, de 01/02/2025 a 31/12/2027"], hoje=self.HOJE)
        self.assertEqual([(i["inicio"], i["fim"]) for i in itens], [("2025-02-01", "2026-10-22")])

    def test_sugestao_que_comeca_depois_de_hoje_sai(self):
        self.assertEqual(sug.vinculos_das_respostas(["de 01/01/2027 a 31/12/2027"], hoje=self.HOJE), [])


class TextosDasPendencias(unittest.TestCase):
    def test_nota_como_a_tela(self):
        self.assertEqual(pf.texto_da_nota(12.5), "12,5")
        self.assertEqual(pf.texto_da_nota(1234.567), "1.234,57")
        self.assertEqual(pf.texto_da_nota(5), "5")

    def test_datas_do_vinculo(self):
        hoje = "2026-10-22"
        self.assertIsNone(pf.falta_nas_datas_do_vinculo({"inicio": "2020-01-01", "fim": "2026-10-22"}, hoje))
        self.assertIn("1960", pf.falta_nas_datas_do_vinculo({"inicio": "1959-12-31", "fim": "1961-01-01"}, hoje))
        self.assertIn(
            "depois de hoje", pf.falta_nas_datas_do_vinculo({"inicio": "2026-01-01", "fim": "2026-10-23"}, hoje)
        )


if __name__ == "__main__":
    unittest.main()
