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


# Tokens e identificadores FICTÍCIOS (formato do portal, valores inventados).
LINK_1 = "/empresa/curriculo/detalhes?tokenCandidato=TKfict01&id=IDfict01|&candidatura=CDfict01||"
LINK_2 = "/empresa/curriculo/detalhes?tokenCandidato=TKfict02&id=IDfict02|&candidatura=CDfict02||"
LINK_3 = "/empresa/curriculo/detalhes?tokenCandidato=TKfict03&id=IDfict03|&candidatura=CDfict03||"

HTML_DA_LISTA = f"""
<html><body>
<div class="nav"><a class="active" href="#">Todos (4)</a></div>
<ul id="lista">
  <li class="candidato" data-pessoa-id="7000001">
    <img src="foto.png"><span>Pessoa Fictícia Um</span><br>
    <a href="{LINK_1.replace("&", "&amp;")}">Ver detalhes</a>
  </li>
  <li class="candidato">
    <input type="checkbox" data-pessoa-id="7000002" data-tokencandidato="TKfict02">
    <div class="acoes"><a href="https://corporate.empregare.com{LINK_2}">Detalhes</a></div>
  </li>
  <li class="candidato" data-pessoa-id="7000003">
    <a href="{LINK_3}">Detalhes</a>
    <a href="{LINK_3}">Currículo</a>
  </li>
  <li class="candidato"><a href="/empresa/curriculo/detalhes?tokenCandidato=TKsemcodigo&id=X|">Sem código</a></li>
  <li class="candidato" data-pessoa-id="7000004"><a href="javascript:alert(1)">Outro link</a></li>
</ul>
</body></html>
"""


class LinksDaEmpregare(unittest.TestCase):
    def test_id_interno_da_vaga(self):
        self.assertEqual(nav.id_interno_da_vaga("/empresa/vagas/candidaturas/Ab1cD2eF3g|"), "Ab1cD2eF3g|")
        self.assertEqual(
            nav.id_interno_da_vaga("https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1cD2eF3g%7C?m=2"),
            "Ab1cD2eF3g|",
        )
        # O código numérico dá "Sem permissão" no portal: não serve.
        self.assertIsNone(nav.id_interno_da_vaga("/empresa/vagas/candidaturas/180231"))
        self.assertIsNone(nav.id_interno_da_vaga("/empresa/vagas/candidaturas/180231|"))
        self.assertIsNone(nav.id_interno_da_vaga("/empresa/vagas"))
        self.assertIsNone(nav.id_interno_da_vaga("/empresa/vagas/candidaturas/a<b>"))
        self.assertIsNone(nav.id_interno_da_vaga(None))

    def test_link_de_detalhe(self):
        self.assertEqual(nav.link_de_detalhe(LINK_1), nav.URL_BASE + LINK_1)
        self.assertEqual(nav.link_de_detalhe(nav.URL_BASE + LINK_1), nav.URL_BASE + LINK_1)
        self.assertIsNone(nav.link_de_detalhe("https://exemplo.invalid" + LINK_1))
        self.assertIsNone(nav.link_de_detalhe("javascript:alert(1)"))
        self.assertIsNone(nav.link_de_detalhe("/empresa/curriculo/detalhes?id=1"))
        self.assertIsNone(nav.link_de_detalhe(LINK_1 + '"><script>'))

    def test_le_codigo_e_link_de_cada_candidato(self):
        candidatos = nav.ler_candidatos_do_html(HTML_DA_LISTA)
        self.assertEqual(
            candidatos,
            [
                {"codigo": "7000001", "link": nav.URL_BASE + LINK_1},  # &amp; volta a &
                {"codigo": "7000002", "link": nav.URL_BASE + LINK_2},  # código no vizinho do link
                {"codigo": "7000003", "link": nav.URL_BASE + LINK_3},
                {"codigo": "7000003", "link": nav.URL_BASE + LINK_3},
            ],
        )

    def test_bloco_com_dois_codigos_e_ambiguo(self):
        html = f'<div><span data-pessoa-id="1"></span><span data-pessoa-id="2"></span><a href="{LINK_1}">x</a></div>'
        self.assertEqual(nav.ler_candidatos_do_html(html), [])
        self.assertEqual(nav.ler_candidatos_do_html(""), [])

    def test_lista_longa_sem_estourar_a_recursao(self):
        itens = "".join(
            f'<div data-pessoa-id="{i}"><a href="/empresa/curriculo/detalhes?tokenCandidato=T{i}&id=I{i}|">d</a></div>'
            for i in range(1, 3001)
        )
        self.assertEqual(len(nav.ler_candidatos_do_html(f"<main>{itens}</main>")), 3000)

    def test_percorre_paginas_ate_acabar(self):
        paginas = [
            [{"codigo": "1", "link": "a"}, {"codigo": "2", "link": "b"}],
            [{"codigo": "3", "link": "c"}, {"codigo": "1", "link": "outro"}],
            [{"codigo": "3", "link": "c"}],  # só repetidos: fim
            [{"codigo": "4", "link": "d"}],
        ]
        lidas = iter(paginas)
        cliques = []
        resultado = nav.percorrer_paginas(lambda: next(lidas), lambda: cliques.append(1) or True)
        self.assertEqual(resultado, {"1": "a", "2": "b", "3": "c"})
        self.assertEqual(len(cliques), 2)

    def test_para_sem_proxima_pagina_no_limite_e_no_prazo(self):
        def pagina():
            pagina.n += 1
            return [{"codigo": str(pagina.n), "link": "x"}]

        pagina.n = 0
        self.assertEqual(len(nav.percorrer_paginas(pagina, lambda: False)), 1)
        pagina.n = 0
        self.assertEqual(len(nav.percorrer_paginas(pagina, lambda: True, limite=5)), 5)
        pagina.n = 0
        relogio = iter([0, 10, 20, 30])
        self.assertEqual(len(nav.percorrer_paginas(pagina, lambda: True, prazo=15, agora=lambda: next(relogio))), 3)

    def test_mascaramento_tira_tokens_dos_links(self):
        texto = f"falhou em {nav.URL_BASE}{LINK_1} vindo de {nav.URL_CANDIDATURAS}Ab1cD2eF3g|?m=2"
        saida = mascaramento.mascarar(texto)
        for proibido in ("TKfict01", "IDfict01", "CDfict01", "Ab1cD2eF3g"):
            self.assertNotIn(proibido, saida)
        self.assertIn("tokenCandidato=<token>", saida)
        self.assertIn("/empresa/vagas/candidaturas/<id>", saida)
        self.assertEqual(mascaramento.mascarar("p_vaga_id=177979"), "p_vaga_id=177979")


