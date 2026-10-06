"""
Testes da base Python comum (python/monitora/): configuração com erro claro,
mascaramento, logging sem dado pessoal, chamadas às RPCs (com servidor falso)
e dados da execução. Nada fala com o Supabase.

    python -m pytest tests/python
"""

import io
import json
import logging
import pathlib
import sys
import tempfile
import unittest
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

from monitora import config, execucao, mascaramento, registro, supabase_rpc  # noqa: E402

CPF_FICTICIO = "00000000191"  # CPF de teste conhecido, não pertence a ninguém
JWT_FICTICIO = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2VncmVkby1maWN0aWNpbw"


class Configuracao(unittest.TestCase):
    def test_falta_variavel_cita_o_nome_e_a_dica(self):
        with self.assertRaises(config.ErroDeConfiguracao) as falha:
            config.ler("X_FALTANDO", dica="Configure no Actions.", ambiente={})
        self.assertIn("X_FALTANDO", str(falha.exception))
        self.assertIn("Configure no Actions.", str(falha.exception))

    def test_formato_invalido_nao_mostra_o_valor(self):
        with self.assertRaises(config.ErroDeConfiguracao) as falha:
            config.ler("URL", aceitar=lambda v: v.startswith("https://"), ambiente={"URL": "segredo-123"})
        self.assertNotIn("segredo-123", str(falha.exception))

    def test_opcional_e_inteiro(self):
        self.assertEqual(config.ler("NADA", obrigatoria=False, padrao="x", ambiente={}), "x")
        self.assertEqual(config.inteiro("N", padrao=15, ambiente={}), 15)
        self.assertEqual(config.inteiro("N", padrao=15, ambiente={"N": " 30 "}), 30)
        with self.assertRaises(config.ErroDeConfiguracao):
            config.inteiro("N", padrao=15, minimo=1, maximo=90, ambiente={"N": "120"})
        with self.assertRaises(config.ErroDeConfiguracao):
            config.inteiro("N", padrao=15, ambiente={"N": "quinze"})

    def test_supabase_exige_https_e_chave(self):
        with self.assertRaises(SystemExit):
            supabase_rpc.configuracao(ambiente={"SUPABASE_URL": "http://inseguro"})
        with self.assertRaises(SystemExit) as falha:
            supabase_rpc.configuracao(ambiente={"SUPABASE_URL": "https://x.supabase.co"})
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", str(falha.exception))
        cfg = supabase_rpc.configuracao(
            ambiente={"VITE_SUPABASE_URL": "https://x.supabase.co/", "SUPABASE_SERVICE_ROLE_KEY": "k"}
        )
        self.assertEqual(cfg, {"url": "https://x.supabase.co", "chave": "k"})


class Mascaramento(unittest.TestCase):
    def test_token_jwt_e_variavel_secreta(self):
        saida = mascaramento.mascarar(f"Bearer {JWT_FICTICIO} falhou", credenciais=[])
        self.assertNotIn(JWT_FICTICIO, saida)
        self.assertIn("<token>", saida)

    def test_codigos_do_sistema_passam(self):
        texto = "edital 101/2026 vaga 177979 aviso 0b8f2a8e-1111-4c2d-9e3f-123456789abc"
        self.assertEqual(mascaramento.mascarar(texto, credenciais=[]), texto)


class Registro(unittest.TestCase):
    def test_log_nunca_imprime_dado_pessoal(self):
        saida = io.StringIO()
        log = registro.registro("teste-mascara", saida=saida)
        log.info("falhou para %s, CPF %s", "pessoa@exemplo.invalid", CPF_FICTICIO)
        try:
            raise RuntimeError(f"resposta trouxe {CPF_FICTICIO}")
        except RuntimeError:
            log.exception("erro")
        texto = saida.getvalue()
        self.assertNotIn("pessoa@exemplo.invalid", texto)
        self.assertNotIn(CPF_FICTICIO, texto)
        self.assertIn("<cpf>", texto)
        self.assertEqual(len(log.handlers), 1)
        registro.registro("teste-mascara", saida=saida)
        self.assertEqual(len(logging.getLogger("monitora.teste-mascara").handlers), 1)


