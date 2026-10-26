"""
A revisão automática das fichas concluídas com pendência (scripts/conferencias/revisao_das_fichas.py,
dentro do job de conferências) e a correção da experiência até o fim das inscrições
(scripts/arquivo/experiencia_ate_o_fim_das_inscricoes.py). Com os casos dourados de
tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json. Nada fala com o Supabase.

    python -m pytest tests/python
"""

import importlib.util
import json
import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "conferencias"))
sys.path.insert(0, str(_RAIZ / "python"))

import conferencias  # noqa: E402
import revisao_das_fichas as rv  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "correcao_experiencia", _RAIZ / "scripts" / "arquivo" / "experiencia_ate_o_fim_das_inscricoes.py"
)
correcao = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(correcao)

DOURADOS = json.loads(
    (_RAIZ / "tests" / "fixtures" / "avaliacao-documental" / "casos-do-calculo-no-banco.json").read_text(
        encoding="utf-8"
    )
)
EDITAL = "00000000-0000-0000-0000-000000000114"


def pagina(casos, regra=None):
    """Uma página de conferencia_ler_fichas com os casos (uma ficha por caso)."""
    return {
        "regras": [{"regra": "R", "versao": 1, "configuracao": regra or DOURADOS["regra"]}],
        "linhas": [
            {
                "ficha": f"ficha-{i}",
                "versao": 7,
                "edital": EDITAL,
                "regra": "R",
                "versao_regra": 1,
                "lancamento": c["lancamento"],
                "resultado": c["resultado"],
                "documental": DOURADOS["documental"],
            }
            for i, c in enumerate(casos)
        ],
    }


class _Log:
    def __init__(self):
        self.avisos = []

    def warning(self, *args):
        self.avisos.append(args[0] % args[1:] if len(args) > 1 else args[0])

    info = warning


class FichasComPendencia(unittest.TestCase):
    def test_as_mesmas_da_tela(self):
        casos = [c for c in DOURADOS["casos"] if not c.get("data_limite")]
        achadas = rv.fichas_com_pendencia([pagina(casos)], DOURADOS["hoje"])
        esperadas = {
            f"ficha-{i}": sorted({p["tipo"] for p in c["esperado"]["pendencias"]})
            for i, c in enumerate(casos)
            if c["esperado"]["pendencias"]
        }
        self.assertEqual({f["ficha"]: f["tipos"] for f in achadas}, esperadas)
        self.assertTrue(all(f["versao"] == 7 and f["edital"] == EDITAL for f in achadas))

    def test_eliminado_por_outro_criterio_nao_vai(self):
        caso = next(c for c in DOURADOS["casos"] if "eliminado pela identidade" in c["nome"])
        self.assertEqual(rv.fichas_com_pendencia([pagina([caso])], DOURADOS["hoje"]), [])

    def test_confere_abaixo_do_comprovado_nao_vai(self):
        caso = next(c for c in DOURADOS["casos"] if c["nome"].startswith("Confere da experiência abaixo"))
        self.assertEqual(rv.fichas_com_pendencia([pagina([caso])], DOURADOS["hoje"]), [])


class MandarParaRevisao(unittest.TestCase):
    def test_conta_as_que_o_banco_confirmou(self):
        chamadas = []

        def chamar(funcao, corpo, **opcoes):
            chamadas.append((funcao, corpo, opcoes))
            return {"alterada": corpo["p_ficha"] == "a"}

        r = rv.mandar_para_revisao(chamar, [{"ficha": "a", "versao": 1}, {"ficha": "b", "versao": 2}], _Log())
        self.assertEqual(r, {"revisadas": 1, "recusadas": 1})
        self.assertEqual([c[0] for c in chamadas], [rv.RPC, rv.RPC])
        self.assertEqual(chamadas[0][1], {"p_ficha": "a", "p_versao": 1})
        self.assertEqual(chamadas[0][2], {"tentativas": 1})

    def test_banco_sem_a_rpc_pula_a_revisao(self):
        class Ausente(Exception):
            status = 404

        def chamar(funcao, corpo, **opcoes):
            raise Ausente()

        log = _Log()
        r = rv.mandar_para_revisao(chamar, [{"ficha": "a", "versao": 1}, {"ficha": "b", "versao": 1}], log)
        self.assertEqual(r, {"revisadas": 0, "recusadas": 2})
        self.assertIn("20261023090000", log.avisos[0])


class _Banco:
    """O banco falso do job: uma ficha concluída com pendência (Confere acima dos títulos)."""

    def __init__(self, ligada=True):
        self.chamadas = []
        self.ligada = ligada
        caso = next(c for c in DOURADOS["casos"] if c["nome"].startswith("Confere da titulação"))
        self.pagina = pagina([caso])

    def __call__(self, _cfg, funcao, corpo, **opcoes):
        self.chamadas.append(funcao)
        if funcao == "conferencia_ler_fichas":
            return {**self.pagina, "proximo": None}
        if funcao == "automacao_ligada":
            return self.ligada
        if funcao == rv.RPC:
            return {"alterada": True, "versao": 8}
        if funcao == "finalizar_conferencia":
            return {"situacao": "CONCLUIDA"}
        return {}


