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


class RefazerOLote(unittest.TestCase):
    """
    O recorte do zero com fichas intocadas (20261013110000), como no 114/2026:
    lote pela nota mínima (≥ 10), linha parada. Quem continua no lote FICA
    (mantém a ficha), quem se inscreveu depois com a nota ENTRA (ficha nova) e
    quem não cabe mais no recorte ou foi eliminado SAI (ficha FORA_LOTE).
    """

    REGRA = {
        "schema": 1,
        "provisoria": {
            "eliminacao_automatica": [
                {"codigo": "CANCELADO", "coluna": "SITUAÇÃO", "quando": ["CANCELADO"], "motivo": "Cancelou a inscrição"}
            ],
            "nota_declarada": [],
        },
        "lote": {"base": "NOTA_MINIMA", "nota_minima": 10, "item_edital": "8.2.6", "linha_anda": False},
        "blocos": [],
    }
    VAGA = {"codigo": "182493", "vagas_imediatas": 1, "cadastro_reserva": True, "modalidades": None, "nivel": None}

    @staticmethod
    def candidato(n, art, situacao="Ativo"):
        return {
            "id": f"c{n}",
            "codigo": f"70000{n}",
            "ativo": True,
            "nascimento": "1990-01-01",
            "candidatura": f"2026-10-0{n}T12:00:00+00:00",
            "colunas": {"SITUAÇÃO": situacao, "NOTA - Questionário": art},
        }

    def setUp(self):
        self.candidatos = [
            self.candidato(1, "24,0/30,0"),  # estava no lote e continua: fica
            self.candidato(2, "12,0/30,0"),  # inscreveu-se depois, com a nota mínima: entra
            self.candidato(3, "28,0/30,0", "Cancelado"),  # estava e cancelou: sai eliminado
            self.candidato(4, "8,0/30,0"),  # estava, mas a nota baixou do mínimo: sai do recorte
            self.candidato(5, "5,0/30,0"),  # nunca esteve: continua fora
        ]
        lote = {"lote": 1, "lista_lote": "GERAL", "entrada": "INICIAL", "motivo_entrada": "Lote inicial: nota ≥ 10"}
        self.anterior = {
            "c1": {"situacao": "NO_LOTE", "posicao": 2, **lote},
            "c3": {"situacao": "NO_LOTE", "posicao": 1, **lote},
            "c4": {"situacao": "NO_LOTE", "posicao": 3, **lote},
            "c5": {"situacao": "RANQUEADO", "posicao": 4},
        }

    def rodar(self, refazer):
        return pc.pre_classificar_vaga(
            pc.normalizar_regra(self.REGRA),
            self.VAGA,
            self.candidatos,
            anterior=self.anterior,
            ultimo_lote=1,
            refazer=refazer,
            hoje="2026-10-13",
        )

    def test_sem_refazer_quem_chegou_depois_fica_fora(self):
        r = self.rodar(refazer=False)
        situacao = {l["id"]: l["situacao"] for l in r["linhas"]}
        self.assertEqual(situacao["c2"], "RANQUEADO")
        self.assertEqual(situacao["c4"], "NO_LOTE")
        self.assertEqual(pc.mudancas_do_lote(self.anterior, r["linhas"]), {"ficam": 2, "entram": 0, "saem": 1})

    def test_refazer_recorta_do_zero_entra_sai_e_fica(self):
        r = self.rodar(refazer=True)
        por_id = {l["id"]: l for l in r["linhas"]}
        self.assertEqual(
            {i: por_id[i]["situacao"] for i in por_id},
            {"c1": "NO_LOTE", "c2": "NO_LOTE", "c3": "ELIMINADO", "c4": "RANQUEADO", "c5": "RANQUEADO"},
        )
        # Todo o lote refeito é o lote 1, entrada INICIAL (o banco grava; a ficha de quem fica não muda).
        self.assertEqual({(por_id[i]["lote"], por_id[i]["entrada"]) for i in ("c1", "c2")}, {(1, "INICIAL")})
        self.assertIsNone(por_id["c4"]["lote"])
        self.assertEqual(r["resumo"]["no_lote"], 2)
        self.assertEqual(pc.mudancas_do_lote(self.anterior, r["linhas"]), {"ficam": 1, "entram": 1, "saem": 2})

    def test_mudancas_do_lote_conta_analisado_como_no_lote(self):
        anterior = {"a": {"situacao": "ANALISADO"}, "b": {"situacao": "NO_LOTE"}, "c": {"situacao": "ELIMINADO"}}
        linhas = [
            {"id": "a", "situacao": "ANALISADO"},
            {"id": "b", "situacao": "RANQUEADO"},
            {"id": "d", "situacao": "NO_LOTE"},
        ]
        self.assertEqual(pc.mudancas_do_lote(anterior, linhas), {"ficam": 1, "entram": 1, "saem": 1})
        self.assertEqual(pc.mudancas_do_lote(None, None), {"ficam": 0, "entram": 0, "saem": 0})


