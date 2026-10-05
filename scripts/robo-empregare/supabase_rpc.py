"""
Chamadas às RPCs de carga do robô da Empregare, com a service_role.

Variáveis: SUPABASE_URL (aceita VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.
Repete até 3 vezes só erro de rede ou 5xx; erro do banco (4xx) não melhora
repetindo. A mensagem de erro passa pelo mascaramento antes de subir.
"""

import json
import os
import time
import urllib.error
import urllib.request

from mascaramento import mascarar

GUIA = "docs/robo-empregare.md"


class ErroDoSupabase(Exception):
    def __init__(self, funcao, status, mensagem):
        super().__init__(f"{funcao} respondeu {status}: {mascarar(mensagem)[:400]}")
        self.funcao = funcao
        self.status = status


def configuracao():
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip().rstrip("/")
    chave = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url.startswith("https://"):
        raise SystemExit("Falta SUPABASE_URL (https://…).")
    if not chave:
        raise SystemExit(
            "Falta SUPABASE_SERVICE_ROLE_KEY. O robô roda pelo GitHub Actions "
            f"(Actions → Robô da Empregare); veja {GUIA}."
        )
    return {"url": url, "chave": chave}


def chamar(config, funcao, corpo, tentativas=3, abrir=urllib.request.urlopen, esperar=time.sleep):
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
            with abrir(pedido, timeout=120) as resposta:
                texto = resposta.read().decode("utf-8")
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as erro:
            texto = erro.read().decode("utf-8", "replace")
            ultimo = ErroDoSupabase(funcao, erro.code, texto)
            if erro.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError) as erro:
            ultimo = ErroDoSupabase(funcao, "sem resposta", str(erro))
        esperar(1.5 * tentativa)
    raise ultimo
