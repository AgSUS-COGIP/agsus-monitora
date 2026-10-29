"""
Chamadas às RPCs do Supabase com a service_role (jobs do GitHub Actions).

O padrão do MONITORA é falar com o banco só por RPC (SECURITY DEFINER): os
jobs não leem tabela direto, nem com a service_role. Cada job chama as RPCs
dele (as de carga do robô da Empregare, as de leitura e gravação das
conferências…), concedidas só ao service_role.

Variáveis: SUPABASE_URL (aceita VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.
Repete até 3 vezes só erro de rede ou 5xx; erro do banco (4xx) não melhora
repetindo, nem o cancelamento por tempo (57014, statement_timeout): a mesma
instrução estoura de novo, e repetir só soma 8 s por tentativa antes de quem
chamou poder reagir (gravar_lote divide o lote ao meio). Do erro do PostgREST sobem só `code` e `message`, mascarados:
`details` e `hint` ficam de fora porque o Postgres põe neles a linha recusada
inteira ("Failing row contains (...)"), com nome e data de nascimento, que o
mascaramento não reconhece. As RPCs que criam registro (`iniciar_*`) devem
ser chamadas com `tentativas=1`: repetir depois de uma resposta perdida
esbarra na execução que a primeira tentativa já abriu. O mesmo vale para as
que fecham ou registram (`fechar_*`, `finalizar_*`, `registrar_*`) e para as
de gravação em lote do robô: a primeira tentativa pode ter gravado e só a
resposta se perdeu.

Pede a resposta comprimida (Accept-Encoding: gzip): sem isso o urllib recebe o
JSON cru, e a leitura dos jobs é a maior parte do egress do Supabase no plano
gratuito (14/10/2026). A resposta gzip é descomprimida aqui.

Funções da Vercel (api/*.py) NÃO usam este módulo: lá a chamada vai com o
Bearer de quem pediu, para o banco decidir a permissão (ver
docs/python-no-monitora.md).
"""

import gzip
import http.client
import json
import time
import urllib.error
import urllib.request

from monitora.config import ErroDeConfiguracao, ler
from monitora.mascaramento import mascarar

GUIA_PADRAO = "docs/python-no-monitora.md"


def texto_do_erro(texto):
    """Só `code` e `message` do erro do PostgREST; nunca `details` nem `hint`."""
    try:
        corpo = json.loads(texto)
    except (TypeError, ValueError):
        return texto
    if not isinstance(corpo, dict):
        return texto
    codigo = str(corpo.get("code") or "").strip()
    mensagem = str(corpo.get("message") or "").strip()
    if not codigo and not mensagem:
        return "erro sem mensagem"
    return f"{codigo}: {mensagem}" if codigo and mensagem else (codigo or mensagem)


def ler_corpo(resposta):
    """O corpo da resposta em texto, descomprimido quando veio em gzip."""
    dados = resposta.read()
    cabecalhos = getattr(resposta, "headers", None)
    codificacao = (cabecalhos.get("Content-Encoding") if cabecalhos else "") or ""
    if "gzip" in codificacao.lower() or dados[:2] == b"\x1f\x8b":
        dados = gzip.decompress(dados)
    return dados.decode("utf-8", "replace")


CANCELADA_POR_TEMPO = "57014"


def cancelada_por_tempo(texto):
    """O corpo do erro diz que o banco cancelou a instrução no statement_timeout (57014)?"""
    try:
        corpo = json.loads(texto)
    except (TypeError, ValueError):
        return False
    return isinstance(corpo, dict) and str(corpo.get("code") or "").strip() == CANCELADA_POR_TEMPO


class ErroDoSupabase(Exception):
    def __init__(self, funcao, status, mensagem):
        super().__init__(f"{funcao} respondeu {status}: {mascarar(mensagem)[:400]}")
        self.funcao = funcao
        self.status = status


def configuracao(guia=GUIA_PADRAO, ambiente=None):
    """{"url", "chave"} da service_role, ou ErroDeConfiguracao dizendo o que falta."""
    url = ler("SUPABASE_URL", obrigatoria=False, ambiente=ambiente) or ler(
        "VITE_SUPABASE_URL", obrigatoria=False, ambiente=ambiente
    )
    url = (url or "").rstrip("/")
    if not url.startswith("https://"):
        raise ErroDeConfiguracao("Falta SUPABASE_URL (https://…).")
    chave = ler(
        "SUPABASE_SERVICE_ROLE_KEY",
        ambiente=ambiente,
        dica=f"O job roda pelo GitHub Actions com os secrets do repositório; veja {guia}.",
    )
    return {"url": url, "chave": chave}


def chamar(
    config,
    funcao,
    corpo,
    tentativas=3,
    abrir=urllib.request.urlopen,
    esperar=time.sleep,
    tempo_limite=120,
    codificar=None,
    decodificar=None,
):
    """A RPC com a service_role. `codificar`/`decodificar` trocam o json.dumps/json.loads (o job dos
    pacotes dos painéis lê e devolve os números como o banco os escreveu: monitora.paineis.json_exato)."""
    dados = (codificar or (lambda c: json.dumps(c, ensure_ascii=False)))(corpo).encode("utf-8")
    ultimo = None
    for tentativa in range(1, tentativas + 1):
        pedido = urllib.request.Request(
            f"{config['url']}/rest/v1/rpc/{funcao}",
            data=dados,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip",
                "apikey": config["chave"],
                "Authorization": f"Bearer {config['chave']}",
            },
        )
        try:
            with abrir(pedido, timeout=tempo_limite) as resposta:
                texto = ler_corpo(resposta)
                return (decodificar or json.loads)(texto) if texto else None
        except urllib.error.HTTPError as erro:
            texto = ler_corpo(erro)
            ultimo = ErroDoSupabase(funcao, erro.code, texto_do_erro(texto))
            if erro.code < 500 or cancelada_por_tempo(texto):
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException) as erro:
            ultimo = ErroDoSupabase(funcao, "sem resposta", str(erro))
        esperar(1.5 * tentativa)
    raise ultimo
