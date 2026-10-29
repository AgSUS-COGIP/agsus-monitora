"""
Testes dos pacotes dos painéis em Python (python/monitora/paineis/ e scripts/paineis/pacotes.py).

O caso dourado (tests/fixtures/paineis/dourado.json) sai do ensaio da migration 20261029180000
(supabase/ensaios/20261029180000_pacotes_dos_paineis_em_python.sql, chave "dourado"): numa área de
mentira, as fontes que paineis_ler_fontes devolve e o que as funções SQL de antes montam na mesma
foto. A montagem em Python tem de sair igual. Dados fictícios; nada fala com o Supabase.

    python -m pytest tests/python/test_pacotes_dos_paineis.py
"""

import importlib.util
import json
import pathlib
import sys
import unittest
from datetime import datetime
from decimal import Decimal

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "python"))

from monitora import supabase_rpc  # noqa: E402
from monitora.paineis import json_exato, pacotes  # noqa: E402

_spec = importlib.util.spec_from_file_location("job_pacotes_dos_paineis", _RAIZ / "scripts" / "paineis" / "pacotes.py")
job = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(job)

DOURADO = json_exato.ler((_RAIZ / "tests" / "fixtures" / "paineis" / "dourado.json").read_text(encoding="utf-8"))


def instante(texto):
    return None if texto is None else datetime.fromisoformat(texto)


class Dourado(unittest.TestCase):
    """O Python monta o mesmo pacote que o SQL, nas mesmas fontes."""

    def test_analises_igual_ao_sql(self):
        caso = DOURADO["ANALISES"]
        py = pacotes.montar("ANALISES", caso["fontes"])
        for escopo in pacotes.ESCOPOS:
            with self.subTest(escopo=escopo):
                p, s = py[escopo], caso["sql"][escopo]
                self.assertEqual(p["linhas"], s["linhas"])
                self.assertEqual(p["total"], s["total"])
                self.assertEqual(p["editais"], s["editais"])
                self.assertEqual(p["concluidas_por_ano"], s["concluidas_por_ano"])
                self.assertEqual(list(p["concluidas_por_ano"]), list(s["concluidas_por_ano"]))
                self.assertEqual(instante(p["atualizado_em"]), instante(s["atualizado_em"]))
        # O caso cobre os três escopos e a ordem da colação do banco (acento e caixa).
        self.assertTrue(all(py[e]["total"] > 0 for e in pacotes.ESCOPOS))

    def test_aprovados_igual_ao_sql(self):
        caso = DOURADO["APROVADOS"]
        py = pacotes.montar("APROVADOS", caso["fontes"])
        self.assertEqual(py, caso["sql"])
        self.assertTrue(any(len(linha) == 16 for linha in py["linhas"]), "falta o caso alterado judicialmente")

    def test_entrevistas_igual_ao_sql(self):
        caso = DOURADO["ENTREVISTAS"]
        py = pacotes.montar("ENTREVISTAS", caso["fontes"])
        sql = dict(caso["sql"])
        self.assertEqual(py["gerado_em"], caso["fontes"]["lido_em"])
        py.pop("gerado_em")
        sql.pop("gerado_em")
        self.assertEqual(py, sql)
        self.assertTrue(py["aprovados_sem_entrevista"] and py["criterios"])

    def test_o_pacote_escrito_volta_igual(self):
        for cache in pacotes.MONTADORES:
            with self.subTest(cache=cache):
                pacote = pacotes.montar(cache, DOURADO[cache]["fontes"])
                self.assertEqual(json_exato.ler(json_exato.escrever(pacote)), pacote)

    def test_fonte_de_outro_formato_e_recusada(self):
        fontes = dict(DOURADO["APROVADOS"]["fontes"], schema_version=2)
        with self.assertRaises(pacotes.FonteInvalida):
            pacotes.montar("APROVADOS", fontes)
        with self.assertRaises(pacotes.FonteInvalida):
            pacotes.montar("ANALISES", DOURADO["APROVADOS"]["fontes"])
        with self.assertRaises(pacotes.FonteInvalida):
            pacotes.montar("XYZ", DOURADO["APROVADOS"]["fontes"])
        # Texto que ordena precisa estar no vocabulário (a ordem é a do banco, não a do Python).
        fontes = dict(DOURADO["APROVADOS"]["fontes"], vocabulario=[])
        with self.assertRaises(pacotes.FonteInvalida):
            pacotes.montar("APROVADOS", fontes)


