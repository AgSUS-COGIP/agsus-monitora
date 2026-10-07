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
        congelar=c.get("congelar", False),
        decisoes=c.get("decisoes") or {},
    )


class CasosDouradosDaPreClassificacao(unittest.TestCase):
    def test_cada_caso_da_o_mesmo_resultado_do_javascript(self):
        for caso in PRE["casos"]:
            with self.subTest(caso["nome"]):
                r = rodar(caso)
                linhas = {l["id"]: {k: l[k] for k in CAMPOS} for l in r["linhas"]}
                self.assertEqual(linhas, caso["esperado"]["linhas"])
                self.assertEqual(r["resumo"], caso["esperado"]["resumo"])
                if "declaradas" in caso["esperado"]:
                    self.assertEqual(
                        {
                            l["id"]: {
                                "declarada": l["declarada"],
                                "art": l["art"],
                                "congelada": (l["declarada_congelada"] or {}).get("total"),
                            }
                            for l in r["linhas"]
                        },
                        caso["esperado"]["declaradas"],
                    )

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


class PerguntaPeloEnunciado(unittest.TestCase):
    def test_casos_dourados_das_perguntas(self):
        for caso in PRE["perguntas"]:
            with self.subTest(caso["nome"]):
                colunas = {nome: "x" for nome in caso["colunas"]}
                self.assertEqual(
                    {
                        "coluna": nd.coluna_da_pergunta(colunas, caso["pergunta"]),
                        "ambigua": nd.pergunta_ambigua(colunas, caso["pergunta"]),
                    },
                    caso["esperado"],
                )

    def test_perguntas_ambiguas_viram_os_codigos_dos_avisos(self):
        caso = PRE["casos"][-1]
        regra = pc.normalizar_regra(caso["regra"])
        colunas = caso["candidatos"][-1]["colunas"]
        self.assertEqual(
            sorted(pc.perguntas_ambiguas(regra, colunas, regra["provisoria"]["pergunta_experiencia"])),
            caso["esperado"]["resumo"]["avisos"],
        )
        self.assertEqual(pc.perguntas_ambiguas(regra, {}, "x"), [])

    def test_pergunta_da_experiencia_em_lista(self):
        self.assertEqual(pc.normalizar_pergunta([" a ", "", 3, "b"]), ["a", "b"])
        self.assertIsNone(pc.normalizar_pergunta([" "]))
        self.assertEqual(pc.normalizar_pergunta("  Experiência  "), "Experiência")
        self.assertIsNone(pc.normalizar_pergunta(None))


class RespostasDaEmpregare(unittest.TestCase):
    R = PRE["respostas"]

    def test_texto(self):
        for valor, esperado in self.R["texto"]:
            with self.subTest(valor):
                self.assertEqual(nd.texto_da_resposta(valor), esperado)

    def test_opcoes(self):
        for valor, esperado in self.R["opcoes"]:
            with self.subTest(valor):
                self.assertEqual(nd.opcoes_da_resposta(valor), esperado)

    def test_mesma_opcao(self):
        for a, b, igual in self.R["mesma_opcao"]:
            with self.subTest(a):
                self.assertEqual(nd.chave_da_opcao(a) == nd.chave_da_opcao(b), igual)

    def test_meses(self):
        for valor, esperado in self.R["meses"]:
            with self.subTest(valor):
                self.assertEqual(pc.meses_declarados(valor), esperado)

    def test_art(self):
        for valor, esperado in self.R["art"]:
            with self.subTest(valor):
                self.assertEqual(nd.ler_art(valor), esperado)


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


class NotaDeclaradaPorNivel(unittest.TestCase):
    ND = PRE["nota_declarada_por_nivel"]

    def test_casos_dourados(self):
        for caso in self.ND["casos"]:
            with self.subTest(caso["nome"]):
                self.assertEqual(
                    nd.calcular_nota_declarada(self.ND["regra"], caso["respostas"], caso["nivel"]),
                    caso["esperado"],
                )

    def test_caso_real_do_93_tecnico_50_igual_a_art(self):
        respostas = self.ND["casos"][0]["respostas"]
        r = nd.calcular_nota_declarada(self.ND["regra"], respostas, "tecnico")
        self.assertEqual(r["parciais"], {"FORMACAO": 0, "CURSOS": 10, "EXPERIENCIA": 40})
        self.assertEqual(r["total"], 50)
        self.assertTrue(r["completa"])
        self.assertFalse(nd.diverge_da_art(pc.art_das_colunas(respostas), r["total"]))

    def test_mesma_resposta_por_nivel_e_sem_nivel(self):
        respostas = {"Pergunta 11 - Experiência Profissional": '"1 ano"'}

        def exp(nivel):
            return nd.calcular_nota_declarada(self.ND["regra"], respostas, nivel)["parciais"].get("EXPERIENCIA")

        self.assertEqual([exp("superior"), exp("tecnico"), exp("medio")], [5, 4, 4])
        sem = nd.calcular_nota_declarada(self.ND["regra"], respostas, None)
        self.assertNotIn("EXPERIENCIA", sem["parciais"])
        self.assertTrue(sem["itens"][2]["nivel_desconhecido"])
        self.assertFalse(sem["completa"])
        self.assertEqual(sem["sem_mapa"], 0)

    def test_nivel_da_vaga(self):
        for caso in PRE["niveis_da_vaga"]["casos"]:
            with self.subTest(caso["cargo"]):
                self.assertEqual(pc.nivel_da_vaga(caso["cargo"], caso["documental"]), caso["esperado"])

    def test_divergencia_so_com_declarada_completa_e_aviso_sem_nivel(self):
        por_nivel, sem_nivel = [c for c in PRE["casos"] if "nível" in c["nome"]]

        def div(caso):
            return {l["id"]: l["divergente"] for l in rodar(caso)["linhas"]}

        self.assertEqual(div(por_nivel), {"t01": False, "t02": False, "t03": True, "t04": False})
        self.assertEqual(div(sem_nivel), {"t01": False, "t02": False, "t03": False, "t04": False})
        self.assertEqual(rodar(sem_nivel)["resumo"]["avisos"], ["SEM_NIVEL:NOTA_EXPERIENCIA"])
        for caso in (por_nivel, sem_nivel):
            self.assertEqual(
                {
                    l["id"]: {"declarada": l["declarada"], "parciais": l["declarada_parciais"]}
                    for l in rodar(caso)["linhas"]
                },
                caso["esperado_declarada"],
            )


