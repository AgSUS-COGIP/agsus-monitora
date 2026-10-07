"""
Testes do expurgo diário dos anexos do chat (python/monitora/chat/expurgo.py e
scripts/expurgo_anexos_chat/): lotes, falha parcial que fica na fila, modo
seco que não remove, o registro da execução e o log sem caminho nenhum. O
banco e o Storage são falsos; nada fala com o Supabase.

    python -m pytest tests/python
"""

import io
import json
import logging
import pathlib
import sys
import unittest
import urllib.error
import uuid
from contextlib import redirect_stdout
from datetime import UTC, datetime

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "expurgo_anexos_chat"))
sys.path.insert(0, str(_RAIZ / "python"))

import expurgo_anexos_chat  # noqa: E402

from monitora.chat import expurgo  # noqa: E402
from monitora.registro import registro  # noqa: E402

USUARIO = "00000000-0000-4000-a000-0000000000a1"


def caminho(n):
    conversa = uuid.UUID(int=n, version=4)
    arquivo = uuid.UUID(int=10_000 + n, version=4)
    return f"{conversa}/{arquivo}.pdf"


class BancoFalso:
    """A fila de expurgo e o bucket: preparar devolve até 100 da fila; confirmar só o que saiu do bucket."""

    def __init__(self, quantos, falham=()):
        self.fila = [caminho(n) for n in range(quantos)]
        self.bucket = set(self.fila)
        self.falham = set(falham)  # o Storage não remove estes
        self.chamadas = []
        self.remocoes = []
        self.registros = []

    def chamar(self, funcao, corpo, **_opcoes):
        self.chamadas.append(funcao)
        if funcao == "preparar_expurgo_anexos_chat":
            return {"bucket": "chat-anexos", "pendentes": len(self.fila), "caminhos": self.fila[:100]}
        if funcao == "confirmar_expurgo_anexos_chat":
            saem = [c for c in corpo["p_caminhos"] if c in self.fila and c not in self.bucket]
            self.fila = [c for c in self.fila if c not in saem]
            return {"confirmados": len(saem), "pendentes": len(self.fila)}
        if funcao == "registrar_expurgo_anexos_chat":
            self.registros.append(corpo)
            if corpo["p_erro"]:
                situacao = "FALHOU"
            elif corpo["p_contagens"]["falhas"]:
                situacao = "PARCIAL"
            else:
                situacao = "CONCLUIDA"
            return {"execucao": corpo["p_execucao"], "situacao": situacao}
        raise AssertionError(f"RPC inesperada: {funcao}")

    def remover(self, caminhos):
        self.remocoes.append(list(caminhos))
        saem = {c for c in caminhos if c in self.bucket and c not in self.falham}
        self.bucket -= saem
        return saem


class Lotes(unittest.TestCase):
    def test_esvazia_a_fila_em_lotes_de_cem(self):
        banco = BancoFalso(250)
        r = expurgo.expurgar(banco.chamar, banco.remover, tamanho_da_remocao=40)
        self.assertEqual((r.lotes, r.removidos, r.confirmados, r.falhas, r.pendentes), (3, 250, 250, 0, 0))
        self.assertEqual(banco.fila, [])
        self.assertEqual(max(len(p) for p in banco.remocoes), 40)
        self.assertEqual(banco.chamadas.count("confirmar_expurgo_anexos_chat"), 3)

    def test_respeita_o_maximo_de_lotes(self):
        banco = BancoFalso(350)
        r = expurgo.expurgar(banco.chamar, banco.remover, lotes=2)
        self.assertEqual((r.lotes, r.confirmados, r.pendentes), (2, 200, 150))

    def test_fila_vazia_nao_remove_nada(self):
        banco = BancoFalso(0)
        r = expurgo.expurgar(banco.chamar, banco.remover)
        self.assertEqual((r.lotes, r.removidos, r.pendentes), (0, 0, 0))
        self.assertEqual(banco.remocoes, [])
        self.assertNotIn("confirmar_expurgo_anexos_chat", banco.chamadas)

    def test_so_remove_caminho_no_formato_do_bucket(self):
        banco = BancoFalso(2)
        banco.fila += ["../outro-bucket/segredo.pdf", "pasta/arquivo.pdf", 7]
        expurgo.expurgar(banco.chamar, banco.remover)
        removidos = [c for pedaco in banco.remocoes for c in pedaco]
        self.assertEqual(sorted(removidos), sorted([caminho(0), caminho(1)]))


