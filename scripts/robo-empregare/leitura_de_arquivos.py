"""
LEITURA AUTOMÁTICA DOS ARQUIVOS DA AVALIAÇÃO DOCUMENTAL

Para os anexos da resposta vigente do questionário ainda não lidos (ou lidos
com extrator de versão antiga, ou com erro) dos editais pedidos — primeiro os
de quem já tem ficha —, o robô entra na Empregare (a mesma sessão do robô da
carga, navegador_empregare.py), baixa cada arquivo SÓ PARA A MEMÓRIA
(arquivo_empregare.py), lê (python/monitora/avaliacao_documental/leitura_de_arquivos/),
grava o resultado (gravar_leituras_de_arquivos, migration 20261009220000) e
descarta o arquivo. A ficha mostra o que foi lido; quem decide é o avaliador.

Uso (o workflow .github/workflows/leitura-de-arquivos.yml faz isso):
  python scripts/robo-empregare/leitura_de_arquivos.py --editais 93/2026 --limite 30
  python scripts/robo-empregare/leitura_de_arquivos.py --editais 93/2026 --seco
      só conta o que falta ler (não entra na Empregare)
  python scripts/robo-empregare/leitura_de_arquivos.py --editais 93/2026 --sondar --limite 3
      só a estrutura do visualizador de até 3 anexos no log (não lê nem grava)
  --forcar  relê também o que já foi lido nesta versão (até o limite; não é retomável)
  --so-relidos  só relê o que já foi lido (versão antiga ou erro; com --forcar, tudo o já lido);
            nunca lê anexo novo (o já lido com versão antiga vem primeiro sempre)

Orçamento: ORCAMENTO_MINUTOS (padrão 100; o job tem 120). Ao esgotar, grava o
que leu e para: a execução seguinte continua de onde parou (o banco sabe o
que já foi lido). Grava em lotes de LOTE leituras.

Variáveis: EMPREGARE_EMAIL, EMPREGARE_SENHA, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
O LOG É PÚBLICO: só contagens, códigos de erro e números de edital — nunca
nome, CPF, nome de arquivo ou trecho de documento. O CPF do candidato nem
chega ao robô: o banco manda sha256(sal + CPF) com o sal sorteado aqui.

Saída: 0 concluída (ou parou no orçamento); 1 erro (nada lido); 2 parcial
(houve erro de download/leitura em algum arquivo).
"""

import argparse
import hashlib
import os
import pathlib
import re
import secrets
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime

# A base comum (python/monitora/) vem do próprio repositório, sem instalar nada.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

import arquivo_empregare as arquivo  # noqa: E402

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.avaliacao_documental.leitura_de_arquivos import VERSAO_DO_EXTRATOR  # noqa: E402
from monitora.avaliacao_documental.leitura_de_arquivos.leitura import (  # noqa: E402
    bloco_do_anexo,
    esperado_do_bloco,
    ler_documento,
    minimo_de_horas,
)
from monitora.execucao import FUSO  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

GUIA = "docs/leitura-dos-arquivos.md"
TITULO = "Leitura dos arquivos → MONITORA"
LIMITE_PADRAO = 300
LIMITE_MAXIMO = 2000
LIMITE_DA_SONDAGEM = 3
LOTE = 20
ORCAMENTO_PADRAO = 100  # minutos (o job tem 120)
_PEDIDO = re.compile(r"^[A-Za-z0-9/ ._-]{1,100}$")
# Os campos que vão para o banco (o resto do resultado fica só na memória).
CAMPOS = (
    "situacao",
    "metodo",
    "formato",
    "documento",
    "paginas",
    "confianca",
    "nome_confere",
    "cpf_confere",
    "itens",
    "alertas",
    "resumo",
    "erro",
)
log = registro("leitura_de_arquivos")


def separar(texto):
    return [p.strip() for p in str(texto or "").split(",") if p.strip()]


def argumentos(lista=None):
    p = argparse.ArgumentParser(description=TITULO)
    p.add_argument("--editais", default=os.environ.get("EDITAIS", ""), help="93/2026, ids ou nomes, por vírgula")
    p.add_argument("--limite", type=int, default=int(os.environ.get("LIMITE") or LIMITE_PADRAO))
    p.add_argument("--forcar", action="store_true", default=os.environ.get("FORCAR") == "sim")
    p.add_argument(
        "--so-relidos",
        action="store_true",
        default=os.environ.get("SO_RELIDOS") == "sim",
        help="só relê o que já foi lido (nunca anexo novo)",
    )
    p.add_argument("--seco", action="store_true", help="só conta o que falta ler")
    p.add_argument("--sondar", action="store_true", help="só a estrutura do visualizador de até 3 anexos")
    args = p.parse_args(lista)
    args.editais = separar(args.editais)
    if len(args.editais) > 100 or any(not _PEDIDO.match(e) for e in args.editais):
        p.error("editais: até 100, cada um número (93/2026), id ou nome curto")
    if not 1 <= args.limite <= LIMITE_MAXIMO:
        p.error(f"limite: de 1 a {LIMITE_MAXIMO} arquivos")
    return args


