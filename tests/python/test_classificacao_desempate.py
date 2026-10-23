"""
O relatório de desempate (python/monitora/classificacao/desempate.py), a
comparação com o motor da tela (comparacao.py) e o job (--seco, --calculo e --desempate,
scripts/classificacao/classificacao.py), nos editais fictícios dos casos
dourados (tests/fixtures/classificacao/casos-do-motor.json). Nada fala com o
Supabase nem roda o Node: o motor da tela e as RPCs entram como funções injetadas.
"""

import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest

from monitora.classificacao import desempate, motor
from monitora.classificacao.comparacao import comparar, divergencias
from monitora.classificacao.retrato import retrato_do_edital

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
DADOS = json.loads((_RAIZ / "tests" / "fixtures" / "classificacao" / "casos-do-motor.json").read_text(encoding="utf-8"))
_ESPEC = importlib.util.spec_from_file_location(
    "job_classificacao", _RAIZ / "scripts" / "classificacao" / "classificacao.py"
)
job = importlib.util.module_from_spec(_ESPEC)
_ESPEC.loader.exec_module(job)


def _relatorio(edital, tipo):
    return desempate.relatorio_de_desempate({"tipo": tipo, **DADOS["editais"][edital]})


def _grupo(relatorio, vaga, nota, lista="GERAL"):
    for v in relatorio["vagas"]:
        if v["chave"] == vaga:
            for g in v["grupos"]:
                if g["lista"] == lista and g["nota"] == nota:
                    return g
    raise AssertionError(f"grupo {vaga}/{lista}/{nota} não encontrado")