class FalhaParcial(unittest.TestCase):
    def test_o_que_o_storage_nao_removeu_fica_na_fila(self):
        teimosos = {caminho(3), caminho(150)}
        banco = BancoFalso(200, falham=teimosos)
        r = expurgo.expurgar(banco.chamar, banco.remover)
        self.assertEqual((r.confirmados, r.falhas, r.pendentes), (198, 2, 2))
        self.assertEqual(set(banco.fila), teimosos)

    def test_nao_tenta_de_novo_na_mesma_execucao_e_para(self):
        banco = BancoFalso(120, falham={caminho(n) for n in range(100)})
        r = expurgo.expurgar(banco.chamar, banco.remover)
        tentados = [c for pedaco in banco.remocoes for c in pedaco]
        self.assertEqual(len(tentados), len(set(tentados)))
        # A fila devolve de novo os mesmos 100 (os mais antigos): a execução para; amanhã tenta de novo.
        self.assertEqual((r.lotes, r.confirmados, r.falhas, r.pendentes), (1, 0, 100, 120))
        self.assertEqual(banco.chamadas.count("preparar_expurgo_anexos_chat"), 2)

    def test_pedido_recusado_nao_confirma_e_segue_com_o_resto(self):
        banco = BancoFalso(100)
        original = banco.remover

        def remover(caminhos):
            if caminho(0) in caminhos:
                raise expurgo.ErroDoStorage(500, f"falhou em {caminhos[0]}")
            return original(caminhos)

        saida = io.StringIO()
        log = registro("teste_expurgo_parcial", saida=saida)
        r = expurgo.expurgar(banco.chamar, remover, tamanho_da_remocao=50, log=log)
        self.assertEqual((r.removidos, r.confirmados, r.falhas, r.pedidos_recusados), (50, 50, 50, 1))
        self.assertEqual(len(banco.fila), 50)
        self.assertNotIn(caminho(0), saida.getvalue())
        self.assertIn("<caminho>", saida.getvalue())

    def test_ja_fora_do_storage_tambem_confirma(self):
        banco = BancoFalso(3)
        banco.bucket.discard(caminho(1))  # removido antes, sem confirmação
        r = expurgo.expurgar(banco.chamar, banco.remover)
        self.assertEqual((r.removidos, r.confirmados, r.falhas), (2, 3, 0))


class Seco(unittest.TestCase):
    def test_seco_nao_remove_nem_confirma(self):
        banco = BancoFalso(150)
        r = expurgo.expurgar(banco.chamar, banco.remover, seco=True)
        self.assertEqual(banco.remocoes, [])
        self.assertEqual(banco.chamadas, ["preparar_expurgo_anexos_chat"])
        self.assertEqual((r.no_lote, r.pendentes, r.removidos), (100, 150, 0))
        self.assertEqual(len(banco.bucket), 150)

    def test_script_seco_nao_registra(self):
        banco = BancoFalso(5)
        saida = io.StringIO()
        with redirect_stdout(saida):
            codigo = expurgo_anexos_chat.principal(
                expurgo_anexos_chat.argumentos(["--seco"]),
                configuracao={"url": "https://x.supabase.co", "chave": "k"},
                chamar_rpc=lambda _cfg, funcao, corpo, **o: banco.chamar(funcao, corpo, **o),
                remover=banco.remover,
            )
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.remocoes, [])
        self.assertEqual(banco.registros, [])
        self.assertIn("Modo seco", saida.getvalue())