class ModalidadePelaPerguntaDoSistemaDeConcorrencia(unittest.TestCase):
    """
    O 114/2026: a modalidade sai da pergunta "Indique em qual sistema de
    concorrência…" (bloco MODALIDADE da regra) e da coluna "PCD" (SIM/NÃO).
    Respostas reais da Empregare, sem dados pessoais.
    """

    PERGUNTA = "Pergunta 15 - Indique em qual sistema de concorrência você deseja se inscrever."
    REGRA = {
        "blocos": [
            {
                "codigo": "MODALIDADE",
                "tipo": "REGISTRO",
                "titulo": "Sistema de concorrência",
                "perguntas": ["Indique em qual sistema de concorrência", "PCD"],
            }
        ]
    }
    # Acúmulo e percentuais da regra de classificação do 114/2026 (FC_DOCUMENTAL_DO_EDITAL).
    COTAS_DO_114 = {"acumulo": "MAIOR_PERCENTUAL", "percentuais": {"PCD": 5, "PP": 25, "PI": 3, "PQ": 2}}

    def modalidade(self, resposta, pcd="NÃO", cotas=COTAS_DO_114, regra=REGRA):
        colunas = {self.PERGUNTA: resposta, "PCD": pcd, "SITUAÇÃO - Questionário": "FINALIZADO"}
        return pc.modalidade_do_candidato(regra, colunas, cotas)

    def test_respostas_reais_de_uma_opcao(self):
        self.assertEqual(self.modalidade('"Ampla concorrência"'), "AC")
        self.assertEqual(self.modalidade('"Pretos ou pardos"'), "PP")
        self.assertEqual(self.modalidade('"Pessoas com deficiência (PCD)"', pcd="SIM"), "PCD")
        self.assertEqual(self.modalidade('"Indígenas"'), "PI")
        self.assertEqual(self.modalidade('"Quilombolas"'), "PQ")

    def test_resposta_multipla_a_cota_prevalece_sobre_a_ampla(self):
        self.assertEqual(self.modalidade('"Ampla concorrência", "Pretos ou pardos"'), "PP")
        self.assertEqual(self.modalidade('"Ampla concorrência", "Pessoas com deficiência (PCD)"'), "PCD")
        self.assertEqual(self.modalidade('"Ampla concorrência", "Quilombolas"'), "PQ")
        self.assertEqual(self.modalidade('"Ampla concorrência", "Indígenas"'), "PI")

    def test_mais_de_uma_cota_segue_o_acumulo_da_classificacao(self):
        todas = '"Ampla concorrência", "Pretos ou pardos", "Quilombolas", "Indígenas", "Pessoas com deficiência (PCD)"'
        # MAIOR_PERCENTUAL: fica na de maior percentual (PP, 25%).
        self.assertEqual(self.modalidade(todas), "PP")
        self.assertEqual(self.modalidade('"Pretos ou pardos", "Indígenas"'), "PP")
        self.assertEqual(self.modalidade('"Ampla concorrência", "Pretos ou pardos", "Quilombolas"'), "PP")
        self.assertEqual(self.modalidade('"Indígenas", "Quilombolas"'), "PI")
        # PCD_MAIS_UMA: a PcD, quando marcada.
        self.assertEqual(self.modalidade(todas, cotas={**self.COTAS_DO_114, "acumulo": "PCD_MAIS_UMA"}), "PCD")
        # Sem a regra de classificação: a primeira na ordem de sempre (PCD, PP, PI, PQ).
        self.assertEqual(self.modalidade(todas, cotas=None), "PCD")
        self.assertEqual(self.modalidade('"Pretos ou pardos", "Indígenas"', cotas=None), "PP")

    def test_coluna_pcd_sim_conta_como_pcd(self):
        self.assertEqual(self.modalidade('"Ampla concorrência"', pcd="SIM"), "PCD")
        self.assertEqual(self.modalidade("", pcd="SIM"), "PCD")
        self.assertEqual(self.modalidade('"Ampla concorrência"', pcd="NÃO"), "AC")
        # PP marcado e PcD pela coluna: decide o acúmulo (MAIOR_PERCENTUAL → PP).
        self.assertEqual(self.modalidade('"Pretos ou pardos"', pcd="SIM"), "PP")

    def test_sem_resposta_ou_sem_bloco_e_ampla(self):
        self.assertEqual(self.modalidade(None), "AC")
        self.assertEqual(self.modalidade("Resposta não informada"), "AC")
        self.assertEqual(self.modalidade('"Pretos ou pardos"', regra={"blocos": []}), "AC")

    def test_cotas_marcadas_e_aviso_de_pergunta_ambigua(self):
        colunas = {self.PERGUNTA: '"Ampla concorrência", "Pretos ou pardos", "Indígenas"', "PCD": "SIM"}
        self.assertEqual(pc.cotas_marcadas(self.REGRA, colunas), ["PCD", "PP", "PI"])
        duas = {**colunas, "Pergunta 17 - Indique em qual sistema de concorrência você deseja se inscrever.": "x"}
        self.assertEqual(pc.perguntas_ambiguas(self.REGRA, duas), ["PERGUNTA_AMBIGUA:MODALIDADE"])

    def test_lote_do_114_com_a_distribuicao_real(self):
        """As contagens reais do lote do 114 (14/10/2026) dão a distribuição esperada."""
        respostas = [
            ('"Ampla concorrência"', "NÃO", 1052),
            ('"Pretos ou pardos"', "NÃO", 183),
            ('"Ampla concorrência", "Pretos ou pardos"', "NÃO", 47),
            ('"Pessoas com deficiência (PCD)"', "SIM", 42),
            ('"Ampla concorrência", "Pessoas com deficiência (PCD)"', "SIM", 8),
            ('"Indígenas"', "NÃO", 3),
            ('"Ampla concorrência", "Quilombolas"', "NÃO", 1),
            ('"Quilombolas"', "NÃO", 1),
            ('"Pretos ou pardos", "Indígenas"', "NÃO", 1),
            ('"Ampla concorrência", "Indígenas"', "NÃO", 1),
            (
                '"Ampla concorrência", "Pretos ou pardos", "Quilombolas", "Indígenas", "Pessoas com deficiência (PCD)"',
                "SIM",
                1,
            ),
            ('"Ampla concorrência", "Pretos ou pardos", "Quilombolas"', "NÃO", 1),
            ('"Ampla concorrência", "Pretos ou pardos", "Indígenas"', "NÃO", 1),
        ]
        candidatos = []
        for resposta, pcd, n in respostas:
            for _ in range(n):
                i = len(candidatos) + 1
                candidatos.append(
                    {
                        "id": f"c{i:04d}",
                        "codigo": str(i),
                        "ativo": True,
                        "nascimento": "1990-01-01",
                        "candidatura": "2026-09-01T00:00:00+00:00",
                        "colunas": {"NOTA - Art": 20, self.PERGUNTA: resposta, "PCD": pcd},
                    }
                )
        vaga = {
            "codigo": "1",
            "vagas_imediatas": 1,
            "cadastro_reserva": True,
            "modalidades": None,
            "nivel": None,
            "cotas": self.COTAS_DO_114,
        }
        r = pc.pre_classificar_vaga(pc.normalizar_regra(self.REGRA), vaga, candidatos, hoje="2026-10-14")
        contagem = {}
        for linha in r["linhas"]:
            contagem[linha["modalidade"]] = contagem.get(linha["modalidade"], 0) + 1
        self.assertEqual(contagem, {"AC": 1052, "PP": 234, "PCD": 50, "PI": 4, "PQ": 2})


