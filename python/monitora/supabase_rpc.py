"""
Chamadas às RPCs do Supabase com a service_role (jobs do GitHub Actions).

O padrão do MONITORA é falar com o banco só por RPC (SECURITY DEFINER): os
jobs não leem tabela direto, nem com a service_role. Cada job chama as RPCs
dele (as de carga do robô da Empregare, as de leitura e gravação das
conferências…), concedidas só ao service_role.

Variáveis: SUPABASE_URL (aceita VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.
Repete até 3 vezes só erro de rede ou 5xx; erro do banco (4xx) não melhora
repetindo. Do erro do PostgREST sobem só `code` e `message`, mascarados:
`details` e `hint` ficam de fora porque o Postgres põe neles a linha recusada
inteira ("Failing row contains (...)"), com nome e data de nascimento, que o
mascaramento não reconhece. As RPCs que criam registro (`iniciar_*`) devem
ser chamadas com `tentativas=1`: repetir depois de uma resposta perdida
esbarra na execução que a primeira tentativa já abriu.

Funções da Vercel (api/*.py) NÃO usam este módulo: lá a chamada vai com o
Bearer de quem pediu, para o banco decidir a permissão (ver
docs/python-no-monitora.md).
"""

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


def chamar(config, funcao, corpo, tentativas=3, abrir=urllib.request.urlopen, esperar=time.sleep, tempo_limite=120):
    dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
    ultimo = None
    for tentativa in range(1, tentativas + 1):
        pedido = urllib.request.Request(
            f"{config['url']}/rest/v1/rpc/{funcao}",
            data=dados,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": config["chave"],
                "Authorization": f"Bearer {config['chave']}",
            },
        )
        try:
            with abrir(pedido, timeout=tempo_limite) as resposta:
                texto = resposta.read().decode("utf-8")
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as erro:
            texto = erro.read().decode("utf-8", "replace")
            ultimo = ErroDoSupabase(funcao, erro.code, texto_do_erro(texto))
            if erro.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException) as erro:
            ultimo = ErroDoSupabase(funcao, "sem resposta", str(erro))
        esperar(1.5 * tentativa)
    raise ultimo
