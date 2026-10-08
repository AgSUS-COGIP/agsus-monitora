"""
Testes dos anexos do questionário da Empregare (scripts/robo-empregare/anexos_empregare.py):
o modo sondar só escreve estrutura mascarada (nada de nome, CPF, e-mail, nome de
arquivo nem URL completa), a captura grava um link por pergunta e, sem link de
arquivo utilizável, fica a página do questionário (e a ficha mantém o fallback).
Dados e links fictícios; nada fala com a Empregare nem com o Supabase.

    python -m pytest tests/python/test_anexos_empregare.py
"""

import pathlib
import sys
import unittest
import urllib.error
from email.message import Message
from unittest import mock

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "python"))

import anexos_empregare as anexos  # noqa: E402
import navegador_empregare as nav  # noqa: E402

from monitora import supabase_rpc  # noqa: E402

DETALHE = nav.URL_BASE + "/empresa/curriculo/detalhes?tokenCandidato=TKfict123&id=IDfict9|&candidatura=CDfict7||"
IMPRIMIR = nav.URL_BASE + "/empresa/questionarios/imprimir/QSTfictAbc9|"
ARQUIVO_PUBLICO = "https://arquivos.exemplo.invalid/anexos/8f3a9c7e2d/Maria_Ficticia_Souza_RG.pdf"
ARQUIVO_ASSINADO = (
    "https://empregare-fict.s3.amazonaws.com/uploads/77777777/Joana%20Ficticia%20CPF%20000.000.001-91.pdf"
    "?X-Amz-Expires=300&X-Amz-Signature=SIGfict0123456789abcdef&X-Amz-Credential=CREDfict"
)

# Dados pessoais fictícios que nunca podem aparecer no log.
PROIBIDOS = (
    "TKfict123",
    "IDfict9",
    "CDfict7",
    "QSTfictAbc9",
    "8f3a9c7e2d",
    "Maria",
    "Ficticia",
    "Souza",
    "Joana",
    "77777777",
    "000.000.001-91",
    "00000000191",
    "SIGfict",
    "CREDfict",
    "pessoa@exemplo.invalid",
    "arquivos.exemplo.invalid/anexos/8f",
    "_RG.pdf",
)


def _leitura():
    """Uma leitura da aba como o JS devolveria, com dado pessoal fictício em todo canto."""
    return {
        "caminho": "/empresa/curriculo/detalhes",
        "titulo": "Maria Ficticia Souza | Empregare",
        "painel": "div#questionarios.tab-pane.active.pessoa-77777777",
        "perguntas_por_classe": 6,
        "perguntas_por_texto": 6,
        "seletores": {".pergunta": 6, "a[download]": 2, "iframe": 0},
        "classes": ["pergunta", "resposta-anexo", "Maria Souza", "x77777777"],
        "arquivos": [
            {
                "href": ARQUIVO_PUBLICO,
                "tag": "a",
                "atributo": "href",
                "download": True,
                "texto_do_link": 24,
                "enunciado": "Pergunta 4 - Anexe o documento de identificação com foto Maria_Ficticia_Souza_RG.pdf",
                "ordem": 4,
                "ancora": "pergunta-4",
            },
            {
                "href": ARQUIVO_ASSINADO,
                "tag": "a",
                "atributo": "onclick",
                "download": False,
                "texto_do_link": 0,
                "enunciado": "Joana Ficticia, pessoa@exemplo.invalid, 000.000.001-91",
                "ordem": 5,
                "ancora": "",
            },
        ],
        "imprimir": [IMPRIMIR],
        "iframes": [],
    }


def _sem_proibidos(teste, texto):
    for proibido in PROIBIDOS:
        teste.assertNotIn(proibido, texto, proibido)


