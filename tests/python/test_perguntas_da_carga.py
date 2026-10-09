"""
Resumo das perguntas da carga da Empregare (migration 20261009180000):
a conta em python/monitora/avaliacao_documental/perguntas_da_carga.py e o
passo do robô em scripts/robo-empregare/resumo_das_perguntas.py.
Dados fictícios.
"""

import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "python"))

import resumo_das_perguntas  # noqa: E402

from monitora import supabase_rpc  # noqa: E402
from monitora.avaliacao_documental.perguntas_da_carga import (  # noqa: E402
    eh_coluna_de_pergunta,
    resumir_perguntas,
    texto_da_resposta,
)

P5 = "Pergunta 5 - Sistema de concorrência"
P10 = "Pergunta 10 - Escolaridade"
P2 = "Pergunta 2 - Nome social"


class ContaDoResumo(unittest.TestCase):
    def test_so_colunas_de_pergunta_na_ordem_do_numero(self):
        colunas = [P10, "Nome", P5, "pergunta 3 - minúscula", "Perguntas gerais", P5, "Pergunta sem número"]
        resumo = resumir_perguntas(colunas, [])
        self.assertEqual(
            [p["coluna"] for p in resumo],
            [P5, P10, "pergunta 3 - minúscula", "Pergunta sem número"],  # como antes: número só com "Pergunta"
        )
        self.assertTrue(eh_coluna_de_pergunta("PERGUNTA 1 - x"))
        self.assertFalse(eh_coluna_de_pergunta("Perguntas gerais"))

    def test_resposta_unica_vira_outras(self):
        linhas = [
            {P5: "Ampla concorrência"},
            {P5: "Ampla concorrência"},
            {P5: "Pessoa Fictícia da Silva"},  # texto livre que aparece uma vez: não sai
            {P5: "PcD"},
            {P5: "PcD"},
            {P5: "PcD"},
        ]
        [p] = resumir_perguntas([P5], linhas)
        self.assertEqual(
            p["respostas"],
            [{"valor": "PcD", "quantidade": 3}, {"valor": "Ampla concorrência", "quantidade": 2}],
        )
        self.assertEqual((p["outras"], p["distintas"]), (1, 3))
        self.assertNotIn("Pessoa Fictícia da Silva", str(p))

    def test_ate_30_respostas_as_mais_frequentes(self):
        linhas = [{P5: f"Opção {i:02d}"} for i in range(40) for _ in range(2 + (i % 3))]
        [p] = resumir_perguntas([P5], linhas)
        self.assertEqual(len(p["respostas"]), 30)
        self.assertEqual(p["distintas"], 40)
        self.assertEqual(p["outras"], 0)
        quantidades = [r["quantidade"] for r in p["respostas"]]
        self.assertEqual(quantidades, sorted(quantidades, reverse=True))

    def test_apara_espacos_corta_em_200_e_ignora_vazias(self):
        longa = "x" * 250
        linhas = [{P5: f"  {longa}  "}, {P5: longa}, {P5: "   "}, {P5: None}, {}, "não é linha"]
        [p] = resumir_perguntas([P5], linhas)
        self.assertEqual(p["respostas"], [{"valor": "x" * 200, "quantidade": 2}])
        self.assertEqual(texto_da_resposta(7), "7")
        self.assertEqual(texto_da_resposta("\t a \t"), "\t a \t")  # como o btrim: só espaços

    def test_soma_as_vagas_do_edital(self):
        vaga_a = [{P2: "Não"}, {P5: "PcD"}]
        vaga_b = [{P2: "Não", P5: "PcD"}]
        resumo = resumir_perguntas([P5, P2], vaga_a + vaga_b)
        self.assertEqual(
            resumo,
            [
                {"coluna": P2, "respostas": [{"valor": "Não", "quantidade": 2}], "outras": 0, "distintas": 1},
                {"coluna": P5, "respostas": [{"valor": "PcD", "quantidade": 2}], "outras": 0, "distintas": 1},
            ],
        )


class PassoDoRobo(unittest.TestCase):
    PENDENTES = {
        "editais": [
            {"edital": "e1", "numero": "114/2026", "hash": "h1", "vagas": ["1", "2"], "colunas": [P5]},
            {"edital": "e2", "numero": "80/2026", "hash": "h2", "vagas": ["3"], "colunas": [P5]},
        ]
    }

    def _chamar(self, gravacoes, recusar=None):
        def chamar(_config, funcao, corpo, tentativas=3):
            if funcao == "listar_resumos_pergunta_pendentes":
                return self.PENDENTES
            if funcao == "ler_respostas_pergunta_vaga":
                return {"vaga": corpo["p_vaga"], "candidatos": 3, "linhas": [{P5: "PcD"}, {P5: "PcD"}]}
            if funcao == "gravar_resumo_pergunta_edital":
                if recusar == corpo["p_edital"]:
                    raise supabase_rpc.ErroDoSupabase(funcao, 400, "40001: A carga do edital mudou")
                gravacoes.append(corpo)
                return {"perguntas": len(corpo["p_perguntas"])}
            raise AssertionError(funcao)

        return chamar

    def test_resume_cada_edital_e_grava_com_a_assinatura(self):
        gravacoes, log = [], []
        feitos, falhas = resumo_das_perguntas.resumir_editais({}, log.append, self._chamar(gravacoes))
        self.assertEqual((feitos, falhas), (2, 0))
        primeiro = gravacoes[0]
        self.assertEqual((primeiro["p_edital"], primeiro["p_hash"], primeiro["p_candidatos"]), ("e1", "h1", 6))
        self.assertEqual(primeiro["p_perguntas"][0]["respostas"], [{"valor": "PcD", "quantidade": 4}])
        self.assertIn("114/2026", log[0])
        self.assertNotIn("PcD", " ".join(log))  # o log público leva só contagens

    def test_carga_que_mudou_no_meio_fica_para_a_proxima(self):
        gravacoes, log = [], []
        feitos, falhas = resumo_das_perguntas.resumir_editais({}, log.append, self._chamar(gravacoes, recusar="e1"))
        self.assertEqual((feitos, falhas), (1, 1))
        self.assertIn("fica para a próxima", log[0])
        self.assertEqual([g["p_edital"] for g in gravacoes], ["e2"])


class RoboComOResumo(unittest.TestCase):
    def setUp(self):
        sys.modules.pop("robo_empregare", None)
        import robo_empregare

        self.robo = robo_empregare

    def test_banco_sem_a_migration_avisa_sem_falhar(self):
        def chamar(_config, funcao, corpo, tentativas=3):
            raise supabase_rpc.ErroDoSupabase(funcao, 404, "PGRST202: function not found")

        linha, falhou = self.robo.resumir_perguntas({}, chamar=chamar)
        self.assertIn("20261009180000", linha)
        self.assertFalse(falhou)

    def test_resumo_que_falha_nao_derruba(self):
        def chamar(_config, funcao, corpo, tentativas=3):
            raise supabase_rpc.ErroDoSupabase(funcao, 500, "erro")

        linha, falhou = self.robo.resumir_perguntas({}, chamar=chamar)
        self.assertIn("NÃO atualizado", linha)
        self.assertTrue(falhou)

    def test_argumento_so_resumir(self):
        args = self.robo.argumentos(["--resumir-perguntas", "--editais", "114/2026", "--forcar"])
        self.assertTrue(args.resumir_perguntas)
        self.assertEqual(args.editais, ["114/2026"])
        self.assertTrue(args.forcar)


if __name__ == "__main__":
    unittest.main()
