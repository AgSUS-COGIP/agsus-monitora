"""
Testes do casamento da lista de aprovados (python/monitora/aprovados/casamento.py) e do job
(scripts/aprovados/casamento_da_lista.py) com o banco falso. Dados fictícios; nada fala com o
Supabase. Os casos vêm dos que a tela tinha em tests/lib/publicacao-de-aprovados.test.js antes
de o casamento passar para o Python (migration 20261030090000).

    python -m pytest tests/python/test_casamento_da_lista.py
"""

import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "aprovados"))
sys.path.insert(0, str(_RAIZ / "python"))

import casamento_da_lista as job  # noqa: E402

from monitora.aprovados import casamento  # noqa: E402

# O resultado final de um edital (chave = análise), como o banco monta em pedir_casamento_da_lista.
NOVOS = [
    {"chave": "a1", "analise_id": "a1", "nome": "Ana Souza", "codigo_vaga": "V1", "posicao": 1},
    {"chave": "a2", "analise_id": "a2", "nome": "Bruno Lima", "codigo_vaga": "V1", "posicao": 2},
    {"chave": "a3", "analise_id": "a3", "nome": "Carla Dias", "codigo_vaga": "V1", "posicao": 3},
    {"chave": "a4", "analise_id": "a4", "nome": "Davi Rocha", "codigo_vaga": "V1", "posicao": 2},
    {"chave": "a5", "analise_id": "a5", "nome": "Élio Nunes", "codigo_vaga": "quadro:9", "posicao": 1},
]


def linha_da_planilha(n, nome, vaga="V1", posicao=None):
    """Quem entra pela planilha: a chave é a linha."""
    return {"chave": str(n), "analise_id": None, "nome": nome, "codigo_vaga": vaga, "posicao": posicao or n}


class NomeNormalizado(unittest.TestCase):
    def test_sem_acento_caixa_e_espacos(self):
        self.assertEqual(casamento.normalizar_nome("  José   DA  Silva-Júnior "), "jose da silva junior")
        self.assertEqual(casamento.normalizar_nome("MARIA DAS GRAÇAS"), "maria das gracas")
        self.assertEqual(casamento.normalizar_nome("joão d'ávila"), "joao d avila")
        self.assertEqual(casamento.normalizar_nome(None), "")