class Regras(unittest.TestCase):
    def test_numero_do_edital(self):
        self.assertEqual(pacotes.numero_do_edital("Edital 06/2026"), "6/2026")
        self.assertEqual(pacotes.numero_do_edital("6 / 2026 (sanitarista)"), "6/2026")
        self.assertEqual(pacotes.numero_do_edital("12345/2026"), "2345/2026")
        self.assertIsNone(pacotes.numero_do_edital("sem número"))
        self.assertIsNone(pacotes.numero_do_edital(None))

    def test_vigente_da_pessoa(self):
        def e(id_, parecer, nota, origem, quando, analise="a1"):
            linha = [None] * 17
            linha[0], linha[2], linha[11], linha[12], linha[14], linha[15] = id_, analise, nota, parecer, origem, quando
            return linha

        base = "2026-10-01T10:00:00+00:00"
        mais_nova = "2026-10-02T10:00:00.5+00:00"
        u = [f"00000000-0000-0000-0000-00000000000{i}" for i in range(6)]
        # Com parecer (APTO/INAPTO) antes de sem parecer.
        self.assertEqual(
            pacotes.entrevistas_vigentes(
                [e(u[1], "SEM_PARECER", Decimal(9), "sistema", mais_nova), e(u[2], "INAPTO", None, "planilha", base)]
            ),
            {u[2]},
        )
        # Depois: com nota, origem sistema, a mais nova; por fim o maior id.
        self.assertEqual(
            pacotes.entrevistas_vigentes(
                [e(u[1], "APTO", None, "sistema", base), e(u[2], "APTO", Decimal(1), "planilha", base)]
            ),
            {u[2]},
        )
        self.assertEqual(
            pacotes.entrevistas_vigentes(
                [e(u[1], "APTO", Decimal(1), "planilha", base), e(u[2], "APTO", Decimal(1), "sistema", base)]
            ),
            {u[2]},
        )
        self.assertEqual(
            pacotes.entrevistas_vigentes(
                [e(u[3], "APTO", Decimal(1), "sistema", base), e(u[2], "APTO", Decimal(1), "sistema", mais_nova)]
            ),
            {u[2]},
        )
        self.assertEqual(
            pacotes.entrevistas_vigentes(
                [e(u[3], "APTO", Decimal(1), "sistema", base), e(u[4], "APTO", Decimal(1), "sistema", base)]
            ),
            {u[4]},
        )
        # Pessoas diferentes ficam as duas; sem análise, a pessoa é o candidato na vaga.
        sem = e(u[5], "APTO", None, "planilha", base, analise=None)
        sem[6], sem[9] = "V1", "c1"
        outra = e(u[4], "APTO", None, "planilha", base, analise=None)
        outra[6], outra[9] = "V1", "c2"
        self.assertEqual(pacotes.entrevistas_vigentes([sem, outra]), {u[4], u[5]})


class JsonExato(unittest.TestCase):
    def test_numeros_saem_como_entraram(self):
        texto = '{"a":[7.50,1,0.10,-3,1e2,12345678901234567890.123],"b":"Ítalo \\"x\\"","c":null,"d":true}'
        lido = json_exato.ler(texto)
        self.assertEqual(json_exato.escrever(lido), texto)
        self.assertEqual(lido["a"][0], Decimal("7.5"))
        self.assertEqual(json.loads(json_exato.escrever(lido))["b"], 'Ítalo "x"')

    def test_tipo_fora_do_json(self):
        with self.assertRaises(TypeError):
            json_exato.escrever({"x": object()})


class _Resposta:
    def __init__(self, corpo):
        self._corpo = corpo

    def read(self):
        return self._corpo.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class ChamadaComJsonExato(unittest.TestCase):
    def test_codificar_e_decodificar(self):
        pedidos = []

        def abrir(pedido, timeout):
            pedidos.append(pedido)
            return _Resposta('{"n": 7.50}')

        r = supabase_rpc.chamar(
            {"url": "https://x.supabase.co", "chave": "k"},
            "f",
            {"p": json_exato.ler("12.50")},
            abrir=abrir,
            codificar=json_exato.escrever,
            decodificar=json_exato.ler,
        )
        self.assertEqual(pedidos[0].data.decode("utf-8"), '{"p":12.50}')
        self.assertEqual(json_exato.escrever(r), '{"n":7.50}')