class RelatorioDeDesempate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.resultado, cls.final = _relatorio("criterios-sorteio-maior-percentual", "FINAL")

    def test_forma_estavel(self):
        r = self.final
        self.assertEqual(r["versao"], desempate.VERSAO_DO_RELATORIO)
        self.assertEqual((r["tipo"], r["ordem"], r["empateNaLista"]), ("FINAL", "FINAL", "CRITERIOS"))
        self.assertEqual([c["codigo"] for c in r["criterios"]][:2], ["IDOSO_60", "INDIGENA_COMPROVADO"])
        self.assertEqual(r["empateFinal"], {"metodo": "SORTEIO", "numeracao": "DENSA"})
        self.assertEqual(
            r["totais"]["grupos"],
            sum(len(v["grupos"]) for v in r["vagas"]),
        )
        # O json estável: mesma entrada, mesmo relatório.
        self.assertEqual(
            json.dumps(r, sort_keys=True),
            json.dumps(_relatorio("criterios-sorteio-maior-percentual", "FINAL")[1], sort_keys=True),
        )

    def test_cada_criterio_decide_o_seu_grupo(self):
        esperados = {
            80: "IDOSO_60",
            79: "INDIGENA_COMPROVADO",
            78: "EXP_SAUDE_INDIGENA",
            77: "EXP_PROFISSIONAL_TEMPO",
            76: "MAIOR_IDADE",
            74: "PCD",
        }
        for nota, criterio in esperados.items():
            with self.subTest(nota=nota):
                g = _grupo(self.final, "101", nota)
                self.assertEqual(g["resolucao"], "CRITERIOS")
                self.assertEqual(g["pares"][-1]["criterio"], criterio)
                self.assertEqual(g["criteriosAplicados"][-1], criterio)

    def test_valor_nulo_fica_atras_e_aparece_como_sem_dado(self):
        g = _grupo(self.final, "101", 78)
        self.assertEqual([c["valores"]["EXP_SAUDE_INDIGENA"] for c in g["candidatos"]], [300, 120, None])
        self.assertIn("(120 × sem dado)", desempate.texto_do_relatorio(self.final))

    def test_hora_da_certidao_no_mesmo_dia(self):
        g = _grupo(self.final, "101", 75)
        par = g["pares"][0]
        self.assertEqual(par["criterio"], "MAIOR_IDADE")
        self.assertTrue(par["horaDaCertidao"])
        self.assertEqual(
            par["valores"], [{"ordemDeIdade": 1, "certidao": True}, {"ordemDeIdade": 2, "certidao": False}]
        )
        self.assertIn("decidiu a hora da certidão", desempate.texto_do_relatorio(self.final))

    def test_empate_ate_o_fim_sorteio_registrado_e_pendente(self):
        sorteado = _grupo(self.final, "101", 73)
        self.assertEqual(sorteado["resolucao"], "EMPATE_FINAL")
        self.assertEqual(sorteado["empatadosAteOFim"][0]["resolucao"], "SORTEIO")
        self.assertEqual(sorteado["empatadosAteOFim"][0]["registro"], "sorteio-FINAL")
        self.assertTrue(sorteado["empatadosAteOFim"][0]["chave"].startswith("FINAL|101|"))
        pendente = _grupo(self.final, "101", 72)
        fim = pendente["empatadosAteOFim"][0]
        self.assertEqual((fim["resolucao"], fim["metodo"], len(fim["analiseIds"])), ("PENDENTE", "SORTEIO", 3))
        self.assertEqual([c["posicao"] for c in pendente["candidatos"]], [18, 18, 18])
        chaves = {p["chave"] for p in self.resultado["pendencias"]}
        self.assertIn(fim["chave"], chaves)

    def test_ordem_de_inscricao_e_mesma_posicao_da_lista(self):
        _, inscricao = _relatorio("ordem-de-inscricao-saltando-pcd-mais-uma", "FINAL")
        resolucoes = {e["resolucao"] for v in inscricao["vagas"] for g in v["grupos"] for e in g["empatadosAteOFim"]}
        self.assertIn("INSCRICAO", resolucoes)
        _, mesma = _relatorio("mesma-posicao-todas-so-parecer", "PRELIMINAR")
        self.assertEqual(mesma["empateNaLista"], "MESMA_POSICAO")
        self.assertTrue(all(g["resolucao"] == "MESMA_POSICAO_LISTA" for v in mesma["vagas"] for g in v["grupos"]))
        self.assertIn("a regra não aplica os critérios", desempate.texto_do_relatorio(mesma))

    def test_grupos_por_modalidade(self):
        listas = {g["lista"] for v in self.final["vagas"] for g in v["grupos"]}
        self.assertIn("GERAL", listas)
        self.assertTrue(listas - {"GERAL"}, "esperado ao menos um grupo numa lista de modalidade")

    def test_nome_e_codigo_sem_data_de_nascimento(self):
        texto = json.dumps(self.final, ensure_ascii=False) + desempate.texto_do_relatorio(self.final)
        primeiro = _grupo(self.final, "101", 80)["candidatos"][0]
        self.assertTrue(primeiro["nome"])
        self.assertIn(f"{primeiro['nome']} (insc. {primeiro['codigo']})", texto)
        for c in DADOS["editais"]["criterios-sorteio-maior-percentual"]["candidatos"]:
            if c["data_nascimento"]:
                self.assertNotIn(c["data_nascimento"], texto)
        self.assertNotRegex(texto, r"@|[0-9]{11}")

    def test_lista_sem_empate(self):
        _, r = _relatorio("criterios-sorteio-maior-percentual", "ENTREVISTA")
        vazio = {**r, "vagas": [], "totais": {**r["totais"], "grupos": 0}}
        self.assertIn("Nenhum empate de nota", desempate.texto_do_relatorio(vazio))


_DOURADO_DO_RELATORIO = _RAIZ / "tests" / "fixtures" / "classificacao" / "relatorio-de-desempate.json"


def resposta_dourada():
    """A resposta de obter_desempate_da_lista com o relatório do edital fictício (lida também pelo vitest)."""
    _, relatorio = _relatorio("criterios-sorteio-maior-percentual", "FINAL")
    return {
        "lista_id": "lista-ficticia-final",
        "versao": relatorio["versao"],
        "gerado_em": "2026-10-23T10:00:00-03:00",
        "da_lista_atual": True,
        "grupos": relatorio["totais"]["grupos"],
        "empatados": relatorio["totais"]["empatadosAteOFim"],
        "pendentes": relatorio["totais"]["pendentes"],
        "relatorio": relatorio,
        "texto": desempate.texto_do_relatorio(relatorio),
    }


