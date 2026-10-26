"""
Testes da detecção das pendências do edital (python/monitora/aprovados/pendencias.py) e do job
(scripts/aprovados/pendencias.py) com o banco falso. Casos dourados fictícios em
tests/fixtures/pendencias-do-edital/casos.json; nada fala com o Supabase.

    python -m pytest tests/python/test_pendencias_do_edital.py
"""

import copy
import io
import json
import pathlib
import sys
import unittest
from contextlib import redirect_stdout
from datetime import date

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "aprovados"))
sys.path.insert(0, str(_RAIZ / "python"))

import pendencias as job  # noqa: E402

from monitora.aprovados import pendencias as regra  # noqa: E402

CASOS = json.loads((_RAIZ / "tests" / "fixtures" / "pendencias-do-edital" / "casos.json").read_text(encoding="utf-8"))
HOJE = date.fromisoformat(CASOS["hoje"])


def detectar(entrada=None, dias=15):
    return regra.detectar(entrada or CASOS["entrada"], HOJE, dias)


def resumo(pendencias):
    return [{k: p[k] for k in ("tipo", "area", "candidatos", "detalhe")} for p in pendencias]


class CasosDourados(unittest.TestCase):
    def test_detecta_exatamente_o_esperado(self):
        self.assertEqual(resumo(detectar()), CASOS["esperado"])

    def test_chave_e_estavel_e_no_formato_do_banco(self):
        primeira, segunda = detectar(), detectar(copy.deepcopy(CASOS["entrada"]))
        self.assertEqual([p["chave"] for p in primeira], [p["chave"] for p in segunda])
        for p in primeira:
            self.assertRegex(p["chave"], r"^[0-9a-f]{40}$")
            self.assertIn(p["tipo"], regra.TIPOS)
        self.assertEqual(len({(p["tipo"], p["chave"]) for p in primeira}), len(primeira))

    def test_detalhe_sem_dado_pessoal(self):
        texto = json.dumps([p["detalhe"] for p in detectar()])
        self.assertNotIn("@", texto)
        self.assertNotRegex(texto, r"\d{11}")
        self.assertNotIn("nome-", texto)
        self.assertNotIn("mat-", texto)


class Regras(unittest.TestCase):
    def entrada(self):
        return copy.deepcopy(CASOS["entrada"])

    def test_linha_nova_no_empate_e_pendencia_nova(self):
        antes = {p["chave"] for p in detectar() if p["tipo"] == regra.POSICAO_REPETIDA}
        entrada = self.entrada()
        entrada["linhas"].append(["p4", 2, "300", "Ampla Concorrência", 7, None, None, "nome-leo", None, None, None])
        depois = [p for p in detectar(entrada) if p["tipo"] == regra.POSICAO_REPETIDA]
        self.assertEqual(depois[0]["candidatos"], ["p1", "p2", "p4"])
        self.assertNotIn(depois[0]["chave"], antes)

    def test_nova_data_do_convocado_e_pendencia_nova(self):
        entrada = self.entrada()
        for linha in entrada["linhas"]:
            if linha[0] == "c1":
                linha[6] = "2026-10-05"
        chaves = {
            p["candidatos"][0]: p["chave"] for p in detectar(entrada) if p["tipo"] == regra.CONVOCADO_SEM_DESFECHO
        }
        originais = {p["candidatos"][0]: p["chave"] for p in detectar() if p["tipo"] == regra.CONVOCADO_SEM_DESFECHO}
        self.assertNotEqual(chaves["c1"], originais["c1"])
        self.assertEqual(chaves["c3"], originais["c3"])

    def test_prazo_do_convocado_vem_da_configuracao(self):
        convocados = [p for p in detectar(dias=20) if p["tipo"] == regra.CONVOCADO_SEM_DESFECHO]
        self.assertEqual([p["candidatos"] for p in convocados], [["c1"]])

    def test_so_uma_matricula_nao_e_duas_matriculas(self):
        entrada = self.entrada()
        for linha in entrada["linhas"]:
            if linha[0] == "d3":
                linha[9] = "mat-x"
        self.assertFalse([p for p in detectar(entrada) if p["tipo"] == regra.DUAS_MATRICULAS])

    def test_codigo_do_candidato_separa_e_junta_pessoas(self):
        entrada = self.entrada()
        # O mesmo código, nomes escritos diferente: a mesma pessoa no edital (como a conferência).
        entrada["linhas"] += [
            ["k1", 0, "600", "Ampla Concorrência", 1, "Contratado", None, "nome-mu", "cod-9", "mat-1", False],
            ["k2", 1, "601", "Ampla Concorrência", 1, "Contratado", None, "nome-mu2", "cod-9", "mat-2", False],
        ]
        duas = [p for p in detectar(entrada) if p["tipo"] == regra.DUAS_MATRICULAS]
        self.assertIn(["k1", "k2"], [p["candidatos"] for p in duas])

    def test_comparar_com_o_instantaneo(self):
        detectadas = detectar()
        por_tipo = {p["tipo"]: p["chave"] for p in detectadas}
        existentes = [
            [regra.PESSOA_REPETIDA, por_tipo[regra.PESSOA_REPETIDA], "ABERTA", None],
            [regra.POSICAO_REPETIDA, por_tipo[regra.POSICAO_REPETIDA], "RESOLVIDA", "EMPATE_PREVISTO"],
            [regra.DUAS_LISTAS, por_tipo[regra.DUAS_LISTAS], "RESOLVIDA", "LISTA_ESCOLHIDA"],
            [regra.CONVOCADO_SEM_DESFECHO, "f" * 40, "ABERTA", None],
        ]
        self.assertEqual(
            regra.comparar(detectadas, existentes),
            {"novas": 3, "mantidas": 1, "reabertas": 1, "permanentes": 1, "saneadas": 1},
        )