ABAS = [
    {"i": 0, "tag": "a", "texto": "", "href": "#tabCurriculo", "icone": "fa fa-user", "ativa": True, "toggle": "tab"},
    {
        "i": 1,
        "tag": "a",
        "texto": "",
        "href": "#tab77777777",
        "titulo": "Maria Ficticia",
        "icone": "fa fa-comments Maria77",
        "toggle": "tab",
    },
    {
        "i": 2,
        "tag": "a",
        "texto": "",
        "href": "#tabQuestionario",
        "titulo": "Questionários",
        "icone": "fa fa-list-alt",
        "toggle": "tab",
    },
    {"i": 3, "tag": "a", "texto": "Vagas", "href": "/empresa/vagas/candidaturas/Vfict77|", "icone": ""},
]
RESUMO_CURRICULO = {"painel": "div#tabCurriculo.tab-pane.active", "texto": 900, "perguntas": 0, "por_texto": 0}
RESUMO_QUESTIONARIO = {
    "painel": "div#tabQuestionario.tab-pane.active",
    "texto": 3000,
    "perguntas": 6,
    "por_texto": 6,
    "arquivos": 2,
    "data_url": 2,
    "data_arquivo": 2,
    "tabelas": 0,
    "paineis": 6,
}
ATRIBUTOS = [
    {
        "tag": "div",
        "classes": ["btn-arquivo", "x77777777"],
        "aba": "tabQuestionario",
        "atributos": [
            [
                "data-url",
                "/empresa/curriculo/arquivo?id=8f3a9c7e2d",
                nav.URL_BASE + "/empresa/curriculo/arquivo?id=8f3a9c7e2d",
            ],
            ["data-arquivo", "Maria_Ficticia_Souza_RG.pdf", ""],
            ["data-toggle", "modal", ""],
        ],
    },
    {
        "tag": "a",
        "classes": [],
        "aba": "",
        "atributos": [["onclick", "baixar('Joana Ficticia', 'https://x.invalid/a/77777777')", ""]],
    },
]


class PadraoDoLink(unittest.TestCase):
    def test_mascara_ids_tokens_e_nome_de_arquivo(self):
        padrao = anexos.padrao_do_link(ARQUIVO_ASSINADO)
        self.assertTrue(padrao.startswith("https://empregare-fict.s3.amazonaws.com/uploads/<MASCARADO>/<MASCARADO>"))
        self.assertIn("X-Amz-Expires=<MASCARADO>", padrao)
        self.assertIn("(extensão .pdf)", padrao)
        _sem_proibidos(self, padrao)

    def test_relativo_e_esquemas_estranhos(self):
        self.assertEqual(
            anexos.padrao_do_link("/empresa/questionarios/imprimir/QSTfictAbc9|"),
            "https://corporate.empregare.com/empresa/questionarios/imprimir/<MASCARADO>",
        )
        self.assertEqual(anexos.padrao_do_link("javascript:baixar('Maria.pdf')"), "<javascript:…>")
        self.assertEqual(anexos.padrao_do_link(""), "—")
        self.assertIn("#<MASCARADO>", anexos.padrao_do_link("https://a.invalid/x#Maria Souza"))

    def test_assinatura_pelos_nomes_dos_parametros(self):
        self.assertEqual(
            anexos.parametros_de_assinatura(ARQUIVO_ASSINADO),
            ["X-Amz-Expires", "X-Amz-Signature", "X-Amz-Credential"],
        )
        self.assertEqual(anexos.parametros_de_assinatura(ARQUIVO_PUBLICO), [])