class BaseDaNotaECongelamento(unittest.TestCase):
    """Os mesmos testes de tests/lib/avaliacao-documental-pre-classificacao.test.js."""

    CASO = next(c for c in PRE["casos"] if c["nome"].startswith("base da nota pela declarada"))

    def _com(self, **provisoria):
        return {**self.CASO["regra"], "provisoria": {**self.CASO["regra"]["provisoria"], **provisoria}}

    def test_padrao_declarada_com_nota_declarada_e_art_sem(self):
        self.assertEqual(pc.normalizar_regra({})["provisoria"]["base_da_nota"], "ART")
        self.assertEqual(pc.normalizar_regra(self.CASO["regra"])["provisoria"]["base_da_nota"], "DECLARADA")
        self.assertEqual(pc.normalizar_regra(self._com(base_da_nota="ART"))["provisoria"]["base_da_nota"], "ART")

    def test_recusa_base_desconhecida_e_declarada_sem_nota_declarada(self):
        with self.assertRaisesRegex(ValueError, "Base da nota do lote: DECLARADA ou ART"):
            pc.normalizar_regra(self._com(base_da_nota="MAIOR"))
        with self.assertRaisesRegex(ValueError, "configure a nota declarada"):
            pc.normalizar_regra(self._com(base_da_nota="DECLARADA", nota_declarada=[]))
        self.assertEqual(pc.erros_da_base_da_nota(self._com(base_da_nota="ART")["provisoria"]), [])

    def test_com_a_base_art_o_mesmo_caso_volta_a_ordem_pela_art(self):
        r = rodar(self.CASO, regra=self._com(base_da_nota="ART"))
        por_codigo = {l["codigo"]: l for l in r["linhas"]}
        self.assertEqual(por_codigo["2171493"]["situacao"], "RANQUEADO")
        self.assertEqual(por_codigo["7100004"]["situacao"], "NO_LOTE")
        self.assertEqual(r["resumo"]["base_da_nota"], "ART")
        self.assertNotIn("SEM_DECLARADA_COMPLETA", r["resumo"]["avisos"])

    def test_fim_das_inscricoes_e_quando_congela(self):
        for cronograma, esperado in PRE["congelamento"]["fim_das_inscricoes"]:
            with self.subTest(cronograma):
                self.assertEqual(pc.fim_das_inscricoes(cronograma), esperado)
        for hoje, fim, esperado in PRE["congelamento"]["congela"]:
            with self.subTest((hoje, fim)):
                self.assertEqual(pc.congela_a_declarada(hoje, fim), esperado)

    def test_a_congelada_guarda_as_respostas_e_o_anterior_invalido_e_ignorado(self):
        caso = next(c for c in PRE["casos"] if c["nome"].startswith("congelamento:"))
        linha = next(l for l in rodar(caso)["linhas"] if l["codigo"] == "2171493")
        self.assertEqual(len(linha["declarada_congelada"]["respostas"]), 3)
        self.assertEqual(
            linha["declarada_congelada"]["respostas"][2],
            {
                "parcial": "EXPERIENCIA",
                "coluna": "Pergunta 5 - Experiência Profissional em atividades compatíveis",
                "resposta": '"1 ano"',
                "pontos": 10,
            },
        )
        self.assertIsNone(pc.declarada_congelada({"total": "20"}))
        self.assertIsNone(pc.declarada_congelada(None))
        self.assertEqual(
            pc.declarada_congelada({"total": 20}), {"total": 20, "parciais": {}, "sem_mapa": 0, "respostas": []}
        )


if __name__ == "__main__":
    unittest.main()
