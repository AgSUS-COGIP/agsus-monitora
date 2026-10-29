"""
Regra própria da Triagem (20261029160000): a seção nova dá exatamente as
entradas de antes do cálculo, e a conta da migration (SQL) é a do Python.

- A fixture `regras-da-triagem-no-ensaio.json` é a saída do ensaio da
  migration no banco real (regra da análise, documental e a seção que o SQL
  montou, dos 4 editais com regra): o Python monta a mesma seção.
- Ida e volta: da seção, `regra_do_calculo` devolve a mesma regra
  normalizada e o mesmo documental que o job usava; e o cálculo de uma vaga
  dá o mesmo resultado (casos dourados do 93/2026).
- Mudar a seção muda o resultado: a prova não é vazia.
"""

import copy
import json
import pathlib
import sys
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "python"))

from monitora.avaliacao_documental.pre_classificacao import normalizar_regra, pre_classificar_vaga  # noqa: E402
from monitora.avaliacao_documental.regra_da_triagem import (  # noqa: E402
    FORMATO,
    regra_do_calculo,
    secao_da_regra_antiga,
)

ENSAIO = json.loads((RAIZ / "tests/fixtures/avaliacao-documental/regras-da-triagem-no-ensaio.json").read_text("utf-8"))
MIGRATION = (RAIZ / "supabase/migrations/20261029160000_regras_proprias_da_triagem.sql").read_text("utf-8")

VAGA = {"codigo": "1", "vagas_imediatas": 1, "cadastro_reserva": True, "modalidades": None, "nivel": None}


def candidato(i, art, situacao="Finalizado"):
    return {
        "id": f"00000000-0000-4000-a000-{i:012d}",
        "codigo": f"C{i}",
        "ativo": True,
        "nascimento": "1990-01-01",
        "candidatura": f"2026-09-0{i}T12:00:00+00:00",
        "colunas": {"NOTA - ART": art, "SITUAÇÃO - Questionário": situacao},
    }


CANDIDATOS = [candidato(1, "24,0/30,0"), candidato(2, "22,0/30,0"), candidato(3, "28,0/30,0", "Cancelado")]


class SqlIgualAoPython(unittest.TestCase):
    def test_a_secao_do_ensaio_e_a_do_python(self):
        self.assertEqual(len(ENSAIO), 4)
        for e in ENSAIO:
            with self.subTest(e["rotulo"]):
                self.assertEqual(secao_da_regra_antiga(e["regra_analise"], e["documental"]), e["triagem"])
                self.assertEqual(e["triagem"]["formato"], FORMATO)

    def test_ida_e_volta_da_as_mesmas_entradas_do_calculo(self):
        for e in ENSAIO:
            with self.subTest(e["rotulo"]):
                regra, documental = regra_do_calculo(e["triagem"], e["regra_analise"])
                self.assertEqual(normalizar_regra(regra), normalizar_regra(e["regra_analise"]))
                for chave in ("niveis_por_cargo", "nivel_padrao", "cotas"):
                    self.assertEqual(documental.get(chave), e["documental"].get(chave), chave)

    def test_a_migration_nao_mexe_em_candidato_nem_dispara_calculo(self):
        corpo = MIGRATION.split("-- 4. Migração das regras de hoje")[1]
        for proibido in ("TB_PRE_CLASSIFICACAO\" set", "disparar_robo", "TB_FICHA_ANALISE", "delete from"):
            self.assertNotIn(proibido, corpo)
        self.assertIn("a01afddb-f64b-47d9-80e8-476a1ed14e43", MIGRATION)


class MesmoResultado(unittest.TestCase):
    def regra(self, **provisoria):
        return {
            "provisoria": {
                "eliminacao_automatica": [
                    {
                        "codigo": "QUESTIONARIO",
                        "coluna_prefixo": "SITUAÇÃO",
                        "exceto": ["Finalizado"],
                        "motivo": "Questionário não finalizado",
                    }
                ],
                **provisoria,
            },
            "lote": {"base": "MULTIPLO_VAGAS", "multiplo": 1},
            "blocos": [],
        }

    def calcular(self, regra, documental=None):
        r = pre_classificar_vaga(normalizar_regra(regra), {**VAGA}, copy.deepcopy(CANDIDATOS), hoje="2026-10-06")
        return r["resumo"], [{k: v for k, v in linha.items() if not k.startswith("_")} for linha in r["linhas"]]

    def test_regra_antiga_e_nova_dao_o_mesmo(self):
        antiga = self.regra()
        nova, _ = regra_do_calculo(secao_da_regra_antiga(antiga, {}), antiga)
        self.assertEqual(self.calcular(antiga), self.calcular(nova))

    def test_mudar_a_secao_muda_o_resultado(self):
        antiga = self.regra()
        secao = secao_da_regra_antiga(antiga, {})
        secao["requisitos"]["eliminacao_automatica"] = []
        nova, _ = regra_do_calculo(secao, antiga)
        self.assertNotEqual(self.calcular(antiga), self.calcular(nova))

    def test_bloco_modalidade_vem_da_secao_e_os_outros_da_analise(self):
        analise = {
            **self.regra(),
            "blocos": [
                {"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Cursos"]},
                {"codigo": "MODALIDADE", "tipo": "REGISTRO", "perguntas": ["Antiga"]},
            ],
        }
        secao = secao_da_regra_antiga(analise, {})
        secao["modalidade"]["perguntas"] = ["Nova"]
        regra, _ = regra_do_calculo(secao, analise)
        self.assertEqual(
            regra["blocos"],
            [
                {"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Cursos"]},
                {"codigo": "MODALIDADE", "tipo": "REGISTRO", "perguntas": ["Nova"]},
            ],
        )

    def test_campo_ausente_continua_ausente(self):
        secao = secao_da_regra_antiga({"provisoria": {}}, {})
        self.assertEqual(secao, {"formato": FORMATO})
        regra, documental = regra_do_calculo(secao, None)
        self.assertEqual(regra, {"provisoria": {}, "blocos": []})
        self.assertEqual(documental, {})


if __name__ == "__main__":
    unittest.main()