def _item_real(codigo, n):
    """Um candidato no formato real da página de candidaturas (valores fictícios)."""
    href = f"/empresa/curriculo/detalhes?tokenCandidato=TKfict{n}&amp;id=IDfict{n}|&amp;candidatura=CDfict{n}||"
    return f"""
    <div class="curriculo-list-item">
      <div class="list-group-item" data-tokencandidato="TKfict{n}" data-id="IDfict{n}|" data-candidatura="CDfict{n}||">
        <a class="link-curriculo link-absolute" href="{href}" data-tokencandidato="TKfict{n}"
           data-id="IDfict{n}|" data-candidatura="CDfict{n}||"></a>
        <div class="row"><div class="col-md-8">
          <h4 class="nome">Pessoa Fictícia {n}</h4>
          <a href="#" data-pessoaid="{codigo}" class="btn-favoritar"><i class="fa fa-star"></i></a>
        </div><div class="col-md-4">
          <ul class="acoes">
            <li data-pessoa-id="{codigo}" data-candidatura-id="CDfict{n}||"><a href="#">Mover</a></li>
          </ul>
        </div></div>
      </div>
    </div>"""


def _pagina_real(codigos):
    """A lista como o portal monta: páginas de 15 em #curriculo-pagina-N dentro de .curriculo-append."""
    paginas = [codigos[i : i + 15] for i in range(0, len(codigos), 15)]
    corpo = "".join(
        f'<div class="list-group candidatura-group" id="curriculo-pagina-{p + 1}">'
        + "".join(_item_real(c, i + 15 * p) for i, c in enumerate(pagina))
        + "</div>"
        for p, pagina in enumerate(paginas)
    )
    return f'<html><body><nav class="nav"><a href="/empresa/vagas">Vagas</a></nav><div class="curriculo-append">{corpo}</div></body></html>'