class _Resposta:
    def __init__(self, corpo):
        self._corpo = corpo

    def read(self):
        return self._corpo.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class ChamadaDeRpc(unittest.TestCase):
    CFG = {"url": "https://x.supabase.co", "chave": "k"}

    def test_monta_o_pedido_e_le_o_json(self):
        pedidos = []

        def abrir(pedido, timeout):
            pedidos.append(pedido)
            return _Resposta(json.dumps({"ok": True}))

        self.assertEqual(supabase_rpc.chamar(self.CFG, "funcao_x", {"p": 1}, abrir=abrir), {"ok": True})
        self.assertEqual(pedidos[0].full_url, "https://x.supabase.co/rest/v1/rpc/funcao_x")
        self.assertEqual(json.loads(pedidos[0].data), {"p": 1})

    def test_erro_4xx_nao_repete_e_mascara(self):
        chamadas = []

        def abrir(pedido, timeout):
            chamadas.append(1)
            raise urllib.error.HTTPError(pedido.full_url, 400, "x", {}, io.BytesIO(f"CPF {CPF_FICTICIO}".encode()))

        with self.assertRaises(supabase_rpc.ErroDoSupabase) as falha:
            supabase_rpc.chamar(self.CFG, "f", {}, abrir=abrir, esperar=lambda s: None)
        self.assertEqual(len(chamadas), 1)
        self.assertNotIn(CPF_FICTICIO, str(falha.exception))

    def test_erro_do_postgrest_nao_traz_a_linha_recusada(self):
        corpo = json.dumps(
            {
                "code": "23502",
                "message": 'null value in column "NO_CANDIDATO" violates not-null constraint',
                "details": "Failing row contains (Maria Fictícia da Silva, 1990-01-01).",
                "hint": None,
            }
        ).encode()

        def abrir(pedido, timeout):
            raise urllib.error.HTTPError(pedido.full_url, 400, "x", {}, io.BytesIO(corpo))

        with self.assertRaises(supabase_rpc.ErroDoSupabase) as falha:
            supabase_rpc.chamar(self.CFG, "f", {}, abrir=abrir, esperar=lambda s: None)
        self.assertIn("23502", str(falha.exception))
        self.assertNotIn("Maria", str(falha.exception))
        self.assertNotIn("1990", str(falha.exception))

    def test_conexao_derrubada_repete(self):
        import http.client

        chamadas = []

        def abrir(pedido, timeout):
            chamadas.append(1)
            raise http.client.RemoteDisconnected("caiu")

        with self.assertRaises(supabase_rpc.ErroDoSupabase):
            supabase_rpc.chamar(self.CFG, "f", {}, abrir=abrir, esperar=lambda s: None)
        self.assertEqual(len(chamadas), 3)

    def test_5xx_repete(self):
        chamadas = []

        def abrir(pedido, timeout):
            chamadas.append(1)
            raise urllib.error.HTTPError(pedido.full_url, 503, "x", {}, io.BytesIO(b"fora"))

        with self.assertRaises(supabase_rpc.ErroDoSupabase):
            supabase_rpc.chamar(self.CFG, "f", {}, abrir=abrir, esperar=lambda s: None)
        self.assertEqual(len(chamadas), 3)


class Execucao(unittest.TestCase):
    def test_disparo(self):
        self.assertEqual(execucao.disparo("agenda"), ("AGENDA", None))
        self.assertEqual(execucao.disparo(""), ("GITHUB", None))
        uid = "0b8f2a8e-1111-4c2d-9e3f-123456789abc"
        self.assertEqual(execucao.disparo(uid.upper()), ("MONITORA", uid))

    def test_resumo_vai_para_a_pagina_da_execucao_mascarado(self):
        with tempfile.TemporaryDirectory() as pasta:
            arquivo = pathlib.Path(pasta) / "resumo.md"
            execucao.resumir(
                "Título",
                ["contato pessoa@exemplo.invalid"],
                ambiente={"GITHUB_STEP_SUMMARY": str(arquivo)},
                imprimir=lambda *a, **k: None,
            )
            texto = arquivo.read_text(encoding="utf-8")
        self.assertIn("## Título", texto)
        self.assertNotIn("pessoa@exemplo.invalid", texto)


class FuncaoDaVercelImportaABase(unittest.TestCase):
    """Uma função api/*.py enxerga python/monitora pelo mesmo caminho relativo."""

    def test_caminho_relativo_da_api(self):
        raiz = pathlib.Path(__file__).resolve().parents[2]
        self.assertTrue((raiz / "api").is_dir())
        self.assertTrue((raiz / "python" / "monitora" / "__init__.py").is_file())
        vercel = json.loads((raiz / "vercel.json").read_text(encoding="utf-8"))
        for nome, opcoes in vercel.get("functions", {}).items():
            if nome.endswith(".py") and "monitora" in (raiz / nome).read_text(encoding="utf-8"):
                self.assertIn("python/monitora/**", opcoes.get("includeFiles", ""), nome)


if __name__ == "__main__":
    unittest.main()