class TesteSemCookies(unittest.TestCase):
    class _Resposta:
        def __init__(self, status, tipo="application/pdf; charset=binary"):
            self.status = status
            self.headers = {"Content-Type": tipo}

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def _erro(self, codigo, local=None):
        cabecalhos = Message()
        if local:
            cabecalhos["Location"] = local
        return urllib.error.HTTPError("https://x.invalid", codigo, "x", cabecalhos, None)

    def test_status_e_redirecionamento_mascarado(self):
        def abrir(pedido, timeout):
            self.assertEqual(pedido.get_method(), "GET")
            self.assertEqual(pedido.get_header("Range"), "bytes=0-0")
            self.assertIsNone(pedido.get_header("Cookie"))
            raise self._erro(302, "/empresa/login?returnUrl=%2Fx%3FtokenCandidato%3DTKfict123")

        r = anexos.testar_sem_cookies(DETALHE, abrir)
        self.assertEqual(r["status"], 302)
        self.assertEqual(r["destino"], "https://corporate.empregare.com/empresa/login?returnUrl=<MASCARADO>")
        self.assertTrue(anexos.classificar_link(DETALHE, r)["exige_sessao"])

    def test_get_de_um_byte_e_head_se_recusado(self):
        metodos = []

        def abrir(pedido, timeout):
            metodos.append((pedido.get_method(), pedido.get_header("Range")))
            if pedido.get_method() == "GET":
                raise self._erro(416)
            return self._Resposta(200)

        r = anexos.testar_sem_cookies(ARQUIVO_PUBLICO, abrir)
        self.assertEqual(metodos, [("GET", "bytes=0-0"), ("HEAD", None)])
        self.assertEqual(r["tipo"], "application/pdf")
        self.assertEqual(anexos.classificar_link(ARQUIVO_PUBLICO, r)["texto"], "público")

    def test_publico_assinado_e_sem_resposta(self):
        self.assertEqual(
            anexos.classificar_link(ARQUIVO_ASSINADO, {"status": 200})["texto"], "público, mas assinado (expira)"
        )
        self.assertEqual(
            anexos.classificar_link(ARQUIVO_PUBLICO, {"status": None, "erro": "URLError"})["texto"],
            "sem resposta (URLError)",
        )
        self.assertEqual(anexos.testar_sem_cookies("/relativo")["erro"], "sem http")