class FormatoCompartilhadoComATela(unittest.TestCase):
    def test_o_relatorio_dourado_e_o_que_o_python_gera_hoje(self):
        gravado = json.loads(_DOURADO_DO_RELATORIO.read_text(encoding="utf-8"))
        self.assertEqual(
            gravado,
            json.loads(json.dumps(resposta_dourada(), ensure_ascii=False)),
            "O formato do relatório mudou: regere com `python tests/python/test_classificacao_desempate.py --regerar` "
            "e acerte src/lib/classificacao/relatorio-de-desempate.ts (VERSAO_DO_RELATORIO).",
        )


class ComparacaoComOMotorDaTela(unittest.TestCase):
    def test_numero_pelo_valor_e_bool_nao_e_numero(self):
        self.assertEqual(divergencias({"a": 3, "b": [1, 2]}, {"a": 3.0, "b": [1, 2]}), [])
        self.assertEqual(divergencias({"a": True}, {"a": 1})[0]["caminho"], "a")
        self.assertEqual(divergencias({"a": [1, 2]}, {"a": [1]})[0], {"caminho": "a[]", "motor": 2, "python": 1})
        self.assertEqual(divergencias({"a": 1}, {})[0]["python"], "(falta)")

    def test_resumo_por_parte(self):
        c = comparar({"vagas": [{"x": 1}], "avisos": [1, 2]}, {"vagas": [{"x": 2}], "avisos": [1, 3]})
        self.assertEqual((c["total"], c["por_parte"]), (2, {"vagas": 1, "avisos": 1}))


def _dados_do_edital():
    """O json de classificacao_ler_edital de um edital fictício (a entrada do caso dourado, no formato do banco)."""
    e = DADOS["editais"]["decisao-manual-convocacao-ajustes"]
    return {
        "edital": {"id": "edital-ficticio", "numero": "999/2026", "unidade": e["unidade"]},
        "regra": {"versao": 1, "configuracao": e["regra"]},
        "cronograma": [{"atividade": "Período de inscrições", "inicio": "2025-02-01", "fim": "2025-02-28"}],
        "quadro": e["quadro"],
        "candidatos": e["candidatos"],
        "entrevistas": e["entrevistas"],
        "desempates": e["desempates"],
        "ajustes": e["ajustes"],
        "convocacao": {k: v for k, v in e["convocacao"].items() if k != "edital_id"},
    }


