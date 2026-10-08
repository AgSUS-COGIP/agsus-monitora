"""
Testes das respostas do questionário da Empregare (scripts/robo-empregare/anexos_empregare.py):
o modo sondar só escreve estrutura mascarada (nada de nome, CPF, e-mail, nome de
arquivo nem URL completa), não clica no que pode mudar algo e abre a visão de
respostas pelo data-resposta; a captura lê o data-resposta da lista e grava por candidato.
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
    {
        "i": 0,
        "tag": "a",
        "texto": "",
        "href": "#tabCurriculo",
        "icone": "fa fa-file-text-o",
        "ativa": True,
        "toggle": "tab",
    },
    {
        "i": 1,
        "tag": "a",
        "texto": "Anexos",
        "href": "#tabAnexos",
        "titulo": "Maria Ficticia",
        "icone": "fa fa-paperclip Maria77",
        "toggle": "tab",
    },
    {
        "i": 2,
        "tag": "a",
        "texto": "",
        "href": "#tabInscricoes",
        "titulo": "Questionários",
        "icone": "fa fa-tag",
        "toggle": "tab",
    },
    {"i": 3, "tag": "a", "texto": "Histórico", "href": "#tabHistorico", "icone": "fa fa-history", "toggle": "tab"},
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


RESPOSTAS = nav.URL_BASE + "/empresa/questionarios/respostas?id=8f3a9c7e2d"
CLICAVEIS = [
    {
        "i": 0,
        "tag": "a",
        "visivel": True,
        "texto": "Ver respostas",
        "titulo": "",
        "href": "#",
        "abs": "",
        "onclick": "",
        "icone": "bi bi-file-earmark-text",
        "atributos": [["data-url", "/empresa/questionarios/respostas?id=8f3a9c7e2d", RESPOSTAS]],
        "bloco_da_vaga": True,
    },
    {
        "i": 1,
        "tag": "button",
        "visivel": True,
        "texto": "Reprovar Maria Ficticia",
        "titulo": "Reprovar no questionário",
        "href": "",
        "abs": "",
        "onclick": "reprovar('TKfict123')",
        "icone": "fa fa-times",
        "atributos": [],
        "bloco_da_vaga": True,
    },
    {
        "i": 2,
        "tag": "a",
        "visivel": True,
        "texto": "Questionário",
        "titulo": "",
        "href": "#modalQuestionario",
        "abs": "",
        "onclick": "",
        "icone": "fa fa-list-alt",
        "atributos": [["data-toggle", "modal", ""]],
        "bloco_da_vaga": False,
    },
]
RESPOSTA_DO_CANDIDATO = {
    "i": 1,
    "tag": "a",
    "visivel": True,
    "texto": "",
    "titulo": "",
    "href": "javascript:",
    "abs": "",
    "onclick": "",
    "icone": "fa fa-file-text-o",
    "atributos": [["data-resposta", "7654321", ""], ["data-modo-resposta", "1", ""]],
    "bloco_da_vaga": False,
}
IMPRIMIR_DO_CANDIDATO = {
    "i": 0,
    "tag": "a",
    "visivel": True,
    "texto": "Imprimir",
    "titulo": "",
    "href": "/empresa/questionarios/imprimir/QSTfictAbc9|",
    "abs": IMPRIMIR,
    "onclick": "",
    "icone": "fa fa-print",
    "atributos": [],
    "bloco_da_vaga": False,
}


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

    def test_sondar_candidato_com_navegador_falso_nao_vaza_nada(self):
        visitadas = []
        abas_clicadas = []
        clicaveis_clicados = []
        raizes = []

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
                    abas_clicadas.append(args[0])
                    return True
                if js == anexos.JS_RESUMO_DO_PAINEL:
                    return RESUMO_QUESTIONARIO if abas_clicadas[-1] == 2 else RESUMO_CURRICULO
                if js == anexos.JS_CONTAR_QUESTIONARIO:
                    return 3
                if js == anexos.JS_LER_QUESTIONARIO:
                    return _leitura()
                if js == anexos.JS_ATRIBUTOS_DE_ARQUIVO:
                    return ATRIBUTOS
                if js == anexos.JS_CLICAVEIS:
                    raizes.append(args[0])
                    return {"raiz": True, "itens": CLICAVEIS if args[0] == "#tabInscricoes" else []}
                if js == anexos.JS_CLICAR_CLICAVEL:
                    clicaveis_clicados.append(args[0])
                    return True
                if js == anexos.JS_FECHAR_MODAL:
                    return 1
                if js == anexos.JS_ANCORAS:
                    return {"total": 3, "padroes": [["pergunta-<n>", 3]]}
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

        def testar(href):
            return {"status": 403, "tipo": "text/html", "destino": None, "erro": None}

        with mock.patch.object(anexos.time, "sleep"):
            linhas = anexos.sondar_candidato(PortalFalso(), "Candidato 1/1", DETALHE, testar, codigo_vaga="179698")
        texto = "\n".join(linhas)
        # Varre as 4 abas do candidato, depois detalha #tabInscricoes, #tabAnexos e #tabCurriculo.
        self.assertEqual(abas_clicadas[:4], [0, 1, 2, 3])
        self.assertEqual(raizes, ["#tabInscricoes", "painel", "#tabAnexos", "#tabCurriculo"])
        # Abre o link de respostas (mesma origem) e o modal do questionário; nunca o "Reprovar".
        self.assertIn(RESPOSTAS, visitadas)
        self.assertEqual(clicaveis_clicados, [2])
        self.assertNotIn(1, clicaveis_clicados)
        for esperado in (
            "Candidato 1/1 #tabInscricoes: clicáveis 3",
            "clicável 0 a · texto Ver respostas",
            "data-url=caminho https://corporate.empregare.com/empresa/questionarios/respostas?id=<MASCARADO>",
            "bloco da vaga sim",
            "clicável 1 button · texto outra",
            "(perigoso: não clico)",
            "ícone bi bi-file-earmark-text",
            "abrindo o clicável 0 (https://corporate.empregare.com/empresa/questionarios/respostas?id=<MASCARADO>)",
            "Candidato 1/1 #tabInscricoes › clicável 0: perguntas por classe 6",
            "Candidato 1/1 #tabInscricoes › modal do clicável 2: perguntas por classe 6",
            "Candidato 1/1 #tabAnexos: elementos com data-url/data-arquivo: 2",
            "GET com sessão: 206 application/pdf (inline); redirecionou não; login não",
            "GET sem cookies: 403 text/html",
        ):
            self.assertIn(esperado, texto)
        _sem_proibidos(self, texto)

    def test_sondar_pela_vaga_abre_o_imprimir_do_candidato(self):
        visitadas = []
        raizes = []
        clicados = []

        class DriverFalso:
            class switch_to:  # noqa: N801
                @staticmethod
                def frame(_f):
                    pass

                @staticmethod
                def default_content():
                    pass

            def get(self, url):
                visitadas.append(url)

            def execute_script(self, js, *args):
                if js == anexos.JS_CLICAVEIS:
                    raizes.append(args[0])
                    if args[0] == "body":
                        return {"raiz": True, "itens": [dict(CLICAVEIS[1], i=0)]}
                    return {"raiz": True, "itens": [IMPRIMIR_DO_CANDIDATO, RESPOSTA_DO_CANDIDATO]}
                if js == anexos.JS_CLICAR_CLICAVEL:
                    clicados.append(args[0])
                    return True
                if js == anexos.JS_FECHAR_MODAL:
                    return 1
                if js == anexos.JS_ANCORAS:
                    return {"total": 14, "padroes": [["pergunta-<n>", 12], ["Maria77777", 1], ["modal", 1]]}
                if js == anexos.JS_LER_QUESTIONARIO:
                    return _leitura()
                if js == anexos.JS_ATRIBUTOS_DE_ARQUIVO:
                    return []
                if js == anexos.JS_CONTAR_QUESTIONARIO:
                    return 1
                if "document.contentType" in js:
                    return {"tipo": "text/html", "caminho": IMPRIMIR, "login": False, "pdf": False}
                raise AssertionError("JS inesperado")

            def find_elements(self, *_a):
                return []

            def set_script_timeout(self, _s):
                pass

            def execute_async_script(self, _js, _url):
                return {"status": 200, "tipo": "application/pdf"}

        class PortalFalso:
            driver = DriverFalso()
            pasta = None
            abertas = 0
            voltou = 0

            def _abrir_candidaturas(self, _ident):
                PortalFalso.abertas += 1

            def abrir_vagas_anunciadas(self):
                PortalFalso.voltou += 1

        with mock.patch.object(anexos.time, "sleep"):
            linhas = anexos.sondar_pela_vaga(
                PortalFalso(), "Vfict|", "179698", ["7000001", "x y"], testar=lambda _h: {"status": 302}
            )
        texto = "\n".join(linhas)
        self.assertEqual(raizes[:2], ["body", "pessoa:7000001"])
        self.assertIn(IMPRIMIR, visitadas)
        # O clique no a[data-resposta] (modal) e a visão de respostas pelo data-resposta.
        self.assertEqual(clicados, [1])
        self.assertIn(nav.URL_BASE + "/empresa/questionarios/imprimir/7654321|", visitadas)
        self.assertIn("data-resposta distintos no item: 1", texto)
        self.assertIn(
            "visão de respostas https://corporate.empregare.com/empresa/questionarios/imprimir/<MASCARADO>", texto
        )
        self.assertIn("âncoras: 14 ids; padrões: pergunta-<n> (12), <MASCARADO> (1), modal (1)", texto)
        self.assertIn("anexos por pergunta/bloco: 4: 1, 5: 1", texto)
        self.assertNotIn("7654321", texto)
        self.assertIn("Vaga 179698 (candidaturas) página: clicáveis 1, relevantes 1", texto)
        self.assertIn("nenhum clicável de questionário/respostas", texto)
        self.assertIn("Vaga 179698 (candidaturas) candidato 1 › clicável 0: perguntas por classe 6", texto)
        self.assertEqual(PortalFalso.voltou, 1)
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
        pela_vaga = []
        with (
            mock.patch.object(
                anexos, "sondar_candidato", lambda _p, rotulo, _l, codigo_vaga="": sondados.append(rotulo) or []
            ),
            mock.patch.object(
                anexos,
                "sondar_pela_vaga",
                lambda _p, ident, vaga, codigos: pela_vaga.append((ident, vaga, codigos)) or [],
            ),
        ):
            anexos.sondar(PortalComVaga(), "177979", 50, logs.append)
        self.assertEqual(sondados, ["Candidato 1/3", "Candidato 2/3", "Candidato 3/3"])
        self.assertEqual(pela_vaga, [("Vfict|", "177979", ["1", "2", "3"])])


class SondagemDasAbas(unittest.TestCase):
    def test_pontos_e_escolha_da_aba(self):
        self.assertEqual([anexos.pontuar_aba(a) for a in ABAS], [0, 0, 3, 0])
        self.assertEqual(anexos.pontuar_aba({"icone": "fa fa-clipboard"}), 2)
        self.assertTrue(anexos.navega_para_fora({"href": "/empresa/vagas"}))
        self.assertFalse(anexos.navega_para_fora(ABAS[0]))
        self.assertEqual(anexos.escolher_aba(ABAS, {}), 2)
        # Sem sinal no href/título/ícone: a aba cujo painel tem "Pergunta N".
        sem_sinal = [dict(a, titulo="", href=f"#tab{a['i']}", icone="") for a in ABAS[:3]]
        self.assertEqual(anexos.escolher_aba(sem_sinal, {1: {"por_texto": 4}}), 1)
        self.assertIsNone(anexos.escolher_aba(sem_sinal, {}))

    def test_clicaveis_pontos_perigo_e_destino(self):
        self.assertEqual([anexos.pontuar_clicavel(c) for c in CLICAVEIS], [2, 2, 2])
        self.assertEqual([anexos.perigoso(c) for c in CLICAVEIS], [False, True, False])
        self.assertEqual(anexos.url_do_clicavel(CLICAVEIS[0]), RESPOSTAS)
        self.assertIsNone(anexos.url_do_clicavel(CLICAVEIS[2]))
        self.assertTrue(anexos.abre_modal(CLICAVEIS[2]))
        self.assertIsNone(anexos.url_do_clicavel({"abs": "https://outro.invalid/empresa/x"}))
        self.assertIsNone(anexos.url_do_clicavel({"abs": nav.URL_BASE + "/empresa/logout"}))
        self.assertEqual(anexos.pontuar_clicavel({"icone": "bi bi-download"}), 1)
        linha = anexos.linha_do_clicavel("C", CLICAVEIS[1])
        self.assertIn("onclick função reprovar", linha)
        _sem_proibidos(self, linha)

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


class RespostasDoQuestionario(unittest.TestCase):
    LISTA = """
    <div class="curriculo-append"><div class="list-group candidatura-group" id="curriculo-pagina-1">
      <div class="curriculo-list-item"><ul><li data-pessoa-id="7000001">Pessoa Fictícia Um</li></ul>
        <a class="link-curriculo" href="/empresa/curriculo/detalhes?tokenCandidato=TKfict123">ver</a>
        <a href="javascript:" data-resposta="7654321" data-modo-resposta="1"></a>
        <a href="javascript:" data-resposta="7654321" data-modo-resposta="2"></a></div>
      <div class="curriculo-list-item"><ul><li data-pessoa-id="7000002">Pessoa Fictícia Dois</li></ul>
        <a href="javascript:" data-resposta="111" ></a><a href="javascript:" data-resposta="222"></a></div>
      <div class="curriculo-list-item"><ul><li data-pessoa-id="7000003">Sem resposta</li></ul>
        <a href="javascript:" data-resposta="12a"></a></div>
    </div></div>
    """

    def test_le_o_data_resposta_de_cada_candidato(self):
        respostas, ambiguos = nav.ler_respostas_do_html(self.LISTA)
        self.assertEqual(respostas, {"7000001": "7654321", "7000002": "111"})
        self.assertEqual(ambiguos, 1)

    def test_link_das_respostas(self):
        self.assertEqual(
            anexos.link_das_respostas("7654321"), nav.URL_BASE + "/empresa/questionarios/imprimir/7654321|"
        )
        self.assertIsNone(anexos.link_das_respostas("12a"))
        self.assertIsNone(anexos.link_das_respostas(""))

    def test_grava_em_lotes_so_contagens_e_404_so_avisa(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, corpo))
            return {"gravadas": len(corpo["p_respostas"])}

        logs = []
        respostas = {"7000002": "111", "7000001": "7654321", "7000009": "x"}
        self.assertEqual(anexos.gravar_respostas({}, "gh-x", "177979", respostas, chamar, logs.append), 2)
        self.assertEqual(chamadas[0][0], "gravar_respostas_empregare")
        self.assertEqual(
            chamadas[0][1]["p_respostas"],
            [{"codigo": "7000001", "resposta": "7654321"}, {"codigo": "7000002", "resposta": "111"}],
        )
        self.assertEqual(logs, ["Vaga 177979: 2 resposta(s) de questionário gravada(s)."])

        def sem_migration(_config, funcao, _corpo):
            raise supabase_rpc.ErroDoSupabase(funcao, 404, "not found")

        logs.clear()
        self.assertEqual(anexos.gravar_respostas({}, "gh-x", "177979", respostas, sem_migration, logs.append), 0)
        self.assertIn("falta a migration 20261008160000", logs[0])
        self.assertEqual(anexos.gravar_respostas({}, "gh-x", "177979", {}, chamar, logs.append), 0)

    def test_portal_junta_as_respostas_da_lista(self):
        class DriverFalso:
            page_source = RespostasDoQuestionario.LISTA

            def execute_script(self, js, *args):
                return 3 if js == nav.JS_CONTAR_LINKS else None

        antigos = (nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA)
        nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA = 0.01, 0.01
        try:
            portal = nav.PortalEmpregare("pasta-falsa", lambda _m: None)
            portal.driver = DriverFalso()
            portal._carregar_e_ler_pagina(prazo=10**12)
        finally:
            nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA = antigos
        self.assertEqual(portal.respostas, {"7000001": "7654321", "7000002": "111"})


class RoboComRespostas(unittest.TestCase):
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

    def test_gravar_vaga_grava_respostas_depois_de_fechar_e_sem_elas_nao_chama(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append(funcao)
            if funcao == "fechar_vaga_empregare":
                return {"situacao": "GRAVADA", "ativos": 1, "desativadas": 0}
            if funcao == "gravar_respostas_empregare":
                return {"gravadas": 1}
            return {"situacao": "EM_CARGA"}

        lido = {"linhas": [{"codigo": "1", "chave": "cod:1"}], "colunas": ["Nome"], "sem_chave": 0, "repetidas": 0}
        enderecos = {"vaga_interno": "Vfict|", "candidatos": {"1": DETALHE}, "respostas": {"1": "7654321"}}
        saida = []
        with (
            mock.patch.object(self.robo, "ler_planilha", lambda _c, _v: lido),
            mock.patch.object(self.robo, "registrar", saida.append),
        ):
            self.robo.gravar_vaga({}, "gh-x", "177979", "x.xlsx", chamar, enderecos=enderecos)
            self.assertEqual(chamadas, ["gravar_lote_empregare", "fechar_vaga_empregare", "gravar_respostas_empregare"])
            chamadas.clear()
            self.robo.gravar_vaga({}, "gh-x", "177979", "x.xlsx", chamar, enderecos=dict(enderecos, respostas={}))
            self.assertEqual(chamadas, ["gravar_lote_empregare", "fechar_vaga_empregare"])
        _sem_proibidos(self, "\n".join(saida))
        self.assertNotIn("7654321", "\n".join(saida))


if __name__ == "__main__":
    unittest.main()
