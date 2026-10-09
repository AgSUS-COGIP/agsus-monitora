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
    parece_dado_pessoal,
    pede_dado_pessoal,
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


class DadoPessoalForaDoResumo(unittest.TestCase):
    PEDEM = [
        "Pergunta 2 - Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00",
        "Pergunta 3 - Informe sua data de nascimento (dd/mm/aaaa)",
        "Pergunta 4 - Número do RG",
        "Pergunta 5 - Seu e-mail para contato",
        "Pergunta 6 - Telefone / celular (WhatsApp)",
        "Pergunta 7 - Endereço completo",
        "Pergunta 8 - CEP",
        "Pergunta 9 - Nome da mãe",
        "Pergunta 10 - Número do PIS/NIS",
        "Pergunta 11 - Matrícula no conselho de classe",
        "Pergunta 12 - EMAIL",
    ]
    NAO_PEDEM = [
        "Pergunta 1 - Sistema de concorrência",
        "Pergunta 13 - Experiência Profissional em atividades compatíveis com o cargo",
        "Pergunta 14 - Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo",
        "Pergunta 15 - Possui curso de pós-graduação (especialização)?",
    ]

    def test_enunciados_que_pedem_dado_pessoal(self):
        for coluna in self.PEDEM:
            self.assertTrue(pede_dado_pessoal(coluna), coluna)
        for coluna in self.NAO_PEDEM:
            self.assertFalse(pede_dado_pessoal(coluna), coluna)

    def test_pergunta_de_dado_pessoal_entra_sem_respostas_e_marcada(self):
        cpf = self.PEDEM[0]
        linhas = [{cpf: "--"}, {cpf: "--"}, {cpf: "000.000.001-91"}, {cpf: "000.000.001-91"}, {cpf: "x"}]
        [p] = resumir_perguntas([cpf], linhas)
        self.assertEqual(p, {"coluna": cpf, "respostas": [], "outras": 3, "distintas": 3, "dado_pessoal": True})
        self.assertNotIn("000.000.001-91", str(p))

    def test_respostas_com_cara_de_dado_pessoal_viram_outras(self):
        for valor in [
            "00000000191",
            "000.000.001-91",
            "000000001-91",
            "pessoa.ficticia@exemplo.invalid",
            "(61) 99999-0000",
            "+55 61 3333-0000",
            "61999990000",
            "99999-0000",
            "70000-000",
            "70.000-000",
            "70000000",
        ]:
            self.assertTrue(parece_dado_pessoal(valor), valor)
        for valor in ["Ampla concorrência", "2 anos e 6 meses", "10 pontos", "--", "2026", "1", "Sim"]:
            self.assertFalse(parece_dado_pessoal(valor), valor)

        p5 = "Pergunta 5 - Sistema de concorrência"
        linhas = [
            {p5: "Ampla concorrência"},
            {p5: "Ampla concorrência"},
            {p5: "00000000191"},
            {p5: "00000000191"},  # repetido, mas é CPF: não sai
            {p5: "pessoa.ficticia@exemplo.invalid"},
            {p5: "pessoa.ficticia@exemplo.invalid"},
            {p5: "Única"},
        ]
        [p] = resumir_perguntas([p5], linhas)
        self.assertEqual(p["respostas"], [{"valor": "Ampla concorrência", "quantidade": 2}])
        self.assertEqual((p["outras"], p["distintas"]), (3, 4))
        self.assertNotIn("dado_pessoal", p)
        self.assertNotIn("00000000191", str(p))


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
