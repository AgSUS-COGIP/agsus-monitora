"""
Testes da avaliação documental em Python (python/monitora/avaliacao_documental/):
os MESMOS casos dourados do vitest —
tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json
(tests/lib/avaliacao-documental-pre-classificacao.test.js) e a nota declarada
de tests/fixtures/avaliacao-documental/casos-de-pontuacao.json
(tests/lib/avaliacao-documental-pontuacao.test.js). Nada fala com o Supabase.

    python -m pytest tests/python
"""

import json
import pathlib
import unittest

from monitora.avaliacao_documental import nota_declarada as nd
from monitora.avaliacao_documental import pre_classificacao as pc

_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "avaliacao-documental"
PRE = json.loads((_FIXTURES / "casos-de-pre-classificacao.json").read_text(encoding="utf-8"))
PONTUACAO = json.loads((_FIXTURES / "casos-de-pontuacao.json").read_text(encoding="utf-8"))
CAMPOS = (
    "situacao",
    "motivo_codigo",
    "posicao",
    "posicao_modalidade",
    "lote",
    "lista_lote",
    "entrada",
    "motivo_entrada",
    "nota",
    "origem_nota",
    "divergente",
    "modalidade",
)


def rodar(caso, **mudancas):
    c = {**caso, **mudancas}
    return pc.pre_classificar_vaga(
        pc.normalizar_regra(c["regra"]),
        c["vaga"],
        c["candidatos"],
        anterior=c["anterior"],
        ultimo_lote=c["ultimo_lote"],
        refazer=c["refazer"],
        hoje=c["hoje"],
    )


class CasosDouradosDaPreClassificacao(unittest.TestCase):
    def test_cada_caso_da_o_mesmo_resultado_do_javascript(self):
        for caso in PRE["casos"]:
            with self.subTest(caso["nome"]):
                r = rodar(caso)
                linhas = {l["id"]: {k: l[k] for k in CAMPOS} for l in r["linhas"]}
                self.assertEqual(linhas, caso["esperado"]["linhas"])
                self.assertEqual(r["resumo"], caso["esperado"]["resumo"])

    def test_rodar_de_novo_nao_muda_nada(self):
        for caso in PRE["casos"]:
            with self.subTest(caso["nome"]):
                primeira = rodar(caso)
                anterior = {l["id"]: l for l in primeira["linhas"]}
                segunda = rodar(
                    caso,
                    candidatos=[c for c in caso["candidatos"] if c["ativo"] is not False or c["id"] in anterior],
                    anterior=anterior,
                    refazer=False,
                    ultimo_lote=max([0] + [l["lote"] or 0 for l in primeira["linhas"]]),
                )
                self.assertEqual(
                    [(l["id"], l["situacao"], l["lote"]) for l in segunda["linhas"]],
                    [(l["id"], l["situacao"], l["lote"]) for l in primeira["linhas"]],
                )
                self.assertEqual(segunda["resumo"]["entraram"], 0)