class Script(unittest.TestCase):
    def rodar(self, banco, lista=(), remover=None):
        saida = io.StringIO()
        log = expurgo_anexos_chat.log
        antigos = log.handlers[:]
        log.handlers = [logging.StreamHandler(saida)]
        try:
            with redirect_stdout(saida):
                codigo = expurgo_anexos_chat.principal(
                    expurgo_anexos_chat.argumentos(list(lista)),
                    configuracao={"url": "https://x.supabase.co", "chave": "k"},
                    chamar_rpc=lambda _cfg, funcao, corpo, **o: banco.chamar(funcao, corpo, **o),
                    remover=remover or banco.remover,
                    agora=lambda: datetime(2026, 10, 7, 9, 30, tzinfo=UTC),
                )
        finally:
            log.handlers = antigos
        return codigo, saida.getvalue()

    def test_concluida_registra_contagens_e_quem_disparou(self):
        banco = BancoFalso(120)
        codigo, _ = self.rodar(banco, ["--disparado-por", USUARIO])
        self.assertEqual(codigo, 0)
        (reg,) = banco.registros
        self.assertEqual(reg["p_disparo"], "MONITORA")
        self.assertEqual(reg["p_usuario"], USUARIO)
        self.assertEqual(reg["p_inicio"], "2026-10-07T09:30:00+00:00")
        self.assertTrue(reg["p_execucao"].startswith("expurgo-"))
        self.assertEqual(
            reg["p_contagens"], {"lotes": 2, "removidos": 120, "confirmados": 120, "falhas": 0, "pendentes": 0}
        )
        self.assertIsNone(reg["p_erro"])

    def test_parcial_sai_com_codigo_dois(self):
        banco = BancoFalso(10, falham={caminho(4)})
        codigo, _ = self.rodar(banco, ["--disparado-por", "agenda"])
        self.assertEqual(codigo, 2)
        self.assertEqual(banco.registros[0]["p_disparo"], "AGENDA")
        self.assertEqual(banco.registros[0]["p_contagens"]["falhas"], 1)

    def test_erro_geral_registra_falhou_sem_caminho(self):
        banco = BancoFalso(3)
        original = banco.chamar

        def chamar(funcao, corpo, **o):
            if funcao == "confirmar_expurgo_anexos_chat":
                raise RuntimeError(f"confirmar respondeu 500 para {corpo['p_caminhos'][0]}")
            return original(funcao, corpo, **o)

        banco.chamar = chamar
        codigo, texto = self.rodar(banco)
        self.assertEqual(codigo, 1)
        (reg,) = banco.registros
        self.assertIn("<caminho>", reg["p_erro"])
        self.assertNotIn(caminho(0).split("/")[0], reg["p_erro"])
        self.assertNotIn(caminho(0).split("/")[0], texto)

    def test_log_e_resumo_so_com_contagens(self):
        banco = BancoFalso(130, falham={caminho(7)})
        _, texto = self.rodar(banco)
        for n in range(130):
            conversa, arquivo = caminho(n).split("/")
            self.assertNotIn(conversa, texto)
            self.assertNotIn(arquivo, texto)
        self.assertNotIn(".pdf", texto)
        self.assertIn("removidos do Storage: 129", texto)
        self.assertIn("ficaram na fila: 1", texto)
        # Nem o registro leva caminho: só as contagens.
        self.assertNotIn(caminho(7).split("/")[0], json.dumps(banco.registros))

    def test_lotes_fora_da_faixa(self):
        with self.assertRaises(SystemExit), redirect_stdout(io.StringIO()):
            expurgo_anexos_chat.argumentos(["--lotes", "0"])


class Storage(unittest.TestCase):
    CFG = {"url": "https://x.supabase.co", "chave": "chave-de-teste"}

    class Resposta(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def test_delete_em_lote_com_service_role(self):
        pedidos = []

        def abrir(pedido, timeout):
            pedidos.append(pedido)
            return self.Resposta(json.dumps([{"name": caminho(0)}, {"name": caminho(1)}]).encode())

        removidos = expurgo.remover_do_storage(self.CFG, [caminho(0), caminho(1), caminho(2)], abrir=abrir)
        self.assertEqual(removidos, {caminho(0), caminho(1)})
        (pedido,) = pedidos
        self.assertEqual(pedido.get_method(), "DELETE")
        self.assertEqual(pedido.full_url, "https://x.supabase.co/storage/v1/object/chat-anexos")
        self.assertEqual(json.loads(pedido.data)["prefixes"], [caminho(0), caminho(1), caminho(2)])
        self.assertEqual(pedido.get_header("Authorization"), "Bearer chave-de-teste")

    def test_erro_4xx_nao_repete_e_nao_mostra_caminho(self):
        tentativas = []

        def abrir(pedido, timeout):
            tentativas.append(1)
            corpo = json.dumps({"error": "Unauthorized", "message": f"sem acesso a {caminho(0)}"}).encode()
            raise urllib.error.HTTPError(pedido.full_url, 403, "x", {}, io.BytesIO(corpo))

        with self.assertRaises(expurgo.ErroDoStorage) as falha:
            expurgo.remover_do_storage(self.CFG, [caminho(0)], abrir=abrir, esperar=lambda s: None)
        self.assertEqual(len(tentativas), 1)
        self.assertNotIn(caminho(0).split("/")[0], str(falha.exception))
        self.assertIn("403", str(falha.exception))

    def test_5xx_repete(self):
        tentativas = []

        def abrir(pedido, timeout):
            tentativas.append(1)
            if len(tentativas) < 3:
                raise urllib.error.HTTPError(pedido.full_url, 503, "x", {}, io.BytesIO(b"{}"))
            return self.Resposta(b"[]")

        self.assertEqual(expurgo.remover_do_storage(self.CFG, [caminho(0)], abrir=abrir, esperar=lambda s: None), set())
        self.assertEqual(len(tentativas), 3)

    def test_sem_caminhos(self):
        texto = expurgo.sem_caminhos(f"falhou: {caminho(9)} e {uuid.UUID(int=1, version=4)}")
        self.assertNotRegex(texto, r"[0-9a-f]{8}-[0-9a-f]{4}")
        self.assertIn("<caminho>", texto)


if __name__ == "__main__":
    unittest.main()
