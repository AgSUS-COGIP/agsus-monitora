"""
Testes do job das conferências de consistência (scripts/conferencias/): o
catálogo contra o caso dourado compartilhado com o vitest
(tests/fixtures/conferencias/catalogo.json), cada regra com dados fictícios e
o fluxo de uma execução com o banco falso. Nada fala com o Supabase.

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
import regras  # noqa: E402
from catalogo import CATALOGO, MODULOS, do_modulo  # noqa: E402

E1 = "00000000-0000-4000-a000-0000000000e1"
E2 = "00000000-0000-4000-a000-0000000000e2"
A1 = "00000000-0000-4000-a000-0000000000a1"
A2 = "00000000-0000-4000-a000-0000000000a2"
A3 = "00000000-0000-4000-a000-0000000000a3"
CONTEXTO = {
    "hoje": "2026-10-05",
    "editais": [
        {"id": E1, "numero": "101/2026", "area": "saude-indigena", "ativo": True},
        {"id": E2, "numero": "80/2026", "area": "saude-indigena", "ativo": True},
    ],
    "regras": [{"edital": E1, "nota_minima": 60, "teto_experiencia": 30}],
}


def _avisos(acumulador):
    return {(a["conferencia"], a["escopo"]): a for a in acumulador.avisos(regras.resumir)}


class CatalogoDourado(unittest.TestCase):
    def test_igual_ao_caso_compartilhado_com_o_vitest(self):
        dourado = json.loads((_RAIZ / "tests/fixtures/conferencias/catalogo.json").read_text(encoding="utf-8"))
        esperado = {c: (v["modulo"], v["gravidade"], v["titulo"]) for c, v in dourado["conferencias"].items()}
        self.assertEqual(CATALOGO, esperado)

    def test_todo_modulo_tem_conferencia(self):
        for modulo in MODULOS:
            self.assertTrue(do_modulo(modulo), modulo)


class Exemplos(unittest.TestCase):
    def test_so_ids_e_codigos(self):
        self.assertEqual(regras.exemplo_seguro("177979"), "177979")
        self.assertEqual(regras.exemplo_seguro(A1), A1)
        self.assertIsNone(regras.exemplo_seguro("Pessoa Fictícia"))
        self.assertIsNone(regras.exemplo_seguro("00000000191"))
        self.assertIsNone(regras.exemplo_seguro("pessoa@exemplo.invalid"))

    def test_no_maximo_vinte_exemplos(self):
        ac = regras.Acumulador()
        for i in range(30):
            ac.anotar("CARGA_VARIACAO_BRUSCA", escopo="vaga:1", exemplo=str(1000 + i))
        aviso = ac.avisos(regras.resumir)[0]
        self.assertEqual(aviso["quantidade"], 30)
        self.assertEqual(len(aviso["exemplos"]), 20)


class Casos(unittest.TestCase):
    def test_caso_so_com_ids_codigos_e_detalhe_simples(self):
        self.assertEqual(
            regras.caso_seguro({"analise": A1, "detalhe": {"nota": 50, "corte": 60.0, "inscricao": "2026-09-10"}}),
            {"analise": A1, "detalhe": {"nota": 50, "corte": 60.0, "inscricao": "2026-09-10"}},
        )
        self.assertEqual(regras.caso_seguro({"codigo": "C1"}), {"codigo": "C1"})
        self.assertIsNone(regras.caso_seguro({"codigo": "Pessoa Fictícia"}))
        self.assertIsNone(regras.caso_seguro({"analise": "nao-e-uuid"}))
        limpo = regras.caso_seguro(
            {"referencia": "x", "detalhe": {"nome": "Pessoa Fictícia", "cpf": "00000000191", "Chave": 1, "ok": True}}
        )
        self.assertEqual(limpo, {"referencia": "x", "detalhe": {"ok": True}})

    def test_tipo_da_referencia_so_conhecido_e_com_referencia(self):
        self.assertEqual(
            regras.caso_seguro({"referencia": "c1", "tipo": "candidato_aprovado"}),
            {"referencia": "c1", "tipo": "candidato_aprovado"},
        )
        self.assertEqual(regras.caso_seguro({"referencia": "c1", "tipo": "pessoa"}), {"referencia": "c1"})
        # Tipo sem referência não vai (só a entrevista, que se acha pela análise).
        self.assertEqual(regras.caso_seguro({"codigo": "C1", "tipo": "vaga"}), {"codigo": "C1"})
        self.assertEqual(
            regras.caso_seguro({"analise": A1, "tipo": "entrevista"}), {"analise": A1, "tipo": "entrevista"}
        )

    def test_todos_os_casos_alem_dos_vinte_exemplos(self):
        ac = regras.Acumulador()
        for i in range(30):
            ac.anotar("CARGA_VARIACAO_BRUSCA", escopo="vaga:1", exemplo=str(1000 + i))
        ac.anotar("CARGA_VARIACAO_BRUSCA", escopo="vaga:1", exemplo="1000")  # repetido: não duplica o caso
        aviso = ac.avisos(regras.resumir)[0]
        self.assertEqual(len(aviso["exemplos"]), 20)
        self.assertEqual(len(aviso["casos"]), 30)
        self.assertEqual(aviso["casos"][0], {"referencia": "1000"})
        self.assertNotIn("_chaves", aviso)

    def test_no_maximo_cinco_mil_casos(self):
        ac = regras.Acumulador()
        for i in range(regras.MAX_CASOS + 10):
            ac.anotar("CARGA_VARIACAO_BRUSCA", escopo="vaga:1", exemplo=f"v{i}")
        self.assertEqual(len(ac.avisos(regras.resumir)[0]["casos"]), regras.MAX_CASOS)

    def test_casos_das_analises_com_o_motivo(self):
        linhas = [
            {"id": A1, "area": "saude-indigena", "edital": E1, "status": "Aprovado", "nota": 50,
             "formacao": 10, "cursos": 10, "experiencia": 45, "etnico": 10, "codigo": "C1",
             "data_analise": "2026-09-01", "inscricao": "2026-09-10"},
            {"id": A3, "area": "saude-indigena", "edital": E2, "status": "Aprovado", "nota": 40,
             "data_analise": "2026-12-01", "codigo": "C1"},
        ]  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_analises([linhas], CONTEXTO, ac)
        avisos = _avisos(ac)
        self.assertEqual(
            avisos[("ANALISE_APROVADA_ABAIXO_DO_CORTE", f"edital:{E1}")]["casos"],
            [{"analise": A1, "detalhe": {"nota": 50.0, "corte": 60.0}}],
        )
        self.assertEqual(
            avisos[("ANALISE_NOTA_DIFERENTE_DA_SOMA", f"edital:{E1}")]["casos"][0]["detalhe"],
            {"nota": 50.0, "soma": 75.0},
        )
        self.assertEqual(
            avisos[("ANALISE_EXPERIENCIA_ACIMA_DO_TETO", f"edital:{E1}")]["casos"][0]["detalhe"],
            {"experiencia": 45.0, "teto": 30.0},
        )
        self.assertEqual(
            avisos[("ANALISE_DATA_INVALIDA", f"edital:{E1}")]["casos"][0],
            {
                "analise": A1,
                "detalhe": {"data_analise": "2026-09-01", "inscricao": "2026-09-10", "motivo": "antes_da_inscricao"},
            },
        )
        self.assertEqual(
            avisos[("ANALISE_DATA_INVALIDA", f"edital:{E2}")]["casos"][0]["detalhe"],
            {"data_analise": "2026-12-01", "motivo": "futuro"},
        )
        self.assertEqual(
            avisos[("ANALISE_EM_DOIS_EDITAIS", "area:saude-indigena")]["casos"],
            [{"codigo": "C1", "detalhe": {"editais": 2}}],
        )

    def test_lotes_por_avisos_e_por_casos(self):
        avisos = [{"casos": [{}] * n} for n in (5, 5, 5, 1)]
        self.assertEqual([len(lote) for lote in conferencias.lotes(avisos, tamanho=10, casos_por_lote=10)], [2, 2])
        self.assertEqual([len(lote) for lote in conferencias.lotes(avisos, tamanho=3, casos_por_lote=100)], [3, 1])
        # Um aviso maior que o lote vai sozinho, inteiro.
        self.assertEqual([len(lote) for lote in conferencias.lotes([{"casos": [{}] * 50}], casos_por_lote=10)], [1])


class Analises(unittest.TestCase):
    def test_regras_das_analises(self):
        linhas = [
            # aprovada abaixo do corte (60) e com soma errada
            {"id": A1, "area": "saude-indigena", "edital": E1, "status": "Aprovado", "nota": 50,
             "formacao": 10, "cursos": 10, "experiencia": 10, "etnico": 10, "codigo": "C1"},
            # experiência acima do teto (30), data no futuro
            {"id": A2, "area": "saude-indigena", "edital": E1, "status": "Reprovado", "nota": 80,
             "formacao": 10, "cursos": 10, "experiencia": 45, "etnico": 10, "data_analise": "2026-12-01",
             "codigo": "C1"},
            # data antes da inscrição; mesmo candidato no edital E2 (ativo)
            {"id": A3, "area": "saude-indigena", "edital": E2, "status": "Aprovado", "nota": 40,
             "data_analise": "2026-09-01", "inscricao": "2026-09-10", "codigo": "C1"},
        ]  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_analises([linhas[:2], linhas[2:]], CONTEXTO, ac)
        avisos = _avisos(ac)
        abaixo = avisos[("ANALISE_APROVADA_ABAIXO_DO_CORTE", f"edital:{E1}")]
        self.assertEqual((abaixo["quantidade"], abaixo["exemplos"]), (1, [A1]))
        self.assertIn("abaixo de 60", abaixo["resumo"])
        self.assertIn("101/2026", abaixo["resumo"])
        # Sem regra no E2, a A3 (nota 40) não é conferida pelo corte.
        self.assertNotIn(("ANALISE_APROVADA_ABAIXO_DO_CORTE", f"edital:{E2}"), avisos)
        self.assertEqual(avisos[("ANALISE_NOTA_DIFERENTE_DA_SOMA", f"edital:{E1}")]["exemplos"], [A1, A2])
        self.assertEqual(avisos[("ANALISE_EXPERIENCIA_ACIMA_DO_TETO", f"edital:{E1}")]["exemplos"], [A2])
        self.assertEqual(avisos[("ANALISE_DATA_INVALIDA", f"edital:{E1}")]["exemplos"], [A2])
        self.assertEqual(avisos[("ANALISE_DATA_INVALIDA", f"edital:{E2}")]["exemplos"], [A3])
        dois = avisos[("ANALISE_EM_DOIS_EDITAIS", "area:saude-indigena")]
        self.assertEqual((dois["gravidade"], dois["exemplos"]), ("INFORMATIVO", ["C1"]))


class Entrevistas(unittest.TestCase):
    def test_regras_das_entrevistas(self):
        dados = {
            "entrevistas": [
                {"id": "en1", "edital": E1, "area": "saude-indigena", "analise": A1, "origem": "sistema", "nota": None},
                {"id": "en2", "edital": E1, "area": "saude-indigena", "analise": A2, "origem": "sistema", "nota": 8},
                {"id": "en3", "edital": E1, "area": "saude-indigena", "analise": A2, "origem": "planilha", "nota": 8},
                {"id": "en4", "edital": E1, "area": "saude-indigena", "analise": A3, "origem": "sistema", "nota": None,
                 "compareceu": "N"},
            ],
            "agenda": [
                {"edital": E1, "area": "saude-indigena", "analise": A1, "codigo": "C1", "data": "2026-10-01",
                 "inicio": "09:00:00", "fim": "09:30:00"},
                {"edital": E1, "area": "saude-indigena", "analise": A3, "codigo": "C3", "data": "2026-10-01",
                 "inicio": "10:00:00", "fim": "10:30:00"},
                {"edital": E2, "area": "saude-indigena", "analise": "x", "codigo": "C1", "data": "2026-10-01",
                 "inicio": "09:15:00", "fim": "09:45:00"},
            ],
            "competencias": [{"id": "k1", "roteiro": "r1", "maxima": 10}],
            "roteiros": [{"id": "r1", "escala": "FAIXA", "passo": 0.5}],
            "avaliacoes": [
                {"entrevista": "en2", "competencia": "k1", "nota": 12},
                {"entrevista": "en2", "competencia": "k1", "nota": 7.3},
                {"entrevista": "en2", "competencia": "k1", "nota": 7.5},
            ],
            "convocacao": [{"edital": E1, "lista": "l1", "analises": [A1, A3]}],
        }  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_entrevistas(dados, CONTEXTO, ac)
        avisos = _avisos(ac)
        self.assertEqual(avisos[("ENTREVISTA_SEM_NOTA_APOS_DATA", f"edital:{E1}")]["exemplos"], [A1])
        fora = avisos[("ENTREVISTA_NOTA_FORA_DA_ESCALA", f"edital:{E1}")]
        self.assertEqual((fora["quantidade"], fora["exemplos"]), (2, ["en2"]))
        self.assertEqual(
            fora["casos"],
            [{"analise": A2, "referencia": "en2", "tipo": "entrevista", "detalhe": {"nota": 12.0, "maxima": 10.0}}],
        )
        self.assertEqual(avisos[("ENTREVISTA_FORA_DA_CONVOCACAO", f"edital:{E1}")]["exemplos"], [A2])
        self.assertEqual(avisos[("ENTREVISTA_HORARIO_DUPLICADO", f"edital:{E1}")]["exemplos"], [A2])
        self.assertEqual(avisos[("ENTREVISTA_HORARIO_DUPLICADO", "area:saude-indigena")]["exemplos"], ["C1"])

    def test_escalas_lista_e_niveis(self):
        self.assertTrue(regras._na_escala(3, 5, {"escala": "LISTA", "permitidas": [1, 3, 5]}))
        self.assertFalse(regras._na_escala(2, 5, {"escala": "LISTA", "permitidas": [1, 3, 5]}))
        self.assertFalse(regras._na_escala(4, 5, {"escala": "NIVEIS", "niveis": [0, 2.5, 5]}))
        self.assertTrue(regras._na_escala(4, 10, {"escala": "FAIXA", "passo": None}))


class Classificacao(unittest.TestCase):
    def test_regras_da_classificacao(self):
        dados = {
            "listas": [
                {"id": "lf", "edital": E1, "area": "saude-indigena", "tipo": "FINAL",
                 "gerada_em": "2026-10-01T10:00:00+00:00", "pendencias": 2, "vagas_pendentes": ["177979", "vaga com espaço"]},
                {"id": "lp", "edital": E2, "area": "saude-indigena", "tipo": "PRELIMINAR",
                 "gerada_em": "2026-10-01T10:00:00+00:00", "pendencias": 0},
            ],
            "analises_alteradas": [{"edital": E1, "alterada_em": "2026-10-02T08:00:00+00:00"},
                                   {"edital": E2, "alterada_em": "2026-10-03T08:00:00+00:00"}],
            "vagas_sem_quadro": [{"edital": E1, "area": "saude-indigena", "vaga": "180001"}],
            "ajustes": [{"id": "aj1", "edital": E2, "area": "saude-indigena", "tipo": "PRELIMINAR",
                         "aprovado_em": "2026-10-02T00:00:00+00:00"},
                        {"id": "aj2", "edital": E1, "area": "saude-indigena", "tipo": "ENTREVISTA",
                         "aprovado_em": "2026-10-02T00:00:00+00:00"}],
        }  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_classificacao(dados, ac)
        avisos = _avisos(ac)
        self.assertIn(("CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA", f"edital:{E1}"), avisos)
        # Lista preliminar mais velha que as análises não é a final: sem aviso de desatualizada.
        self.assertNotIn(("CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA", f"edital:{E2}"), avisos)
        empate = avisos[("CLASSIFICACAO_EMPATE_PENDENTE", f"edital:{E1}")]
        self.assertEqual((empate["quantidade"], empate["exemplos"]), (2, ["lf", "177979"]))
        self.assertEqual(avisos[("CLASSIFICACAO_VAGA_SEM_QUADRO", f"edital:{E1}")]["exemplos"], ["180001"])
        self.assertEqual(avisos[("CLASSIFICACAO_AJUSTE_APOS_LISTA", f"edital:{E2}")]["exemplos"], ["aj1"])
        self.assertNotIn(("CLASSIFICACAO_AJUSTE_APOS_LISTA", f"edital:{E1}"), avisos)
        # Cada caso diz o que é a referência (a tela resolve nome, edital e vaga).
        self.assertEqual(
            avisos[("CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA", f"edital:{E1}")]["casos"],
            [{"referencia": "lf", "tipo": "lista_classificacao"}],
        )
        self.assertEqual(
            empate["casos"],
            [
                {"referencia": "lf", "tipo": "lista_classificacao", "detalhe": {"pendencias": 2}},
                {"referencia": "177979", "tipo": "vaga"},
            ],
        )
        self.assertEqual(
            avisos[("CLASSIFICACAO_VAGA_SEM_QUADRO", f"edital:{E1}")]["casos"],
            [{"referencia": "180001", "tipo": "vaga"}],
        )
        self.assertEqual(
            avisos[("CLASSIFICACAO_AJUSTE_APOS_LISTA", f"edital:{E2}")]["casos"],
            [{"referencia": "aj1", "tipo": "ajuste_recurso"}],
        )


class Aprovados(unittest.TestCase):
    def test_regras_dos_aprovados(self):
        p1, p2 = "a" * 64, "b" * 64
        dados = {
            "candidatos": [
                {"id": "c1", "edital": E1, "area": "saude-indigena", "status": "Contratado", "pessoa": p1},
                {"id": "c2", "edital": E2, "area": "saude-indigena", "status": "Contratado", "pessoa": p1},
                {"id": "c3", "edital": E1, "area": "saude-indigena", "status": "Contratado", "pessoa": p2},
                {"id": "c4", "edital": E1, "area": "saude-indigena", "status": "Convocado", "convocado_em": "2026-09-01"},
                {"id": "c5", "edital": E1, "area": "saude-indigena", "status": "Convocado", "convocado_em": "2026-10-01"},
            ],
            "pendencias": [{"lista": "la", "edital": E1, "area": "saude-indigena", "candidatos": ["c9", "c8"]},
                           {"lista": "lb", "edital": E2, "area": "saude-indigena", "candidatos": []}],
        }  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_aprovados(dados, CONTEXTO, ac, dias_convocado=15)
        avisos = _avisos(ac)
        self.assertEqual(avisos[("APROVADOS_CONTRATADO_DUPLICADO", "area:saude-indigena")]["exemplos"], ["c1", "c2"])
        convocado = avisos[("APROVADOS_CONVOCADO_SEM_DESFECHO", f"edital:{E1}")]
        self.assertEqual(convocado["exemplos"], ["c4"])
        self.assertIn("15 dias", convocado["resumo"])
        pend = avisos[("APROVADOS_PENDENCIA_DA_PUBLICACAO", f"edital:{E1}")]
        self.assertEqual((pend["quantidade"], pend["exemplos"]), (2, ["c9", "c8"]))
        self.assertNotIn(("APROVADOS_PENDENCIA_DA_PUBLICACAO", f"edital:{E2}"), avisos)
        # Casos com o tipo: a tela resolve nome, edital, vaga e situação do aprovado.
        self.assertEqual(
            convocado["casos"],
            [{"referencia": "c4", "tipo": "candidato_aprovado", "detalhe": {"convocado_em": "2026-09-01"}}],
        )
        self.assertEqual(
            pend["casos"],
            [{"referencia": "c9", "tipo": "candidato_aprovado"}, {"referencia": "c8", "tipo": "candidato_aprovado"}],
        )

    def test_contratado_em_duas_vagas_um_caso_por_pessoa_e_area(self):
        p1 = "a" * 64
        dados = {
            "candidatos": [
                {"id": "c1", "edital": E1, "area": "sede", "status": "Contratado", "pessoa": p1},
                {"id": "c2", "edital": E2, "area": "saude-indigena", "status": "Contratado", "pessoa": p1},
                {"id": "c3", "edital": E2, "area": "saude-indigena", "status": "Contratado", "pessoa": p1},
            ],
        }  # fmt: skip
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_aprovados(dados, CONTEXTO, ac)
        avisos = _avisos(ac)
        saude = avisos[("APROVADOS_CONTRATADO_DUPLICADO", "area:saude-indigena")]
        sede = avisos[("APROVADOS_CONTRATADO_DUPLICADO", "area:sede")]
        # O caso de cada área é o vínculo da pessoa naquela área; uma pessoa, um caso.
        self.assertEqual(saude["casos"], [{"referencia": "c2", "tipo": "candidato_aprovado", "detalhe": {"vagas": 3}}])
        self.assertEqual(sede["casos"], [{"referencia": "c1", "tipo": "candidato_aprovado", "detalhe": {"vagas": 3}}])
        self.assertEqual((saude["quantidade"], saude["exemplos"]), (1, ["c2", "c1", "c3"]))


class Cargas(unittest.TestCase):
    def test_variacao_brusca(self):
        dados = {
            "vagas": [
                {"vaga": "177979", "edital": E1, "situacao": "GRAVADA", "ativos": 300, "novos": 0, "saidas": 900},
                {"vaga": "177980", "edital": E1, "situacao": "GRAVADA", "ativos": 110, "novos": 10, "saidas": 0},
                {"vaga": "177981", "edital": None, "situacao": "RECUSADA", "ativos": 1000, "arquivo": 100},
                {"vaga": "177982", "edital": E1, "situacao": "GRAVADA", "ativos": 50, "novos": 50, "saidas": 0},
            ]
        }
        ac = regras.Acumulador({e["id"]: e for e in CONTEXTO["editais"]})
        regras.conferir_cargas(dados, ac)
        avisos = _avisos(ac)
        self.assertIn(("CARGA_VARIACAO_BRUSCA", "vaga:177979"), avisos)
        self.assertIn("de 1200 para 300", avisos[("CARGA_VARIACAO_BRUSCA", "vaga:177979")]["resumo"])
        self.assertNotIn(("CARGA_VARIACAO_BRUSCA", "vaga:177980"), avisos)
        self.assertIn(("CARGA_VARIACAO_BRUSCA", "vaga:177981"), avisos)
        self.assertNotIn(("CARGA_VARIACAO_BRUSCA", "vaga:177982"), avisos)  # primeira carga
        self.assertEqual(
            avisos[("CARGA_VARIACAO_BRUSCA", "vaga:177979")]["casos"],
            [{"referencia": "177979", "tipo": "vaga_empregare", "detalhe": {"antes": 1200, "depois": 300}}],
        )


class _BancoFalso:
    def __init__(self, falhar=None):
        self.chamadas = []
        self.falhar = falhar or set()

    def __call__(self, _cfg, funcao, corpo, **opcoes):
        self.chamadas.append((funcao, corpo))
        self.opcoes = getattr(self, "opcoes", {})
        self.opcoes[funcao] = opcoes
        if funcao in self.falhar:
            raise RuntimeError(f"{funcao} caiu para pessoa@exemplo.invalid")
        if funcao == "conferencia_ler_contexto":
            return CONTEXTO
        if funcao == "conferencia_ler_analises":
            if corpo["p_apos"] is None:
                linha = {"id": A1, "area": "saude-indigena", "edital": E1, "status": "Aprovado", "nota": 10}
                return {"linhas": [linha], "proximo": A1}
            return {"linhas": [], "proximo": None}
        if funcao == "conferencia_ler_cargas":
            return {
                "vagas": [{"vaga": "177979", "edital": E1, "situacao": "GRAVADA", "ativos": 1, "novos": 0, "saidas": 9}]
            }
        if funcao.startswith("conferencia_ler_"):
            return {}
        if funcao == "finalizar_conferencia":
            return {
                "situacao": "PARCIAL" if corpo["p_falhas"] else "CONCLUIDA",
                "novos": 2,
                "abertos": 2,
                "resolvidos": 0,
            }
        return {}


class Fluxo(unittest.TestCase):
    def _rodar(self, banco, lista=None):
        args = conferencias.argumentos(lista or ["--disparado-por", "agenda", "--dias-convocado", "15"])
        return conferencias.principal(args, configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco)

    def test_iniciar_nao_repete(self):
        banco = _BancoFalso()
        self._rodar(banco)
        self.assertEqual(banco.opcoes["iniciar_conferencia"], {"tentativas": 1})

    def test_cursor_parado_encerra(self):
        def chamar(funcao, corpo):
            return {"linhas": [{"id": "a"}], "proximo": "a"}

        self.assertEqual(len(list(conferencias.paginas_de_analises(chamar))), 2)

    def test_execucao_completa(self):
        banco = _BancoFalso()
        self.assertEqual(self._rodar(banco), 0)
        funcoes = [f for f, _ in banco.chamadas]
        self.assertEqual(funcoes[0], "iniciar_conferencia")
        self.assertEqual(funcoes.count("conferencia_ler_analises"), 2)
        self.assertEqual(banco.chamadas[0][1]["p_disparo"], "AGENDA")
        gravados = [c for f, c in banco.chamadas if f == "gravar_avisos_conferencia"][0]["p_avisos"]
        self.assertEqual(
            sorted(a["conferencia"] for a in gravados), ["ANALISE_APROVADA_ABAIXO_DO_CORTE", "CARGA_VARIACAO_BRUSCA"]
        )
        fim = banco.chamadas[-1][1]
        self.assertEqual(sorted(fim["p_conferencias"]), sorted(CATALOGO))
        self.assertEqual(fim["p_falhas"], [])

    def test_modulo_que_falha_nao_resolve_os_avisos_dele(self):
        banco = _BancoFalso(falhar={"conferencia_ler_cargas"})
        self.assertEqual(self._rodar(banco), 2)
        fim = banco.chamadas[-1][1]
        self.assertEqual(fim["p_falhas"], do_modulo("cargas"))
        self.assertNotIn("CARGA_VARIACAO_BRUSCA", fim["p_conferencias"])
        gravados = [c for f, c in banco.chamadas if f == "gravar_avisos_conferencia"][0]["p_avisos"]
        self.assertNotIn("CARGA_VARIACAO_BRUSCA", [a["conferencia"] for a in gravados])

    def test_seco_nao_grava(self):
        banco = _BancoFalso()
        self.assertEqual(self._rodar(banco, ["--seco", "--dias-convocado", "15"]), 0)
        self.assertFalse(any(f in ("iniciar_conferencia", "gravar_avisos_conferencia") for f, _ in banco.chamadas))

    def test_erro_geral_fecha_como_falha_sem_dado_pessoal(self):
        banco = _BancoFalso(falhar={"conferencia_ler_contexto"})
        self.assertEqual(self._rodar(banco), 1)
        fim = banco.chamadas[-1]
        self.assertEqual(fim[0], "finalizar_conferencia")
        self.assertNotIn("pessoa@exemplo.invalid", fim[1]["p_erro"])

    def test_dias_de_convocado_pelo_ambiente(self):
        import os

        antigo = os.environ.get("CONFERENCIA_DIAS_CONVOCADO")
        try:
            os.environ["CONFERENCIA_DIAS_CONVOCADO"] = "30"
            self.assertEqual(conferencias.argumentos([]).dias_convocado, 30)
            os.environ["CONFERENCIA_DIAS_CONVOCADO"] = "0"
            with self.assertRaises(SystemExit):
                conferencias.argumentos([])
        finally:
            if antigo is None:
                os.environ.pop("CONFERENCIA_DIAS_CONVOCADO", None)
            else:
                os.environ["CONFERENCIA_DIAS_CONVOCADO"] = antigo


if __name__ == "__main__":
    unittest.main()