class Casar(unittest.TestCase):
    def test_lista_da_classificacao_casa_pela_analise(self):
        r = casamento.casar([{"id": "c1", "analise_id": "a1", "nome": "Outro Nome"}], NOVOS)
        self.assertEqual(r["vinculos"], [{"candidato_id": "c1", "chave": "a1", "forma": "ANALISE"}])
        self.assertEqual(r["nao_casados"], [])

    def test_lista_de_planilha_casa_pelo_nome_normalizado(self):
        r = casamento.casar([{"id": "c2", "nome": "BRUNO  LIMA", "status": "Contratado"}], NOVOS)
        self.assertEqual(r["vinculos"], [{"candidato_id": "c2", "chave": "a2", "forma": "NOME"}])

    def test_homonimos_desempatam_pela_vaga_e_o_resto_fica_ambiguo(self):
        novos = [*NOVOS, {"chave": "a9", "analise_id": "a9", "nome": "Ana Souza", "codigo_vaga": "V2", "posicao": 1}]
        anteriores = [
            {"id": "c1", "nome": "Ana Souza", "codigo_vaga": "V2", "classificacao": 4},
            {"id": "c3", "nome": "Ana Souza", "codigo_vaga": "", "status": "Desistente"},
        ]
        r = casamento.casar(anteriores, novos)
        self.assertEqual(r["vinculos"], [{"candidato_id": "c1", "chave": "a9", "forma": "NOME_VAGA"}])
        self.assertEqual([(n["id"], n["ambiguo"], n["decidido"]) for n in r["nao_casados"]], [("c3", True, False)])

    def test_revisao_manual_vence_e_pode_dizer_que_nao_esta(self):
        anteriores = [
            {"id": "c3", "nome": "Ana S.", "status": "Contratado", "matricula": "1"},
            {"id": "c4", "analise_id": "a3", "nome": "Carla Dias"},
        ]
        r = casamento.casar(anteriores, NOVOS, {"c3": "a1", "c4": ""})
        self.assertEqual(r["vinculos"], [{"candidato_id": "c3", "chave": "a1", "forma": "MANUAL"}])
        self.assertEqual([(n["id"], n["decidido"]) for n in r["nao_casados"]], [("c4", True)])

    def test_um_novo_nao_casa_com_duas_pessoas(self):
        r = casamento.casar(
            [{"id": "c1", "analise_id": "a1", "nome": "Ana Souza"}, {"id": "c2", "nome": "Ana Souza"}], NOVOS
        )
        self.assertEqual([v["chave"] for v in r["vinculos"]], ["a1"])
        self.assertEqual([n["id"] for n in r["nao_casados"]], ["c2"])

    def test_planilha_casa_pela_linha(self):
        novos = [
            linha_da_planilha(1, "JOSE DA SILVA"),
            linha_da_planilha(2, "maria souza"),
            linha_da_planilha(3, "Maria  Souza", "V2"),
            linha_da_planilha(4, "Gente Nova"),
        ]
        anteriores = [
            {"id": "a", "nome": "José da Silva", "codigo_vaga": "V1", "status": "Contratado", "matricula": "M1"},
            {"id": "b", "nome": "Maria Souza", "codigo_vaga": "V1", "status": "Convocado"},
            {"id": "c", "nome": "Maria Souza", "codigo_vaga": "V2"},
        ]
        self.assertEqual(
            casamento.casar(anteriores, novos)["vinculos"],
            [
                {"candidato_id": "a", "chave": "1", "forma": "NOME"},
                {"candidato_id": "b", "chave": "2", "forma": "NOME_VAGA"},
                {"candidato_id": "c", "chave": "3", "forma": "NOME_VAGA"},
            ],
        )


class Plano(unittest.TestCase):
    ANTERIORES = [
        {"id": "c1", "analise_id": "a1", "nome": "Ana Souza", "classificacao": 1, "codigo_vaga": "V1"},
        {
            "id": "c2",
            "nome": "Bruno Lima",
            "classificacao": 5,
            "codigo_vaga": "V1",
            "status": "Contratado",
            "matricula": "7",
        },
        {"id": "c5", "nome": "Fulano Fora", "classificacao": 9, "codigo_vaga": "V1", "status": "Desistente"},
        {"id": "c6", "nome": "Gina Sem Dados", "classificacao": 10, "codigo_vaga": "V1"},
        {"id": "c7", "nome": "Hugo Judicial", "sub_judice": True, "cargo": "Enfermeiro"},
    ]

    def test_resumo_pendencias_mudancas_e_revisao(self):
        p = casamento.plano(self.ANTERIORES, NOVOS)
        self.assertEqual(p["versao"], 1)
        self.assertEqual(
            p["vinculos"],
            [
                {"candidato_id": "c1", "chave": "a1", "forma": "ANALISE"},
                {"candidato_id": "c2", "chave": "a2", "forma": "NOME"},
            ],
        )
        self.assertEqual(
            p["resumo"],
            {
                "casados": 2,
                "entram": 3,
                "sem_par": 2,
                "sem_dono": 1,
                "preservados": 1,
                "mudam": 1,
                "sub_judice_mantidos": 1,
                "ambiguos": 0,
            },
        )
        self.assertEqual([x["candidato_id"] for x in p["pendencias"]], ["c5"])
        self.assertEqual(p["pendencias"][0]["status"], "Desistente")
        self.assertEqual(p["mudam"], [{"candidato_id": "c2", "chave": "a2", "de": 5, "para": 2}])
        self.assertEqual(p["revisar"], ["c5"])

    def test_mudar_de_vaga_tambem_conta(self):
        p = casamento.plano([{"id": "c1", "analise_id": "a1", "classificacao": 1, "codigo_vaga": "V9"}], NOVOS)
        self.assertEqual(p["resumo"]["mudam"], 1)

    def test_quem_foi_revisto_a_mao_continua_na_revisao(self):
        p = casamento.plano(self.ANTERIORES, NOVOS, {"c6": ""})
        self.assertIn("c6", p["revisar"])

    def test_lista_grande_em_tempo_curto(self):
        import time

        anteriores = [
            {
                "id": f"c{i}",
                "nome": f"Pessoa {i}",
                "codigo_vaga": "V1",
                "classificacao": i,
                "status": "Contratado" if i % 5 == 0 else None,
            }
            for i in range(1, 7001)
        ]
        novos = [linha_da_planilha(i, f"PESSOA {i}") for i in range(1, 7001)]
        inicio = time.perf_counter()
        p = casamento.plano(anteriores, novos)
        self.assertEqual(p["resumo"]["casados"], 7000)
        self.assertLess(time.perf_counter() - inicio, 5)


