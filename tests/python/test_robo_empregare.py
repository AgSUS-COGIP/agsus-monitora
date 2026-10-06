"""
Testes do robô da Empregare (scripts/robo-empregare/): leitura do Excel com
planilha falsa gerada aqui (dados fictícios), chave natural, mascaramento do
log, escolha da exportação na Central e o fluxo de uma vaga com o banco falso.
Nada fala com a Empregare nem com o Supabase.

    python -m pytest tests/python          (ou: python -m unittest discover -s tests/python)

A leitura do Excel precisa de pandas e openpyxl
(pip install -r scripts/robo-empregare/requirements.txt); sem eles, esses testes são pulados.
"""

import hashlib
import importlib.util
import os
import pathlib
import sys
import tempfile
import unittest
from datetime import datetime

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
_PASTA = _RAIZ / "scripts" / "robo-empregare"
sys.path.insert(0, str(_PASTA))
sys.path.insert(0, str(_RAIZ / "python"))

import navegador_empregare as nav  # noqa: E402
import planilha_empregare as pl  # noqa: E402

from monitora import mascaramento  # noqa: E402

TEM_PANDAS = all(importlib.util.find_spec(m) for m in ("pandas", "openpyxl"))
CPF_FICTICIO = "00000000191"  # CPF de teste conhecido, não pertence a ninguém


def _sha(prefixo, valor):
    return hashlib.sha256(f"empregare:{prefixo}:{valor}".encode()).hexdigest()


class ChaveNatural(unittest.TestCase):
    def test_codigo_vem_primeiro(self):
        self.assertEqual(pl.chave_natural("12345", CPF_FICTICIO, "a@b.invalid"), ("cod:12345", "CODIGO"))
        self.assertEqual(pl.chave_natural(12345.0), ("cod:12345", "CODIGO"))

    def test_cpf_vira_hash_nunca_em_claro(self):
        chave, tipo = pl.chave_natural(None, "000.000.001-91")
        self.assertEqual(tipo, "CPF")
        self.assertEqual(chave, "cpf:" + _sha("cpf", CPF_FICTICIO))
        self.assertNotIn(CPF_FICTICIO, chave)
        # Excel numérico perde os zeros à esquerda: volta a 11 dígitos.
        self.assertEqual(pl.chave_natural(None, 191), (chave, "CPF"))

    def test_email_minusculo_em_hash(self):
        chave, tipo = pl.chave_natural(None, None, " Pessoa@Exemplo.INVALID ")
        self.assertEqual((chave, tipo), ("email:" + _sha("email", "pessoa@exemplo.invalid"), "EMAIL"))

    def test_sem_nada_fica_de_fora(self):
        self.assertEqual(pl.chave_natural(None, "123", "sem-arroba"), (None, None))
        self.assertEqual(pl.chave_natural("código com espaço e ç"), (None, None))

    def test_formato_aceito_pelo_banco(self):
        import re

        padrao = re.compile(r"^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$")
        for chave, _ in (
            pl.chave_natural("A-1_2.3"),
            pl.chave_natural(None, CPF_FICTICIO),
            pl.chave_natural(None, None, "x@y.invalid"),
        ):
            self.assertRegex(chave, padrao)


class Colunas(unittest.TestCase):
    def test_nomes_repetidos_e_vazios(self):
        self.assertEqual(
            pl.nomes_unicos(["Pergunta", "pergunta", None, "Pergunta", "Coluna 3"]),
            ["Pergunta", "pergunta (2)", "Coluna 3", "Pergunta (3)", "Coluna 3 (2)"],
        )

    def test_reconhece_colunas_por_nome_sem_acento(self):
        nomes = ["Nome Completo", "E-mail", "CPF (somente números)", "Data de Nascimento", "Etapa Atual"]
        mapa = pl.mapear_colunas(nomes)
        self.assertEqual(mapa["nome"], 0)
        self.assertEqual(mapa["email"], 1)
        self.assertEqual(mapa["cpf"], 2)
        self.assertEqual(mapa["nascimento"], 3)
        self.assertEqual(mapa["situacao"], 4)

    def test_coluna_codigo_com_o_codigo_da_vaga_nao_e_do_candidato(self):
        nomes = ["Código", "Nome", "CPF"]
        valores = [["177979", "177979"], ["A", "B"], ["1", "2"]]
        self.assertNotIn("codigo", pl.mapear_colunas(nomes, valores, "177979"))
        valores[0] = ["901", "902"]
        self.assertEqual(pl.mapear_colunas(nomes, valores, "177979")["codigo"], 0)

    def test_celulas_em_texto_estavel(self):
        self.assertEqual(pl.texto_da_celula(datetime(2026, 10, 5)), "2026-10-05")
        self.assertEqual(pl.texto_da_celula(datetime(2026, 10, 5, 8, 30, 15, 99)), "2026-10-05T08:30:15")
        self.assertEqual(pl.texto_da_celula(42.0), "42")
        self.assertEqual(pl.texto_da_celula(float("nan")), None)
        self.assertEqual(pl.texto_da_celula("  "), None)