class ListaRealDaEmpregare(unittest.TestCase):
    def test_le_pares_do_formato_real(self):
        codigos = [str(3700000 + i) for i in range(20)]
        candidatos, descartados = nav.ler_lista_de_candidatos(_pagina_real(codigos))
        self.assertEqual(descartados, 0)
        self.assertEqual([c["codigo"] for c in candidatos], codigos)
        self.assertEqual(
            candidatos[0]["link"],
            nav.URL_BASE + "/empresa/curriculo/detalhes?tokenCandidato=TKfict0&id=IDfict0|&candidatura=CDfict0||",
        )

    def test_link_fora_do_formato_e_contado_e_item_sem_codigo_fica_de_fora(self):
        html = _pagina_real(["3700001"]).replace("tokenCandidato=TKfict0", "tokenCandidato=TK fict<0>")
        html = html.replace(
            "</div></body>",
            '<div class="curriculo-list-item"><a class="link-curriculo" href="' + LINK_1 + '"></a></div></div></body>',
        )
        candidatos, descartados = nav.ler_lista_de_candidatos(html)
        self.assertEqual((candidatos, descartados), ([], 1))

    def test_rolagem_infinita_ate_parar_de_crescer(self):
        relogio = {"t": 0.0}
        carregados = {"n": 15}
        rolagens = []

        def rolar():
            rolagens.append(1)
            carregados["n"] = min(carregados["n"] + 15, 86)

        def dormir(s):
            relogio["t"] += s

        final = nav.carregar_lista_inteira(
            lambda: carregados["n"], rolar, espera=6, intervalo=0.5, dormir=dormir, agora=lambda: relogio["t"]
        )
        self.assertEqual(final, 86)
        # 5 rolagens que trouxeram mais (30…86) e 2 sem novidade.
        self.assertEqual(len(rolagens), 7)

    def test_para_no_total_esperado_e_no_prazo(self):
        relogio = {"t": 0.0}
        carregados = {"n": 15}

        def rolar():
            carregados["n"] += 15

        def dormir(s):
            relogio["t"] += s

        agora = lambda: relogio["t"]  # noqa: E731
        self.assertEqual(
            nav.carregar_lista_inteira(lambda: carregados["n"], rolar, total=40, dormir=dormir, agora=agora), 45
        )
        carregados["n"] = 15
        relogio["t"] = 0.0
        self.assertLess(
            nav.carregar_lista_inteira(lambda: carregados["n"], rolar, prazo=1.2, dormir=dormir, agora=agora), 90
        )

    def test_portal_espera_rola_e_le_a_lista_inteira(self):
        codigos = [str(3787200 + i) for i in range(86)]

        class DriverFalso:
            def __init__(self):
                self.carregados = 15

            @property
            def page_source(self):
                return _pagina_real(codigos[: self.carregados])

            def execute_script(self, js, *args):
                if js == nav.JS_CONTAR_LINKS:
                    return self.carregados
                if js == nav.JS_ROLAR_LISTA:
                    self.carregados = min(self.carregados + 15, len(codigos))
                return None

        antigos = (nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA)
        nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA = 0.05, 0.01
        try:
            portal = nav.PortalEmpregare("pasta-falsa", lambda _m: None)
            portal.driver = DriverFalso()
            candidatos = portal._carregar_e_ler_pagina(prazo=10**12)
        finally:
            nav.ESPERA_POR_MAIS, nav.INTERVALO_DA_LISTA = antigos
        self.assertEqual(len(candidatos), 86)
        self.assertEqual(portal.descartados, 0)


class PortalFalso(nav.PortalEmpregare):
    """O portal sem Chrome: páginas de HTML fictício e contagem do que aconteceria."""

    def __init__(self, paginas, falha=None):
        self.logs = []
        super().__init__("pasta-falsa", self.logs.append)
        self.paginas = list(paginas)
        self.falha = falha
        self.abertas = []
        self.voltou = 0

    def _abrir_candidaturas(self, ident):
        self.abertas.append(ident)

    def _carregar_e_ler_pagina(self, prazo, total=None):
        if self.falha:
            raise self.falha
        return nav.ler_candidatos_do_html(self.paginas[0] if self.paginas else "")

    def _proxima_pagina(self):
        self.paginas.pop(0)
        return bool(self.paginas)

    def abrir_vagas_anunciadas(self):
        self.voltou += 1