class BancoFalso:
    def __init__(self, pedidos):
        self.pedidos = pedidos
        self.gravados = []

    def __call__(self, _cfg, funcao, corpo, **_opcoes):
        if funcao == "casamento_ler_pedidos":
            return {"schema_version": 1, "pedidos": self.pedidos}
        if funcao == "gravar_casamento_da_lista":
            self.gravados.append(corpo)
            return {"ok": True}
        raise AssertionError(funcao)


class Job(unittest.TestCase):
    PEDIDO = {
        "pedido": "11111111-1111-1111-1111-111111111111",
        "novos": [linha_da_planilha(1, "Ana Souza"), linha_da_planilha(2, "Nova Pessoa")],
        "anteriores": [{"id": "c1", "nome": "ANA SOUZA", "status": "Contratado", "matricula": "M"}],
        "manuais": {},
    }

    def test_grava_o_plano_de_cada_pedido(self):
        banco = BancoFalso([self.PEDIDO])
        codigo = job.principal(job.argumentos([]), configuracao={}, chamar_rpc=banco)
        self.assertEqual(codigo, 0)
        (gravado,) = banco.gravados
        self.assertEqual(gravado["p_pedido"], self.PEDIDO["pedido"])
        self.assertIsNone(gravado["p_erro"])
        self.assertEqual(gravado["p_plano"]["vinculos"], [{"candidato_id": "c1", "chave": "1", "forma": "NOME"}])
        self.assertTrue(gravado["p_execucao"].startswith("casam-"))

    def test_seco_nao_grava(self):
        banco = BancoFalso([self.PEDIDO])
        self.assertEqual(job.principal(job.argumentos(["--seco"]), configuracao={}, chamar_rpc=banco), 0)
        self.assertEqual(banco.gravados, [])

    def test_pedido_ruim_vira_erro_e_os_outros_seguem(self):
        ruim = {
            **self.PEDIDO,
            "pedido": "22222222-2222-2222-2222-222222222222",
            "anteriores": [{"id": "x", "nome": object()}],
        }
        ruim["novos"] = None
        banco = BancoFalso([ruim, self.PEDIDO])
        original = casamento.plano

        def plano(anteriores, novos, manuais):
            if anteriores and anteriores[0]["id"] == "x":
                raise ValueError("falhou")
            return original(anteriores, novos, manuais)

        job.casamento.plano = plano
        try:
            codigo = job.principal(job.argumentos([]), configuracao={}, chamar_rpc=banco)
        finally:
            job.casamento.plano = original
        self.assertEqual(codigo, 2)
        self.assertEqual([g["p_erro"] is None for g in banco.gravados], [False, True])

    def test_pedido_invalido_e_entrada_invalida(self):
        with self.assertRaises(SystemExit) as saida:
            job.argumentos(["--pedido", "nao-e-uuid"])
        self.assertEqual(saida.exception.code, 3)


if __name__ == "__main__":
    unittest.main()
