"""
Robustez dos robôs (varredura de 22/10/2026; migration 20261022120000_robos_mais_robustos.sql):
prazo único da execução do robô da Empregare, Central que falha numa tentativa só,
exportação de outro tipo ou de data ilegível nunca baixada, pedido de exportação que
não se repete depois do clique, uma tentativa nas RPCs que fecham ou gravam, o 57014
que não se repete, saída parcial quando os anexos não gravam, código próprio para
entrada inválida, SIGTERM que fecha a execução e o hash do arquivo na leitura.
Banco e portal falsos: nada fala com a Empregare nem com o Supabase.
"""

import io
import json
import os
import pathlib
import signal
import sys
import tempfile
import types
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
from unittest import mock

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "scripts" / "conferencias"))
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))
sys.path.insert(0, str(_RAIZ / "python"))

import conferencias  # noqa: E402
import leitura_de_arquivos  # noqa: E402
import navegador_empregare as nav  # noqa: E402
import pre_classificacao as job  # noqa: E402
import robo_empregare as robo  # noqa: E402

from monitora import disparo_externo, execucao, supabase_rpc  # noqa: E402

DESDE = datetime(2026, 10, 22, 9, 0)


def exportacao(n, vaga="999990101", origem=nav.ORIGEM_EXPORTACAO, data="22/10/2026 09:05"):
    return {
        "id": str(n),
        "vaga": vaga,
        "origem": origem,
        "data": data,
        "situacao": "Disponível",
        "href": f"/Exports/Download/{n}",
    }


class EscolhaDaExportacao(unittest.TestCase):
    def test_data_ilegivel_nao_conta_como_desta_execucao(self):
        self.assertEqual(
            nav.escolher_exportacao([exportacao(1, data="ontem à tarde")], "999990101", DESDE),
            (None, "ainda não listada"),
        )
        # Sem `desde` (sem filtro de data), a linha continua valendo.
        self.assertEqual(nav.escolher_exportacao([exportacao(1, data="")], "999990101")[1], "ok")

    def test_exportacao_de_outro_tipo_nunca_e_baixada(self):
        outra = exportacao(2, origem="Currículos da vaga (PDF)")
        linha, motivo = nav.escolher_exportacao([outra], "999990101", DESDE)
        self.assertIsNone(linha)
        self.assertIn("outro tipo", motivo)
        linha, motivo = nav.escolher_exportacao([outra, exportacao(1)], "999990101", DESDE)
        self.assertEqual((linha["id"], motivo), ("1", "ok"))


class PrazoDoPortal(unittest.TestCase):
    def test_restante_respeita_o_prazo_da_execucao(self):
        portal = nav.PortalEmpregare("pasta-falsa", lambda _t: None)
        self.assertEqual(portal.restante(180), 180)
        portal.prazo = nav.time.monotonic() + 30
        self.assertLessEqual(portal.restante(180), 30)
        portal.prazo = nav.time.monotonic() - 5
        self.assertEqual(portal.restante(180), 0)


def _selenium_falso():
    """Só o que _pedir_exportacao importa do Selenium (o pacote não precisa estar instalado)."""
    excecoes = types.ModuleType("selenium.common.exceptions")
    excecoes.TimeoutException = type("TimeoutException", (Exception,), {})
    by = types.ModuleType("selenium.webdriver.common.by")
    by.By = types.SimpleNamespace(XPATH="xpath", ID="id", CSS_SELECTOR="css")
    ec = types.ModuleType("selenium.webdriver.support.expected_conditions")
    ec.presence_of_element_located = lambda alvo: alvo
    ec.visibility_of_element_located = lambda alvo: alvo
    suporte = types.ModuleType("selenium.webdriver.support")
    suporte.expected_conditions = ec
    return {
        "selenium": types.ModuleType("selenium"),
        "selenium.common": types.ModuleType("selenium.common"),
        "selenium.common.exceptions": excecoes,
        "selenium.webdriver": types.ModuleType("selenium.webdriver"),
        "selenium.webdriver.common": types.ModuleType("selenium.webdriver.common"),
        "selenium.webdriver.common.by": by,
        "selenium.webdriver.support": suporte,
        "selenium.webdriver.support.expected_conditions": ec,
    }


