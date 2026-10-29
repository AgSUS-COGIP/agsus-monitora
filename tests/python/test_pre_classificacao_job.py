"""
Testes do job da triagem (scripts/pre_classificacao/): o fluxo de
uma execução com o banco falso (função `chamar` injetada) e dados fictícios —
edital sem regra conferida, prévia no modo seco, gravação por vaga, falha de
um edital, execução em andamento e nada de dado pessoal no resumo. Nada fala
com o Supabase.

    python -m pytest tests/python
"""

import io
import json
import pathlib
import sys
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest import mock

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))
sys.path.insert(0, str(_RAIZ / "python"))

import pre_classificacao as job  # noqa: E402

from monitora import supabase_rpc  # noqa: E402

E93 = "00000000-0000-4000-a000-000000000093"
EFCC = "00000000-0000-4000-a000-0000000000fc"
USUARIO = "00000000-0000-4000-a000-0000000000aa"
REGRA = {
    "schema": 1,
    "provisoria": {
        "eliminacao_automatica": [
            {"codigo": "CANCELADO", "coluna": "SITUAÇÃO", "quando": ["CANCELADO"], "motivo": "Cancelou a inscrição"}
        ],
        "nota_declarada": [],
        "divergencia_tolerancia": 0,
    },
    "lote": {"base": "MULTIPLO_VAGAS", "multiplo": 1, "inclui_cr": True, "inclui_empatados": False},
    "blocos": [],
}


def candidato(i, art, situacao="Ativo"):
    return {
        "id": f"00000000-0000-4000-a000-0000000c00{i:02d}",
        "codigo": f"70000{i:02d}",
        "ativo": True,
        "nascimento": "1990-01-01",
        "candidatura": f"2026-09-{10 + i:02d}T12:00:00+00:00",
        "colunas": {"SITUAÇÃO": situacao, "NOTA - Questionário": art},
    }


def compactar(c, pedidas):
    """O inscrito como o banco devolve com p_colunas (20261014220000): só as pedidas, pela posição."""
    saida = {k: v for k, v in c.items() if k != "colunas" and v is not None}
    saida["c"] = {str(i): c["colunas"][n] for i, n in enumerate(pedidas) if n in c["colunas"]}
    return saida


class BancoFalso:
    def __init__(
        self,
        editais,
        candidatos=None,
        falhar_vaga=None,
        em_andamento=False,
        distribuicao=None,
        decisoes=None,
        anterior=None,
        nao_encontrados=(),
    ):
        self.editais = editais
        self.nao_encontrados = list(nao_encontrados)
        self.anterior = anterior or {}
        self.decisoes = decisoes or {}
        self.distribuicao = distribuicao or {"modo": "PEGAR_PROXIMO", "novos": "MENOS_PENDENTES", "a_abrir": []}
        self.candidatos = candidatos or {}
        self.falhar_vaga = falhar_vaga
        self.em_andamento = em_andamento
        self.chamadas = []
        self.opcoes = {}

    def __call__(self, _cfg, funcao, corpo, **opcoes):
        self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
        self.opcoes.setdefault(funcao, []).append(opcoes)
        if funcao == "pre_classificacao_ler_editais":
            return {"hoje": "2026-10-06", "nao_encontrados": self.nao_encontrados, "editais": self.editais}
        if funcao == "pre_classificacao_ler_colunas":
            return {"colunas": sorted({k for cs in self.candidatos.values() for c in cs for k in c["colunas"]})}
        if funcao == "pre_classificacao_ler_candidatos":
            candidatos = self.candidatos.get(corpo["p_vaga"], [])
            if corpo.get("p_colunas") is not None:
                candidatos = [compactar(c, corpo["p_colunas"]) for c in candidatos]
            return {
                "candidatos": candidatos,
                "anterior": self.anterior.get(corpo["p_vaga"], {}),
                "decisoes": self.decisoes,
            }
        if funcao == "iniciar_pre_classificacao":
            if self.em_andamento:
                raise supabase_rpc.ErroDoSupabase(funcao, 400, '{"code":"55P03","message":"Já há uma em andamento"}')
            return {"execucao": corpo["p_execucao"]}
        if funcao == "gravar_pre_classificacao_vaga":
            if corpo["p_vaga"] == self.falhar_vaga:
                raise supabase_rpc.ErroDoSupabase(funcao, 400, '{"code":"22023","message":"posição inválida"}')
            return {"inscritos": len(corpo["p_linhas"]), "mudancas": 0}
        if funcao == "gravar_sugestoes_da_ficha":
            return {"candidatos": len(corpo["p_sugestoes"])}
        if funcao == "pre_classificacao_ler_distribuicao":
            return self.distribuicao
        if funcao == "abrir_fichas_pre_classificacao":
            n = len(self.distribuicao.get("a_abrir") or [])
            return {"criadas": n, "atribuidas": len(corpo["p_atribuicoes"]), "fora_do_lote": 1, "voltaram": 0}
        if funcao == "finalizar_pre_classificacao":
            falhou = any(e["situacao"] == "FALHOU" for e in corpo["p_editais"]) or corpo["p_erro"]
            return {"situacao": "PARCIAL" if falhou else "CONCLUIDA", "vagas": 1, "lote": 2}
        raise AssertionError(funcao)

    def de(self, funcao):
        return [c for f, c in self.chamadas if f == funcao]