class Sondagem(unittest.TestCase):
    def test_linhas_da_leitura_so_com_estrutura(self):
        testes = {
            ARQUIVO_PUBLICO: {"sem_cookies": {"status": 200}, "com_sessao": "outra origem"},
            ARQUIVO_ASSINADO: {"sem_cookies": {"status": 403}, "com_sessao": "outra origem"},
        }
        linhas = anexos.linhas_da_leitura("Candidato 1/1 (aba)", _leitura(), testes)
        texto = "\n".join(linhas)
        for esperado in (
            "painel div#questionarios.tab-pane.active.<MASCARADO>",
            "perguntas por classe 6, por texto «Pergunta N» 6; arquivos 2",
            "seletores com resultado: .pergunta 6 · a[download] 2",
            "classes: pergunta, resposta-anexo\n",
            "link imprimir https://corporate.empregare.com/empresa/questionarios/imprimir/<MASCARADO>",
            "arquivo 1: pergunta 4 (bloco 4) · enunciado «Pergunta 4 - Anexe o documento de identificação com foto»",
            "GET sem cookies: 200",
            "leitura: público",
            "arquivo 2: pergunta ? (bloco 5) · enunciado (texto que não parece enunciado",
            "assinado/expira: sim (X-Amz-Expires, X-Amz-Signature, X-Amz-Credential)",
            "GET sem cookies: 403",
            "leitura: exige sessão (ou a assinatura expirou)",
        ):
            self.assertIn(esperado, texto)
        _sem_proibidos(self, texto)

    def test_classes_com_nome_e_digitos_nao_passam(self):
        self.assertEqual(anexos._palavras(["pergunta", "x77777777", "Maria Souza"]), ["pergunta"])

    def test_aba_e_abas_da_pagina(self):
        linhas = anexos.linhas_da_aba(
            "Candidato 1/1",
            ["Currículo", "Questionários (3)", "Maria Ficticia", "Histórico"],
            {
                "achou": True,
                "total": 2,
                "tag": "a",
                "href": "#questionarios",
                "alvo": "#tab-q",
                "id": "aba-77777777",
                "classes": "nav-link active Maria77",
                "onclick": "abrirAba('TKfict123')",
            },
            True,
        )
        texto = "\n".join(linhas)
        self.assertIn("abas da página 4 [Currículo, Questionários (3), outra, Histórico]", texto)
        self.assertIn("href #questionarios, alvo #tab-q", texto)
        self.assertIn("classes nav-link active", texto)
        self.assertIn("onclick abrirAba", texto)
        self.assertIn("conteúdo apareceu: sim", texto)
        _sem_proibidos(self, texto)
        self.assertNotIn("77777777", texto)
        nao = anexos.linhas_da_aba("C", [], {"achou": False}, False)
        self.assertIn("NÃO achei a aba Questionários", nao[1])

    def test_sondar_candidato_com_navegador_falso_nao_vaza_nada(self):
        visitadas = []
        cliques = []

        class Troca:
            def frame(self, _f):
                pass

            def default_content(self):
                pass

        class DriverFalso:
            switch_to = Troca()

            def get(self, url):
                visitadas.append(url)

            def execute_script(self, js, *args):
                if js == anexos.JS_DESCREVER_ABAS:
                    return ABAS
                if js == anexos.JS_CLICAR_ABA:
                    cliques.append(args[0])
                    return True
                if js == anexos.JS_RESUMO_DO_PAINEL:
                    return RESUMO_QUESTIONARIO if cliques[-1] == 2 else RESUMO_CURRICULO
                if js == anexos.JS_CONTAR_QUESTIONARIO:
                    return 3
                if js == anexos.JS_LER_QUESTIONARIO:
                    return _leitura()
                if js == anexos.JS_ATRIBUTOS_DE_ARQUIVO:
                    return ATRIBUTOS
                if "document.contentType" in js:
                    return {"tipo": "application/pdf", "caminho": ARQUIVO_PUBLICO, "login": False, "pdf": True}
                raise AssertionError("JS inesperado")

            def find_elements(self, *_a):
                return []

            def set_script_timeout(self, _s):
                pass

            def execute_async_script(self, js, url):
                if js == anexos.JS_GET_COM_SESSAO:
                    return {"status": 206, "tipo": "application/pdf", "disposicao": "inline", "redirecionou": False}
                return 200

        class PortalFalso:
            driver = DriverFalso()
            pasta = None

            def _voltar_para_a_janela(self):
                return 1

        testados = []

        def testar(href):
            testados.append(href)
            return {"status": 403, "tipo": "text/html", "destino": None, "erro": None}

        with mock.patch.object(anexos.time, "sleep"):
            linhas = anexos.sondar_candidato(PortalFalso(), "Candidato 1/1", DETALHE, testar)
        texto = "\n".join(linhas)
        # Clica só nas abas que trocam de painel (a 3 leva a outra página) e volta na escolhida.
        self.assertEqual(cliques, [0, 1, 2, 2])
        self.assertIn("aba escolhida para o questionário: 2", texto)
        self.assertIn("aba 2 (a) · texto — · href #tabQuestionario", texto)
        self.assertIn("ícone fa fa-list-alt", texto)
        self.assertIn("title Questionários", texto)
        self.assertIn("pontos 3", texto)
        self.assertIn("«Pergunta N» 6; arquivos 2; data-url 2", texto)
        self.assertIn("aba 1 (a) · texto — · href <MASCARADO>", texto)
        self.assertIn("title outra (14 letras)", texto)
        self.assertIn("Candidato 1/1 (aba 2): perguntas por classe 6", texto)
        self.assertIn("Candidato 1/1 (imprimir): perguntas por classe 6", texto)
        self.assertIn("elementos com data-url/data-arquivo: 2", texto)
        self.assertIn(
            "data-url=caminho https://corporate.empregare.com/empresa/curriculo/arquivo?id=<MASCARADO>", texto
        )
        self.assertIn("data-arquivo=<nome de arquivo, extensão .pdf", texto)
        self.assertIn("data-toggle=modal", texto)
        self.assertIn("GET com sessão: 206 application/pdf (inline); redirecionou não; login não", texto)
        self.assertIn("visualizador de PDF sim · login não · download não", texto)
        self.assertIn("GET sem cookies: 403 text/html", texto)
        self.assertEqual(visitadas[:2], [DETALHE, IMPRIMIR])
        self.assertIn(IMPRIMIR, testados)
        _sem_proibidos(self, texto)

    def test_sondar_sem_vaga_e_com_limite_maximo(self):
        logs = []

        class PortalSemVaga:
            def localizar_vaga(self, _codigo):
                return None

        resumo = anexos.sondar(PortalSemVaga(), "177979", 2, logs.append)
        self.assertIn("vaga não encontrada", resumo[0])

        class PortalComVaga:
            def localizar_vaga(self, _codigo):
                return "Vfict|"

            def capturar_candidatos(self, _codigo):
                return {"vaga_interno": "Vfict|", "candidatos": {str(i): DETALHE for i in range(1, 10)}}

        sondados = []
        with mock.patch.object(anexos, "sondar_candidato", lambda _p, rotulo, _l: sondados.append(rotulo) or []):
            anexos.sondar(PortalComVaga(), "177979", 50, logs.append)
        self.assertEqual(sondados, ["Candidato 1/3", "Candidato 2/3", "Candidato 3/3"])