@unittest.skipUnless(TEM_PANDAS, "pandas/openpyxl não instalados")
class LeituraDoExcel(unittest.TestCase):
    def _excel(self, abas):
        import pandas as pd

        pasta = tempfile.mkdtemp()
        caminho = os.path.join(pasta, "candidatos_177979.xlsx")
        with pd.ExcelWriter(caminho, engine="openpyxl") as escritor:
            for nome, linhas in abas.items():
                pd.DataFrame(linhas).to_excel(escritor, sheet_name=nome, header=False, index=False)
        return caminho

    def test_planilha_falsa_com_titulo_questionario_e_repetido(self):
        caminho = self._excel(
            {
                "Candidatos": [
                    ["Relatório de candidatos da vaga 177979", None, None, None, None, None, None],
                    [None, None, None, None, None, None, None],
                    ["Nome", "E-mail", "CPF", "Data de Nascimento", "Etapa", "Você tem CNH?", "Você tem CNH?"],
                    [
                        "Pessoa Fictícia Um",
                        "um@exemplo.invalid",
                        CPF_FICTICIO,
                        datetime(1990, 1, 2),
                        "Triagem",
                        "Sim",
                        "B",
                    ],
                    ["Pessoa Fictícia Dois", "dois@exemplo.invalid", None, "03/04/1991", "Inscrito", "Não", None],
                    ["Pessoa Sem Chave", None, None, None, "Inscrito", "Sim", None],
                    [
                        "Pessoa Fictícia Um",
                        "um@exemplo.invalid",
                        CPF_FICTICIO,
                        datetime(1990, 1, 2),
                        "Entrevista",
                        "Sim",
                        "B",
                    ],
                ]
            }
        )
        lido = pl.ler_planilha(caminho, "177979")
        self.assertEqual(lido["colunas"][:5], ["Nome", "E-mail", "CPF", "Data de Nascimento", "Etapa"])
        self.assertEqual(lido["colunas"][5:], ["Você tem CNH?", "Você tem CNH? (2)"])
        self.assertEqual(len(lido["linhas"]), 2)
        self.assertEqual(lido["sem_chave"], 1)
        self.assertEqual(lido["repetidas"], 1)
        um, dois = lido["linhas"]
        self.assertEqual(um["tipo"], "CPF")
        self.assertEqual(um["cpf"], CPF_FICTICIO)
        self.assertEqual(um["nascimento"], "1990-01-02")
        self.assertEqual(um["situacao"], "Entrevista")  # a última linha repetida vale
        self.assertEqual(um["colunas"]["Você tem CNH? (2)"], "B")
        self.assertEqual(dois["tipo"], "EMAIL")
        self.assertEqual(dois["nascimento"], "1991-04-03")
        self.assertNotIn("Você tem CNH? (2)", dois["colunas"])  # vazio não entra

    def test_outra_aba_com_a_mesma_chave_entra_no_candidato(self):
        caminho = self._excel(
            {
                "Candidatos": [
                    ["Código do Candidato", "Nome", "E-mail"],
                    [901, "Pessoa Fictícia Um", "um@exemplo.invalid"],
                    [902, "Pessoa Fictícia Dois", "dois@exemplo.invalid"],
                ],
                "Competências": [
                    ["Código do Candidato", "Competência", "Nota"],
                    [901, "Comunicação", 4],
                    [901, "Trabalho em equipe", 5],
                ],
            }
        )
        lido = pl.ler_planilha(caminho, "177979")
        self.assertEqual(lido["abas"], 2)
        self.assertIn("Competências ›", lido["colunas"])
        um = next(l for l in lido["linhas"] if l["chave"] == "cod:901")
        self.assertEqual(
            um["colunas"]["Competências ›"],
            [
                {"Código do Candidato": "901", "Competência": "Comunicação", "Nota": "4"},
                {"Código do Candidato": "901", "Competência": "Trabalho em equipe", "Nota": "5"},
            ],
        )
        dois = next(l for l in lido["linhas"] if l["chave"] == "cod:902")
        self.assertNotIn("Competências ›", dois["colunas"])

    def test_lotes(self):
        self.assertEqual([len(l) for l in pl.em_lotes(list(range(1201)), 500)], [500, 500, 201])