def edital_93(situacao="CONFERIDA", vagas=None):
    return {
        "id": E93,
        "rotulo": "93/2026",
        "regra": {"versao": 3, "situacao": situacao, "configuracao": REGRA},
        "refazer_permitido": True,
        "vagas": vagas
        if vagas is not None
        else [
            {
                "codigo": "179698",
                "candidatos_ativos": 3,
                "ultimo_lote": 0,
                "quadro": {"vagas_imediatas": 1, "cadastro_reserva": True, "modalidades": {"Ampla Concorrência": 1}},
            }
        ],
    }


def rodar(banco, lista):
    saida = io.StringIO()
    with redirect_stdout(saida):
        codigo = job.principal(job.argumentos(lista), configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco)
    return codigo, saida.getvalue()


CANDIDATOS = {"179698": [candidato(1, "24,0/30,0"), candidato(2, "22,0/30,0"), candidato(3, "28,0/30,0", "Cancelado")]}


class Fluxo(unittest.TestCase):
    def test_edital_sem_regra_explica_e_nao_quebra_no_modo_seco(self):
        sem_regra = {**edital_93(), "regra": None}
        banco = BancoFalso([sem_regra], CANDIDATOS, nao_encontrados=["99/2099"])
        codigo, saida = rodar(banco, ["--seco", "--editais", "93/2026,99/2099"])
        # Edital pedido que não existe não é sucesso: parcial.
        self.assertEqual(codigo, 2)
        self.assertIn("93/2026: edital sem regra conferida", saida)
        self.assertIn("3 inscritos em 1 vaga(s) aguardam", saida)
        self.assertIn("Editais não encontrados: 99/2099", saida)
        self.assertEqual(banco.de("pre_classificacao_ler_candidatos"), [])
        self.assertEqual(banco.de("iniciar_pre_classificacao"), [])

    def test_regra_nao_conferida_vira_previa_no_seco_e_nao_grava_no_normal(self):
        banco = BancoFalso([edital_93("CONFERIR")], CANDIDATOS)
        codigo, saida = rodar(banco, ["--seco"])
        self.assertEqual(codigo, 0)
        self.assertIn("prévia calculada", saida)
        self.assertIn("2 no lote", saida)
        banco = BancoFalso([edital_93("CONFERIR")], CANDIDATOS)
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])
        self.assertEqual(banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]["situacao"], "REGRA_NAO_CONFERIDA")
        self.assertIn("falta a coordenação marcar como conferida", saida)

    def test_grava_cada_vaga_com_a_versao_da_regra_e_fecha_a_execucao(self):
        banco = BancoFalso([edital_93()], CANDIDATOS)
        codigo, saida = rodar(banco, ["--editais", "93/2026", "--disparado-por", USUARIO])
        self.assertEqual(codigo, 0)
        inicio = banco.de("iniciar_pre_classificacao")[0]
        self.assertEqual(
            (inicio["p_disparo"], inicio["p_usuario"], inicio["p_pedido"]), ("MONITORA", USUARIO, ["93/2026"])
        )
        gravacao = banco.de("gravar_pre_classificacao_vaga")[0]
        self.assertEqual((gravacao["p_vaga"], gravacao["p_versao_regra"]), ("179698", 3))
        situacoes = {l["id"][-2:]: (l["situacao"], l["posicao"], l["lote"]) for l in gravacao["p_linhas"]}
        self.assertEqual(situacoes, {"01": ("NO_LOTE", 1, 1), "02": ("NO_LOTE", 2, 1), "03": ("ELIMINADO", None, None)})
        self.assertEqual(gravacao["p_resumo"]["tamanho"], 2)
        self.assertEqual(set(gravacao["p_linhas"][0]), set(job.CAMPOS_DA_LINHA))
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["situacao"], fim["inscritos"], fim["no_lote"]), ("PROCESSADO", 3, 2))
        self.assertNotIn("avisos_por_vaga", fim)
        self.assertIn("1 eliminados", saida)

    def test_as_decisoes_da_coordenacao_ficam_no_lote_e_contam_separado(self):
        # 03 cancelou (a regra elimina), mas a coordenação o incluiu: Critério CORES.
        decisoes = {CANDIDATOS["179698"][2]["id"]: {"motivo": "Critério CORES"}}
        banco = BancoFalso([edital_93()], CANDIDATOS, decisoes=decisoes)
        codigo, saida = rodar(banco, ["--editais", "93/2026"])
        self.assertEqual(codigo, 0)
        gravacao = banco.de("gravar_pre_classificacao_vaga")[0]
        linhas = {
            l["id"][-2:]: (l["situacao"], l["posicao"], l["entrada"], l["motivo_entrada"]) for l in gravacao["p_linhas"]
        }
        self.assertEqual(linhas["03"], ("NO_LOTE", 3, "DECISAO", "Critério CORES"))
        self.assertEqual(gravacao["p_resumo"]["tamanho"], 2)
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["no_lote"], fim["por_decisao"], fim["eliminados"]), (2, 1, 0))
        self.assertIn("lote: 2 pela regra + 1 por decisão", saida)

    def test_edital_que_falha_nao_derruba_os_outros(self):
        fcc = {**edital_93(), "id": EFCC, "rotulo": "FCC", "vagas": [{**edital_93()["vagas"][0], "codigo": "111111"}]}
        banco = BancoFalso(
            [edital_93(), fcc], {**CANDIDATOS, "111111": [candidato(4, "10,0/30,0")]}, falhar_vaga="111111"
        )
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 2)
        editais = {e["rotulo"]: e for e in banco.de("finalizar_pre_classificacao")[0]["p_editais"]}
        self.assertEqual(editais["93/2026"]["situacao"], "PROCESSADO")
        self.assertEqual(editais["FCC"]["situacao"], "FALHOU")
        self.assertIn("FCC: FALHOU", saida)

    def test_execucao_em_andamento_para_com_aviso(self):
        banco = BancoFalso([edital_93()], CANDIDATOS, em_andamento=True)
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 1)
        self.assertIn("em andamento", saida)
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])

    def test_iniciar_nao_repete(self):
        # As RPCs que abrem e fecham a execução não são idempotentes: uma tentativa só. As outras repetem (padrão).
        banco = BancoFalso([edital_93()], CANDIDATOS)
        codigo, _ = rodar(banco, ["--editais", "93/2026"])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.opcoes["iniciar_pre_classificacao"], [{"tentativas": 1}])
        self.assertEqual(banco.opcoes["gravar_pre_classificacao_vaga"], [{}])
        self.assertEqual(banco.opcoes["finalizar_pre_classificacao"], [{"tentativas": 1}])

    def test_iniciar_sem_resposta_nao_e_chamado_de_novo(self):
        # Pelo chamar de verdade (supabase_rpc): a resposta se perde e o job não abre outra execução.
        banco = BancoFalso([edital_93()], CANDIDATOS)
        pedidos = []

        class Resposta:
            headers = {}

            def __init__(self, corpo):
                self.corpo = corpo

            def read(self):
                return json.dumps(self.corpo).encode("utf-8")

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

        def abrir(pedido, timeout=None):
            funcao = pedido.full_url.rsplit("/", 1)[-1]
            pedidos.append(funcao)
            if funcao == "iniciar_pre_classificacao":
                raise urllib.error.URLError("conexão perdida")
            return Resposta(banco(None, funcao, json.loads(pedido.data)))

        def chamar_rpc(cfg, funcao, corpo, **opcoes):
            return supabase_rpc.chamar(cfg, funcao, corpo, abrir=abrir, esperar=lambda _s: None, **opcoes)

        with self.assertRaises(supabase_rpc.ErroDoSupabase), redirect_stdout(io.StringIO()):
            job.principal(
                job.argumentos(["--editais", "93/2026"]),
                configuracao={"url": "https://x", "chave": "k"},
                chamar_rpc=chamar_rpc,
            )
        self.assertEqual(pedidos.count("iniciar_pre_classificacao"), 1)
        self.assertNotIn("gravar_pre_classificacao_vaga", pedidos)

    def test_erro_no_calculo_das_sugestoes_so_vira_aviso(self):
        # A conta das sugestões fica dentro do tratamento de gravar_sugestoes: o edital segue PROCESSADO.
        regra = {**REGRA, "blocos": [{"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Informe os cursos"]}]}
        edital = {**edital_93(), "regra": {"versao": 3, "situacao": "CONFERIDA", "configuracao": regra}}
        banco = BancoFalso([edital], CANDIDATOS)
        with (
            mock.patch.object(job, "sugestoes_da_vaga", side_effect=RuntimeError("conta quebrada")),
            self.assertLogs("monitora.pre_classificacao", level="WARNING") as registro,
        ):
            codigo, _ = rodar(banco, ["--editais", "93/2026"])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.de("gravar_sugestoes_da_ficha"), [])
        self.assertEqual(len(banco.de("gravar_pre_classificacao_vaga")), 1)
        self.assertEqual(len(banco.de("abrir_fichas_pre_classificacao")), 1)
        fim = banco.de("finalizar_pre_classificacao")[0]
        self.assertEqual((fim["p_erro"], fim["p_editais"][0]["situacao"]), (None, "PROCESSADO"))
        self.assertTrue(any("Sugestões da ficha da vaga 179698" in r for r in registro.output))

    def test_idoso_pela_idade_no_fim_das_inscricoes_do_cronograma(self):
        # Hoje (2026-10-06) o 01 já tem 60 anos; no fim das inscrições (2026-09-29), ainda 59: não é idoso.
        regra = {**REGRA, "provisoria": {**REGRA["provisoria"], "desempate": ["IDOSO", "CANDIDATURA"]}}
        cronograma = [{"atividade": "Período de inscrição", "inicio": "2026-09-21", "fim": "2026-09-29"}]
        edital = {
            **edital_93(),
            "regra": {"versao": 3, "situacao": "CONFERIDA", "configuracao": regra},
            "cronograma": cronograma,
        }
        quase_idoso = {**candidato(1, "24,0/30,0"), "nascimento": "1966-10-01"}
        mais_novo = {**candidato(2, "24,0/30,0"), "candidatura": "2026-09-01T12:00:00+00:00"}

        def posicoes(banco):
            codigo, _ = rodar(banco, ["--editais", "93/2026"])
            self.assertEqual(codigo, 0)
            return {l["id"][-2:]: l["posicao"] for l in banco.de("gravar_pre_classificacao_vaga")[0]["p_linhas"]}

        self.assertEqual(posicoes(BancoFalso([edital], {"179698": [quase_idoso, mais_novo]})), {"01": 2, "02": 1})
        # Sem cronograma, a idade é a de hoje: o 01 é idoso e vem primeiro.
        sem_cronograma = {**edital, "cronograma": None}
        self.assertEqual(
            posicoes(BancoFalso([sem_cronograma], {"179698": [quase_idoso, mais_novo]})), {"01": 1, "02": 2}
        )

    def test_disparo_e_modo_pelo_ambiente(self):
        self.assertEqual(job.tipo_do_disparo("robo"), ("ROBO", None))
        self.assertEqual(job.tipo_do_disparo(""), ("GITHUB", None))
        self.assertEqual(job.tipo_do_disparo(USUARIO), ("MONITORA", USUARIO))
        with self.assertRaises(SystemExit):
            job.argumentos(["--editais", "93/2026', x='1"])

    def test_refazer_recusado_com_ficha_iniciada(self):
        edital = {**edital_93(), "refazer_permitido": False, "fichas_iniciadas": 3}
        banco = BancoFalso([edital], CANDIDATOS)
        codigo, saida = rodar(banco, ["--refazer-lote"])
        self.assertEqual(codigo, 2)
        self.assertIn("93/2026: FALHOU — lote não refeito: o lote já está em análise: 3 fichas iniciadas.", saida)
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual(fim["situacao"], "FALHOU")
        self.assertTrue(banco.de("iniciar_pre_classificacao")[0]["p_refazer"])
        # Nada do edital é gravado nem abre ficha.
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])
        self.assertEqual(banco.de("abrir_fichas_pre_classificacao"), [])

    def test_refazer_recusado_no_modo_seco_tambem_explica(self):
        edital = {**edital_93(), "refazer_permitido": False, "fichas_iniciadas": 0}
        codigo, saida = rodar(BancoFalso([edital], CANDIDATOS), ["--seco", "--refazer-lote"])
        self.assertEqual(codigo, 2)
        self.assertIn("lote não refeito: o edital já tem candidato analisado", saida)

    def test_refazer_com_fichas_intocadas_diz_quem_fica_entra_e_sai(self):
        c1, c2, c3 = (c["id"] for c in CANDIDATOS["179698"])
        lote = {"lote": 1, "lista_lote": "GERAL", "entrada": "INICIAL", "motivo_entrada": "Lote inicial"}
        # Antes: c2 e c3 no lote; c1 fora. Refeito (1 vaga + CR = 2): c1 e c2 no lote, c3 cancelou.
        anterior = {"179698": {c2: {"situacao": "NO_LOTE", **lote}, c3: {"situacao": "NO_LOTE", **lote}}}
        banco = BancoFalso([{**edital_93(), "fichas_iniciadas": 0}], CANDIDATOS, anterior=anterior)
        codigo, saida = rodar(banco, ["--refazer-lote"])
        self.assertEqual(codigo, 0)
        self.assertIn("lote refeito: 1 ficam, 1 entram, 1 saem", saida)
        linhas = {l["id"]: l["situacao"] for l in banco.de("gravar_pre_classificacao_vaga")[0]["p_linhas"]}
        self.assertEqual(linhas, {c1: "NO_LOTE", c2: "NO_LOTE", c3: "ELIMINADO"})
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual(fim["lote_refeito"], {"ficam": 1, "entram": 1, "saem": 1})
        self.assertEqual(len(banco.de("abrir_fichas_pre_classificacao")), 1)

    def test_abre_as_fichas_do_lote_no_fim_do_edital(self):
        distribuicao = {
            "modo": "DISTRIBUICAO_INICIAL",
            "novos": "MENOS_PENDENTES",
            "criterio": "PARTES_IGUAIS",
            "distribuicao_iniciada": True,
            "analistas": [
                {"usuario": "u-a", "vagas": None, "limite": None, "pendentes": 3},
                {"usuario": "u-b", "vagas": ["179698"], "limite": None, "pendentes": 0},
            ],
            "a_abrir": [{"candidato": "c1", "vaga": "179698"}, {"candidato": "c2", "vaga": "179698"}],
        }
        banco = BancoFalso([edital_93()], CANDIDATOS, distribuicao=distribuicao)
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 0)
        abrir = banco.de("abrir_fichas_pre_classificacao")[0]
        self.assertEqual(abrir["p_edital"], E93)
        self.assertEqual(
            abrir["p_atribuicoes"], [{"candidato": "c1", "usuario": "u-b"}, {"candidato": "c2", "usuario": "u-b"}]
        )
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["fichas_criadas"], fim["fichas_atribuidas"], fim["fichas_fora_do_lote"]), (2, 2, 1))
        self.assertIn("fichas: 2 aberta(s), 2 atribuída(s), 1 fora do lote", saida)
        self.assertNotIn("u-b", saida)

    def test_nao_abre_fichas_sem_regra_conferida(self):
        banco = BancoFalso([edital_93("CONFERIR")], CANDIDATOS)
        rodar(banco, [])
        self.assertEqual(banco.de("abrir_fichas_pre_classificacao"), [])

    def test_a_vaga_leva_o_nivel_do_cargo_e_da_regra_de_classificacao(self):
        quadro = {"vagas_imediatas": 1, "cadastro_reserva": False, "modalidades": None}
        tecnico = job.dados_da_vaga(
            {"codigo": "180250", "cargo": "TÉCNICO DE ENFERMAGEM DO TRABALHO", "quadro": quadro}
        )
        self.assertEqual(tecnico["nivel"], "tecnico")
        superior = job.dados_da_vaga({"codigo": "179698", "cargo": "MÉDICO DO TRABALHO (Nível Superior)"}, {})
        self.assertEqual((superior["nivel"], superior["vagas_imediatas"]), ("superior", None))
        self.assertIsNone(job.dados_da_vaga({"codigo": "1", "cargo": "Engenheiro"}, {})["nivel"])
        self.assertEqual(job.dados_da_vaga({"codigo": "1", "cargo": None}, {"nivel_padrao": "medio"})["nivel"], "medio")

    def test_a_vaga_leva_as_cotas_da_regra_de_classificacao(self):
        cotas = {"acumulo": "MAIOR_PERCENTUAL", "percentuais": {"PP": 25, "PCD": 5}}
        self.assertEqual(job.dados_da_vaga({"codigo": "1"}, {"cotas": cotas})["cotas"], cotas)
        self.assertIsNone(job.dados_da_vaga({"codigo": "1"}, {})["cotas"])
        self.assertIsNone(job.dados_da_vaga({"codigo": "1"})["cotas"])

    def test_le_os_inscritos_em_partes_com_o_quadro_da_vaga_e_o_mesmo_resultado(self):
        """A vaga lida em partes (20261014110000) dá o mesmo cálculo que lida de uma vez."""
        candidatos = [candidato(i, f"{10 + i},0/30,0") for i in range(1, 8)]
        quadro = {"vagas_imediatas": 2, "cadastro_reserva": False, "modalidades": {"Ampla Concorrência": 2}}
        anterior = {candidatos[0]["id"]: {"situacao": "NO_LOTE", "posicao": 7, "lote": 1}}
        chamadas = []

        def banco(funcao, corpo):
            if funcao == "pre_classificacao_ler_colunas":
                return {"colunas": []}
            self.assertEqual(funcao, "pre_classificacao_ler_candidatos")
            chamadas.append(corpo)
            apos, limite = corpo.get("p_apos"), corpo["p_limite"]
            resto = [c for c in candidatos if apos is None or c["id"] > apos]
            parte = {"candidatos": resto[:limite], "mais": len(resto) > limite}
            if apos is None:
                parte.update(
                    vaga={"cargo": "CARGO 1: QUÍMICO (Nível Superior)", "quadro": quadro},
                    anterior=anterior,
                    decisoes={},
                )
            return parte

        def calcular(tamanho):
            chamadas.clear()
            gravados = {}
            # Sem cargo nem quadro na lista do edital: vêm com os inscritos.
            vaga = {"codigo": "179698", "candidatos_ativos": 7, "ultimo_lote": 1}
            with mock.patch.object(job, "TAMANHO_DA_PARTE", tamanho):
                job.processar_edital(
                    banco,
                    edital_93(vagas=[vaga]),
                    "2026-10-06",
                    True,
                    lambda codigo, r: gravados.setdefault(codigo, job.payload_da_vaga(r)),
                )
            return gravados, [c.get("p_apos") for c in chamadas]

        em_partes, apos = calcular(3)
        # 7 inscritos em partes de 3: 3 chamadas, cada uma depois do último id da anterior.
        self.assertEqual(apos, [None, candidatos[2]["id"], candidatos[5]["id"]])
        resumo, linhas = em_partes["179698"]
        self.assertEqual(sorted(linha["id"] for linha in linhas), [c["id"] for c in candidatos])
        self.assertEqual(resumo["tamanho"], 2)  # as 2 vagas imediatas do quadro lido com a vaga
        # De uma vez (uma parte só) o resultado é idêntico.
        de_uma_vez, apos = calcular(5000)
        self.assertEqual(apos, [None])
        self.assertEqual(de_uma_vez, em_partes)

        lidos = job.ler_candidatos(banco, edital_93(), {"codigo": "179698"}, 2)
        self.assertEqual([c["id"] for c in lidos["candidatos"]], [c["id"] for c in candidatos])
        self.assertNotIn("mais", lidos)
        self.assertEqual((lidos["vaga"]["quadro"], lidos["anterior"], lidos["decisoes"]), (quadro, anterior, {}))

    def test_a_gravacao_leva_a_linha_do_quadro_lida_com_a_vaga(self):
        """O banco não acha a linha do quadro de novo: o job manda a que leu (20261014130000)."""
        candidatos = [candidato(i, f"{10 + i},0/30,0") for i in range(1, 4)]
        id_quadro = "00000000-0000-4000-a000-00000000q001".replace("q", "0")

        def gravar_com(quadro):
            def banco(funcao, corpo):
                return {"candidatos": candidatos, "vaga": {"cargo": "CARGO 1", "quadro": quadro}, "anterior": {}}

            gravados = {}
            job.processar_edital(
                banco,
                edital_93(vagas=[{"codigo": "179698", "candidatos_ativos": 3, "ultimo_lote": 0}]),
                "2026-10-06",
                True,
                lambda codigo, r: gravados.setdefault(codigo, job.payload_da_vaga(r)),
            )
            return gravados["179698"][0]

        com_quadro = {"id": id_quadro, "vagas_imediatas": 1, "cadastro_reserva": False, "modalidades": None}
        self.assertEqual(gravar_com(com_quadro)["quadro"], id_quadro)
        # Vaga sem linha do quadro: a chave vai nula (o banco grava sem quadro, sem procurar de novo).
        resumo = gravar_com(None)
        self.assertIn("quadro", resumo)
        self.assertIsNone(resumo["quadro"])
        # Quem não informa (ex.: o treinamento) não manda a chave: o banco acha a linha.
        sem = {"resumo": {"tamanho": 1, "descricao": "", "por_modalidade": None, "acima_do_corte": 0, "avisos": []}}
        self.assertNotIn("quadro", job.payload_da_vaga({**sem, "linhas": []})[0])

    def test_a_leitura_em_partes_para_sem_mais_e_recusa_parte_fora_de_ordem(self):
        def banco(funcao, corpo):
            if corpo.get("p_apos") is None:
                return {"candidatos": [{"id": "b"}], "mais": True}
            return {"candidatos": [{"id": "a"}], "mais": False}

        with self.assertRaises(RuntimeError):
            job.ler_candidatos(banco, {"id": E93}, {"codigo": "1"}, 1)
        # Sem "mais" (banco antigo ou dados de treinamento), uma chamada só.
        so_uma = []
        lidos = job.ler_candidatos(
            lambda f, c: so_uma.append(c) or {"candidatos": [{"id": "x"}]}, {"id": E93}, {"codigo": "1"}
        )
        self.assertEqual((len(so_uma), so_uma[0]["p_limite"], lidos["candidatos"]), (1, 500, [{"id": "x"}]))

    def test_grava_as_sugestoes_da_ficha_pelas_respostas(self):
        regra = {
            **REGRA,
            "blocos": [{"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Informe os cursos"]}],
        }
        edital = {**edital_93(), "regra": {"versao": 3, "situacao": "CONFERIDA", "configuracao": regra}}
        com_curso = candidato(1, "24,0/30,0")
        com_curso["colunas"]["Pergunta 15 - Informe os cursos (nome e carga horária)"] = '"NR-10 120h"'
        banco = BancoFalso([edital], {"179698": [com_curso, candidato(2, "22,0/30,0")]})
        codigo, saida = rodar(banco, ["--editais", "93/2026"])
        self.assertEqual(codigo, 0)
        [gravacao] = banco.de("gravar_sugestoes_da_ficha")
        self.assertEqual(gravacao["p_vaga"], "179698")
        self.assertEqual(
            gravacao["p_sugestoes"],
            [
                {
                    "id": com_curso["id"],
                    "blocos": {"CURSOS": [{"nome": "NR-10", "horas": 120, "aceito": True, "da_resposta": True}]},
                }
            ],
        )
        self.assertIn("sugestões da ficha: 1 candidato(s)", saida)
        self.assertNotIn("sugestoes", banco.de("finalizar_pre_classificacao")[0]["p_editais"][0])

    def test_le_so_as_colunas_da_regra_e_o_resultado_e_o_mesmo(self):
        """p_colunas (20261014220000): só as colunas que a regra olha; a gravação é idêntica à leitura completa."""
        regra = {
            **REGRA,
            "provisoria": {
                **REGRA["provisoria"],
                "eliminacao_automatica": REGRA["provisoria"]["eliminacao_automatica"]
                + [{"codigo": "SEM_MEDIO", "pergunta": "Você possui Ensino Médio", "quando": ["Não"], "motivo": "x"}],
                "nota_declarada": [
                    {"parcial": "CURSOS", "pergunta": "Selecione a pontuação", "tipo": "OPCAO", "pontos": {"10": 10}}
                ],
            },
            "blocos": [
                {"codigo": "MODALIDADE", "tipo": "MODALIDADE", "perguntas": ["Indique em qual sistema"]},
                {"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Informe os cursos"]},
            ],
        }
        edital = {**edital_93(), "regra": {"versao": 3, "situacao": "CONFERIDA", "configuracao": regra}}
        candidatos = []
        for i, (medio, pontos, sistema) in enumerate([("Sim", "10", "Ampla"), ("Não", "10", "PcD"), ("Sim", "", "")]):
            c = candidato(i + 1, f"{20 + i},0/30,0")
            c["colunas"].update(
                {
                    "Pergunta 5 - Você possui Ensino Médio completo?": medio,
                    "Pergunta 9 - Selecione a pontuação relativa aos cursos": pontos,
                    "Pergunta 11 - Indique em qual sistema de concorrência": sistema,
                    "Pergunta 15 - Informe os cursos (nome e carga horária)": '"NR-10 120h"',
                    "Justificativa - Pergunta 5": "longa " * 50,
                    "MARCADORES": "x",
                    "SITUAÇÃO - NIVEL MÉDIO": "Finalizado",
                }
            )
            candidatos.append(c)

        def gravacoes(banco):
            rodar(banco, ["--editais", "93/2026"])
            sem_execucao = [
                [{k: v for k, v in g.items() if k != "p_execucao"} for g in banco.de(f)]
                for f in ("gravar_pre_classificacao_vaga", "gravar_sugestoes_da_ficha")
            ]
            self.assertTrue(all(sem_execucao))
            return sem_execucao

        enxuto = BancoFalso([edital], {"179698": candidatos})
        completo = BancoFalso([edital], {"179698": candidatos})
        lido_enxuto = gravacoes(enxuto)
        # A leitura completa (colunas=None): todas as colunas de cada inscrito.
        with mock.patch.object(job, "colunas_do_edital", return_value=None):
            self.assertEqual(lido_enxuto, gravacoes(completo))
        [pedido] = enxuto.de("pre_classificacao_ler_candidatos")
        self.assertEqual(
            sorted(pedido["p_colunas"]),
            sorted(
                [
                    "SITUAÇÃO",
                    "NOTA - Questionário",
                    "SITUAÇÃO - NIVEL MÉDIO",
                    "Pergunta 5 - Você possui Ensino Médio completo?",
                    "Pergunta 9 - Selecione a pontuação relativa aos cursos",
                    "Pergunta 11 - Indique em qual sistema de concorrência",
                    "Pergunta 15 - Informe os cursos (nome e carga horária)",
                ]
            ),
        )
        self.assertNotIn("p_colunas", completo.de("pre_classificacao_ler_candidatos")[0])

    def test_no_fim_do_robo_pula_o_edital_sem_mudanca(self):
        sem_mudanca = {**edital_93(), "sem_mudanca": True}
        banco = BancoFalso([sem_mudanca], CANDIDATOS)
        codigo, saida = rodar(banco, ["--apos-robo"])
        self.assertEqual(codigo, 0)
        self.assertIn("Sem mudança desde a última triagem de hoje", saida)
        self.assertEqual(banco.de("iniciar_pre_classificacao"), [])
        self.assertEqual(banco.de("pre_classificacao_ler_candidatos"), [])
        # Com outro edital que mudou, só ele é recalculado.
        fcc = {**edital_93(), "id": EFCC, "rotulo": "FCC"}
        banco = BancoFalso([sem_mudanca, fcc], CANDIDATOS)
        codigo, saida = rodar(banco, ["--apos-robo"])
        self.assertEqual(codigo, 0)
        self.assertEqual({g["p_edital"] for g in banco.de("gravar_pre_classificacao_vaga")}, {EFCC})

    def test_sem_bloco_de_itens_nao_grava_sugestoes(self):
        banco = BancoFalso([edital_93()], CANDIDATOS)
        rodar(banco, ["--editais", "93/2026"])
        self.assertEqual(banco.de("gravar_sugestoes_da_ficha"), [])

    def test_o_resumo_nao_tem_dado_pessoal(self):
        banco = BancoFalso([edital_93()], CANDIDATOS)
        _codigo, saida = rodar(banco, [])
        self.assertNotRegex(saida, r"@|\d{11}")
        self.assertNotIn("Cancelou", saida)


if __name__ == "__main__":
    unittest.main()
