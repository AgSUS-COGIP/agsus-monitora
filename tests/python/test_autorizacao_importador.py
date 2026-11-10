"""Autorizacao do importador: perfil atual, negacao e falhas fechadas."""

import importlib.util
import io
import json
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError

import pytest

_ARQUIVO = Path(__file__).resolve().parents[2] / "api" / "anexos-do-edital.py"
_SPEC = importlib.util.spec_from_file_location("anexos_acesso", _ARQUIVO)
ax = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(ax)

USUARIO = "11111111-1111-4111-8111-111111111111"
TOKEN = "token-sintetico-nao-valido"


def perfil(**alteracoes):
    p = {
        "user_id": USUARIO,
        "ativo": True,
        "areas": ["saude-indigena"],
        "permissoes": {"nucleo": "editor", "calendario": "leitor"},
    }
    return {"profile": p | alteracoes}


@pytest.fixture(autouse=True)
def ambiente(monkeypatch):
    monkeypatch.setenv("VITE_SUPABASE_URL", "https://teste.supabase.co/")
    monkeypatch.setenv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-publicavel-de-teste")
    monkeypatch.delenv("VITE_SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "SEGREDO_QUE_NAO_PODE_SER_USADO")


def resposta(dados):
    return io.BytesIO(json.dumps(dados).encode())


@pytest.mark.parametrize("recurso", ["nucleo", "calendario"])
@pytest.mark.parametrize("nivel", ["editor", "admin"])
def test_permite_so_editor_ou_admin_do_modulo(monkeypatch, recurso, nivel):
    abrir = Mock(return_value=resposta(perfil(permissoes={recurso: nivel})))
    monkeypatch.setattr(ax.urllib.request, "urlopen", abrir)
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is True
    pedido = abrir.call_args.args[0]
    assert pedido.full_url == "https://teste.supabase.co/rest/v1/rpc/obter_contexto_monitora"
    assert pedido.method == "POST"
    assert pedido.data == b"{}"
    assert pedido.get_header("Authorization") == f"Bearer {TOKEN}"
    assert pedido.get_header("Apikey") == "chave-publicavel-de-teste"
    assert abrir.call_args.kwargs == {"timeout": 8}


@pytest.mark.parametrize(
    "dados",
    [
        None,
        [],
        {},
        {"profile": None},
        {"profile": []},
        perfil(ativo=False),
        perfil(ativo="true"),
        perfil(user_id="outro-usuario"),
        perfil(user_id=None),
        perfil(areas=[]),
        perfil(areas="saude-indigena"),
        perfil(areas=[None, ""]),
        perfil(permissoes=None),
        perfil(permissoes={"nucleo": "leitor", "calendario": "sem_acesso"}),
        perfil(permissoes={"importacao": "admin"}),
        perfil(permissoes={}, admin_global=True),
        perfil(permissoes={}, user_metadata={"admin_global": True}),
    ],
)
def test_nega_perfil_invalido_ou_sem_permissao(monkeypatch, dados):
    monkeypatch.setattr(ax.urllib.request, "urlopen", Mock(return_value=resposta(dados)))
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is False


@pytest.mark.parametrize("erro", [TimeoutError(), HTTPError("https://teste", 500, "erro", None, None)])
def test_falha_do_banco_nao_libera_importacao(monkeypatch, erro):
    monkeypatch.setattr(ax.urllib.request, "urlopen", Mock(side_effect=erro))
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is None


def test_json_invalido_nao_libera_importacao(monkeypatch):
    monkeypatch.setattr(ax.urllib.request, "urlopen", Mock(return_value=io.BytesIO(b"not-json")))
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is None


def test_sem_usuario_nao_consulta_banco(monkeypatch):
    abrir = Mock()
    monkeypatch.setattr(ax.urllib.request, "urlopen", abrir)
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", None) is False
    abrir.assert_not_called()


def test_permissao_nao_e_guardada_entre_pedidos(monkeypatch):
    abrir = Mock(side_effect=[resposta(perfil()), resposta(perfil(ativo=False))])
    monkeypatch.setattr(ax.urllib.request, "urlopen", abrir)
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is True
    assert ax.usuario_pode_importar(f"Bearer {TOKEN}", USUARIO) is False
    assert abrir.call_count == 2


def montar_handler():
    h = object.__new__(ax.handler)
    h.headers = {"Authorization": f"Bearer {TOKEN}", "Content-Length": "9"}
    h.path = "/api/anexos-do-edital"
    h.rfile = Mock(return_value=None)
    h.rfile.read.return_value = b"%PDF-fake"
    h._responder = Mock()
    return h


@pytest.mark.parametrize("usuario,permissao,status", [(None, True, 401), (USUARIO, False, 403), (USUARIO, None, 503)])
def test_nega_antes_de_ler_o_corpo(monkeypatch, usuario, permissao, status):
    monkeypatch.setattr(ax, "usuario_autenticado", Mock(return_value=usuario))
    autorizar = Mock(return_value=permissao)
    monkeypatch.setattr(ax, "usuario_pode_importar", autorizar)
    extrair = Mock()
    monkeypatch.setattr(ax, "extrair", extrair)
    h = montar_handler()
    h.do_POST()
    assert h._responder.call_args.args[0] == status
    h.rfile.read.assert_not_called()
    extrair.assert_not_called()
    if not usuario:
        autorizar.assert_not_called()


@pytest.mark.parametrize("retificacao", [False, True])
def test_usuario_autorizado_mantem_extracao_e_retificacao(monkeypatch, retificacao):
    monkeypatch.setattr(ax, "usuario_autenticado", Mock(return_value=USUARIO))
    monkeypatch.setattr(ax, "usuario_pode_importar", Mock(return_value=True))
    extrair = Mock(return_value={"ok": True})
    monkeypatch.setattr(ax, "extrair_retificacao" if retificacao else "extrair", extrair)
    h = montar_handler()
    if retificacao:
        h.path += "?tipo=retificacao"
    h.do_POST()
    h._responder.assert_called_once_with(200, {"ok": True})
    extrair.assert_called_once_with(b"%PDF-fake")


def test_limite_de_upload_continua_sem_ler_corpo(monkeypatch):
    monkeypatch.setattr(ax, "usuario_autenticado", Mock(return_value=USUARIO))
    monkeypatch.setattr(ax, "usuario_pode_importar", Mock(return_value=True))
    h = montar_handler()
    h.headers["Content-Length"] = str(ax.LIMITE_BYTES + 1)
    h.do_POST()
    assert h._responder.call_args.args[0] == 413
    h.rfile.read.assert_not_called()
