"""
Testes da regra "Contratado em outra lista" (python/monitora/aprovados/contratacao.py) e do job
(scripts/aprovados/contratacao.py) com o banco falso. Dados fictícios; nada fala com o Supabase.

    python -m pytest tests/python/test_contratacao_dos_aprovados.py
"""

import pathlib
import sys
import unittest
from unittest import mock

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "aprovados"))
sys.path.insert(0, str(_RAIZ / "python"))

import contratacao as job  # noqa: E402

from monitora.aprovados import contratacao as regra  # noqa: E402

E1, E2 = "e1", "e2"
L1 = "lista-1"
M1, M2 = "1" * 64, "2" * 64


def linha(id_, vaga, classificacao, status="Contratado", vinculo=M1, modalidade="Ampla Concorrência", **extra):
    return {
        "id": id_,
        "lista": L1,
        "edital": E1,
        "area": "projetos",
        "vaga": vaga,
        "modalidade": modalidade,
        "classificacao": classificacao,
        "status": status,
        "vinculo": vinculo,
        "anterior": None,
        **extra,
    }


def chamados(vaga, ate, modalidade="Ampla Concorrência", status="Contratado", prefixo=None):
    """Outros candidatos da vaga já chamados até a posição `ate` (cada um com a própria matrícula)."""
    p = prefixo or vaga
    return [
        linha(f"{p}-{i}", vaga, i, status=status, vinculo=f"{p}#{i}#".ljust(64, "0"), modalidade=modalidade)
        for i in range(1, ate + 1)
    ]


def situacoes(resultado):
    return {d["candidato"]: (d["situacao"], d["contratacao"], d["motivo"]) for d in resultado["gravar"]}


class Modalidade(unittest.TestCase):
    def test_so_ampla_conta_como_ampla(self):
        for texto in ("Ampla Concorrência", "“Ampla Concorrência”", '"Ampla concorrência"', "Ampla Concorência"):
            self.assertTrue(regra.eh_ampla(texto), texto)
        for texto in ("PPIQ", '"PcD"', "Ampla Concorrência; Pretos e Pardos", '"Indígenas"', "Quilombola", ""):
            self.assertFalse(regra.eh_ampla(texto), texto)


class Regra(unittest.TestCase):
    def test_ampla_e_cota_alcancadas_vence_a_ampla(self):
        linhas = [
            linha("ac", "MED", 137),
            linha("cota", "MED PPIQ", 12, modalidade="PPIQ"),
            *chamados("MED", 200),
            *chamados("MED PPIQ", 20, modalidade="PPIQ"),
        ]
        r = regra.decidir(linhas, [])
        self.assertEqual(
            situacoes(r),
            {
                "ac": ("CONTRATACAO", "ac", "AMPLA_ALCANCADA"),
                "cota": ("OUTRA_LISTA", "ac", "AMPLA_ALCANCADA"),
            },
        )
        cota = next(d for d in r["gravar"] if d["candidato"] == "cota")
        self.assertIn("ampla concorrência", cota["texto"])
        self.assertIn("Ampla Concorrência · 137º · vaga MED", cota["texto"])
        self.assertEqual((cota["base"], cota["versao"], cota["edital"]), ("ac,cota", 1, E1))
        self.assertEqual(r["remover"], [])
        self.assertEqual([g["acao"] for g in r["grupos"]], ["NOVA"])

    def test_so_uma_alcancada_vence_ela_mesmo_sendo_cota(self):
        linhas = [
            linha("ac", "MED", 137),
            linha("cota", "MED PPIQ", 12, modalidade="PPIQ"),
            *chamados("MED", 50),
            *chamados("MED PPIQ", 20, modalidade="PPIQ"),
        ]
        r = regra.decidir(linhas, [])
        self.assertEqual(situacoes(r)["cota"], ("CONTRATACAO", "cota", "UNICA_ALCANCADA"))
        self.assertEqual(situacoes(r)["ac"], ("OUTRA_LISTA", "cota", "UNICA_ALCANCADA"))
        ac = next(d for d in r["gravar"] if d["candidato"] == "ac")
        self.assertIn("a convocação parou no 50º", ac["texto"])

    def test_desistente_tambem_conta_como_chamado(self):
        linhas = [
            linha("a", "V1", 3),
            linha("b", "V2", 3),
            *chamados("V1", 4, status="Desistente"),
        ]
        self.assertEqual(situacoes(regra.decidir(linhas, []))["a"][0], "CONTRATACAO")

    def test_ambiguos(self):
        casos = {
            "NENHUMA_ALCANCADA": [linha("a", "V1", 9), linha("b", "V2", 9), *chamados("V1", 2), *chamados("V2", 2)],
            "MAIS_DE_UMA_AMPLA": [linha("a", "V1", 1), linha("b", "V2", 1), *chamados("V1", 2), *chamados("V2", 2)],
            "NENHUMA_AMPLA": [
                linha("a", "V1", 1, modalidade="PCD"),
                linha("b", "V2", 1, modalidade="PPIQ"),
                *chamados("V1", 2, modalidade="PCD"),
                *chamados("V2", 2, modalidade="PPIQ"),
            ],
        }
        for motivo, linhas in casos.items():
            with self.subTest(motivo):
                r = regra.decidir(linhas, [])
                self.assertEqual(set(situacoes(r).values()), {("AMBIGUO", None, motivo)})
                self.assertIn("A regra não decide", r["gravar"][0]["texto"])
                self.assertEqual(r["grupos"][0]["acao"], "AMBIGUA")

    def test_sem_conflito_nao_ha_decisao(self):
        linhas = [
            linha("a", "V1", 1),
            # Mesma matrícula em outro edital: fora da regra (continua como aviso da conferência).
            linha("b", "V2", 1, edital=E2),
            # Convocado e já "Contratado em outra lista" não entram no grupo.
            linha("c", "V3", 1, status="Convocado"),
            linha("d", "V4", 1, status="Contratado em outra lista"),
            linha("e", "V5", 1, vinculo=None),
        ]
        self.assertEqual(regra.decidir(linhas, []), {"gravar": [], "remover": [], "grupos": []})

    def test_linhas_em_conflito_e_em_outra_lista_nao_contam_no_alcance(self):
        linhas = [
            linha("a", "V1", 5),
            linha("b", "V2", 2),
            # Na V1, quem tem posição maior que a de "a" é outro conflito e um "em outra lista".
            linha("x", "V1", 9, vinculo=M2),
            linha("y", "V3", 1, vinculo=M2),
            linha("z", "V1", 8, status="Contratado em outra lista", vinculo="9" * 64),
            *chamados("V2", 3),
        ]
        r = regra.decidir(linhas, [])
        self.assertEqual(situacoes(r)["b"], ("CONTRATACAO", "b", "UNICA_ALCANCADA"))