def para_o_banco(anexo, resultado, hash_do_arquivo):
    """A leitura no formato de gravar_leituras_de_arquivos (sem nome, CPF ou texto do documento)."""
    leitura = {c: resultado.get(c) for c in CAMPOS if resultado.get(c) is not None}
    leitura.update(
        resposta=anexo["resposta"],
        pergunta=str(anexo["pergunta"]),
        arquivo=int(anexo["arquivo"]),
        hash=hash_do_arquivo,
        versao=VERSAO_DO_EXTRATOR,
    )
    leitura.setdefault("itens", [])
    leitura.setdefault("alertas", [])
    for campo in ("itens", "alertas", "resumo"):
        leitura[campo] = sem_numero_de_documento(leitura[campo]) if campo in leitura else leitura.get(campo)
    return leitura


# Mesma expressão da rede de segurança do banco (gravar_leituras_de_arquivos):
# sequência com cara de CPF (inclui números longos como registro, protocolo, CTPS).
_NUMERO_DE_DOCUMENTO = re.compile(r"\d{3}\.?\d{3}\.?\d{3}-?\d{2}")


def sem_numero_de_documento(valor):
    """Tira dos textos lidos qualquer número com cara de CPF antes de ir ao banco."""
    if isinstance(valor, str):
        return _NUMERO_DE_DOCUMENTO.sub("[número omitido]", valor)
    if isinstance(valor, list):
        return [sem_numero_de_documento(v) for v in valor]
    if isinstance(valor, dict):
        return {k: sem_numero_de_documento(v) for k, v in valor.items()}
    return valor


def leitura_com_erro(anexo, codigo):
    return para_o_banco(
        anexo,
        {"situacao": "ERRO", "erro": re.sub(r"[^a-z0-9_]", "_", codigo.lower())[:60], "resumo": "Não foi possível ler"},
        None,
    )


def ler_anexo(anexo, regras, baixar, sal, hoje, ler=ler_documento):
    """Baixa e lê um anexo: a leitura para o banco e o que contar no resumo (sem dado pessoal)."""
    regra = regras.get(anexo.get("edital")) or {}
    bloco = bloco_do_anexo(regra, anexo.get("coluna"), anexo.get("enunciado"))
    esperado = esperado_do_bloco(bloco)
    try:
        conteudo = baixar(anexo["link"])
    except arquivo.ErroNoArquivo as erro:
        return leitura_com_erro(anexo, erro.codigo), esperado
    try:
        resultado = ler(
            conteudo,
            esperado,
            nome=anexo.get("nome"),
            sal=sal,
            hash_do_cpf=anexo.get("cpf"),
            minimo_horas=minimo_de_horas(bloco) if esperado == "CURSOS" else None,
            hoje=hoje,
        )
        return para_o_banco(anexo, resultado, hashlib.sha256(conteudo).hexdigest()), esperado
    except Exception as erro:  # um arquivo estranho não derruba o lote
        log.info("Um arquivo não pôde ser interpretado (%s).", type(erro).__name__)
        return leitura_com_erro(anexo, f"leitura_{type(erro).__name__}"), esperado
    finally:
        del conteudo


class Gravador:
    """Junta as leituras e grava em lotes de LOTE (gravar_leituras_de_arquivos)."""

    def __init__(self, config, id_execucao, chamar):
        self.config, self.id, self.chamar = config, id_execucao, chamar
        self.fila, self.gravadas, self.fora = [], 0, 0

    def guardar(self, leitura):
        self.fila.append(leitura)
        if len(self.fila) >= LOTE:
            self.descarregar()

    def descarregar(self):
        if not self.fila:
            return
        lote, self.fila = self.fila, []
        r = self.chamar(self.config, "gravar_leituras_de_arquivos", {"p_execucao": self.id, "p_leituras": lote}) or {}
        self.gravadas += int(r.get("gravadas") or 0)
        self.fora += int(r.get("fora") or 0)


def linhas_do_resumo(lista, contagem, gravador, esperados, esgotou, segundos):
    linhas = [
        f"Editais: {', '.join(e.get('rotulo') or '?' for e in lista.get('editais') or []) or 'nenhum'}"
        + (f" · não encontrados: {', '.join(lista['nao_encontrados'])}" if lista.get("nao_encontrados") else ""),
        f"Anexos da resposta vigente: {lista.get('total', 0)} · a ler antes desta execução: {lista.get('pendentes', 0)}",
        f"Arquivos processados: {sum(contagem.values())} (lidos {contagem['LIDO']}, ilegíveis {contagem['ILEGIVEL']}, "
        f"erro {contagem['ERRO']}, formato não lido {contagem['NAO_SUPORTADO']})",
        f"Gravados: {gravador.gravadas}" + (f" · fora do banco: {gravador.fora}" if gravador.fora else ""),
        "Por item da ficha: " + (", ".join(f"{k.lower()} {v}" for k, v in sorted(esperados.items())) or "nenhum"),
        f"Extrator {VERSAO_DO_EXTRATOR} · {round(segundos / 60, 1)} min",
    ]
    if contagem["ERRO"]:
        linhas.append("Erros por código: " + ", ".join(f"{k} {v}" for k, v in sorted(contagem.erros.items())))
    if esgotou:
        linhas.append("Orçamento de tempo esgotado: a próxima execução continua de onde parou.")
    return linhas