class VariasCotasDoEdital114(unittest.TestCase):
    """
    O 114/2026 depois da v22 da regra (itens 5.1.5/5.1.6 e 5.8): a opção sai SÓ da
    pergunta do sistema de concorrência (a coluna "PCD" não dá direito à cota e
    sai das perguntas do bloco MODALIDADE); quem optou por mais de uma cota tem a
    lista (modalidades) e a principal é a de maior percentual.
    """

    PERGUNTA = ModalidadePelaPerguntaDoSistemaDeConcorrencia.PERGUNTA
    COTAS = ModalidadePelaPerguntaDoSistemaDeConcorrencia.COTAS_DO_114
    REGRA_V22 = {
        "blocos": [
            {
                "codigo": "MODALIDADE",
                "tipo": "REGISTRO",
                "titulo": "Sistema de concorrência",
                "perguntas": ["Indique em qual sistema de concorrência"],
            }
        ]
    }

    def colunas(self, resposta, pcd):
        return {self.PERGUNTA: resposta, "PCD": pcd}

    def test_so_ampla_com_pcd_sim_na_coluna_e_ampla(self):
        colunas = self.colunas('"Ampla concorrência"', "SIM")
        self.assertEqual(pc.modalidades_do_candidato(self.REGRA_V22, colunas, self.COTAS), [])
        self.assertEqual(pc.modalidade_do_candidato(self.REGRA_V22, colunas, self.COTAS), "AC")

    def test_pretos_ou_pardos_com_pcd_sim_na_coluna_e_pp(self):
        colunas = self.colunas('"Pretos ou pardos"', "SIM")
        self.assertEqual(pc.modalidades_do_candidato(self.REGRA_V22, colunas, self.COTAS), ["PP"])
        self.assertEqual(pc.modalidade_do_candidato(self.REGRA_V22, colunas, self.COTAS), "PP")

    def test_pp_e_pcd_na_pergunta_lista_as_duas_e_a_principal_e_pp(self):
        colunas = self.colunas('"Pretos ou pardos", "Pessoas com deficiência (PCD)"', "NÃO")
        self.assertEqual(pc.modalidades_do_candidato(self.REGRA_V22, colunas, self.COTAS), ["PP", "PCD"])
        self.assertEqual(pc.modalidade_do_candidato(self.REGRA_V22, colunas, self.COTAS), "PP")
        # PCD_MAIS_UMA: a PcD primeiro.
        pcd_mais_uma = {**self.COTAS, "acumulo": "PCD_MAIS_UMA"}
        self.assertEqual(pc.modalidades_do_candidato(self.REGRA_V22, colunas, pcd_mais_uma), ["PCD", "PP"])

    def test_a_linha_leva_a_lista_e_o_lote_por_modalidade_aceita_qualquer_cota_optada(self):
        def candidato(i, resposta, nota):
            return {
                "id": f"c{i}",
                "codigo": str(i),
                "ativo": True,
                "nascimento": "1990-01-01",
                "candidatura": "2026-09-01T00:00:00+00:00",
                "colunas": {"NOTA - Art": nota, self.PERGUNTA: resposta},
            }

        candidatos = [
            candidato(1, '"Ampla concorrência"', 30),
            candidato(2, '"Pretos ou pardos", "Pessoas com deficiência (PCD)"', 20),
            candidato(3, '"Pretos ou pardos"', 25),
        ]
        regra = pc.normalizar_regra(
            {
                **self.REGRA_V22,
                "lote": {"base": "MULTIPLO_VAGAS", "multiplo": 1, "inclui_cr": False, "por_modalidade": True},
            }
        )
        vaga = {
            "codigo": "1",
            "vagas_imediatas": 3,
            "cadastro_reserva": False,
            "modalidades": {"Ampla concorrência": 1, "Pretos e pardos": 1, "PcD": 1},
            "nivel": None,
            "cotas": self.COTAS,
        }
        r = pc.pre_classificar_vaga(regra, vaga, candidatos, hoje="2026-10-15")
        por_id = {linha["id"]: linha for linha in r["linhas"]}
        self.assertEqual(por_id["c2"]["modalidades"], ["PP", "PCD"])
        self.assertEqual(por_id["c2"]["modalidade"], "PP")
        self.assertEqual(por_id["c1"]["modalidades"], [])
        # A vaga PP foi para quem tem a maior nota entre os PP (c3); c2 entra pela PcD (5.8.1).
        self.assertEqual(por_id["c1"]["lista_lote"], "AC")
        self.assertEqual(por_id["c3"]["lista_lote"], "PP")
        self.assertEqual(por_id["c2"]["lista_lote"], "PCD")
        self.assertEqual(por_id["c2"]["situacao"], "NO_LOTE")


if __name__ == "__main__":
    unittest.main()
