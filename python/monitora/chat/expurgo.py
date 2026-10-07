"""
Expurgo dos anexos do chat: tira do Storage os arquivos que já não pertencem a
nenhuma mensagem (fila public."TB_EXPURGO_ANEXO_CHAT").

A retenção e o "Zerar mensagens" apagam as linhas dos anexos e põem o caminho
do arquivo na fila; o Storage não deixa apagar pelo SQL. Cada lote:

    1. preparar_expurgo_anexos_chat()          até 100 caminhos da fila (e põe
                                               na fila os enviados e nunca
                                               anexados há mais de 1 dia)
    2. DELETE /storage/v1/object/chat-anexos   remove pela API do Storage, em
                                               pedaços (TAMANHO_DA_REMOCAO)
    3. confirmar_expurgo_anexos_chat(caminhos) marca como expurgado só o que de
                                               fato saiu de storage.objects

O que falhar (pedaço recusado pelo Storage, rede, arquivo que continua lá) não
é confirmado e fica na fila para a próxima execução — ou para a tela. Um
caminho que já falhou nesta execução não é tentado de novo nela: quando a
fila só devolve caminhos já tentados, a execução para.

A service_role passa por cima das políticas do bucket; por isso só se remove o
que preparar_expurgo_anexos_chat devolveu e no formato do bucket
(<conversa>/<uuid>.<extensão>, só uuids). As RPCs aceitam a service_role desde
supabase/migrations/20261007250000_expurgo_diario_dos_anexos_do_chat.sql.

NADA DE CAMINHO NO LOG: o repositório e o log do Actions são públicos. Este
módulo devolve e registra só contagens; mensagens de erro passam por
`sem_caminhos` (tira uuids) além do mascaramento de sempre.

Testes: tests/python/test_expurgo_anexos_chat.py.
"""

import http.client
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass

from monitora.mascaramento import mascarar

BUCKET = "chat-anexos"
TAMANHO_DO_LOTE = 100  # o que preparar_expurgo_anexos_chat devolve, no máximo
TAMANHO_DA_REMOCAO = 100  # caminhos por DELETE no Storage (a API aceita até 1.000)
LOTES_POR_EXECUCAO = 50  # até 5.000 arquivos por dia; o resto fica para amanhã

CAMINHO = re.compile(r"^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$")
_UUID = re.compile(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_CAMINHO_SOLTO = re.compile(r"(?i)<caminho>(?:/<caminho>)?(?:\.[a-z0-9]{2,5})?")


def sem_caminhos(texto):
    """Texto seguro para o log público: sem uuid (o caminho do bucket é feito só de uuids)."""
    # Antes do mascaramento: ele troca os dígitos longos de dentro do uuid e o uuid some do padrão.
    t = _CAMINHO_SOLTO.sub("<caminho>", _UUID.sub("<caminho>", str(texto if texto is not None else "")))
    return mascarar(t)


class ErroDoStorage(Exception):
    """O Storage recusou ou não respondeu. A mensagem nunca traz caminho."""

    def __init__(self, status, mensagem=""):
        super().__init__(f"Storage respondeu {status}: {sem_caminhos(mensagem)[:200]}".rstrip(": "))
        self.status = status


def _erro_do_storage(texto):
    """Só o `error`/`message` do corpo de erro do Storage, sem caminho."""
    try:
        corpo = json.loads(texto)
    except (TypeError, ValueError):
        return ""
    if not isinstance(corpo, dict):
        return ""
    return str(corpo.get("error") or corpo.get("message") or "").strip()


def remover_do_storage(
    config,
    caminhos,
    bucket=BUCKET,
    tentativas=3,
    abrir=urllib.request.urlopen,
    esperar=time.sleep,
    tempo_limite=60,
):
    """
    Remove `caminhos` do bucket pela API do Storage (service_role). Devolve o
    conjunto dos nomes que o Storage disse ter removido (o que já não existia
    não volta). Repete só rede e 5xx; 4xx → ErroDoStorage na hora.
    """
    dados = json.dumps({"prefixes": list(caminhos)}).encode("utf-8")
    endereco = f"{config['url']}/storage/v1/object/{urllib.parse.quote(bucket)}"
    ultimo = None
    for tentativa in range(1, tentativas + 1):
        pedido = urllib.request.Request(
            endereco,
            data=dados,
            method="DELETE",
            headers={
                "Content-Type": "application/json",
                "apikey": config["chave"],
                "Authorization": f"Bearer {config['chave']}",
            },
        )
        try:
            with abrir(pedido, timeout=tempo_limite) as resposta:
                texto = resposta.read().decode("utf-8")
            corpo = json.loads(texto) if texto else []
            if not isinstance(corpo, list):
                raise ErroDoStorage("inesperado", "a resposta não é uma lista")
            return {str(o.get("name")) for o in corpo if isinstance(o, dict) and o.get("name")}
        except urllib.error.HTTPError as erro:
            ultimo = ErroDoStorage(erro.code, _erro_do_storage(erro.read().decode("utf-8", "replace")))
            if erro.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException) as erro:
            ultimo = ErroDoStorage("sem resposta", type(erro).__name__)
        except ValueError:
            ultimo = ErroDoStorage("inesperado", "resposta que não é JSON")
            break
        if tentativa < tentativas:
            esperar(1.5 * tentativa)
    raise ultimo