class Contagem(Counter):
    def __init__(self):
        super().__init__()
        self.erros = Counter()


def processar(anexos, regras, baixar, gravador, sal, hoje, prazo, agora=time.monotonic):
    """Lê os anexos até o prazo; devolve (contagem por situação, por item da ficha, esgotou)."""
    contagem, esperados = Contagem(), Counter()
    for i, anexo in enumerate(anexos):
        if agora() >= prazo:
            return contagem, esperados, True
        leitura, esperado = ler_anexo(anexo, regras, baixar, sal, hoje)
        contagem[leitura["situacao"]] += 1
        if leitura["situacao"] == "ERRO":
            contagem.erros[leitura.get("erro") or "erro"] += 1
        esperados[esperado] += 1
        gravador.guardar(leitura)
        if (i + 1) % 25 == 0:
            log.info("%s de %s arquivos processados.", i + 1, len(anexos))
    return contagem, esperados, False


def sondar(portal, anexos):
    linhas = []
    for i, anexo in enumerate(anexos[:LIMITE_DA_SONDAGEM], start=1):
        info = arquivo.sondar_visualizador(portal.driver, anexo["link"])
        linhas.append(f"Anexo {i} (pergunta {anexo.get('ordem') or '?'}): {info}")
    return linhas or ["Nenhum anexo para sondar."]


def principal(args, configuracao=None, chamar=supabase_rpc.chamar, portal_de=None, relogio=time.monotonic):
    inicio = relogio()
    config = configuracao if configuracao is not None else supabase_rpc.configuracao(GUIA)
    sal = secrets.token_urlsafe(32)
    limite = min(args.limite, LIMITE_DA_SONDAGEM) if args.sondar else args.limite
    pedido = {
        "p_editais": args.editais or None,
        "p_versao": VERSAO_DO_EXTRATOR,
        "p_forcar": bool(args.forcar),
        "p_limite": limite,
        "p_sal": sal,
    }
    if args.so_relidos:
        # Só quando pedido: sem ele, a chamada vale também para a RPC antiga (sem p_so_relidos).
        pedido["p_so_relidos"] = True
    lista = chamar(config, "listar_anexos_para_leitura", pedido) or {}
    anexos = lista.get("anexos") or []
    log.info(
        "%s anexo(s) a ler nesta execução (de %s pendentes, %s no total).",
        len(anexos),
        lista.get("pendentes", 0),
        lista.get("total", 0),
    )
    if args.seco or not anexos:
        execucao.resumir(TITULO, linhas_do_resumo(lista, Contagem(), Gravador(config, "", chamar), Counter(), False, 0))
        return 0
    regras = {e["id"]: e.get("regra") or {} for e in lista.get("editais") or []}
    id_execucao = execucao.identificador(prefixo="leitura")
    gravador = Gravador(config, id_execucao, chamar)
    orcamento = int(os.environ.get("ORCAMENTO_MINUTOS") or ORCAMENTO_PADRAO) * 60
    hoje = datetime.now(FUSO).date()
    if portal_de is None:
        import navegador_empregare as nav

        def portal_de(pasta):
            return nav.PortalEmpregare(pasta, log.info)

    from navegador_empregare import credenciais

    email, senha = credenciais()
    with tempfile.TemporaryDirectory() as pasta, portal_de(pasta) as portal:
        portal.entrar(email, senha)
        if args.sondar:
            execucao.resumir(TITULO + " (sondagem)", sondar(portal, anexos))
            return 0

        def baixar(link):
            return arquivo.baixar(portal.driver, link)

        try:
            contagem, esperados, esgotou = processar(
                anexos, regras, baixar, gravador, sal, hoje, inicio + orcamento, relogio
            )
        finally:
            gravador.descarregar()
    execucao.resumir(TITULO, linhas_do_resumo(lista, contagem, gravador, esperados, esgotou, relogio() - inicio))
    if sum(contagem.values()) and contagem["ERRO"] == sum(contagem.values()):
        return 1
    return 2 if contagem["ERRO"] else 0


def main(lista=None):
    args = argumentos(lista)
    try:
        return principal(args)
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) == 404:
            log.error("O banco ainda não tem a leitura dos arquivos (falta a migration 20261009220000).")
        else:
            log.error("O banco recusou: %s", erro)
        return 1
    except SystemExit:
        raise
    except Exception as erro:
        log.error("A leitura dos arquivos parou: %s", resumo_do_erro(erro))
        return 1


if __name__ == "__main__":
    sys.exit(main())
