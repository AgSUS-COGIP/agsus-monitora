"""
Robô da leitura dos arquivos (scripts/robo-empregare/leitura_de_arquivos.py e
arquivo_empregare.py): o visualizador da Empregare (HTML sintético), o fluxo
com banco e portal falsos, o orçamento de tempo e o log sem dado pessoal.
Nada fala com a Empregare nem com o Supabase; nenhum documento real.
"""

import base64
import io
import logging
import pathlib
import re
import sys
from urllib.parse import urlparse

import pytest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "robo-empregare"))
sys.path.insert(0, str(_RAIZ / "python"))

import arquivo_empregare as arq  # noqa: E402
import leitura_de_arquivos as robo  # noqa: E402

from monitora.avaliacao_documental.leitura_de_arquivos import VERSAO_DO_EXTRATOR  # noqa: E402
from monitora.avaliacao_documental.leitura_de_arquivos.pessoas import hash_do_cpf  # noqa: E402

pytest.importorskip("reportlab")
pytest.importorskip("pdfplumber")

ARQUIVO = "6452621-c4104531-23b0-47d7-8f4e-704e72c7b257.pdf"
LINK = (
    "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?"
    f"arquivo={ARQUIVO}&nome=Case&token=abc123&questionarioRespostaID=8019889&perguntaID=555"
)
NOME = "Maria Exemplo da Silva"


def pdf_de_certificado(horas=145):
    from reportlab.pdfgen import canvas

    saida = io.BytesIO()
    c = canvas.Canvas(saida)
    c.drawString(40, 800, "CERTIFICADO")
    c.drawString(40, 780, f"Certificamos que {NOME} concluiu o curso Enfrentamento das Arboviroses,")
    c.drawString(40, 760, f"com carga horaria de {horas} horas. Fundacao Exemplo, 12/05/2023. CPF 123.456.789-09")
    c.showPage()
    c.save()
    return saida.getvalue()


# ── visualizador ─────────────────────────────────────────────────────────────


def test_link_do_visualizador_a_partir_do_visualizar_arquivo():
    assert arq.nome_do_arquivo(LINK) == ARQUIVO
    assert (
        arq.link_do_visualizador(LINK) == f"https://corporate.empregare.com/Company/Viewer?arquivo={ARQUIVO}&nome=Case"
    )
    assert arq.link_do_visualizador("https://corporate.empregare.com/x?arquivo=../../etc<script>") is None
    assert arq.link_do_visualizador("") is None


def test_candidatos_botao_baixar_vem_primeiro():
    html = f"""
      <html><body>
        <iframe src="https://docs.google.com/viewer?url=https%3A%2F%2Farquivos.exemplo.com%2Fcase%2F{ARQUIVO}&embedded=true"></iframe>
        <a class="btn" href="/Company/Viewer?arquivo={ARQUIVO}&nome=Case">Recarregar</a>
        <a class="btn btn-primary" href="/Company/VacancyTests/DownloadArquivo?arquivo={ARQUIVO}"><i></i> Baixar Arquivo</a>
        <script>var x = "https://arquivos.exemplo.com/case/{ARQUIVO}";</script>
      </body></html>"""
    c = arq.candidatos_de_download(html, ARQUIVO)
    assert c[0] == f"https://corporate.empregare.com/Company/VacancyTests/DownloadArquivo?arquivo={ARQUIVO}"
    assert f"https://arquivos.exemplo.com/case/{ARQUIVO}" in c
    assert not any("/Company/Viewer" in u for u in c)  # o próprio visualizador não conta
    assert not any(
        urlparse(u).hostname == "docs.google.com" for u in c
    )  # do visualizador do Google, só o endereço de dentro


def test_candidatos_pelo_onclick_e_pelo_embed():
    html = f"""<button onclick="window.open('https://cdn.exemplo.com/a/{ARQUIVO}')">Baixar</button>
               <embed src="/Company/Files/Get?arquivo={ARQUIVO}">"""
    c = arq.candidatos_de_download(html, ARQUIVO)
    assert c == [
        f"https://cdn.exemplo.com/a/{ARQUIVO}",
        f"https://corporate.empregare.com/Company/Files/Get?arquivo={ARQUIVO}",
    ]


class DriverFalso:
    """Responde ao fetch da página como a Empregare responderia (por URL)."""

    def __init__(self, respostas):
        self.respostas, self.pedidos = respostas, []

    def set_script_timeout(self, _):
        pass

    def execute_async_script(self, _js, url, _limite):
        self.pedidos.append(url)
        tipo, corpo, status = self.respostas.get(url, ("text/html", b"", 404))
        return {"status": status, "tipo": tipo, "base64": base64.b64encode(corpo).decode(), "login": False}


