"""
Testes do modo "só anexos" do robô da Empregare (scripts/robo-empregare/so_anexos.py):
não exporta nem grava a carga, nunca reduz anexos, o seco não grava, sem códigos
relê só os suspeitos (DATA DE RESPOSTA) e quem não foi relido sai no relatório.
Portal e banco falsos; nada fala com a Empregare nem com o Supabase.

    python -m pytest tests/python/test_so_anexos.py
"""

import contextlib
import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "python"))

import anexos_empregare as anexos  # noqa: E402
import robo_empregare  # noqa: E402
import so_anexos  # noqa: E402

from monitora import execucao  # noqa: E402

VAGA = "182514"
BASE = "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?"


def link(arquivo, pergunta, token="TKfict"):
    return f"{BASE}arquivo={arquivo}&nome=Case&token={token}&questionarioRespostaID=9&perguntaID={pergunta}"


def gravado(pergunta, numero, arquivo):
    """Um anexo como listar_anexos_empregare devolve: [pergunta, número, hash do arquivo, hash do link]."""
    return [pergunta, numero, so_anexos.hash16(arquivo), so_anexos.hash16(link(arquivo, pergunta))]


def capturado(pergunta, numero, arquivo, token="TKfict"):
    return {
        "pergunta": pergunta,
        "ordem": int(pergunta),
        "arquivo": numero,
        "enunciado": f"Pergunta {pergunta}",
        "link": link(arquivo, pergunta, token),
    }


class PortalFalso:
    """Só o que o modo anexos pode usar; exportar a vaga reprova o teste."""

    def __init__(self, respostas):
        self.ids_das_vagas = {}
        self.respostas = respostas
        self.localizadas = []
        self.capturadas = []

    def localizar_vaga(self, codigo):
        self.localizadas.append(codigo)
        return f"Id{codigo}|"

    def capturar_candidatos(self, codigo, total=None):
        assert self.ids_das_vagas.get(codigo), "capturar_candidatos sem o identificador interno"
        self.capturadas.append(codigo)
        return {"vaga_interno": self.ids_das_vagas[codigo], "candidatos": {}, "respostas": dict(self.respostas)}

    def exportar_vaga(self, codigo):
        raise AssertionError("o modo anexos não pode exportar a vaga")


class BancoFalso:
    PROIBIDAS = {"gravar_lote_empregare", "fechar_vaga_empregare"}

    def __init__(self, listado, situacao_final="CONCLUIDA", invalidadas=0, vagas=None):
        self.listado = listado
        self.vagas = vagas if vagas is not None else [{"vaga": VAGA, "edital": "114/2026"}]
        self.situacao_final = situacao_final
        self.invalidadas = invalidadas
        self.chamadas = []

    def __call__(self, _config, funcao, corpo, tentativas=None):
        assert funcao not in self.PROIBIDAS, f"o modo anexos não pode chamar {funcao}"
        self.chamadas.append((funcao, corpo))
        if funcao == "listar_anexos_empregare":
            return self.listado
        if funcao == "listar_vagas_empregare":
            return {"vagas": self.vagas}
        if funcao == "gravar_anexos_empregare":
            return {
                "respostas": len(corpo["p_respostas"]),
                "anexos": sum(len(r["anexos"]) for r in corpo["p_respostas"]),
                "leituras_invalidadas": self.invalidadas,
            }
        if funcao == "finalizar_sync_empregare":
            return {"situacao": self.situacao_final}
        return {}

    def nomes(self):
        return [f for f, _ in self.chamadas]

    def gravados(self):
        return [r["codigo"] for f, c in self.chamadas if f == "gravar_anexos_empregare" for r in c["p_respostas"]]


