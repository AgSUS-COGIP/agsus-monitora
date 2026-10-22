"""
Inscrições congeladas e o registro dos disparos (migration
20261020170000_inscricoes_congeladas.sql): o robô da Empregare pula o edital
congelado sem filtro e recusa o pedido explícito; o modo "só anexos" pede a
liberação (ou --seco) desde 20261022170000;
o override (--forcar-congelado) vai ao banco e a execução registra o uso; a
pré-classificação faz o mesmo; e o registro das execuções iniciadas direto no
GitHub (python/monitora/disparo_externo.py) nunca derruba o robô. Banco falso:
nada fala com a Empregare nem com o Supabase.
"""

import io
import json
import pathlib
import sys
import unittest
from contextlib import redirect_stdout
from unittest import mock

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))
sys.path.insert(0, str(_RAIZ / "python"))

import pre_classificacao as job  # noqa: E402
import robo_empregare as robo  # noqa: E402
import so_anexos  # noqa: E402

from monitora import disparo_externo, supabase_rpc  # noqa: E402

LIBERACAO = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
E114 = "bcecfb08-88ef-4e06-8401-bcad6bf88fd0"
USUARIO = "00000000-0000-4000-a000-0000000000aa"
URL = "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/123456789"
SEM_FUNCAO = supabase_rpc.ErroDoSupabase("x", 404, '{"code":"PGRST202","message":"Could not find the function"}')


class BancoDoRobo:
    """listar_vagas_empregare devolve `lista`; registra todas as chamadas."""

    def __init__(self, lista, sem_trava=False, uso=None):
        self.lista = lista
        self.sem_trava = sem_trava
        self.uso = uso if uso is not None else {"editais": ["114/2026"]}
        self.chamadas = []

    def __call__(self, _config, funcao, corpo, tentativas=None):
        self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
        if funcao == "listar_vagas_empregare":
            if self.sem_trava and "p_finalidade" in corpo:
                raise SEM_FUNCAO
            return self.lista
        if funcao == "registrar_uso_liberacao_congelamento":
            return self.uso
        raise AssertionError(f"o robô não devia chamar {funcao} aqui")

    def de(self, funcao):
        return [c for f, c in self.chamadas if f == funcao]


def congelada(pedido):
    return {"edital_id": E114, "edital": "114/2026", "vagas": 30, "pedido": pedido}


def rodar_robo(banco, lista_de_args):
    saida = io.StringIO()
    with (
        mock.patch.object(robo.supabase_rpc, "chamar", banco),
        mock.patch.object(robo.supabase_rpc, "configuracao", return_value={"url": "https://x", "chave": "k"}),
        mock.patch.object(robo.nav, "credenciais", side_effect=AssertionError("não devia entrar na Empregare")),
        redirect_stdout(saida),
    ):
        codigo = robo.principal(robo.argumentos(lista_de_args))
    return codigo, saida.getvalue()