def test_baixar_pelo_botao_do_visualizador():
    pdf = pdf_de_certificado()
    visualizador = arq.link_do_visualizador(LINK)
    download = f"https://corporate.empregare.com/Company/VacancyTests/DownloadArquivo?arquivo={ARQUIVO}"
    html = f'<a href="{download}">Baixar Arquivo</a>'.encode()
    driver = DriverFalso({visualizador: ("text/html", html, 200), download: ("application/pdf", pdf, 200)})
    assert arq.baixar(driver, LINK) == pdf
    assert driver.pedidos == [visualizador, download]


def test_baixar_quando_o_visualizador_ja_e_o_arquivo():
    pdf = pdf_de_certificado()
    driver = DriverFalso({arq.link_do_visualizador(LINK): ("application/pdf", pdf, 200)})
    assert arq.baixar(driver, LINK) == pdf


def test_baixar_de_outro_dominio_sem_cookie():
    pdf = pdf_de_certificado()
    externo = f"https://arquivos.exemplo.com/case/{ARQUIVO}"
    html = f"<iframe src='{externo}'></iframe>".encode()
    driver = DriverFalso({arq.link_do_visualizador(LINK): ("text/html", html, 200)})
    pedidos = []

    def sem_cookie(url):
        pedidos.append(url)
        return "application/pdf", pdf

    assert arq.baixar(driver, LINK, sem_cookie=sem_cookie) == pdf
    assert pedidos == [externo]


def test_erros_do_download_viram_codigo():
    driver = DriverFalso({arq.link_do_visualizador(LINK): ("text/html", b"<p>nada aqui</p>", 200)})
    with pytest.raises(arq.ErroNoArquivo) as erro:
        arq.baixar(driver, LINK)
    assert erro.value.codigo == "sem_link_de_download"
    with pytest.raises(arq.ErroNoArquivo) as erro:
        arq.baixar(DriverFalso({}), LINK)
    assert erro.value.codigo == "http_404"


def test_sondar_o_visualizador_nao_mostra_nome_nem_numero():
    download = f"https://corporate.empregare.com/Company/Case/6452621/Download?arquivo={ARQUIVO}"
    html = f'<a href="{download}">Baixar Arquivo</a>'.encode()
    info = arq.sondar_visualizador(DriverFalso({arq.link_do_visualizador(LINK): ("text/html", html, 200)}), LINK)
    assert info["botao_baixar"] == 1 and info["candidatos"] == 1
    assert ARQUIVO not in repr(info) and "6452621" not in repr(info)


# ── o fluxo do robô ──────────────────────────────────────────────────────────

REGRA = {
    "blocos": [
        {
            "codigo": "CURSOS",
            "tipo": "CURSOS",
            "perguntas": ["Anexe os seus Certificados"],
            "faixas": [{"min_horas": 40, "max_horas": None, "pontos": 1}],
        }
    ]
}
EDITAL = "f57d77e1-7f6b-416c-9f9e-6e40c6d5bded"


class BancoFalso:
    def __init__(self, anexos):
        self.anexos, self.chamadas, self.sal = anexos, [], None

    def __call__(self, _config, funcao, corpo):
        self.chamadas.append((funcao, corpo))
        if funcao == "listar_anexos_para_leitura":
            self.sal = corpo["p_sal"]
            anexos = [dict(a, cpf=hash_do_cpf(corpo["p_sal"], "12345678909")) for a in self.anexos][: corpo["p_limite"]]
            return {
                "editais": [{"id": EDITAL, "rotulo": "93/2026", "regra": REGRA}],
                "nao_encontrados": [],
                "total": len(self.anexos),
                "pendentes": len(self.anexos),
                "anexos": anexos,
            }
        if funcao == "gravar_leituras_de_arquivos":
            return {"recebidas": len(corpo["p_leituras"]), "gravadas": len(corpo["p_leituras"]), "fora": 0}
        raise AssertionError(funcao)


class PortalFalso:
    def __init__(self, conteudos):
        self.driver = None
        self.conteudos = conteudos

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def entrar(self, email, senha):
        assert email and senha


def anexo(n, coluna="Pergunta 16 - Anexe os seus Certificados de Conclusão dos Cursos"):
    return {
        "resposta": "0e6c9f1e-1111-4222-8333-444455556666",
        "pergunta": str(1000 + n),
        "arquivo": 1,
        "ordem": 16,
        "coluna": coluna,
        "enunciado": "Anexe os seus Certificados de Conclusão dos Cursos",
        "link": LINK.replace("perguntaID=555", f"perguntaID={1000 + n}"),
        "edital": EDITAL,
        "vaga": "180231",
        "candidato": "9b1f0000-0000-4000-8000-000000000001",
        "com_ficha": True,
        "nome": NOME,
    }


@pytest.fixture
def ambiente(monkeypatch):
    monkeypatch.setenv("EMPREGARE_EMAIL", "robo@exemplo.org")
    monkeypatch.setenv("EMPREGARE_SENHA", "segredo-de-teste")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)


