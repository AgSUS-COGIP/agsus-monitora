"""
A revisão automática das fichas concluídas com pendência (scripts/conferencias/revisao_das_fichas.py,
dentro do job de conferências). Com os casos dourados de
tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json. Nada fala com o Supabase.

    python -m pytest tests/python
"""

import json
import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "conferencias"))
sys.path.insert(0, str(_RAIZ / "python"))

import conferencias  # noqa: E402
import revisao_das_fichas as rv  # noqa: E402

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


if __name__ == "__main__":
    unittest.main()