class Mascaramento(unittest.TestCase):
    def test_tira_email_cpf_telefone_e_credencial(self):
        texto = (
            "falhou para pessoa@exemplo.invalid cpf 000.000.001-91 ou 00000000191, "
            "tel (61) 99999-0000, senha s3gredo! na vaga 177979 edital 80/2026"
        )
        saida = mascaramento.mascarar(texto, credenciais=["s3gredo!"])
        for proibido in ("pessoa@exemplo.invalid", "000.000.001-91", "00000000191", "99999-0000", "s3gredo!"):
            self.assertNotIn(proibido, saida)
        self.assertIn("vaga 177979", saida)
        self.assertIn("80/2026", saida)

    def test_credenciais_do_ambiente(self):
        antigo = dict(os.environ)
        try:
            os.environ["EMPREGARE_EMAIL"] = "robo.ficticio@exemplo.invalid"
            os.environ["EMPREGARE_SENHA"] = "SenhaFicticia#1"
            saida = mascaramento.mascarar("login SenhaFicticia#1 robo.ficticio@exemplo.invalid")
            self.assertNotIn("SenhaFicticia#1", saida)
            self.assertNotIn("robo.ficticio", saida)
        finally:
            os.environ.clear()
            os.environ.update(antigo)

    def test_identificador_da_execucao_passa(self):
        sys.modules.pop("robo_empregare", None)
        if not TEM_PANDAS:
            self.skipTest("robo_empregare importa a leitura do Excel")
        import robo_empregare

        sync = robo_empregare.identificador(datetime(2026, 10, 5, 8, 30, 12), "abcdef123456")
        self.assertEqual(sync, "gh-20261005T083012-abcdef12")
        self.assertEqual(mascaramento.mascarar(sync), sync)

    def test_resumo_do_erro_so_primeira_linha(self):
        erro = RuntimeError("Message: timeout em um@exemplo.invalid\nStacktrace:\n#0 0x55d…")
        self.assertEqual(mascaramento.resumo_do_erro(erro), "RuntimeError: timeout em <e-mail>")


class CentralDeExportacoes(unittest.TestCase):
    def test_le_data_da_central(self):
        self.assertEqual(nav.ler_data_da_central("05/10/2026 08:01"), datetime(2026, 10, 5, 8, 1))
        self.assertEqual(nav.ler_data_da_central("05/10/2026 08:01:30"), datetime(2026, 10, 5, 8, 1, 30))
        self.assertIsNone(nav.ler_data_da_central("ontem"))

    def test_escolhe_a_mais_recente_disponivel_desta_execucao(self):
        desde = datetime(2026, 10, 5, 8, 0)
        linhas = [
            {
                "id": "1",
                "vaga": "177979",
                "origem": nav.ORIGEM_EXPORTACAO,
                "data": "04/10/2026 08:00",
                "situacao": "Disponível",
                "href": "/Exports/Download/1",
            },
            {
                "id": "2",
                "vaga": "177979",
                "origem": nav.ORIGEM_EXPORTACAO,
                "data": "05/10/2026 08:05",
                "situacao": "Disponível",
                "href": "/Exports/Download/2",
            },
            {
                "id": "3",
                "vaga": "177979",
                "origem": nav.ORIGEM_EXPORTACAO,
                "data": "05/10/2026 08:20",
                "situacao": "Disponível",
                "href": "/Exports/Download/3",
            },
            {
                "id": "4",
                "vaga": "177980",
                "origem": nav.ORIGEM_EXPORTACAO,
                "data": "05/10/2026 08:06",
                "situacao": "Processando",
                "href": "",
            },
        ]
        escolhida, motivo = nav.escolher_exportacao(linhas, "177979", desde)
        self.assertEqual((escolhida["id"], motivo), ("3", "ok"))
        self.assertEqual(nav.escolher_exportacao(linhas, "177980", desde), (None, "Processando"))
        # Só a de ontem: ainda não é desta execução.
        self.assertEqual(nav.escolher_exportacao(linhas[:1], "177979", desde), (None, "ainda não listada"))
        # Folga de relógio: 5 min antes do início ainda vale.
        quase = [dict(linhas[0], data="05/10/2026 07:55")]
        self.assertEqual(nav.escolher_exportacao(quase, "177979", desde)[1], "ok")

    def test_espera_o_download_terminar(self):
        pasta = tempfile.mkdtemp()
        relogio = {"t": 0}
        arquivos = iter([[], ["a.xlsx.crdownload"], ["a.xlsx"]])

        def dormir(_):
            relogio["t"] += 1
            for f in os.listdir(pasta):
                os.remove(os.path.join(pasta, f))
            for f in next(arquivos, ["a.xlsx"]):
                open(os.path.join(pasta, f), "w").close()

        self.assertEqual(nav.esperar_download(pasta, set(), 10, lambda: relogio["t"], dormir), "a.xlsx")
        self.assertIsNone(nav.esperar_download(tempfile.mkdtemp(), set(), 3, lambda: relogio["t"], dormir))

    def test_credenciais_faltando_falham_claro(self):
        antigo = dict(os.environ)
        try:
            os.environ.pop("EMPREGARE_EMAIL", None)
            os.environ["EMPREGARE_SENHA"] = "x"
            with self.assertRaises(SystemExit) as falha:
                nav.credenciais()
            self.assertIn("EMPREGARE_EMAIL", str(falha.exception))
            self.assertNotIn("EMPREGARE_SENHA", str(falha.exception))
        finally:
            os.environ.clear()
            os.environ.update(antigo)