def listado(candidatos, conhecida=True):
    return {
        "vaga": VAGA,
        "conhecida": conhecida,
        "vaga_interno": None,
        "colunas": ["Pergunta 16 - Pergunta 16", "Pergunta 18 - Pergunta 18"],
        "ativos": 10,
        "suspeitos": sum(1 for c in candidatos if c.get("suspeito")),
        "sem_captura": 0,
        "nao_encontrados": [],
        "candidatos": candidatos,
    }


def candidato(codigo, anexos_gravados, perguntas=25, suspeito=True, resposta="8037239"):
    return {
        "codigo": codigo,
        "suspeito": suspeito,
        "respostas": [{"resposta": resposta, "perguntas": perguntas, "anexos": anexos_gravados}],
    }


def na_lista(*codigos):
    return {c: {"pessoa": "", "respostas": [{"id": "8037239", "token": "TKfict", "vaga": ""}]} for c in codigos}


class Args:
    def __init__(self, candidatos=(), seco=False, vagas=(VAGA,), editais=(), limite=60):
        self.candidatos = list(candidatos)
        self.seco = seco
        self.vagas = list(vagas)
        self.editais = list(editais)
        self.limite = limite


class ModoAnexos(unittest.TestCase):
    def setUp(self):
        self.logs = []
        self.resumo = []
        self.lidos = []  # (vaga, códigos pedidos, prioridades)
        self.capturas = {}
        self.antigo = anexos.capturar_anexos

        def capturar(_portal, codigo, respostas, _registrar, _prazo, agora=None, prioridades="—"):
            self.lidos.append((codigo, sorted(respostas), prioridades))
            return {c: v for c, v in self.capturas.items() if c in respostas}

        anexos.capturar_anexos = capturar

    def tearDown(self):
        anexos.capturar_anexos = self.antigo

    def rodar(self, banco, portal, args):
        return so_anexos.executar(
            args,
            {},
            lambda: contextlib.nullcontext(portal),
            self.logs.append,
            self.resumo.extend,
            chamar=banco,
            agora=lambda: 0.0,
            ids={"sync": "gh-20261020T120000-abcdef12", "tipo": "GITHUB", "usuario": None, "url": None},
        )

    def releitura(self, codigo, *itens, perguntas=25):
        self.capturas[codigo] = [
            {"resposta": "8037239", "impressao": None, "perguntas": perguntas, "anexos": list(itens)}
        ]

    def test_nao_exporta_nem_grava_a_carga_e_grava_so_os_anexos(self):
        banco = BancoFalso(listado([candidato("2160872", [gravado("10", 1, "a.pdf")], perguntas=23)]))
        portal = PortalFalso(na_lista("2160872"))
        self.releitura("2160872", capturado("10", 1, "a.pdf"), capturado("16", 1, "b.pdf"), capturado("18", 1, "c.pdf"))
        self.assertEqual(self.rodar(banco, portal, Args(candidatos=["2160872"])), 0)
        nomes = banco.nomes()
        # A lista de vagas (só leitura) vem antes: é ela que marca o edital congelado.
        self.assertEqual(nomes[:2], ["listar_vagas_empregare", "iniciar_sync_empregare"])
        self.assertEqual(banco.chamadas[0][1]["p_vagas"], [VAGA])
        self.assertEqual(nomes[-1], "finalizar_sync_empregare")
        self.assertNotIn("gravar_lote_empregare", nomes)
        self.assertNotIn("fechar_vaga_empregare", nomes)
        inicio = banco.chamadas[1][1]
        self.assertEqual(inicio["p_filtro"]["so_anexos"], True)
        self.assertEqual(inicio["p_vagas_pedidas"], 1)
        self.assertEqual(banco.gravados(), ["2160872"])
        fim = banco.chamadas[-1][1]
        self.assertEqual((fim["p_vagas_baixadas"], fim["p_vagas_falha"], fim["p_erro"]), (1, 0, None))
        # Releitura forçada: sem prioridades (nada de "já lida").
        self.assertEqual(self.lidos, [(VAGA, ["2160872"], None)])
        # Vaga sem identificador gravado: localizada (só leitura) antes da lista.
        self.assertEqual(portal.localizadas, [VAGA])
        texto = "\n".join(self.logs + self.resumo)
        self.assertIn("candidato 2160872: 2 anexo(s) novo(s) · 0 alterado(s) · 0 removido(s) · perguntas 23→25", texto)
        self.assertIn("não mudou situação, ativos, lote nem triagem", texto)

    def test_nunca_reduz_anexos(self):
        banco = BancoFalso(
            listado(
                [
                    candidato(
                        "2160872", [gravado("10", 1, "a.pdf"), gravado("16", 1, "b.pdf"), gravado("18", 1, "c.pdf")]
                    )
                ]
            ),
            "PARCIAL",
        )
        self.releitura("2160872", capturado("10", 1, "a.pdf"), capturado("16", 1, "b.pdf"))  # perdeu a 18
        self.assertEqual(self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872"])), 2)
        self.assertNotIn("gravar_anexos_empregare", banco.nomes())
        self.assertIn("BLOQUEADO", "\n".join(self.logs))

    def test_menos_perguntas_tambem_bloqueia_e_fecha_parcial(self):
        banco = BancoFalso(listado([candidato("2160872", [gravado("10", 1, "a.pdf")], perguntas=25)]), "PARCIAL")
        self.releitura("2160872", capturado("10", 1, "a.pdf"), capturado("16", 1, "b.pdf"), perguntas=20)
        self.assertEqual(self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872"])), 2)
        self.assertNotIn("gravar_anexos_empregare", banco.nomes())
        self.assertEqual(banco.chamadas[-1][1]["p_vagas_falha"], 1)
        self.assertTrue(any("Bloqueados" in l and f"{VAGA}/2160872" in l for l in self.resumo))

    def test_seco_compara_sem_gravar_nem_abrir_execucao(self):
        banco = BancoFalso(listado([candidato("2160872", [gravado("10", 1, "a.pdf"), gravado("16", 1, "b.pdf")])]))
        self.releitura(
            "2160872", capturado("10", 1, "a.pdf"), capturado("16", 1, "outro.pdf"), capturado("18", 1, "c.pdf")
        )
        saida = self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872"], seco=True))
        self.assertEqual(saida, 0)
        self.assertEqual(banco.nomes(), ["listar_vagas_empregare", "listar_anexos_empregare"])
        texto = "\n".join(self.logs + self.resumo)
        self.assertIn("1 anexo(s) novo(s) · 1 alterado(s) · 0 removido(s)", texto)
        self.assertIn("SECO: nada foi gravado.", texto)

    def test_sem_codigos_rele_so_os_suspeitos(self):
        banco = BancoFalso(
            listado(
                [
                    candidato("2160872", [gravado("10", 1, "a.pdf")], suspeito=True),
                    candidato("2160999", [gravado("10", 1, "z.pdf")], suspeito=False),
                ]
            )
        )
        self.releitura("2160872", capturado("10", 1, "a.pdf"))
        self.rodar(banco, PortalFalso(na_lista("2160872", "2160999")), Args())
        self.assertEqual(banco.chamadas[2], ("listar_anexos_empregare", {"p_vaga": VAGA, "p_codigos": None}))
        self.assertEqual(self.lidos, [(VAGA, ["2160872"], None)])
        self.assertEqual(banco.gravados(), ["2160872"])  # sem mudança: grava a captura de hoje

    def test_quem_nao_tem_resposta_na_lista_sai_como_nao_relido(self):
        banco = BancoFalso(
            listado([candidato("2160872", [gravado("10", 1, "a.pdf")]), candidato("2160873", [])]), "PARCIAL"
        )
        self.releitura("2160872", capturado("10", 1, "a.pdf"))
        saida = self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872", "2160873", "9999999"]))
        self.assertEqual(saida, 2)
        self.assertEqual(banco.gravados(), ["2160872"])
        texto = "\n".join(self.resumo)
        self.assertIn(f"Não relidos (sem resposta na lista, falha ou tempo) vaga/candidato (1): {VAGA}/2160873", texto)
        self.assertIn("Candidatos pedidos que não estão ativos nas vagas (1): 9999999", texto)

    def test_vaga_sem_carga_falha_sem_entrar_na_lista(self):
        banco = BancoFalso(listado([], conhecida=False), "FALHOU")
        portal = PortalFalso({})
        self.assertEqual(self.rodar(banco, portal, Args(candidatos=["2160872"])), 1)
        self.assertEqual(portal.capturadas, [])
        self.assertEqual(banco.chamadas[-1][1]["p_vagas_baixadas"], 0)

    def test_edital_congelado_sem_liberacao_recusa_sem_abrir_execucao_nem_a_empregare(self):
        banco = BancoFalso(listado([]), vagas=[{"vaga": VAGA, "edital": "114/2026", "congelada": True}])
        portal = PortalFalso({})
        self.assertEqual(self.rodar(banco, portal, Args(candidatos=["2160872"])), 1)
        self.assertEqual(banco.nomes(), ["listar_vagas_empregare"])
        self.assertEqual(portal.capturadas, [])
        self.assertTrue(any("inscrições congeladas em 114/2026" in l for l in self.resumo))

    def test_edital_congelado_no_seco_so_compara(self):
        banco = BancoFalso(
            listado([candidato("2160872", [gravado("10", 1, "a.pdf")])]),
            vagas=[{"vaga": VAGA, "edital": "114/2026", "congelada": True}],
        )
        self.releitura("2160872", capturado("10", 1, "a.pdf"))
        saida = self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872"], seco=True))
        self.assertEqual(saida, 0)
        self.assertEqual(banco.nomes(), ["listar_vagas_empregare", "listar_anexos_empregare"])

    def test_edital_congelado_com_liberacao_registra_o_uso_e_grava(self):
        banco = BancoFalso(
            listado([candidato("2160872", [gravado("10", 1, "a.pdf")])]),
            vagas=[{"vaga": VAGA, "edital": "114/2026", "congelada": True, "liberada": True}],
        )
        self.releitura("2160872", capturado("10", 1, "a.pdf"))
        args = Args(candidatos=["2160872"])
        args.forcar_congelado = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        usos = []
        saida = so_anexos.executar(
            args,
            {},
            lambda: contextlib.nullcontext(PortalFalso(na_lista("2160872"))),
            self.logs.append,
            self.resumo.extend,
            chamar=banco,
            agora=lambda: 0.0,
            ids={"sync": "gh-20261022T120000-abcdef12", "tipo": "GITHUB", "usuario": None, "url": None},
            liberar=lambda sync: usos.append(sync) or "Override registrado.",
        )
        self.assertEqual(saida, 0)
        self.assertEqual(banco.chamadas[0][1]["p_liberacao"], args.forcar_congelado)
        self.assertEqual(usos, ["gh-20261022T120000-abcdef12"])
        self.assertTrue(banco.chamadas[1][1]["p_filtro"]["forcar_congelado"])
        self.assertEqual(banco.gravados(), ["2160872"])

    def test_interrupcao_do_github_fecha_a_execucao_com_erro(self):
        banco = BancoFalso(listado([candidato("2160872", [gravado("10", 1, "a.pdf")])]))

        def cancelado(*_a, **_k):
            raise execucao.ExecucaoInterrompida("execução interrompida (SIGTERM)")

        anexos.capturar_anexos = cancelado
        self.assertEqual(self.rodar(banco, PortalFalso(na_lista("2160872")), Args(candidatos=["2160872"])), 1)
        self.assertEqual(banco.nomes()[-1], "finalizar_sync_empregare")
        self.assertIn("SIGTERM", banco.chamadas[-1][1]["p_erro"])

    def test_editais_usam_a_lista_de_vagas_so_de_leitura(self):
        banco = BancoFalso(listado([]))
        self.rodar(banco, PortalFalso({}), Args(vagas=(), editais=["114/2026"]))
        self.assertEqual(banco.chamadas[0][0], "listar_vagas_empregare")


class Comparacao(unittest.TestCase):
    def test_token_novo_no_link_nao_e_arquivo_alterado(self):
        guardado = so_anexos.gravado_por_candidato(listado([candidato("1", [gravado("16", 1, "b.pdf")])]))["1"]
        lida = [{"resposta": "8037239", "perguntas": 25, "anexos": [capturado("16", 1, "b.pdf", token="OUTRO")]}]
        d = so_anexos.comparar(guardado, lida)
        self.assertEqual((d["novos"], d["alterados"], d["removidos"], d["reduz"], d["mudou"]), (0, 0, 0, False, False))

    def test_arquivo_trocado_e_alterado_e_resposta_nova_e_novo(self):
        guardado = so_anexos.gravado_por_candidato(listado([candidato("1", [gravado("16", 1, "b.pdf")])]))["1"]
        lida = [
            {"resposta": "8037239", "perguntas": 25, "anexos": [capturado("16", 1, "b2.pdf")]},
            {"resposta": "9000000", "perguntas": 3, "anexos": [capturado("2", 1, "x.pdf")]},
        ]
        d = so_anexos.comparar(guardado, lida)
        self.assertEqual((d["novos"], d["alterados"], d["removidos"], d["reduz"]), (1, 1, 0, False))

    def test_hash_e_o_mesmo_do_banco(self):
        # left(encode(sha256(convert_to(x, 'UTF8')), 'hex'), 16)
        self.assertEqual(so_anexos.hash16("a.pdf"), "a7949e623819aa32")
        self.assertEqual(so_anexos.arquivo_do_link(link("a%20b.pdf", "16")), "a%20b.pdf")
        self.assertEqual(so_anexos.arquivo_do_link("sem-parametro"), "sem-parametro")

    def test_codigos_em_linhas_curtas(self):
        linhas = so_anexos.em_linhas("X", [str(1000000 + i) for i in range(90)])
        self.assertEqual(len(linhas), 3)
        self.assertTrue(all(len(l) < 600 for l in linhas))


class GravarAnexosConta(unittest.TestCase):
    def test_soma_as_leituras_invalidadas(self):
        banco = BancoFalso(listado([]), invalidadas=2)
        totais = {}
        n = anexos.gravar_anexos(
            {},
            "gh-x",
            VAGA,
            {
                "1": [
                    {"resposta": "8037239", "impressao": None, "perguntas": 1, "anexos": [capturado("16", 1, "b.pdf")]}
                ]
            },
            [],
            banco,
            lambda _t: None,
            totais=totais,
        )
        self.assertEqual((n, totais), (1, {"leituras_invalidadas": 2, "falhou": False}))


class Argumentos(unittest.TestCase):
    def test_entrada_do_modo(self):
        a = robo_empregare.argumentos(
            ["--so-anexos", "--vagas", VAGA, "--candidatos", "2160872, 2160872;2160873", "--seco"]
        )
        self.assertEqual((a.so_anexos, a.seco, a.candidatos), (True, True, ["2160872", "2160873"]))
        for errado in (
            ["--candidatos", "2160872"],
            ["--so-anexos"],
            ["--so-anexos", "--vagas", VAGA, "--forcar"],
            ["--so-anexos", "--vagas", VAGA, "--anexos"],
            ["--so-anexos", "--vagas", VAGA, "--candidatos", "abc"],
        ):
            with self.assertRaises(SystemExit, msg=errado):
                robo_empregare.argumentos(errado)


if __name__ == "__main__":
    unittest.main()