class PortalQueQuebraDepoisDoClique(nav.PortalEmpregare):
    """Pede a exportação sem Chrome; a tela de vagas não volta depois do clique em Exportar."""

    def __init__(self):
        self.logs = []
        super().__init__("pasta-falsa", self.logs.append)
        self.ids_das_vagas = {"999990101": "Id|"}
        self.cliques = []

    def _buscar_processo(self, codigo):
        return f"processo {codigo}"

    def clicar(self, elemento):
        self.cliques.append(elemento)

    def _esperar(self, _segundos):
        return types.SimpleNamespace(until=lambda alvo: alvo)

    def _marcar_checkbox(self, _id):
        pass

    def _selecionar_questionario(self):
        pass

    def abrir_vagas_anunciadas(self):
        raise RuntimeError("página de vagas não carregou")


class PedidoDeExportacao(unittest.TestCase):
    def test_depois_do_clique_conta_como_pedida_e_nao_pede_de_novo(self):
        portal = PortalQueQuebraDepoisDoClique()
        with mock.patch.dict(sys.modules, _selenium_falso()), mock.patch.object(nav.time, "sleep", lambda _s: None):
            self.assertTrue(portal.exportar_vaga("999990101"))
        self.assertEqual(portal.cliques.count(("id", "btn-exportar-candidatos")), 1)
        self.assertTrue(any("exportação pedida, mas a tela não voltou" in l for l in portal.logs))


class CentralQueFalha:
    """Central falsa: a 1ª abertura levanta; depois mostra a exportação de cada vaga pedida."""

    def __init__(self, falhas_ao_abrir=1, baixar_levanta=()):
        self.falhas_ao_abrir = falhas_ao_abrir
        self.baixar_levanta = set(baixar_levanta)
        self.aberturas = 0
        self.baixadas = []
        self.paginas_da_central = 1

    def abrir_central(self):
        self.aberturas += 1
        if self.aberturas <= self.falhas_ao_abrir:
            raise RuntimeError("element click intercepted")

    def ler_central(self):
        return [exportacao(i, vaga=str(999990100 + i)) for i in range(1, 4)]

    def baixar(self, linha, pasta):
        if linha["vaga"] in self.baixar_levanta:
            raise OSError("pasta sumiu")
        self.baixadas.append(linha["vaga"])
        return os.path.join(pasta, linha["vaga"] + ".xlsx")