class SondagemDasAbas(unittest.TestCase):
    def test_pontos_e_escolha_da_aba(self):
        self.assertEqual([anexos.pontuar_aba(a) for a in ABAS], [0, 0, 3, 0])
        self.assertEqual(anexos.pontuar_aba({"icone": "fa fa-clipboard"}), 2)
        self.assertTrue(anexos.navega_para_fora(ABAS[3]))
        self.assertFalse(anexos.navega_para_fora(ABAS[0]))
        self.assertEqual(anexos.escolher_aba(ABAS, {}), 2)
        # Sem sinal no href/título/ícone: a aba cujo painel tem "Pergunta N".
        sem_sinal = [dict(a, titulo="", href=f"#tab{a['i']}", icone="") for a in ABAS[:3]]
        self.assertEqual(anexos.escolher_aba(sem_sinal, {1: {"por_texto": 4}}), 1)
        self.assertIsNone(anexos.escolher_aba(sem_sinal, {}))

    def test_valores_dos_atributos_sem_dado_pessoal(self):
        linhas = anexos.linhas_dos_atributos("C", ATRIBUTOS)
        texto = "\n".join(linhas)
        self.assertIn("elemento 1: div.btn-arquivo (aba tabQuestionario)", texto)
        self.assertIn("onclick=função baixar, links: https://x.invalid/a/<MASCARADO>", texto)
        self.assertEqual(anexos.descrever_valor("data-id", "123456789"), "<número, 9 dígitos>")
        self.assertEqual(anexos.descrever_valor("data-x", "Maria Souza"), "<texto, 11 caracteres>")
        self.assertEqual(
            anexos.links_dos_atributos(ATRIBUTOS), [nav.URL_BASE + "/empresa/curriculo/arquivo?id=8f3a9c7e2d"]
        )
        _sem_proibidos(self, texto)

    def test_acesso_sem_url_e_get_so_na_mesma_origem(self):
        linha = anexos.linha_do_acesso(
            "C",
            1,
            ARQUIVO_ASSINADO,
            {"status": 302, "tipo": "text/html", "redirecionou": True, "login": True},
            {"erro": "TimeoutException"},
        )
        self.assertIn("GET com sessão: 302 text/html; redirecionou sim; login sim · abrir: TimeoutException", linha)
        _sem_proibidos(self, linha)
        self.assertEqual(anexos.get_com_sessao(object(), ARQUIVO_PUBLICO), {"erro": "outra origem"})


