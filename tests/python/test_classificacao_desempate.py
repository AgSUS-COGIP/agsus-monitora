"""
O relatório de desempate (python/monitora/classificacao/desempate.py), a
comparação com o motor da tela (comparacao.py) e o job --seco
(scripts/classificacao/classificacao.py), nos editais fictícios dos casos
dourados (tests/fixtures/classificacao/casos-do-motor.json). Nada fala com o
Supabase nem roda o Node: o motor da tela entra como função injetada.
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

    def test_sem_nome_nem_data_de_nascimento(self):
        texto = json.dumps(self.final, ensure_ascii=False) + desempate.texto_do_relatorio(self.final)
        for c in DADOS["editais"]["criterios-sorteio-maior-percentual"]["candidatos"]:
            if c["nome"]:
                self.assertNotIn(c["nome"], texto)
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

    def test_so_roda_seco_nesta_etapa(self):
        with self.assertRaises(SystemExit) as saida, contextlib.redirect_stderr(io.StringIO()):
            job.principal(["--arquivo", "x.json"], ambiente={})
        self.assertEqual(saida.exception.code, 3)
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            job.principal(["--seco", "--arquivo", "x.json", "--tipos", "OUTRA"], ambiente={})

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


if __name__ == "__main__":
    import sys

    if "--regerar" in sys.argv:
        conteudo = json.dumps(resposta_dourada(), ensure_ascii=False, indent=1) + chr(10)
        _DOURADO_DO_RELATORIO.write_bytes(conteudo.encode("utf-8"))
    else:
        unittest.main()