class BaixarEGravar(unittest.TestCase):
    def setUp(self):
        self.logs = []
        self.gravadas = []
        self.antigos = (robo.registrar, robo.gravar_vaga)
        robo.registrar = self.logs.append

        def gravar(_config, _sync, codigo, _caminho, enderecos=None, totais=None):
            self.gravadas.append(codigo)
            return "GRAVADA"

        robo.gravar_vaga = gravar

    def tearDown(self):
        robo.registrar, robo.gravar_vaga = self.antigos

    def test_falha_ao_abrir_a_central_gasta_so_aquela_tentativa(self):
        portal = CentralQueFalha(falhas_ao_abrir=1, baixar_levanta=["999990102"])
        esperas = []
        baixadas, falhas, pendentes = robo.baixar_e_gravar(
            portal, {}, "gh-x", ["999990101", "999990102"], "pasta", DESDE, esperas.append
        )
        self.assertEqual((baixadas, falhas), (1, 0))
        self.assertEqual(self.gravadas, ["999990101"])
        # O download que levantou não derruba a execução: a vaga fica pendente.
        self.assertEqual(pendentes, ["999990102"])
        self.assertTrue(any("não abriu nesta tentativa" in l for l in self.logs))
        self.assertTrue(any("o download falhou" in l for l in self.logs))

    def test_prazo_da_execucao_para_as_tentativas_e_encurta_a_espera(self):
        relogio = {"t": 0.0}

        def dormir(segundos):
            relogio["t"] += segundos

        portal = CentralQueFalha(falhas_ao_abrir=99)
        baixadas, falhas, pendentes = robo.baixar_e_gravar(
            portal, {}, "gh-x", ["999990101"], "pasta", DESDE, dormir, fim=45.0, agora=lambda: relogio["t"]
        )
        self.assertEqual((baixadas, falhas, pendentes), (0, 0, ["999990101"]))
        # 30 s + 15 s (a espera encurta até o prazo) e nenhuma tentativa depois dele.
        self.assertEqual(portal.aberturas, 2)
        self.assertEqual(relogio["t"], 45.0)
        self.assertTrue(any("Prazo da execução" in l for l in self.logs))

    def test_prazo_da_execucao_vale_dentro_do_lote_e_o_que_falta_vira_falha(self):
        class CentralVazia(CentralQueFalha):
            def ler_central(self):
                return []

            def exportar_vaga(self, _codigo):
                return True

            def capturar_candidatos(self, codigo):
                return {"vaga_interno": f"Id{codigo}|", "candidatos": {}, "respostas": {}}

        tempos = iter([0.0] + [10.0] * 20 + [robo.PRAZO_DA_EXECUCAO] * 1000)
        contagem = {}
        vagas = [{"vaga": "999990101", "edital": "114/2026"}]
        baixadas, falhas = robo.processar_vagas(
            CentralVazia(falhas_ao_abrir=0),
            {},
            "gh-x",
            vagas,
            "pasta",
            dormir=lambda _s: None,
            agora=lambda: next(tempos),
            relogio=lambda: DESDE,
            contagem=contagem,
        )
        self.assertEqual((baixadas, falhas), (0, 1))
        self.assertTrue(any("Central não aberta de novo" in l for l in self.logs))
        self.assertFalse(any(l.startswith("Segunda passada: pedindo") for l in self.logs))


class GravarVaga(unittest.TestCase):
    LIDO = {"linhas": [{"codigo": "7000001"}], "colunas": ["CÓDIGO"], "sem_chave": 0, "repetidas": 0}

    def test_uma_tentativa_no_lote_e_no_fechamento_e_anexos_recusados_contam(self):
        opcoes = []

        def chamar(_config, funcao, corpo, **kw):
            opcoes.append((funcao, kw))
            if funcao == "fechar_vaga_empregare":
                return {"situacao": "GRAVADA", "ativos": 1, "desativadas": 0}
            if funcao == "gravar_anexos_empregare":
                raise supabase_rpc.ErroDoSupabase(funcao, 400, '{"code":"55000","message":"Inscrições congeladas"}')
            return {"situacao": "EM_CARGA"}

        totais = {}
        enderecos = {"anexos": {"7000001": [{"resposta": "1", "perguntas": 1, "anexos": []}]}}
        with mock.patch.object(robo, "ler_planilha", lambda _c, _v: self.LIDO), redirect_stdout(io.StringIO()):
            situacao = robo.gravar_vaga({}, "gh-x", "999990101", "x.xlsx", chamar, enderecos=enderecos, totais=totais)
        self.assertEqual(situacao, "GRAVADA")
        self.assertEqual(totais, {"gravadas": 1, "anexos_com_falha": 1})
        self.assertEqual(dict(opcoes)["gravar_lote_empregare"], {"tentativas": 1})
        self.assertEqual(dict(opcoes)["fechar_vaga_empregare"], {"tentativas": 1})