class RoboDaEmpregare(unittest.TestCase):
    def test_lista_da_carga_pede_a_finalidade_carga_e_a_liberacao(self):
        banco = BancoDoRobo({"modo": "EDITAIS", "vagas": [], "congeladas": []})
        args = robo.argumentos(["--editais", "114/2026", "--forcar-congelado", LIBERACAO.upper()])
        robo.listar_vagas({}, args, banco)
        corpo = banco.de("listar_vagas_empregare")[0]
        self.assertEqual((corpo["p_finalidade"], corpo["p_liberacao"]), ("carga", LIBERACAO))
        self.assertEqual(corpo["p_editais"], ["114/2026"])

    def test_banco_sem_a_trava_falha_em_vez_de_carregar_sem_ela(self):
        banco = BancoDoRobo({"modo": "PADRAO", "vagas": [{"vaga": "1"}]}, sem_trava=True)
        with self.assertRaises(supabase_rpc.ErroDoSupabase):
            robo.listar_vagas({}, robo.argumentos([]), banco)
        self.assertEqual(len(banco.de("listar_vagas_empregare")), 1)

    def test_edital_congelado_explicito_recusa_sem_entrar_na_empregare(self):
        banco = BancoDoRobo({"modo": "EDITAIS", "limite": 60, "vagas": [], "congeladas": [congelada(True)]})
        codigo, saida = rodar_robo(banco, ["--editais", "114/2026"])
        self.assertEqual(codigo, 1)
        self.assertIn("Recusado: inscrições congeladas em 114/2026 (30 vaga(s))", saida)
        self.assertIn("Nada foi exportado nem gravado", saida)
        self.assertEqual([f for f, _ in banco.chamadas], ["listar_vagas_empregare"])

    def test_vaga_explicita_de_edital_congelado_tambem_recusa_no_modo_forcar(self):
        banco = BancoDoRobo({"modo": "VAGAS", "limite": 60, "vagas": [], "congeladas": [congelada(True)]})
        codigo, _ = rodar_robo(banco, ["--vagas", "182514", "--forcar"])
        self.assertEqual(codigo, 1)
        self.assertEqual(banco.de("iniciar_sync_empregare"), [])

    def test_sem_filtro_o_congelado_so_e_pulado(self):
        lista = {"modo": "PADRAO", "limite": 60, "vagas": [{"vaga": "1", "edital": "93/2026"}]}
        lista["congeladas"] = [congelada(False)]
        banco = BancoDoRobo(lista)
        codigo, saida = rodar_robo(banco, ["--seco"])
        self.assertEqual(codigo, 0)
        self.assertIn("Editais com inscrições congeladas (pulados): 114/2026 (30 vaga(s))", saida)
        self.assertNotIn("seria recusado", saida)

    def test_seco_explicito_avisa_que_seria_recusado(self):
        banco = BancoDoRobo({"modo": "EDITAIS", "limite": 60, "vagas": [], "congeladas": [congelada(True)]})
        codigo, saida = rodar_robo(banco, ["--seco", "--editais", "114/2026"])
        self.assertEqual(codigo, 0)
        self.assertIn("Num modo que grava, este pedido seria recusado.", saida)

    def test_forcar_congelado_so_com_token_valido_e_no_so_anexos_sem_seco(self):
        with redirect_stdout(io.StringIO()), mock.patch("sys.stderr", io.StringIO()):
            with self.assertRaises(SystemExit) as falha:
                robo.argumentos(["--forcar-congelado", "114/2026"])
            self.assertEqual(falha.exception.code, 3)  # entrada inválida, não o 2 do parcial
            with self.assertRaises(SystemExit):
                robo.argumentos(["--so-anexos", "--editais", "114/2026", "--seco", "--forcar-congelado", LIBERACAO])
            with self.assertRaises(SystemExit):
                robo.argumentos(["--fumaca", "--forcar-congelado", LIBERACAO])
        self.assertEqual(robo.argumentos(["--forcar-congelado", f" {LIBERACAO} "]).forcar_congelado, LIBERACAO)
        # Só anexos grava (respostas e anexos): com a liberação, vale também no edital congelado.
        args = robo.argumentos(["--so-anexos", "--editais", "114/2026", "--forcar-congelado", LIBERACAO])
        self.assertEqual(args.forcar_congelado, LIBERACAO)

    def test_uso_da_liberacao_registrado_e_falha_vira_aviso(self):
        banco = BancoDoRobo({})
        linha = robo.usar_liberacao({}, LIBERACAO, "gh-20261020T120000-abcdef12", banco)
        self.assertIn("liberadas em 114/2026", linha)
        self.assertEqual(
            banco.de("registrar_uso_liberacao_congelamento")[0],
            {"p_liberacao": LIBERACAO, "p_execucao": "gh-20261020T120000-abcdef12"},
        )
        self.assertIn("vencido", robo.usar_liberacao({}, LIBERACAO, "gh-x-12345678", BancoDoRobo({}, uso={})))

        def falha(*_a, **_k):
            raise supabase_rpc.ErroDoSupabase("registrar_uso_liberacao_congelamento", 500, "fora do ar")

        self.assertIn("NÃO registrado", robo.usar_liberacao({}, LIBERACAO, "gh-x-12345678", falha))
        self.assertIsNone(robo.usar_liberacao({}, "", "gh-x-12345678", falha))

    def test_modo_so_anexos_pede_as_vagas_com_a_finalidade_anexos(self):
        banco = BancoDoRobo({"vagas": [{"vaga": "182514", "congelada": True}]})

        class Args:
            vagas = []
            editais = ["114/2026"]
            limite = 60

        self.assertEqual(so_anexos.vagas_pedidas(Args, {}, banco), [{"vaga": "182514", "congelada": True}])
        self.assertEqual(banco.de("listar_vagas_empregare")[0]["p_finalidade"], "anexos")
        banco = BancoDoRobo({"vagas": [{"vaga": "1"}]}, sem_trava=True)
        with self.assertRaises(supabase_rpc.ErroDoSupabase):
            so_anexos.vagas_pedidas(Args, {}, banco)


class BancoDaPre:
    def __init__(self, contexto):
        self.contexto = contexto
        self.chamadas = []

    def __call__(self, _cfg, funcao, corpo, **_opcoes):
        self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
        if funcao == "pre_classificacao_ler_editais":
            return self.contexto
        if funcao == "iniciar_pre_classificacao":
            return {"execucao": corpo["p_execucao"]}
        if funcao == "registrar_uso_liberacao_congelamento":
            return {"editais": ["114/2026"]}
        if funcao == "finalizar_pre_classificacao":
            return {"situacao": "CONCLUIDA", "vagas": 0, "lote": 0}
        raise AssertionError(funcao)

    def de(self, funcao):
        return [c for f, c in self.chamadas if f == funcao]


def rodar_pre(banco, lista):
    saida = io.StringIO()
    with redirect_stdout(saida):
        codigo = job.principal(job.argumentos(lista), configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco)
    return codigo, saida.getvalue()