class Job(unittest.TestCase):
    CFG = {"url": "https://x.supabase.co", "chave": "k"}

    def banco(self, pendentes, falhar=()):
        chamadas = []

        def chamar(cfg, funcao, corpo, **opcoes):
            chamadas.append((funcao, corpo, opcoes))
            if funcao == "paineis_ler_pendentes":
                return {"schema_version": 1, "pendentes": pendentes}
            if funcao == "paineis_ler_fontes":
                if corpo["p_area"] in falhar:
                    raise supabase_rpc.ErroDoSupabase(funcao, 500, "erro")
                return DOURADO[corpo["p_cache"]]["fontes"]
            if funcao == "paineis_gravar_pacote":
                return {"ok": True, "gravados": 1, "marcas_apagadas": len(corpo["p_marcas"])}
            raise AssertionError(funcao)

        return chamar, chamadas

    def rodar(self, argumentos, chamar):
        return job.principal(job.argumentos(argumentos), configuracao=self.CFG, chamar_rpc=chamar)

    def test_monta_e_grava_cada_pendente_com_as_marcas_lidas(self):
        pend = [{"cache": c, "area": "ensaio-paineis", "motivo": "MARCA"} for c in job.CACHES]
        chamar, chamadas = self.banco(pend)
        self.assertEqual(self.rodar(["--disparado-por", "agenda"], chamar), 0)
        gravacoes = [c for c in chamadas if c[0] == "paineis_gravar_pacote"]
        self.assertEqual([g[1]["p_cache"] for g in gravacoes], list(job.CACHES))
        for _funcao, corpo, opcoes in gravacoes:
            fontes = DOURADO[corpo["p_cache"]]["fontes"]
            self.assertEqual(corpo["p_lido_em"], fontes["lido_em"])
            self.assertEqual(corpo["p_marcas"], fontes["marcas"])
            self.assertEqual(corpo["p_pacote"], pacotes.montar(corpo["p_cache"], fontes))
            self.assertEqual(opcoes["tentativas"], 1)
            self.assertIs(opcoes["codificar"], json_exato.escrever)

    def test_seco_nao_grava(self):
        chamar, chamadas = self.banco([{"cache": "APROVADOS", "area": "ensaio-paineis", "motivo": "VELHO"}])
        self.assertEqual(self.rodar(["--seco"], chamar), 0)
        self.assertNotIn("paineis_gravar_pacote", [c[0] for c in chamadas])

    def test_filtra_os_pacotes_pedidos(self):
        pend = [{"cache": c, "area": "ensaio-paineis", "motivo": "MARCA"} for c in job.CACHES]
        chamar, chamadas = self.banco(pend)
        self.assertEqual(self.rodar(["--caches", "aprovados"], chamar), 0)
        self.assertEqual([c[1]["p_cache"] for c in chamadas if c[0] == "paineis_gravar_pacote"], ["APROVADOS"])
        self.assertEqual(self.rodar(["--caches", "OUTRO"], chamar), 3)

    def test_uma_area_que_falha_nao_segura_as_outras(self):
        pend = [
            {"cache": "APROVADOS", "area": "quebrada", "motivo": "MARCA"},
            {"cache": "APROVADOS", "area": "ensaio-paineis", "motivo": "MARCA"},
        ]
        chamar, chamadas = self.banco(pend, falhar={"quebrada"})
        self.assertEqual(self.rodar([], chamar), 2)
        self.assertEqual(len([c for c in chamadas if c[0] == "paineis_gravar_pacote"]), 1)
        chamar, _ = self.banco(pend[:1], falhar={"quebrada"})
        self.assertEqual(self.rodar([], chamar), 1)

    def test_nada_pendente(self):
        chamar, chamadas = self.banco([])
        self.assertEqual(self.rodar([], chamar), 0)
        self.assertEqual([c[0] for c in chamadas], ["paineis_ler_pendentes"])


if __name__ == "__main__":
    unittest.main()