class Principal(unittest.TestCase):
    """O fim da execução do robô: saída parcial pelos anexos, saída do passo e SIGTERM."""

    def rodar(self, processar, ambiente=None):
        chamadas = []

        def chamar(_config, funcao, corpo, **kw):
            chamadas.append((funcao, corpo, kw))
            if funcao == "listar_vagas_empregare":
                return {"modo": "PADRAO", "limite": 60, "vagas": [{"vaga": "999990101", "edital": "114/2026"}]}
            if funcao == "finalizar_sync_empregare":
                return {"situacao": "CONCLUIDA"}
            return {}

        class PortalNulo:
            def __init__(self, *_a):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *_a):
                return False

            def entrar(self, *_a):
                pass

            def abrir_vagas_anunciadas(self):
                pass

        saida = io.StringIO()
        with (
            mock.patch.object(robo.supabase_rpc, "chamar", chamar),
            mock.patch.object(robo.supabase_rpc, "configuracao", return_value={}),
            mock.patch.object(robo.nav, "credenciais", return_value=("robo@exemplo.invalid", "x")),
            mock.patch.object(robo.nav, "PortalEmpregare", PortalNulo),
            mock.patch.object(robo, "processar_vagas", processar),
            mock.patch.object(robo, "resumir_perguntas", return_value=("Resumo das perguntas: 0.", False)),
            mock.patch.dict(os.environ, ambiente or {}, clear=False),
            redirect_stdout(saida),
        ):
            codigo = robo.principal(robo.argumentos([]))
        return codigo, chamadas, saida.getvalue()

    def test_anexos_que_nao_gravaram_deixam_a_execucao_parcial_e_o_passo_diz_que_houve_carga(self):
        def processar(*_a, contagem=None, **_k):
            contagem.update(baixadas=1, falhas=0, gravadas=1, anexos_com_falha=1)

        with tempfile.TemporaryDirectory() as pasta:
            saida_do_passo = os.path.join(pasta, "saida")
            codigo, chamadas, texto = self.rodar(processar, {"GITHUB_OUTPUT": saida_do_passo})
            with open(saida_do_passo, encoding="utf-8") as f:
                self.assertEqual(f.read(), "carga=sim\n")
        self.assertEqual(codigo, 2)
        self.assertIn("Anexos do questionário NÃO gravados em 1 vaga(s)", texto)
        fim = [c for c in chamadas if c[0] == "finalizar_sync_empregare"][0]
        self.assertEqual(fim[2], {"tentativas": 1})

    def test_interrupcao_do_github_fecha_a_execucao_com_erro(self):
        def processar(*_a, contagem=None, **_k):
            contagem.update(baixadas=3)
            raise execucao.ExecucaoInterrompida("execução interrompida (SIGTERM: cancelada ou sem tempo)")

        codigo, chamadas, _ = self.rodar(processar)
        self.assertEqual(codigo, 1)
        fim = [c for c in chamadas if c[0] == "finalizar_sync_empregare"][0]
        self.assertIn("SIGTERM", fim[1]["p_erro"])
        self.assertEqual(fim[1]["p_vagas_baixadas"], 3)


class SinalViraExcecao(unittest.TestCase):
    def test_sigterm_levanta_uma_vez_e_o_segundo_e_ignorado(self):
        instalados = {}

        def instalar(sinal, manipulador):
            anterior = instalados.get(sinal)
            instalados[sinal] = manipulador
            return anterior

        with self.assertRaises(execucao.ExecucaoInterrompida) as caso:
            with execucao.interromper_com_excecao(sinais=(signal.SIGTERM,), instalar=instalar):
                instalados[signal.SIGTERM](signal.SIGTERM, None)
        self.assertIn("SIGTERM", str(caso.exception))
        # Ao sair do bloco, volta o manipulador padrão (o ignorado só valia durante o fechamento).
        self.assertEqual(instalados[signal.SIGTERM], signal.SIG_DFL)
        # Não é Exception: passa pelos except que protegem cada vaga ou edital.
        self.assertFalse(issubclass(execucao.ExecucaoInterrompida, Exception))

    def test_entrada_invalida_sai_com_codigo_proprio(self):
        for analisar, args in (
            (robo.argumentos, ["--limite", "0"]),
            (job.argumentos, ["--forcar-congelado", "nao-e-token"]),
            (conferencias.argumentos, ["--dias-convocado", "0"]),
        ):
            with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as falha:
                analisar(args)
            self.assertEqual(falha.exception.code, execucao.ENTRADA_INVALIDA, analisar.__module__)