class Job(unittest.TestCase):
    def rodar(self, argumentos, gravacoes):
        def chamar(_cfg, funcao, corpo, **_opcoes):
            if funcao == "pendencias_ler_aprovados":
                return copy.deepcopy(CASOS["entrada"])
            gravacoes.append((funcao, corpo))
            return {"ok": True, "novas": len(corpo["p_pendencias"])}

        saida = io.StringIO()
        with redirect_stdout(saida):
            codigo = job.principal(job.argumentos(argumentos), configuracao={}, chamar_rpc=chamar, hoje=HOJE)
        return codigo, saida.getvalue()

    def test_seco_nao_grava_e_resume_por_area(self):
        gravacoes = []
        codigo, saida = self.rodar(["--seco", "--dias-convocado", "15"], gravacoes)
        self.assertEqual(codigo, 0)
        self.assertEqual(gravacoes, [])
        self.assertIn("Modo seco", saida)
        self.assertIn("projetos: 3 pendência(s)", saida)
        self.assertIn("sede: 2 pendência(s)", saida)
        self.assertIn("Total: 6 pendência(s)", saida)
        self.assertNotIn("nome-", saida)

    def test_grava_o_instantaneo_inteiro_uma_vez(self):
        gravacoes = []
        codigo, _saida = self.rodar(["--dias-convocado", "15", "--disparado-por", "agenda"], gravacoes)
        self.assertEqual(codigo, 0)
        self.assertEqual(len(gravacoes), 1)
        funcao, corpo = gravacoes[0]
        self.assertEqual(funcao, "gravar_pendencias_do_edital")
        self.assertRegex(corpo["p_execucao"], r"^pend-\d{8}T\d{6}-[0-9a-f]{8}$")
        self.assertEqual(corpo["p_lido_em"], CASOS["entrada"]["lido_em"])
        self.assertEqual(len(corpo["p_pendencias"]), len(CASOS["esperado"]))
        self.assertEqual(set(corpo["p_pendencias"][0]), {"tipo", "edital", "chave", "candidatos", "detalhe"})

    def test_formato_desconhecido_para_o_job(self):
        with self.assertRaises(ValueError):
            job.ler(lambda _f, _c: {"schema_version": 2})

    def test_prazo_fora_da_faixa_e_entrada_invalida(self):
        with self.assertRaises(SystemExit), redirect_stdout(io.StringIO()):
            job.argumentos(["--dias-convocado", "0"])


if __name__ == "__main__":
    unittest.main()