class JobSeco(unittest.TestCase):
    def _rodar(self, argv, motor_da_tela):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            codigo = job.principal(argv, ambiente={}, motor=motor_da_tela)
        return codigo, saida.getvalue()

    def _arquivo(self, pasta):
        caminho = pathlib.Path(pasta) / "dados.json"
        caminho.write_text(json.dumps(_dados_do_edital(), ensure_ascii=False), encoding="utf-8")
        return str(caminho)

    def test_mesma_saida_sem_divergencia_e_relatorios_na_pasta(self):
        def igual(dados, tipos):
            return {t: motor.classificar_edital(dados, t) for t in tipos}

        with tempfile.TemporaryDirectory() as pasta:
            codigo, log = self._rodar(["--seco", "--arquivo", self._arquivo(pasta), "--saida", pasta], igual)
            self.assertEqual(codigo, job.SEM_DIVERGENCIA, log)
            self.assertIn("999/2026 · FINAL", log)
            self.assertIn("Sem divergência", log)
            arquivos = sorted(p.name for p in pathlib.Path(pasta).iterdir())
            self.assertIn("999-2026-final.desempate.txt", arquivos)
            self.assertIn("divergencias-999-2026-final.json", arquivos)
        for c in _dados_do_edital()["candidatos"]:
            if c["nome"]:
                self.assertNotIn(c["nome"], log)

    def test_divergencia_sai_com_2_e_o_log_so_tem_o_caminho(self):
        def diferente(dados, tipos):
            saida = {t: motor.classificar_edital(dados, t) for t in tipos}
            saida["FINAL"]["vagas"][0]["geral"][0]["posicao"] = 99
            return saida

        with tempfile.TemporaryDirectory() as pasta:
            codigo, log = self._rodar(["--seco", "--arquivo", self._arquivo(pasta), "--tipos", "FINAL"], diferente)
        self.assertEqual(codigo, job.COM_DIVERGENCIA)
        self.assertIn("diverge em vagas[0].geral[0].posicao", log)
        self.assertNotIn("99", log.split("diverge em")[1].split("\n")[0].replace("vagas[0].geral[0].posicao", ""))

    def test_pede_um_modo_e_opcoes_do_modo(self):
        for argv in (
            ["--arquivo", "x.json"],
            ["--seco", "--desempate"],
            ["--seco", "--arquivo", "x.json", "--tipos", "OUTRA"],
            ["--seco", "--arquivo", "x.json", "--lista", "11111111-1111-1111-1111-111111111111"],
            ["--desempate", "--edital", "x"],
            ["--desempate", "--lista", "nao-e-uuid"],
        ):
            with self.subTest(argv=argv):
                with self.assertRaises(SystemExit) as saida, contextlib.redirect_stderr(io.StringIO()):
                    job.principal(argv, ambiente={})
                self.assertEqual(saida.exception.code, 3)

    def test_falha_do_motor_da_tela_sai_com_1(self):
        def quebra(_dados, _tipos):
            raise RuntimeError("O motor da tela (Node) falhou com o código 1.")

        with tempfile.TemporaryDirectory() as pasta:
            codigo, log = self._rodar(["--seco", "--arquivo", self._arquivo(pasta)], quebra)
        self.assertEqual(codigo, job.ERRO)
        self.assertIn("Falhou", log)

    def test_leitura_pela_rpc_do_servico(self):
        chamadas = []

        def chamar(config, funcao, corpo):
            chamadas.append((funcao, corpo))
            return {"edital": {"numero": "1/2026"}}

        self.assertEqual(
            job.ler_edital({"url": "https://x", "chave": "k"}, "id-1", chamar=chamar)["edital"]["numero"], "1/2026"
        )
        self.assertEqual(chamadas, [("classificacao_ler_edital", {"p_edital": "id-1"})])


L_PRONTA = "11111111-1111-4111-8111-111111111111"
L_MEXIDA = "22222222-2222-4222-8222-222222222222"
L_REGRA_VELHA = "33333333-3333-4333-8333-333333333333"
L_QUEBRA = "44444444-4444-4444-8444-444444444444"
HASH = "a" * 64