class CapturaPorPergunta(unittest.TestCase):
    def test_arquivo_publico_vira_link_do_arquivo_e_assinado_vira_pagina(self):
        def classificar(href):
            return anexos.classificar_link(href, {"status": 200})

        linhas, sem_numero = anexos.anexos_do_candidato(dict(_leitura(), aba="#questionarios"), DETALHE, classificar)
        self.assertEqual(sem_numero, 0)
        self.assertEqual([(l["pergunta"], l["tipo"]) for l in linhas], [(4, "ARQUIVO"), (5, "QUESTIONARIO")])
        self.assertEqual(linhas[0]["link"], ARQUIVO_PUBLICO)
        self.assertEqual(linhas[0]["enunciado"], "Pergunta 4 - Anexe o documento de identificação com foto")
        # Assinado (expira): a visão imprimir com a âncora da aba (o bloco não tem id).
        self.assertEqual(linhas[1]["link"], IMPRIMIR + "#questionarios")

    def test_arquivo_que_exige_sessao_vira_pagina_com_ancora_da_pergunta(self):
        leitura = dict(_leitura(), imprimir=[])
        linhas, _ = anexos.anexos_do_candidato(
            leitura, DETALHE, lambda href: anexos.classificar_link(href, {"status": 401})
        )
        self.assertEqual(linhas[0], {**linhas[0], "tipo": "QUESTIONARIO", "link": DETALHE + "#pergunta-4"})
        for linha in linhas:
            self.assertTrue(anexos.LINK_DA_PAGINA.match(linha["link"]))

    def test_sem_numero_fica_de_fora_e_vale_o_primeiro_da_pergunta(self):
        leitura = {
            "arquivos": [
                {"href": ARQUIVO_PUBLICO, "enunciado": "Anexe o diploma", "ordem": None},
                {"href": ARQUIVO_PUBLICO + "?2", "enunciado": "Pergunta 7 - Anexe", "ordem": None},
                {"href": ARQUIVO_PUBLICO + "?3", "enunciado": "7) Anexe outro", "ordem": None},
                {"href": "javascript:void(0)", "enunciado": "Pergunta 8 - Anexe", "ordem": None},
            ]
        }
        linhas, sem_numero = anexos.anexos_do_candidato(
            leitura, None, lambda href: anexos.classificar_link(href, {"status": 200})
        )
        self.assertEqual(sem_numero, 1)
        self.assertEqual([(l["pergunta"], l["link"]) for l in linhas], [(7, ARQUIVO_PUBLICO + "?2")])

    def test_fila_poe_os_ja_capturados_no_fim(self):
        self.assertEqual(
            [c for c, _ in anexos.ordenar_para_capturar({"1": "a", "2": "b", "3": "c"}, ["1"])], ["2", "3", "1"]
        )

    def test_capturar_anexos_conta_sem_vazar_e_volta_para_vagas(self):
        logs = []

        class PortalFalso:
            voltou = 0
            driver = object()

            def abrir_vagas_anunciadas(self):
                PortalFalso.voltou += 1

        def abrir(_portal, detalhe):
            if "SEMABA" in detalhe:
                return [], {"achou": False}, False
            return [], {"achou": True, "alvo": "#questionarios"}, True

        with (
            mock.patch.object(anexos, "abrir_questionario_do_candidato", abrir),
            mock.patch.object(anexos, "ler_questionario", lambda _d: _leitura()),
        ):
            capturados = anexos.capturar_anexos(
                PortalFalso(),
                "177979",
                {"7000001": DETALHE, "7000002": DETALHE + "SEMABA"},
                [],
                logs.append,
                prazo=float("inf"),
                testar=lambda _h: {"status": 200},
            )
        self.assertEqual(list(capturados), ["7000001"])
        self.assertEqual(PortalFalso.voltou, 1)
        self.assertEqual(
            logs,
            [
                "Vaga 177979: anexos lidos de 1 de 2 candidato(s) com link · 1 com anexo · links: 1 do arquivo, "
                "1 da página · 1 sem aba Questionários."
            ],
        )

    def test_grava_por_pergunta_em_lotes_e_404_so_avisa(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, corpo))
            return {"gravados": len(corpo["p_anexos"])}

        logs = []
        capturados = {
            "7000001": [{"pergunta": 4, "enunciado": "Anexe", "tipo": "ARQUIVO", "link": ARQUIVO_PUBLICO}],
            "7000002": [
                {"pergunta": 4, "enunciado": None, "tipo": "QUESTIONARIO", "link": IMPRIMIR},
                {"pergunta": 5, "enunciado": None, "tipo": "QUESTIONARIO", "link": IMPRIMIR},
            ],
        }
        self.assertEqual(anexos.gravar_anexos({}, "gh-x", "177979", capturados, chamar, logs.append), 3)
        funcao, corpo = chamadas[0]
        self.assertEqual(funcao, "gravar_anexos_empregare")
        self.assertEqual(
            [(i["codigo"], i["pergunta"]) for i in corpo["p_anexos"]], [("7000001", 4), ("7000002", 4), ("7000002", 5)]
        )
        self.assertEqual(logs, ["Vaga 177979: 3 link(s) de anexo gravado(s)."])

        def sem_migration(_config, funcao, _corpo):
            raise supabase_rpc.ErroDoSupabase(funcao, 404, "not found")

        logs.clear()
        self.assertEqual(anexos.gravar_anexos({}, "gh-x", "177979", capturados, sem_migration, logs.append), 0)
        self.assertIn("falta a migration 20261008160000", logs[0])
        self.assertEqual(anexos.gravar_anexos({}, "gh-x", "177979", {}, chamar, logs.append), 0)