@dataclass
class Resultado:
    """Só contagens: é o que vai para o log, o resumo e TL_EXPURGO_ANEXO_CHAT."""

    lotes: int = 0
    removidos: int = 0
    confirmados: int = 0
    falhas: int = 0
    pendentes: int | None = None
    no_lote: int = 0  # modo seco: quantos o primeiro lote removeria
    pedidos_recusados: int = 0  # pedaços que o Storage recusou ou não respondeu

    def contagens(self):
        """O que registrar_expurgo_anexos_chat aceita."""
        c = asdict(self)
        return {k: c[k] for k in ("lotes", "removidos", "confirmados", "falhas", "pendentes")}


def _pedacos(lista, tamanho):
    for inicio in range(0, len(lista), tamanho):
        yield lista[inicio : inicio + tamanho]


def _inteiro(valor):
    try:
        return max(0, int(valor))
    except (TypeError, ValueError):
        return None


def expurgar(
    chamar,
    remover,
    *,
    seco=False,
    lotes=LOTES_POR_EXECUCAO,
    tamanho_da_remocao=TAMANHO_DA_REMOCAO,
    log=None,
):
    """
    Roda o expurgo. `chamar(funcao, corpo)` chama a RPC; `remover(caminhos)`
    remove do Storage e devolve o conjunto removido (ou levanta). Com `seco`,
    só lê a fila (um lote) e conta quantos sairiam: nada é removido nem
    confirmado. Devolve um Resultado (só contagens).
    """
    resultado = Resultado()
    ja_tentados = set()
    for _ in range(max(1, lotes)):
        fila = chamar("preparar_expurgo_anexos_chat", {}) or {}
        pendentes = _inteiro(fila.get("pendentes"))
        if pendentes is not None:
            resultado.pendentes = pendentes
        recebidos = fila.get("caminhos") if isinstance(fila.get("caminhos"), list) else []
        # Só o formato do bucket: a service_role removeria qualquer coisa.
        validos = [c for c in recebidos if isinstance(c, str) and CAMINHO.fullmatch(c)]
        novos = [c for c in dict.fromkeys(validos) if c not in ja_tentados]
        if not novos:
            break
        resultado.lotes += 1
        if seco:
            resultado.no_lote = len(novos)
            break
        ja_tentados.update(novos)

        aceitos = []
        removidos_no_lote = 0
        for pedaco in _pedacos(novos, max(1, tamanho_da_remocao)):
            try:
                removidos = remover(pedaco)
            except Exception as erro:  # qualquer falha deixa o pedaço na fila
                resultado.pedidos_recusados += 1
                if log:
                    log.warning("Um pedido de remoção (%s arquivos) falhou: %s", len(pedaco), sem_caminhos(erro))
                continue
            removidos_no_lote += len(set(removidos or ()) & set(pedaco))
            # O que já não existia (removido antes, sem confirmação) também se confirma:
            # a RPC só marca o que está fora de storage.objects.
            aceitos += pedaco

        confirmados = 0
        if aceitos:
            resposta = chamar("confirmar_expurgo_anexos_chat", {"p_caminhos": aceitos}) or {}
            confirmados = _inteiro(resposta.get("confirmados")) or 0
            pendentes = _inteiro(resposta.get("pendentes"))
            if pendentes is not None:
                resultado.pendentes = pendentes
        resultado.removidos += removidos_no_lote
        resultado.confirmados += confirmados
        resultado.falhas += max(0, len(novos) - confirmados)
        if log:
            log.info(
                "Lote %s: %s na fila, %s removidos, %s confirmados.",
                resultado.lotes,
                len(novos),
                removidos_no_lote,
                confirmados,
            )
        if len(recebidos) < TAMANHO_DO_LOTE:
            break
    return resultado