class BancoFalso:
    """As RPCs do --desempate, sem rede: as listas registradas vêm do próprio retrato do Python (como a tela grava)."""

    def __init__(self, pedidos=None, falha_na_leitura=False, calculos=None, falha_nos_calculos=False, recusar=None):
        self.dados = _dados_do_edital()
        resultado = motor.classificar_edital(self.dados, "FINAL")
        # O jsonb devolve as chaves em outra ordem e 3.0 como 3.
        retrato = json.loads(json.dumps(retrato_do_edital(self.dados, resultado), sort_keys=True))
        mexido = json.loads(json.dumps(retrato))
        mexido["vagas"][0]["geral"][0]["posicao"] += 1
        base = {"edital": "edital-ficticio", "tipo": "FINAL", "versao_regra": 1, "hash": HASH}
        self.listas = {
            L_PRONTA: {**base, "id": L_PRONTA, "resultado": retrato},
            L_MEXIDA: {**base, "id": L_MEXIDA, "resultado": mexido},
            L_REGRA_VELHA: {**base, "id": L_REGRA_VELHA, "versao_regra": 0, "resultado": retrato},
        }
        self.pedidos = (
            [{"lista": x} for x in (L_PRONTA, L_MEXIDA, L_REGRA_VELHA, L_QUEBRA)] if pedidos is None else pedidos
        )
        self.falha_na_leitura = falha_na_leitura
        # A fila dos cálculos, lida a cada chamada (o que chega no meio da execução vem num lote depois).
        self.lotes_de_calculo = list(calculos or [])
        self.falha_nos_calculos = falha_nos_calculos
        self.recusar = recusar or {}
        self.chamadas = []
        self.marcas = {}
        self.gravados = {}
        self.marcas_do_calculo = {}
        self.retratos = {}

    def __call__(self, config, funcao, corpo):
        self.chamadas.append((funcao, corpo))
        if funcao == "classificacao_ler_pedidos_desempate":
            if self.falha_na_leitura:
                raise job.supabase_rpc.ErroDoSupabase(funcao, 500, "fora do ar")
            return self.pedidos
        if funcao == "classificacao_marcar_preparo":
            self.marcas.setdefault(corpo["p_lista"], []).append((corpo["p_situacao"], corpo["p_mensagem"]))
            return {"situacao": corpo["p_situacao"]}
        if funcao == "classificacao_ler_lista":
            if corpo["p_lista"] not in self.listas:
                raise job.supabase_rpc.ErroDoSupabase(funcao, 400, "22023: Lista não encontrada")
            return json.loads(json.dumps(self.listas[corpo["p_lista"]]))
        if funcao == "classificacao_ler_edital":
            return json.loads(json.dumps(self.dados))
        if funcao == "classificacao_gravar_desempate":
            self.gravados[corpo["p_lista"]] = corpo
            return {"lista": corpo["p_lista"]}
        if funcao == "classificacao_ler_pedidos_calculo":
            if self.falha_nos_calculos:
                raise job.supabase_rpc.ErroDoSupabase(funcao, 500, "fora do ar")
            return self.lotes_de_calculo.pop(0) if self.lotes_de_calculo else []
        if funcao == "classificacao_marcar_calculo":
            self.marcas_do_calculo.setdefault(corpo["p_pedido"], []).append((corpo["p_situacao"], corpo["p_mensagem"]))
            return {"situacao": corpo["p_situacao"]}
        if funcao == "classificacao_gravar_calculo":
            if corpo["p_pedido"] in self.recusar:
                raise job.supabase_rpc.ErroDoSupabase(funcao, 400, self.recusar[corpo["p_pedido"]])
            self.retratos[corpo["p_pedido"]] = corpo
            return {"pedido": corpo["p_pedido"], "situacao": "PRONTO", "hash": HASH}
        raise AssertionError(funcao)