class Congelada(unittest.TestCase):
    def setUp(self):
        self.linhas = [
            linha("ac", "MED", 137),
            linha("cota", "MED PPIQ", 12, modalidade="PPIQ"),
            *chamados("MED", 200),
            *chamados("MED PPIQ", 20, modalidade="PPIQ"),
        ]
        self.instantaneo = regra.decidir(self.linhas, [])["gravar"]

    def test_a_decisao_nao_muda_quando_o_alcance_muda(self):
        # A ampla deixa de alcançar (a regra hoje escolheria a cota): a decisão fica.
        menos = [x for x in self.linhas if not (x["vaga"] == "MED" and x["classificacao"] > 100 and x["id"] != "ac")]
        r = regra.decidir(menos, self.instantaneo)
        self.assertEqual((r["gravar"], r["remover"]), ([], []))
        self.assertEqual(r["grupos"][0]["acao"], "MANTIDA")

    def test_base_mudou_a_decisao_e_refeita(self):
        # Uma terceira linha Contratado da mesma matrícula entra: outra base, decisão nova.
        mais = [*self.linhas, linha("pcd", "MED PCD", 1, modalidade="PCD")]
        r = regra.decidir(mais, self.instantaneo)
        self.assertEqual({d["base"] for d in r["gravar"]}, {"ac,cota,pcd"})
        self.assertEqual(r["grupos"][0]["acao"], "NOVA")

    def test_uma_linha_deixa_de_ser_contratado_o_registro_sai(self):
        sem_cota = [{**x, "status": "Contratado em outra lista"} if x["id"] == "cota" else x for x in self.linhas]
        r = regra.decidir(sem_cota, self.instantaneo)
        self.assertEqual((r["gravar"], r["remover"], r["grupos"]), ([], ["ac", "cota"], []))

    def test_ambiguo_e_reavaliado(self):
        linhas = [linha("a", "V1", 9), linha("b", "V2", 9), *chamados("V1", 2), *chamados("V2", 2)]
        inst = regra.decidir(linhas, [])["gravar"]
        mesma = regra.decidir(linhas, inst)
        self.assertEqual((mesma["gravar"], mesma["grupos"][0]["acao"]), ([], "AMBIGUA"))
        # A convocação andou na V1: agora a regra decide.
        r = regra.decidir([*linhas, *chamados("V1", 10, prefixo="V1n")], inst)
        self.assertEqual(situacoes(r)["a"], ("CONTRATACAO", "a", "UNICA_ALCANCADA"))

    def test_lista_nova_herda_pelo_candidato_anterior(self):
        # A publicação de uma lista nova: as linhas novas apontam para as antigas (CO_CANDIDATO_ANTERIOR).
        novas = [
            {**x, "id": f"n-{x['id']}", "lista": "lista-2", "anterior": x["id"]}
            for x in self.linhas
            if x["id"] in ("ac", "cota")
        ]
        # Na lista nova, a regra escolheria a cota (ninguém chamado na ampla); a decisão vem herdada.
        r = regra.decidir([*novas, *chamados("MED PPIQ", 20, modalidade="PPIQ", prefixo="n")], self.instantaneo)
        self.assertEqual(
            situacoes(r),
            {
                "n-ac": ("CONTRATACAO", "n-ac", "HERDADA"),
                "n-cota": ("OUTRA_LISTA", "n-ac", "HERDADA"),
            },
        )
        self.assertEqual(r["remover"], ["ac", "cota"])
        self.assertEqual(r["grupos"][0]["acao"], "HERDADA")