class DiagnosticoDaLista(unittest.TestCase):
    PAGINA = {
        "caminho": "/empresa/vagas/candidaturas/Mc5fictPML0|",
        "titulo": "Candidaturas | Empregare (contato pessoa@exemplo.invalid)",
        "itens": 0,
        "links_curriculo": 0,
        "pessoas": 0,
        "detalhes": 0,
        "pagina1": 0,
        "iframes": 1,
        # Como o portal mostra: contagem antes do texto.
        "abas": ["37 Todos", "32 Interessados", "Pessoa Fictícia 3787275", "0 Triados", "Agendados (2)"],
        "aba_ativa": "37 Todos",
        "etapa": "0",
    }

    def test_linha_segura_com_contagens_e_abas(self):
        fonte = "<html>" + "x" * 94 + "</html>"
        texto = nav.texto_do_diagnostico(dict(self.PAGINA, espera="estourou", janelas=2), fonte)
        for esperado in (
            "página /empresa/vagas/candidaturas/<id>",
            "espera estourou",
            "janelas 2",
            "etapa m=0",
            "itens 0 · a.link-curriculo 0 · li[data-pessoa-id] 0 · links de detalhe 0 · #curriculo-pagina-1 0",
            "iframes 1",
            "abas 5 (ativa: Todos (37)) [Todos (37), Interessados (32), outra, Triados (0), Agendados (2)]",
            "page_source 107 caracteres, curriculo-list-item: não, link-curriculo: não",
        ):
            self.assertIn(esperado, texto)
        for proibido in ("Mc5fictPML0", "pessoa@exemplo.invalid", "Pessoa Fictícia", "3787275"):
            self.assertNotIn(proibido, texto)

    def test_sem_permissao_e_sem_fonte_quando_leu_algo(self):
        texto = nav.texto_do_diagnostico(
            {"caminho": "/Company/Home/SemPermissao?tokenCandidato=TKfict", "titulo": "Sem permissão", "espera": "ok"}
        )
        self.assertIn("página /Company/Home/SemPermissao;", texto)
        self.assertNotIn("TKfict", texto)
        self.assertNotIn("page_source", texto)
        self.assertEqual(
            nav.texto_do_diagnostico({"erro": "JavascriptException"}), "sem diagnóstico (JavascriptException)"
        )

    def test_portal_monta_o_diagnostico_e_le_o_page_source_so_sem_candidatos(self):
        class DriverFalso:
            lido = 0

            @property
            def page_source(self):
                DriverFalso.lido += 1
                return '<div class="curriculo-append"></div>'

            def execute_script(self, js, *args):
                return dict(DiagnosticoDaLista.PAGINA) if js == nav.JS_DIAGNOSTICO_DA_LISTA else None

        portal = nav.PortalEmpregare("pasta-falsa", lambda _m: None)
        portal.driver = DriverFalso()
        portal.diagnostico = {"espera": "estourou", "janelas": 1}
        texto = portal._diagnosticar_lista(0)
        self.assertIn("espera estourou; janelas 1; etapa m=0", texto)
        self.assertIn("page_source 36 caracteres", texto)
        portal._diagnosticar_lista(3)
        self.assertEqual(DriverFalso.lido, 1)

    def test_sem_m_na_url_e_rotulos_fora_das_etapas(self):
        texto = nav.texto_do_diagnostico({"caminho": "/empresa/vagas/candidaturas/X|", "abas": ["Sair", "12"]})
        self.assertIn("etapa sem m", texto)
        self.assertIn("[outra, outra]", texto)

    def test_endereco_abre_direto_a_aba_todos(self):
        self.assertEqual(
            nav.endereco_das_candidaturas("Mc5fictPML0|"),
            "https://corporate.empregare.com/empresa/vagas/candidaturas/Mc5fictPML0|?m=0",
        )
        self.assertTrue(nav.endereco_das_candidaturas("Mc5fictPML0|", 2).endswith("|?m=2"))

    def test_portal_abre_na_aba_todos_sem_procurar_aba(self):
        abertos = []

        class DriverFalso:
            def get(self, url):
                abertos.append(url)

            def execute_script(self, js, *args):
                raise AssertionError("não deve procurar nem clicar em aba")

        portal = nav.PortalEmpregare("pasta-falsa", lambda _m: None)
        portal.driver = DriverFalso()
        portal._voltar_para_a_janela = lambda: 1
        portal._esperar_a_lista = lambda: True
        portal._abrir_candidaturas("Mc5fictPML0|")
        self.assertEqual(abertos, [nav.URL_CANDIDATURAS + "Mc5fictPML0|?m=0"])
        self.assertEqual(portal.diagnostico, {"janelas": 1, "espera": "ok"})

    def test_volta_para_a_janela_do_login(self):
        class Troca:
            def __init__(self, driver):
                self.d = driver

            @property
            def alert(self):
                raise RuntimeError("sem alerta")

            def window(self, h):
                self.d.atual = h

        class DriverFalso:
            window_handles = ["login", "exportacao"]
            atual = "exportacao"

            def __init__(self):
                self.switch_to = Troca(self)

            @property
            def current_window_handle(self):
                return self.atual

        portal = nav.PortalEmpregare("pasta-falsa", lambda _m: None)
        portal.driver = DriverFalso()
        portal.janela = "login"
        self.assertEqual(portal._voltar_para_a_janela(), 2)
        self.assertEqual(portal.driver.atual, "login")