class JobDesempate(unittest.TestCase):
    def _rodar(self, banco, argv=("--desempate",)):
        saida = io.StringIO()
        ambiente = {"SUPABASE_URL": "https://exemplo.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "chave"}
        with contextlib.redirect_stdout(saida):
            codigo = job.principal(list(argv), ambiente=ambiente, chamar=banco)
        return codigo, saida.getvalue()

    def test_grava_so_a_lista_que_confere_e_marca_as_outras(self):
        banco = BancoFalso()
        codigo, log = self._rodar(banco)
        self.assertEqual(codigo, job.COM_DIVERGENCIA)
        self.assertEqual(set(banco.gravados), {L_PRONTA})
        gravado = banco.gravados[L_PRONTA]
        self.assertEqual(gravado["p_hash"], HASH)
        self.assertEqual(gravado["p_relatorio"]["tipo"], "FINAL")
        self.assertTrue(gravado["p_execucao"].startswith("classificacao-"))
        self.assertEqual([s for s, _ in banco.marcas[L_PRONTA]], ["PREPARANDO"])
        self.assertEqual([s for s, _ in banco.marcas[L_MEXIDA]], ["PREPARANDO", "NAO_CONFERE"])
        self.assertIn("1 diferença(s)", banco.marcas[L_MEXIDA][-1][1])
        self.assertEqual(banco.marcas[L_REGRA_VELHA][-1], ("NAO_CONFERE", job.MENSAGEM_REGRA_MUDOU))
        self.assertEqual(banco.marcas[L_QUEBRA][-1][0], "FALHOU")
        self.assertIn("Lista não encontrada", banco.marcas[L_QUEBRA][-1][1])
        # O edital é lido uma vez para as listas dele.
        self.assertEqual(sum(1 for f, _ in banco.chamadas if f == "classificacao_ler_edital"), 1)
        self.assertIn("999/2026 · FINAL · lista 11111111: relatório gravado", log)
        self.assertIn("difere em vagas[0].geral[0].posicao", log)
        self.assertIn("4 lista(s): 1 falhou, 2 nao confere, 1 pronto.", log)

    def test_o_relatorio_gravado_tem_nome_e_o_log_e_as_mensagens_nao(self):
        banco = BancoFalso()
        _, log = self._rodar(banco)
        nomes = [c["nome"] for c in banco.dados["candidatos"] if c["nome"]]
        texto = banco.gravados[L_PRONTA]["p_texto"]
        self.assertTrue(any(n in texto for n in nomes))
        mensagens = " ".join(m or "" for marcas in banco.marcas.values() for _, m in marcas)
        for nome in nomes:
            self.assertNotIn(nome, log)
            self.assertNotIn(nome, mensagens)

    def test_so_as_listas_pedidas_e_nada_pendente(self):
        banco = BancoFalso(pedidos=[{"lista": L_PRONTA}])
        codigo, log = self._rodar(banco, ["--desempate", "--lista", f"{L_PRONTA},{L_MEXIDA}"])
        self.assertEqual(codigo, job.SEM_DIVERGENCIA)
        self.assertIn(("classificacao_ler_pedidos_desempate", {"p_listas": [L_PRONTA, L_MEXIDA]}), banco.chamadas)
        codigo, log = self._rodar(BancoFalso(pedidos=[]))
        self.assertEqual(codigo, job.SEM_DIVERGENCIA)
        self.assertIn("Nenhuma lista esperando", log)

    def test_falha_ao_ler_os_pedidos_sai_com_1(self):
        codigo, log = self._rodar(BancoFalso(falha_na_leitura=True))
        self.assertEqual(codigo, job.ERRO)
        self.assertIn("Falhou ao ler os pedidos", log)

    def test_motivo_seguro_nao_repete_a_mensagem_de_excecao_qualquer(self):
        self.assertEqual(job.motivo_seguro(KeyError("Fulana de Tal")), "KeyError")
        self.assertIn("hash diferente", job.motivo_seguro(job.supabase_rpc.ErroDoSupabase("x", 400, "hash diferente")))


P_OK = "aaaaaaaa-1111-4111-8111-111111111111"
P_REGRA = "bbbbbbbb-2222-4222-8222-222222222222"
P_RECUSADO = "cccccccc-3333-4333-8333-333333333333"


def _pedido(pedido, versao=1, tipo="FINAL"):
    return {"pedido": pedido, "edital": "edital-ficticio", "tipo": tipo, "versao_regra": versao, "situacao": "PEDIDO"}


class JobCalculo(unittest.TestCase):
    """--calculo (etapa 2b): o retrato da lista pedida pelo "Gerar", calculado pelo Python e gravado no pedido."""

    def _rodar(self, banco, argv=("--calculo",)):
        saida = io.StringIO()
        ambiente = {"SUPABASE_URL": "https://exemplo.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "chave"}
        with contextlib.redirect_stdout(saida):
            codigo = job.principal(list(argv), ambiente=ambiente, chamar=banco)
        return codigo, saida.getvalue()

    def test_grava_o_retrato_que_a_tela_registraria(self):
        banco = BancoFalso(pedidos=[], calculos=[[_pedido(P_OK)]])
        codigo, log = self._rodar(banco)
        self.assertEqual(codigo, job.SEM_DIVERGENCIA, log)
        self.assertEqual([s for s, _ in banco.marcas_do_calculo[P_OK]], ["CALCULANDO"])
        gravado = banco.retratos[P_OK]
        self.assertTrue(gravado["p_execucao"].startswith("classificacao-"))
        esperado = retrato_do_edital(banco.dados, motor.classificar_edital(banco.dados, "FINAL"))
        self.assertEqual(gravado["p_retrato"], esperado)
        self.assertEqual(gravado["p_retrato"]["regra_versao"], 1)
        self.assertIn("999/2026 · FINAL · pedido aaaaaaaa: lista calculada", log)
        self.assertIn("1 cálculo(s): 1 pronto.", log)
        # O retrato leva os nomes (vai para o banco); o log, não.
        nomes = [c["nome"] for c in banco.dados["candidatos"] if c["nome"]]
        self.assertTrue(any(n in json.dumps(gravado["p_retrato"], ensure_ascii=False) for n in nomes))
        for nome in nomes:
            self.assertNotIn(nome, log)

    def test_regra_mudada_ou_gravacao_recusada_marca_falhou_e_segue(self):
        banco = BancoFalso(
            pedidos=[],
            calculos=[[_pedido(P_REGRA, versao=0), _pedido(P_RECUSADO), _pedido(P_OK)]],
            recusar={P_RECUSADO: "PT409: A regra do edital mudou desde o pedido; gere de novo."},
        )
        codigo, log = self._rodar(banco)
        self.assertEqual(codigo, job.COM_DIVERGENCIA)
        self.assertEqual(banco.marcas_do_calculo[P_REGRA][-1], ("FALHOU", job.MENSAGEM_REGRA_MUDOU_NO_PEDIDO))
        self.assertNotIn(P_REGRA, banco.retratos)
        self.assertEqual(banco.marcas_do_calculo[P_RECUSADO][-1][0], "FALHOU")
        self.assertIn("mudou desde o pedido", banco.marcas_do_calculo[P_RECUSADO][-1][1])
        self.assertIn(P_OK, banco.retratos)
        self.assertIn("3 cálculo(s): 2 falhou, 1 pronto.", log)

    def test_o_calculo_que_chega_passa_na_frente_do_proximo_relatorio(self):
        banco = BancoFalso(pedidos=[{"lista": L_PRONTA}, {"lista": L_MEXIDA}], calculos=[[], [], [_pedido(P_OK)]])
        codigo, log = self._rodar(banco, ["--desempate"])
        self.assertEqual(codigo, job.COM_DIVERGENCIA)  # a L_MEXIDA não confere
        nomes = [f for f, _ in banco.chamadas]
        gravou_o_calculo = nomes.index("classificacao_gravar_calculo")
        lidas = [i for i, (f, c) in enumerate(banco.chamadas) if f == "classificacao_ler_lista"]
        self.assertLess(lidas[0], gravou_o_calculo)
        self.assertLess(gravou_o_calculo, lidas[1])
        self.assertIn("1 cálculo(s): 1 pronto.", log)
        self.assertIn("2 lista(s): 1 nao confere, 1 pronto.", log)

    def test_falha_ao_ler_a_fila_dos_calculos_nao_segura_os_relatorios(self):
        banco = BancoFalso(pedidos=[{"lista": L_PRONTA}], falha_nos_calculos=True)
        codigo, log = self._rodar(banco)
        self.assertEqual(codigo, job.COM_DIVERGENCIA)
        self.assertIn("Falhou ao ler os pedidos de cálculo", log)
        self.assertEqual(set(banco.gravados), {L_PRONTA})

    def test_nada_esperando(self):
        codigo, log = self._rodar(BancoFalso(pedidos=[]))
        self.assertEqual(codigo, job.SEM_DIVERGENCIA)
        self.assertIn("Nenhuma lista esperando o cálculo nem o relatório de desempate.", log)

    def test_calculo_nao_aceita_lista_nem_opcoes_do_seco(self):
        for argv in (
            ["--calculo", "--lista", L_PRONTA],
            ["--calculo", "--edital", "x"],
            ["--calculo", "--desempate"],
        ):
            with self.subTest(argv=argv):
                with self.assertRaises(SystemExit) as saida, contextlib.redirect_stderr(io.StringIO()):
                    job.principal(argv, ambiente={})
                self.assertEqual(saida.exception.code, 3)


if __name__ == "__main__":
    import sys

    if "--regerar" in sys.argv:
        conteudo = json.dumps(resposta_dourada(), ensure_ascii=False, indent=1) + chr(10)
        _DOURADO_DO_RELATORIO.write_bytes(conteudo.encode("utf-8"))
    else:
        unittest.main()