class RoboComAnexos(unittest.TestCase):
    def setUp(self):
        sys.modules.pop("robo_empregare", None)
        import robo_empregare

        self.robo = robo_empregare

    def test_sondar_pede_uma_vaga(self):
        with self.assertRaises(SystemExit):
            self.robo.argumentos(["--sondar"])
        with self.assertRaises(SystemExit):
            self.robo.argumentos(["--sondar", "--vagas", "1,2"])
        args = self.robo.argumentos(["--sondar", "--vagas", "177979", "--limite", "2"])
        self.assertTrue(args.sondar)
        self.assertFalse(args.anexos)
        self.assertTrue(self.robo.argumentos(["--anexos"]).anexos)

    def test_banco_sem_migration_desliga_a_captura(self):
        def chamar(_config, funcao, _corpo):
            raise supabase_rpc.ErroDoSupabase(funcao, 404, "not found")

        saida = []
        with mock.patch.object(self.robo, "registrar", saida.append):
            captura = self.robo.CapturaDeAnexos({}, chamar)
            enderecos = {"vaga_interno": "V|", "candidatos": {"1": DETALHE}}
            captura.da_vaga(object(), "177979", enderecos)
        self.assertTrue(captura.desligada)
        self.assertNotIn("anexos", enderecos)
        self.assertIn("falta a migration 20261008160000", saida[0])

    def test_captura_poe_os_anexos_nos_enderecos(self):
        def chamar(_config, funcao, corpo):
            self.assertEqual(funcao, "anexos_capturados_empregare")
            return {"candidatos": ["2"]}

        recebido = {}

        def capturar(_portal, codigo, candidatos, ja, _registrar, prazo):
            recebido.update(codigo=codigo, ja=ja, candidatos=candidatos)
            return {"1": [{"pergunta": 4, "tipo": "ARQUIVO", "link": ARQUIVO_PUBLICO}]}

        enderecos = {"vaga_interno": "V|", "candidatos": {"1": DETALHE, "2": DETALHE}}
        with mock.patch.object(self.robo.anexos, "capturar_anexos", capturar):
            self.robo.CapturaDeAnexos({}, chamar).da_vaga(object(), "177979", enderecos)
        self.assertEqual(recebido["ja"], ["2"])
        self.assertEqual(list(enderecos["anexos"]), ["1"])

    def test_gravar_vaga_grava_anexos_depois_de_fechar_e_sem_anexos_nao_chama(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append(funcao)
            if funcao == "fechar_vaga_empregare":
                return {"situacao": "GRAVADA", "ativos": 1, "desativadas": 0}
            if funcao == "gravar_anexos_empregare":
                return {"gravados": 1}
            return {"situacao": "EM_CARGA"}

        lido = {"linhas": [{"codigo": "1", "chave": "cod:1"}], "colunas": ["Nome"], "sem_chave": 0, "repetidas": 0}
        enderecos = {
            "vaga_interno": "Vfict|",
            "candidatos": {"1": DETALHE},
            "anexos": {"1": [{"pergunta": 4, "enunciado": None, "tipo": "ARQUIVO", "link": ARQUIVO_PUBLICO}]},
        }
        saida = []
        with (
            mock.patch.object(self.robo, "ler_planilha", lambda _c, _v: lido),
            mock.patch.object(self.robo, "registrar", saida.append),
        ):
            self.robo.gravar_vaga({}, "gh-x", "177979", "x.xlsx", chamar, enderecos=enderecos)
            self.assertEqual(chamadas, ["gravar_lote_empregare", "fechar_vaga_empregare", "gravar_anexos_empregare"])
            chamadas.clear()
            self.robo.gravar_vaga({}, "gh-x", "177979", "x.xlsx", chamar, enderecos=dict(enderecos, anexos={}))
            self.assertEqual(chamadas, ["gravar_lote_empregare", "fechar_vaga_empregare"])
        _sem_proibidos(self, "\n".join(saida))


if __name__ == "__main__":
    unittest.main()