class Contagens(unittest.TestCase):
    def test_contratados_antes_e_depois(self):
        linhas = [
            linha("ac", "MED", 137),
            linha("cota", "MED PPIQ", 12, modalidade="PPIQ"),
            linha("mig", "MED", 1, status="Migração", vinculo=M2),
            *chamados("MED", 200),
        ]
        r = regra.decidir(linhas, [])
        antes = regra.contratados_por_area(linhas, regra.outra_lista_efetiva([], linhas))
        depois_inst = regra.instantaneo_depois([], r)
        depois = regra.contratados_por_area(linhas, regra.outra_lista_efetiva(depois_inst, linhas))
        self.assertEqual((antes["projetos"], depois["projetos"]), (203, 202))


class Job(unittest.TestCase):
    def banco(self, linhas, instantaneo=None):
        chamadas = []

        def chamar_rpc(_cfg, funcao, corpo, **opcoes):
            chamadas.append((funcao, corpo, opcoes))
            if funcao == "contratacao_ler_aprovados":
                return {"schema_version": 1, "linhas": linhas, "instantaneo": instantaneo or []}
            if funcao == "gravar_contratacao_dos_aprovados":
                return {"gravadas": len(corpo["p_decisoes"]), "removidas": len(corpo["p_remover"])}
            raise AssertionError(funcao)

        return chamadas, chamar_rpc

    def linhas(self):
        return [
            linha("ac", "MED", 137),
            linha("cota", "MED PPIQ", 12, modalidade="PPIQ"),
            linha("a", "V1", 9, vinculo=M2),
            linha("b", "V2", 9, vinculo=M2),
            *chamados("MED", 200),
        ]

    def test_seco_nao_grava_e_resume_por_area(self):
        chamadas, chamar_rpc = self.banco(self.linhas())
        saida = []
        with mock.patch.object(job.execucao, "resumir", lambda titulo, linhas, **_: saida.extend(linhas)):
            codigo = job.principal(job.argumentos(["--seco"]), configuracao={}, chamar_rpc=chamar_rpc)
        self.assertEqual(codigo, 0)
        self.assertEqual([c[0] for c in chamadas], ["contratacao_ler_aprovados"])
        self.assertIn("Modo seco: nada foi gravado.", saida)
        projetos = next(x for x in saida if x.startswith("projetos:"))
        self.assertIn("2 caso(s) · resolvidos 1 (novos 1, mantidos 0, herdados 0) · ambíguos 1", projetos)
        self.assertIn("contratados 204 → 203", projetos)

    def test_normal_grava_uma_vez_sem_repetir(self):
        inst = [{"candidato": "velho", "situacao": "OUTRA_LISTA", "base": "velho,x"}]
        chamadas, chamar_rpc = self.banco(self.linhas(), inst)
        with mock.patch.object(job.execucao, "resumir", lambda *a, **k: None):
            codigo = job.principal(job.argumentos([]), configuracao={}, chamar_rpc=chamar_rpc)
        self.assertEqual(codigo, 0)
        gravacoes = [c for c in chamadas if c[0] == "gravar_contratacao_dos_aprovados"]
        self.assertEqual([len(c[1]["p_remover"]) for c in gravacoes], [1, 0])
        self.assertEqual([len(c[1]["p_decisoes"]) for c in gravacoes], [0, 4])
        self.assertTrue(all(c[2] == {"tentativas": 1} for c in gravacoes))
        self.assertTrue(gravacoes[0][1]["p_execucao"].startswith("contr-"))

    def test_lote_nao_parte_o_grupo(self):
        decisoes = [{"edital": E1, "vinculo": str(i // 3), "candidato": i} for i in range(9)]
        self.assertEqual([len(lote) for lote in job.lotes(decisoes, tamanho=4)], [3, 3, 3])

    def test_mudou_uma_linha_o_grupo_vai_inteiro(self):
        linhas = [linha("a", "V1", 9), linha("b", "V2", 9), *chamados("V1", 2), *chamados("V2", 2)]
        inst = regra.decidir(linhas, [])["gravar"]
        inst[0] = {**inst[0], "texto": "antigo"}
        self.assertEqual(len(regra.decidir(linhas, inst)["gravar"]), 2)

    def test_formato_desconhecido_e_erro(self):
        def chamar_rpc(*_a, **_k):
            return {"schema_version": 2}

        with self.assertRaises(ValueError):
            job.principal(job.argumentos(["--seco"]), configuracao={}, chamar_rpc=chamar_rpc)


if __name__ == "__main__":
    unittest.main()