@unittest.skipUnless(TEM_PANDAS, "pandas/openpyxl não instalados")
class FluxoDeUmaVaga(unittest.TestCase):
    def setUp(self):
        sys.modules.pop("robo_empregare", None)
        import robo_empregare

        self.robo = robo_empregare
        self.caminho = LeituraDoExcel._excel(
            self,
            {
                "Candidatos": [
                    ["Nome", "E-mail"],
                    *[[f"Pessoa Fictícia {i}", f"p{i}@exemplo.invalid"] for i in range(1, 1203)],
                ]
            },
        )

    def test_grava_em_lotes_e_fecha(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, corpo))
            if funcao == "fechar_vaga_empregare":
                return {"situacao": "GRAVADA", "ativos": 1202, "desativadas": 0}
            return {"situacao": "EM_CARGA", "gravadas": len(corpo["p_linhas"])}

        self.assertEqual(self.robo.gravar_vaga({}, "gh-x", "177979", self.caminho, chamar), "GRAVADA")
        lotes = [c for f, c in chamadas if f == "gravar_lote_empregare"]
        self.assertEqual([len(l["p_linhas"]) for l in lotes], [500, 500, 202])
        self.assertTrue(all(l["p_total"] == 1202 for l in lotes))
        self.assertEqual(chamadas[-1][1]["p_colunas"], ["Nome", "E-mail"])

    def test_trava_para_no_primeiro_lote(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append(funcao)
            return {"situacao": "RECUSADA"}

        self.assertEqual(self.robo.gravar_vaga({}, "gh-x", "177979", self.caminho, chamar), "RECUSADA")
        self.assertEqual(chamadas, ["gravar_lote_empregare", "fechar_vaga_empregare"])

    def test_erro_inesperado_perde_so_a_vaga(self):
        def chamar(_config, funcao, corpo):
            raise ValueError("resposta truncada")

        self.assertEqual(self.robo.gravar_vaga({}, "gh-x", "177979", self.caminho, chamar), "FALHA")

    def test_disparo_e_endereco_da_execucao(self):
        self.assertEqual(self.robo.disparo("agenda"), ("AGENDA", None))
        uid = "0b8f2a8e-1111-4c2d-9e3f-123456789abc"
        self.assertEqual(self.robo.disparo(uid.upper()), ("MONITORA", uid))
        self.assertEqual(self.robo.disparo(""), ("GITHUB", None))
        self.assertEqual(
            self.robo.url_da_execucao(
                {
                    "GITHUB_SERVER_URL": "https://github.com",
                    "GITHUB_REPOSITORY": "AgSUS-COGIP/agsus-monitora",
                    "GITHUB_RUN_ID": "42",
                }
            ),
            "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/42",
        )
        self.assertIsNone(
            self.robo.url_da_execucao(
                {"GITHUB_SERVER_URL": "https://exemplo.invalid", "GITHUB_REPOSITORY": "x", "GITHUB_RUN_ID": "1"}
            )
        )

    def test_argumentos_validam_editais_e_vagas(self):
        args = self.robo.argumentos(["--editais", "80/2026, 81/2026", "--vagas", "177979;177980", "--limite", "5"])
        self.assertEqual((args.editais, args.vagas, args.limite), (["80/2026", "81/2026"], ["177979", "177980"], 5))
        with self.assertRaises(SystemExit):
            self.robo.argumentos(["--editais", "edital oitenta"])
        with self.assertRaises(SystemExit):
            self.robo.argumentos(["--vagas", "17a979"])

    def test_contagem_por_origem_das_vagas(self):
        vagas = [
            {"vaga": "999999101", "origem": "quadro"},
            {"vaga": "999999102", "origem": "quadro"},
            {"vaga": "999999103", "origem": "selecao"},
            {"vaga": "999999104", "origem": "pedida"},
            {"vaga": "999999105"},  # banco antes da migration 20261006080000: sem origem = Seleção
        ]
        self.assertEqual(
            self.robo.contagem_por_origem(vagas),
            "quadro do edital 2 · Seleção 2 · pedidas fora das duas 1",
        )
        self.assertEqual(self.robo.contagem_por_origem([]), "—")
        self.assertEqual(self.robo.contagem_por_origem([{"vaga": "1", "origem": "outra"}]), "outra 1")


if __name__ == "__main__":
    unittest.main()