class NotaDeclarada(unittest.TestCase):
    def test_casos_dourados_da_nota_declarada(self):
        for caso in PONTUACAO["nota_declarada"]:
            with self.subTest(caso["nome"]):
                regra = PONTUACAO["regras"][caso["regra"]]
                self.assertEqual(nd.calcular_nota_declarada(regra, caso["respostas"]), caso["esperado"])

    def test_pergunta_pelo_comeco_sem_acento_nem_caixa(self):
        respostas = {"PERGUNTA 15 - Formação": "a", "Pergunta 1 - Nome": "b"}
        self.assertEqual(nd.coluna_da_pergunta(respostas, "pergunta 15 -"), "PERGUNTA 15 - Formação")
        self.assertEqual(nd.coluna_da_pergunta(respostas, "Pergunta 1 -"), "Pergunta 1 - Nome")
        self.assertIsNone(nd.coluna_da_pergunta(respostas, ""))

    def test_faixa_em_meses_com_teto(self):
        regra = {
            "provisoria": {
                "nota_declarada": [
                    {
                        "parcial": "EXPERIENCIA",
                        "pergunta": "Pergunta 17 -",
                        "tipo": "FAIXA_EM_MESES",
                        "meses": {"De 1 a 3 anos": 36, "Mais de 5 anos": 72},
                        "pontos_por_mes": 0.2,
                        "teto": 10,
                    }
                ]
            }
        }
        self.assertEqual(nd.calcular_nota_declarada(regra, {"Pergunta 17 - Exp": "De 1 a 3 anos"})["total"], 7.2)
        self.assertEqual(nd.calcular_nota_declarada(regra, {"Pergunta 17 - Exp": "Mais de 5 anos"})["total"], 10)

    def test_art_e_divergencia(self):
        self.assertEqual(nd.ler_art("6,0/30,0"), 6.0)
        self.assertIsNone(nd.ler_art("x/30"))
        self.assertTrue(nd.diverge_da_art(10, 8, 1))
        self.assertFalse(nd.diverge_da_art(10, 9, 1))
        self.assertFalse(nd.diverge_da_art(None, 9, 0))


class PecasDaConta(unittest.TestCase):
    def test_tamanho_do_lote(self):
        lote = pc.normalizar_regra({})["lote"]
        self.assertEqual(
            pc.tamanho_do_lote(lote, {"vagas_imediatas": 11, "cadastro_reserva": True})["descricao"],
            "3 × (11 + CR) = 36",
        )
        r = pc.tamanho_do_lote({**lote, "multiplo": 2.5, "inclui_cr": False}, {"vagas_imediatas": 3})
        self.assertEqual((r["tamanho"], r["descricao"]), (8, "2,5 × 3 = 8"))
        self.assertEqual(pc.tamanho_do_lote(lote, {"vagas_imediatas": 0})["aviso"], "SEM_VAGAS")

    def test_lote_pela_nota_minima(self):
        self.assertEqual(
            pc.tamanho_do_lote({"base": "NOTA_MINIMA", "nota_minima": 15, "item_edital": "8.2.6"}, {}),
            {
                "tamanho": None,
                "descricao": "nota ≥ 15 (item 8.2.6)",
                "por_modalidade": None,
                "aviso": None,
                "nota_minima": 15,
            },
        )
        self.assertEqual(pc.tamanho_do_lote({"base": "NOTA_MINIMA"}, {})["aviso"], "SEM_NOTA_MINIMA")

    def test_meses_declarados_como_o_javascript(self):
        casos = {
            "De 1 a 2 anos": 12,
            "Mais de 5 anos": 60,
            "De 6 meses a 1 ano": 6,
            "Sem experiência": 0,
            "1,5 ano": 18,
            "texto livre": None,
            "": None,
        }
        for texto, meses in casos.items():
            self.assertEqual(pc.meses_declarados(texto), meses, texto)
        self.assertEqual(pc.meses_declarados(24), 24)

    def test_vagas_por_modalidade_e_codigos(self):
        self.assertEqual(
            pc.vagas_por_modalidade({"Ampla Concorrência": "2", "PcD": None, "Indígenas": 1}),
            {"AC": 2, "PCD": 0, "PI": 1},
        )
        self.assertIsNone(pc.vagas_por_modalidade({"Ampla Concorrência": None}))
        self.assertEqual(pc.codigos_da_modalidade("PPIQ - Indígenas"), ["PI"])

    def test_idade_e_numero_no_texto(self):
        self.assertEqual(pc.idade_em("1966-10-07", "2026-10-06"), 59)
        self.assertEqual(pc.idade_em("1966-10-06", "2026-10-06"), 60)
        self.assertIsNone(pc.idade_em(None, "2026-10-06"))
        self.assertEqual(pc.numero_no_texto(24.0), "24")
        self.assertEqual(pc.numero_no_texto(18.5), "18,5")


if __name__ == "__main__":
    unittest.main()