class NoJob(unittest.TestCase):
    def _rodar(self, banco, lista=("--disparado-por", "agenda")):
        args = conferencias.argumentos(list(lista))
        return conferencias.principal(args, configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco)

    def test_manda_para_revisao_antes_de_fechar(self):
        banco = _Banco()
        self._rodar(banco)
        self.assertEqual(banco.chamadas.count(rv.RPC), 1)
        self.assertLess(banco.chamadas.index(rv.RPC), banco.chamadas.index("finalizar_conferencia"))

    def test_chave_desligada_nao_manda(self):
        banco = _Banco(ligada=False)
        self._rodar(banco)
        self.assertNotIn(rv.RPC, banco.chamadas)

    def test_seco_nao_manda(self):
        banco = _Banco()
        self._rodar(banco, ("--seco",))
        self.assertNotIn(rv.RPC, banco.chamadas)


def ficha_com_vinculos(vinculos, calculado, dias):
    caso = DOURADOS["casos"][0]
    return {
        **caso,
        "lancamento": {**caso["lancamento"], "vinculos": vinculos},
        "resultado": {
            **caso["resultado"],
            "calculados": {"EXPERIENCIA": calculado},
            "experiencia": {"dias_total": dias},
        },
    }


def vinculo(inicio, fim):
    return {"empregador": "Empresa fictícia", "categoria": "AREA_OU_SUS", "inicio": inicio, "fim": fim, "aceito": True}


class CorrecaoDaExperiencia(unittest.TestCase):
    # 2023-01-01 a 2024-12-31 (24 meses, 15 pontos) e mais 5 dias depois de 2024-12-31 no 2º vínculo.
    def _fichas(self):
        mesma = ficha_com_vinculos([vinculo("2023-01-01", "2025-01-05")], 15, 736)
        # 2023-01-01 a 2024-07-10: 557 dias → cortado em 2024-06-30 fica 18 meses (10 pontos): a pontuação mudaria.
        muda = ficha_com_vinculos([vinculo("2023-01-01", "2024-07-10")], 15, 557)
        sem_corte = ficha_com_vinculos([vinculo("2023-01-01", "2024-06-30")], 10, 547)
        return [mesma, muda, sem_corte]

    def test_so_corrige_quem_tem_dias_depois_e_a_mesma_pontuacao(self):
        fichas = correcao.avaliar_fichas([pagina(self._fichas())], EDITAL, "2024-12-31")
        self.assertEqual([(f["ficha"], f["corrige"]) for f in fichas], [("ficha-0", True)])
        self.assertEqual((fichas[0]["dias_antes"], fichas[0]["dias_depois"]), (736, 731))
        fichas = correcao.avaliar_fichas([pagina(self._fichas())], EDITAL, "2024-06-30")
        por_ficha = {f["ficha"]: f for f in fichas}
        self.assertFalse(por_ficha["ficha-1"]["corrige"])
        self.assertEqual(por_ficha["ficha-1"]["pontos_depois"], 10)

    def test_outro_edital_fica_de_fora(self):
        self.assertEqual(correcao.avaliar_fichas([pagina(self._fichas())], "outro", "2024-12-31"), [])

    def test_seco_pelo_arquivo_nao_chama_o_banco(self):
        import tempfile

        with tempfile.TemporaryDirectory() as pasta:
            arquivo = pathlib.Path(pasta) / "fichas.json"
            arquivo.write_text(json.dumps([pagina(self._fichas())]), encoding="utf-8")
            saida = []
            args = correcao.argumentos(
                ["--edital", EDITAL, "--data-limite", "2024-12-31", "--seco", "--de-arquivo", str(arquivo)]
            )
            self.assertEqual(correcao.principal(args, imprimir=saida.append), 0)
        self.assertIn("modo seco", saida[0])
        self.assertIn("A corrigir (pontuação igual, nota e resultado não mudam): 1", saida[0])

    def test_modo_real_assina_com_a_conta_do_setor_sem_repetir(self):
        chamadas = []
        pag = pagina(self._fichas())

        def banco(_cfg, funcao, corpo, **opcoes):
            chamadas.append((funcao, corpo, opcoes))
            if funcao == "conferencia_ler_fichas":
                return {**pag, "proximo": None}
            return {"versao": 8}

        args = correcao.argumentos(["--edital", EDITAL, "--data-limite", "2024-12-31"])
        self.assertEqual(
            correcao.principal(args, configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco, imprimir=print),
            0,
        )
        gravacoes = [c for c in chamadas if c[0] == "corrigir_experiencia_da_ficha"]
        self.assertEqual(len(gravacoes), 1)
        corpo, opcoes = gravacoes[0][1], gravacoes[0][2]
        self.assertEqual(corpo["p_usuario"], correcao.CONTA_DO_SETOR)
        self.assertEqual(corpo["p_experiencia"]["dias_total"], 731)
        self.assertIn("31/12/2024", corpo["p_motivo"])
        self.assertEqual(opcoes, {"tentativas": 1})

    def test_de_arquivo_so_no_seco(self):
        with self.assertRaises(SystemExit):
            correcao.argumentos(["--edital", EDITAL, "--data-limite", "2024-12-31", "--de-arquivo", "x.json"])


if __name__ == "__main__":
    unittest.main()