class CapturaDosCandidatos(unittest.TestCase):
    def test_captura_paginas_e_so_conta_no_log(self):
        segunda = f'<li data-pessoa-id="7000009"><a href="{LINK_2}">d</a></li>'
        portal = PortalFalso([HTML_DA_LISTA, segunda])
        portal._guardar_id_da_vaga("180231", lambda: "/empresa/vagas/candidaturas/Ab1cD2eF3g|")
        r = portal.capturar_candidatos("180231")
        self.assertEqual(r["vaga_interno"], "Ab1cD2eF3g|")
        self.assertEqual(sorted(r["candidatos"]), ["7000001", "7000002", "7000003", "7000009"])
        self.assertEqual(portal.abertas, ["Ab1cD2eF3g|"])
        self.assertEqual(portal.voltou, 1)
        log = "\n".join(portal.logs)
        self.assertIn("4 link(s) de candidato", log)
        for proibido in ("TKfict", "IDfict", "Ab1cD2eF3g", "7000001", "Pessoa Fictícia"):
            self.assertNotIn(proibido, log)

    def test_falha_na_lista_vira_aviso_e_segue(self):
        portal = PortalFalso([HTML_DA_LISTA], falha=RuntimeError("Message: timeout em tokenCandidato=TKfict01"))
        portal.ids_das_vagas["180231"] = "Ab1cD2eF3g|"
        r = portal.capturar_candidatos("180231")
        self.assertEqual(r, {"vaga_interno": "Ab1cD2eF3g|", "candidatos": {}, "respostas": {}})
        self.assertEqual(portal.voltou, 1)
        self.assertIn("não consegui ler a lista de candidatos", portal.logs[-2])
        self.assertIn("diagnóstico da lista", portal.logs[-1])
        self.assertNotIn("TKfict01", "\n".join(portal.logs))

    def test_sem_identificador_nao_abre_nada(self):
        portal = PortalFalso([HTML_DA_LISTA])
        self.assertIsNone(portal.capturar_candidatos("180231"))
        self.assertEqual(portal.abertas, [])
        self.assertIn("sem o identificador interno", portal.logs[-1])

    def test_tempo_dos_links_esgotado_guarda_so_a_vaga(self):
        portal = PortalFalso([HTML_DA_LISTA])
        portal.ids_das_vagas["180231"] = "Ab1cD2eF3g|"
        portal.tempo_em_links = nav.ORCAMENTO_DOS_LINKS
        self.assertEqual(
            portal.capturar_candidatos("180231"), {"vaga_interno": "Ab1cD2eF3g|", "candidatos": {}, "respostas": {}}
        )
        self.assertEqual(portal.abertas, [])

    def test_guardar_id_nunca_derruba_a_exportacao(self):
        portal = PortalFalso([])

        def explode():
            raise RuntimeError("elemento sumiu")

        self.assertIsNone(portal._guardar_id_da_vaga("180231", explode))
        self.assertIsNone(portal._guardar_id_da_vaga("180231", lambda: "/empresa/vagas/candidaturas/180231"))
        self.assertEqual(portal.ids_das_vagas, {})


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

    def test_grava_links_dos_candidatos_e_identificador_da_vaga(self):
        caminho = LeituraDoExcel._excel(
            self,
            {
                "Candidatos": [
                    ["Código do candidato", "Nome"],
                    ["7000001", "Pessoa Fictícia Um"],
                    ["7000002", "Pessoa Fictícia Dois"],
                    ["7000005", "Pessoa Fictícia Cinco"],
                ]
            },
        )
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, corpo))
            if funcao == "fechar_vaga_empregare":
                return {"situacao": "GRAVADA", "ativos": 3, "desativadas": 0}
            return {"situacao": "EM_CARGA", "gravadas": len(corpo["p_linhas"])}

        enderecos = {
            "vaga_interno": "Ab1cD2eF3g|",
            "candidatos": {"7000001": nav.URL_BASE + LINK_1, "7000002": nav.URL_BASE + LINK_2, "7999999": "x"},
        }
        saida = []
        antigo = self.robo.registrar
        self.robo.registrar = saida.append
        try:
            situacao = self.robo.gravar_vaga({}, "gh-x", "177979", caminho, chamar, enderecos=enderecos)
        finally:
            self.robo.registrar = antigo
        self.assertEqual(situacao, "GRAVADA")
        linhas = {l["codigo"]: l.get("link") for l in chamadas[0][1]["p_linhas"]}
        self.assertEqual(linhas, {"7000001": nav.URL_BASE + LINK_1, "7000002": nav.URL_BASE + LINK_2, "7000005": None})
        self.assertEqual(chamadas[-1][1]["p_vaga_interno"], "Ab1cD2eF3g|")
        self.assertIn("2 com link da Empregare", saida[-1])
        self.assertNotIn("TKfict", "\n".join(saida))

    def test_sem_links_grava_como_antes(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, corpo))
            return {"situacao": "GRAVADA" if funcao == "fechar_vaga_empregare" else "EM_CARGA"}

        self.robo.gravar_vaga({}, "gh-x", "177979", self.caminho, chamar, enderecos=None)
        self.assertNotIn("p_vaga_interno", chamadas[-1][1])
        self.assertTrue(all("link" not in l for _, c in chamadas[:-1] for l in c["p_linhas"]))

    def test_banco_sem_a_migration_fecha_sem_o_identificador(self):
        chamadas = []

        def chamar(_config, funcao, corpo):
            chamadas.append((funcao, dict(corpo)))
            if funcao == "fechar_vaga_empregare" and "p_vaga_interno" in corpo:
                raise self.robo.supabase_rpc.ErroDoSupabase(funcao, 404, "PGRST202: function not found")
            return {"situacao": "GRAVADA" if funcao == "fechar_vaga_empregare" else "EM_CARGA"}

        situacao = self.robo.gravar_vaga(
            {},
            "gh-x",
            "177979",
            self.caminho,
            chamar,
            enderecos={"vaga_interno": "Ab1cD2eF3g|", "candidatos": {}, "respostas": {}},
        )
        self.assertEqual(situacao, "GRAVADA")
        fechamentos = [c for f, c in chamadas if f == "fechar_vaga_empregare"]
        self.assertEqual(len(fechamentos), 2)
        self.assertNotIn("p_vaga_interno", fechamentos[-1])

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
            {"vaga": "999999106", "origem": "ligada"},
        ]
        self.assertEqual(
            self.robo.contagem_por_origem(vagas),
            "quadro do edital 2 · Seleção 2 · ligadas ao edital 1 · pedidas fora das fontes 1",
        )
        self.assertEqual(self.robo.contagem_por_origem([]), "—")
        self.assertEqual(self.robo.contagem_por_origem([{"vaga": "1", "origem": "outra"}]), "outra 1")


if __name__ == "__main__":
    unittest.main()