def test_fluxo_le_grava_em_lote_sem_dado_pessoal(monkeypatch, ambiente, caplog, capsys):
    pdf = pdf_de_certificado()
    monkeypatch.setattr(robo.arquivo, "baixar", lambda _driver, link: pdf if "1001" not in link else b"PK\x03\x04zip")
    banco = BancoFalso([anexo(n) for n in range(25)])
    args = robo.argumentos(["--editais", "93/2026", "--limite", "25"])
    with caplog.at_level(logging.INFO):
        saida = robo.principal(
            args, configuracao={"url": "https://x", "chave": "k"}, chamar=banco, portal_de=PortalFalso
        )
    assert saida == 0
    gravacoes = [c for f, c in banco.chamadas if f == "gravar_leituras_de_arquivos"]
    assert [len(c["p_leituras"]) for c in gravacoes] == [20, 5]
    leituras = [lt for c in gravacoes for lt in c["p_leituras"]]
    lido = leituras[0]
    assert lido["situacao"] == "LIDO" and lido["versao"] == VERSAO_DO_EXTRATOR
    assert lido["itens"][0]["horas"] == 145 and lido["nome_confere"] is True and lido["cpf_confere"] is True
    assert len(lido["hash"]) == 64
    assert leituras[1]["situacao"] == "NAO_SUPORTADO"
    # Nada de nome, CPF, nome de arquivo nem do sal no que vai ao banco ou ao log.
    tudo = repr(leituras) + caplog.text + capsys.readouterr().out
    for proibido in ("Maria", "Silva", "123.456.789-09", "12345678909", ARQUIVO, banco.sal):
        assert proibido not in tudo
    listar = banco.chamadas[0][1]
    assert listar["p_editais"] == ["93/2026"] and listar["p_versao"] == VERSAO_DO_EXTRATOR
    assert len(listar["p_sal"]) >= 16


def test_erro_de_download_vira_leitura_com_erro_e_saida_parcial(monkeypatch, ambiente):
    def baixar(_driver, link):
        if "1000" in link:
            raise arq.ErroNoArquivo("http_404")
        return pdf_de_certificado(20)

    monkeypatch.setattr(robo.arquivo, "baixar", baixar)
    banco = BancoFalso([anexo(0), anexo(1)])
    saida = robo.principal(robo.argumentos(["--limite", "5"]), configuracao={}, chamar=banco, portal_de=PortalFalso)
    assert saida == 2
    (gravacao,) = [c for f, c in banco.chamadas if f == "gravar_leituras_de_arquivos"]
    erro, lido = gravacao["p_leituras"]
    assert erro["situacao"] == "ERRO" and erro["erro"] == "http_404" and "hash" in erro and erro["hash"] is None
    assert [a["codigo"] for a in lido["itens"][0]["alertas"]] == ["HORAS_ABAIXO_MINIMO"]


def test_orcamento_de_tempo_para_e_grava_o_que_leu(monkeypatch, ambiente):
    monkeypatch.setattr(robo.arquivo, "baixar", lambda _d, _l: pdf_de_certificado())
    monkeypatch.setenv("ORCAMENTO_MINUTOS", "1")
    tempos = iter([0, 0, 10, 30, 61, 62, 63, 64])
    banco = BancoFalso([anexo(n) for n in range(6)])
    saida = robo.principal(
        robo.argumentos([]), configuracao={}, chamar=banco, portal_de=PortalFalso, relogio=lambda: next(tempos)
    )
    assert saida == 0
    (gravacao,) = [c for f, c in banco.chamadas if f == "gravar_leituras_de_arquivos"]
    assert len(gravacao["p_leituras"]) == 3


def test_seco_so_conta(ambiente):
    banco = BancoFalso([anexo(0)])
    assert robo.principal(robo.argumentos(["--seco"]), configuracao={}, chamar=banco, portal_de=PortalFalso) == 0
    assert [f for f, _ in banco.chamadas] == ["listar_anexos_para_leitura"]


def test_argumentos_validam_o_pedido():
    with pytest.raises(SystemExit):
        robo.argumentos(["--editais", "93/2026; drop table"])
    with pytest.raises(SystemExit):
        robo.argumentos(["--limite", "0"])
    assert robo.argumentos(["--editais", "93/2026, 114/2026"]).editais == ["93/2026", "114/2026"]


def test_para_o_banco_tira_numero_com_cara_de_cpf():
    anexo = {"resposta": "r", "pergunta": "1", "arquivo": 1}
    resultado = {
        "situacao": "LIDO",
        "resumo": "CTPS 123.456.789-09",
        "itens": [{"empregador": "Empresa 12345678901", "dias": 30}],
        "alertas": [{"codigo": "NOME_DIVERGENTE", "texto": "doc 98765432100"}],
    }
    saida = robo.para_o_banco(anexo, resultado, "h")
    texto = str(saida["itens"]) + str(saida["alertas"]) + saida["resumo"]
    assert not re.search(r"\d{3}\.?\d{3}\.?\d{3}-?\d{2}", texto)
    assert saida["itens"][0]["dias"] == 30