class PreClassificacao(unittest.TestCase):
    def test_refazer_lote_do_edital_congelado_e_recusado_sem_gravar(self):
        banco = BancoDaPre(
            {"hoje": "2026-10-20", "editais": [], "congelados": [{"id": E114, "rotulo": "114/2026", "pedido": True}]}
        )
        with mock.patch.dict("os.environ", {"MODO": "refazer_lote"}):
            codigo, saida = rodar_pre(banco, ["--editais", E114])
        self.assertEqual(codigo, 1)
        self.assertIn("Recusado: inscrições congeladas em 114/2026", saida)
        self.assertEqual(banco.de("iniciar_pre_classificacao"), [])
        self.assertFalse(banco.de("pre_classificacao_ler_editais")[0]["p_incluir_congelados"])

    def test_apos_robo_pula_o_congelado_e_segue(self):
        banco = BancoDaPre(
            {"hoje": "2026-10-20", "editais": [], "congelados": [{"id": E114, "rotulo": "114/2026", "pedido": False}]}
        )
        codigo, saida = rodar_pre(banco, ["--apos-robo"])
        self.assertEqual(codigo, 0)
        self.assertIn("Inscrições congeladas (não recalculado): 114/2026", saida)

    def test_seco_inclui_o_congelado_e_o_override_e_registrado(self):
        banco = BancoDaPre({"hoje": "2026-10-20", "editais": []})
        rodar_pre(banco, ["--seco", "--editais", "114/2026"])
        self.assertTrue(banco.de("pre_classificacao_ler_editais")[0]["p_incluir_congelados"])
        banco = BancoDaPre({"hoje": "2026-10-20", "editais": []})
        codigo, saida = rodar_pre(banco, ["--editais", "114/2026", "--forcar-congelado", LIBERACAO])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.de("pre_classificacao_ler_editais")[0]["p_liberacao"], LIBERACAO)
        uso = banco.de("registrar_uso_liberacao_congelamento")[0]
        self.assertEqual(uso["p_liberacao"], LIBERACAO)
        self.assertTrue(uso["p_execucao"].startswith("precl-"))
        self.assertIn("Override do administrador global registrado nesta execução: 114/2026", saida)


class RegistroDeDisparoExterno(unittest.TestCase):
    AMBIENTE = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "AgSUS-COGIP/agsus-monitora",
        "GITHUB_RUN_ID": "123456789",
        "ATOR_GITHUB": "fulano",
        "DISPARADO_POR": "",
        "MODO": "normal",
        "EDITAIS": "114/2026, 93/2026",
        "VAGAS": "182514,182515",
        "LIMITE": "60",
    }

    def registrar(self, ambiente, chamar):
        linhas = []
        disparo = disparo_externo.registrar(
            "robo-empregare.yml", ambiente, chamar=chamar, configuracao=lambda ambiente: {}, imprimir=linhas.append
        )
        return disparo, linhas

    def test_registra_com_ator_url_e_resumo_sem_candidatos(self):
        chamadas = []
        disparo, _ = self.registrar(
            self.AMBIENTE, lambda _c, f, corpo, **opcoes: chamadas.append((f, corpo, opcoes)) or 42
        )
        self.assertEqual(disparo, 42)
        # Uma tentativa só: o registro não atrasa o robô.
        self.assertEqual(chamadas[0][2], {"tentativas": 1})
        funcao, corpo, _ = chamadas[0]
        self.assertEqual(funcao, "registrar_disparo_externo")
        self.assertEqual((corpo["p_workflow"], corpo["p_ator"], corpo["p_url"]), ("robo-empregare.yml", "fulano", URL))
        self.assertEqual(corpo["p_resumo"], "modo normal · editais 114/2026, 93/2026 · 2 vaga(s) · limite 60")

    def test_pula_o_que_o_banco_ja_registrou(self):
        for valor in (USUARIO, "AGENDA", "manual", "robo"):
            chamadas = []
            disparo, linhas = self.registrar({**self.AMBIENTE, "DISPARADO_POR": valor}, chamadas.append)
            self.assertIsNone(disparo)
            self.assertEqual(chamadas, [])
            self.assertIn("já registrada", linhas[0])

    def test_falha_nunca_derruba_e_vira_aviso(self):
        def fora(*_a, **_k):
            raise supabase_rpc.ErroDoSupabase("registrar_disparo_externo", 500, "fora do ar")

        disparo, linhas = self.registrar(self.AMBIENTE, fora)
        self.assertIsNone(disparo)
        self.assertTrue(linhas[0].startswith("::warning::Execução NÃO registrada"))

        def sem_funcao(*_a, **_k):
            raise SEM_FUNCAO

        _, linhas = self.registrar(self.AMBIENTE, sem_funcao)
        self.assertIn("migration 20261020170000", linhas[0])
        self.assertEqual(disparo_externo.main(["outro.yml"]), 0)

    def test_fora_do_github_nao_registra(self):
        disparo, linhas = self.registrar({"DISPARADO_POR": ""}, lambda *a: 1 / 0)
        self.assertIsNone(disparo)
        self.assertIn("Fora do GitHub Actions", linhas[0])


if __name__ == "__main__":
    unittest.main()
