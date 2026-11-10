"""
Acesso ao importador de anexos (api/anexos-do-edital.py), auditoria SEG-02:
sessão válida não basta; o perfil precisa poder importar, e quando não dá para
conferir o endpoint não processa. A rede é simulada (nada sai da máquina).

    python -m unittest tests/python/test_importador_com_permissao.py
"""

import importlib.util
import io
import json
import os
import pathlib
import unittest
import urllib.error
from unittest import mock

_ARQUIVO = pathlib.Path(__file__).resolve().parents[2] / "api" / "anexos-do-edital.py"
_spec = importlib.util.spec_from_file_location("anexos_do_edital_acesso", _ARQUIVO)
ax = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ax)

AMBIENTE = {"VITE_SUPABASE_URL": "https://teste.supabase.co", "VITE_SUPABASE_PUBLISHABLE_KEY": "chave-publica"}


class _Resposta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _responde(valor):
    return mock.patch.object(ax.urllib.request, "urlopen", return_value=_Resposta(json.dumps(valor).encode()))


@mock.patch.dict(os.environ, AMBIENTE, clear=False)
class PodeImportar(unittest.TestCase):
    def test_true_e_false_vem_do_banco(self):
        with _responde(True):
            self.assertIs(ax.pode_importar("Bearer abc"), True)
        with _responde(False):
            self.assertIs(ax.pode_importar("Bearer abc"), False)

    def test_pergunta_a_rpc_com_o_bearer_de_quem_chamou(self):
        with _responde(True) as aberto:
            ax.pode_importar("Bearer abc")
        pedido = aberto.call_args.args[0]
        self.assertEqual(pedido.full_url, "https://teste.supabase.co/rest/v1/rpc/pode_importar_anexos_do_edital")
        self.assertEqual(pedido.get_method(), "POST")
        self.assertEqual(pedido.get_header("Authorization"), "Bearer abc")
        self.assertEqual(pedido.get_header("Apikey"), "chave-publica")

    def test_sem_conferir_devolve_none(self):
        # Função ausente (404 do PostgREST), rede fora ou resposta que não é booleano.
        erro = urllib.error.HTTPError("u", 404, "Not Found", {}, None)
        with mock.patch.object(ax.urllib.request, "urlopen", side_effect=erro):
            self.assertIsNone(ax.pode_importar("Bearer abc"))
        with _responde({"pode": True}):
            self.assertIsNone(ax.pode_importar("Bearer abc"))
        with _responde(None):
            self.assertIsNone(ax.pode_importar("Bearer abc"))

    def test_sem_token_nem_pergunta(self):
        with mock.patch.object(ax.urllib.request, "urlopen") as aberto:
            self.assertIsNone(ax.pode_importar(""))
            self.assertIsNone(ax.pode_importar("Basic abc"))
        aberto.assert_not_called()


class _Corpo(io.BytesIO):
    lido = False

    def read(self, *args):
        self.lido = True
        return super().read(*args)


def _post(autenticado, permitido):
    """Roda do_POST sem socket e devolve (status, corpo, PDF foi lido)."""
    pedido = ax.handler.__new__(ax.handler)
    pdf = b"%PDF-1.4 vazio"
    pedido.headers = {"Authorization": "Bearer abc", "Content-Length": str(len(pdf))}
    pedido.path = "/api/anexos-do-edital"
    pedido.rfile = _Corpo(pdf)
    respostas = []
    pedido._responder = lambda status, corpo: respostas.append((status, corpo))
    with (
        mock.patch.object(ax, "usuario_autenticado", return_value="id" if autenticado else None),
        mock.patch.object(ax, "pode_importar", return_value=permitido),
        mock.patch.object(ax, "extrair", return_value={"ok": True}),
    ):
        pedido.do_POST()
    ((status, corpo),) = respostas
    return status, corpo, pedido.rfile.lido


class Endpoint(unittest.TestCase):
    def test_sem_sessao_401(self):
        status, _, lido = _post(autenticado=False, permitido=True)
        self.assertEqual(status, 401)
        self.assertFalse(lido)

    def test_perfil_sem_permissao_403_sem_ler_o_pdf(self):
        status, corpo, lido = _post(autenticado=True, permitido=False)
        self.assertEqual(status, 403)
        self.assertIn("não pode importar", corpo["erro"])
        self.assertFalse(lido)

    def test_sem_conferir_503_sem_ler_o_pdf(self):
        status, _, lido = _post(autenticado=True, permitido=None)
        self.assertEqual(status, 503)
        self.assertFalse(lido)

    def test_com_permissao_processa(self):
        status, corpo, lido = _post(autenticado=True, permitido=True)
        self.assertEqual((status, corpo), (200, {"ok": True}))
        self.assertTrue(lido)


if __name__ == "__main__":
    unittest.main()