class JobsFechamComErro(unittest.TestCase):
    def test_pre_classificacao_interrompida_fecha_a_execucao(self):
        chamadas = []

        def banco(_cfg, funcao, corpo, **kw):
            chamadas.append((funcao, corpo, kw))
            if funcao == "pre_classificacao_ler_editais":
                return {"hoje": "2026-10-22", "editais": [{"id": "e1", "rotulo": "93/2026", "regra": {}}]}
            return {}

        def interrompido(*_a, **_k):
            raise execucao.ExecucaoInterrompida("execução interrompida (SIGTERM)")

        with mock.patch.object(job, "processar_edital", interrompido), redirect_stdout(io.StringIO()):
            codigo = job.principal(
                job.argumentos([]), configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco
            )
        self.assertEqual(codigo, 1)
        fim = chamadas[-1]
        self.assertEqual(fim[0], "finalizar_pre_classificacao")
        self.assertIn("SIGTERM", fim[1]["p_erro"])
        self.assertEqual(fim[2], {"tentativas": 1})

    def test_conferencias_interrompidas_fecham_a_execucao(self):
        chamadas = []

        def banco(_cfg, funcao, corpo, **kw):
            chamadas.append((funcao, corpo, kw))
            return {}

        def interrompido(*_a, **_k):
            raise execucao.ExecucaoInterrompida("execução interrompida (SIGTERM)")

        args = conferencias.argumentos([])
        with mock.patch.object(conferencias, "conferir", interrompido), redirect_stdout(io.StringIO()):
            self.assertEqual(
                conferencias.principal(args, configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco), 1
            )
        self.assertEqual(chamadas[-1][0], "finalizar_conferencia")
        self.assertIn("SIGTERM", chamadas[-1][1]["p_erro"])
        self.assertEqual(chamadas[-1][2], {"tentativas": 1})


class CanceladaPorTempo(unittest.TestCase):
    def test_57014_nao_se_repete_e_o_5xx_comum_sim(self):
        def resposta_de_erro(codigo, corpo):
            return urllib.error.HTTPError("https://x", codigo, "erro", {}, io.BytesIO(corpo.encode()))

        tentativas = []

        def abrir(_pedido, timeout=None):
            tentativas.append(1)
            raise resposta_de_erro(500, json.dumps({"code": "57014", "message": "canceling statement"}))

        with self.assertRaises(supabase_rpc.ErroDoSupabase) as erro:
            supabase_rpc.chamar({"url": "https://x", "chave": "k"}, "f", {}, abrir=abrir, esperar=lambda _s: None)
        self.assertEqual(len(tentativas), 1)
        self.assertIn("57014", str(erro.exception))

        tentativas.clear()

        def abrir_503(_pedido, timeout=None):
            tentativas.append(1)
            raise resposta_de_erro(503, "fora do ar")

        with self.assertRaises(supabase_rpc.ErroDoSupabase):
            supabase_rpc.chamar({"url": "https://x", "chave": "k"}, "f", {}, abrir=abrir_503, esperar=lambda _s: None)
        self.assertEqual(len(tentativas), 3)


class ListaDosWorkflows(unittest.TestCase):
    def test_leitura_entra_e_o_expurgo_sai(self):
        self.assertIn("leitura-de-arquivos.yml", disparo_externo.WORKFLOWS)
        self.assertNotIn("expurgo-anexos-chat.yml", disparo_externo.WORKFLOWS)
        for nome in disparo_externo.WORKFLOWS:
            self.assertTrue((_RAIZ / ".github" / "workflows" / nome).exists(), nome)


class ArquivoDaLeitura(unittest.TestCase):
    def test_leitura_leva_o_hash_do_arquivo_do_link_e_nunca_o_nome(self):
        anexo = {
            "resposta": "0e6c9f1e-1111-4222-8333-444455556666",
            "pergunta": "1001",
            "arquivo": 1,
            "link": "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?t=TK&arquivo=Maria_Fict.pdf",
        }
        leitura = leitura_de_arquivos.para_o_banco(anexo, {"situacao": "LIDO"}, None)
        esperado = leitura_de_arquivos.hashlib.sha256(b"Maria_Fict.pdf").hexdigest()
        self.assertEqual(leitura["hash_link_arquivo"], esperado)
        self.assertNotIn("Maria", json.dumps(leitura))
        self.assertNotIn("hash_link_arquivo", leitura_de_arquivos.para_o_banco(dict(anexo, link=""), {}, None))


if __name__ == "__main__":
    unittest.main()
