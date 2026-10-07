"""
EXPURGO DIÁRIO DOS ANEXOS DO CHAT (job Python)

Tira do Storage (bucket chat-anexos) os arquivos dos anexos de mensagens que
a retenção ou o "Zerar mensagens" já apagaram — a fila TB_EXPURGO_ANEXO_CHAT —
sem depender de um administrador abrir Configurações › Mensagens (chat). Em
lotes: preparar_expurgo_anexos_chat → remove pela API do Storage →
confirmar_expurgo_anexos_chat; o que falhar fica na fila para a próxima vez
(python/monitora/chat/expurgo.py). Registra cada execução em
TL_EXPURGO_ANEXO_CHAT (registrar_expurgo_anexos_chat), que o Status das
atualizações mostra. Migration:
supabase/migrations/20261007250000_expurgo_diario_dos_anexos_do_chat.sql.

Roda pelo GitHub Actions (.github/workflows/expurgo-anexos-chat.yml): todo dia
às 6h30 de Brasília, pelo "Rodar agora" das Configurações › Status das
atualizações (RPC disparar_robo) ou pelo "Run workflow". Guia:
docs/python-no-monitora.md.

Uso
  python scripts/expurgo_anexos_chat/expurgo_anexos_chat.py --seco
      só lê a fila (um lote) e diz quantos sairiam; não remove, não confirma
      e não registra. A leitura da fila (preparar_expurgo_anexos_chat) põe
      nela os arquivos enviados e nunca anexados há mais de 1 dia — só fila,
      nada sai do Storage.
  python scripts/expurgo_anexos_chat/expurgo_anexos_chat.py [--disparado-por agenda|<uuid>] [--lotes 50]

Variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (os mesmos secrets dos
outros jobs). O log é público (repositório público): só contagens — nunca
caminho, nome de arquivo nem conteúdo.

Saída: 0 concluída; 2 parcial (algum arquivo ficou na fila); 1 erro.
"""

import argparse
import functools
import os
import pathlib
import sys
from datetime import UTC, datetime

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.chat import expurgo  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Expurgo diário dos anexos do chat → Storage"
log = registro("expurgo_anexos_chat")


def argumentos(lista=None):
    p = argparse.ArgumentParser(description=TITULO)
    p.add_argument("--seco", action="store_true", help="só lê a fila; não remove nem confirma")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    p.add_argument(
        "--lotes",
        type=int,
        default=expurgo.LOTES_POR_EXECUCAO,
        help=f"máximo de lotes de {expurgo.TAMANHO_DO_LOTE} (1 a 500)",
    )
    args = p.parse_args(lista)
    if not 1 <= args.lotes <= 500:
        p.error("lotes fora de 1 a 500")
    return args


def linhas_do_resumo(resultado):
    pendentes = "—" if resultado.pendentes is None else resultado.pendentes
    return [
        f"Lotes: {resultado.lotes} · removidos do Storage: {resultado.removidos} · "
        f"confirmados: {resultado.confirmados} · ficaram na fila: {resultado.falhas}.",
        f"Arquivos na fila agora: {pendentes}."
        + (f" Pedidos ao Storage que falharam: {resultado.pedidos_recusados}." if resultado.pedidos_recusados else ""),
    ]


def principal(args, configuracao=None, chamar_rpc=None, remover=None, agora=None):
    cfg = configuracao or supabase_rpc.configuracao("docs/python-no-monitora.md")
    chamar_rpc = chamar_rpc or supabase_rpc.chamar
    remover = remover or functools.partial(expurgo.remover_do_storage, cfg)

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    if args.seco:
        resultado = expurgo.expurgar(chamar, remover, seco=True, log=log)
        pendentes = "—" if resultado.pendentes is None else resultado.pendentes
        execucao.resumir(
            TITULO,
            [
                "Modo seco: nada foi removido nem confirmado.",
                f"Arquivos na fila: {pendentes} · o primeiro lote removeria {resultado.no_lote}.",
            ],
        )
        return 0

    inicio = (agora or (lambda: datetime.now(UTC)))()
    tipo, usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="expurgo")
    log.info("Execução %s (disparo %s).", id_execucao, tipo.lower())

    def registrar(resultado, erro=None):
        return (
            chamar(
                "registrar_expurgo_anexos_chat",
                {
                    "p_execucao": id_execucao,
                    "p_disparo": tipo,
                    "p_usuario": usuario,
                    "p_url": execucao.url_da_execucao(),
                    "p_inicio": inicio.isoformat(),
                    "p_contagens": resultado.contagens(),
                    "p_erro": erro,
                },
                # Sem repetir: se a resposta se perdeu, a 2ª tentativa esbarraria no registro da 1ª.
                tentativas=1,
            )
            or {}
        )

    resultado = expurgo.Resultado()
    try:
        resultado = expurgo.expurgar(chamar, remover, lotes=args.lotes, log=log)
    except Exception as erro:
        mensagem = expurgo.sem_caminhos(erro)[:500]
        try:
            registrar(resultado, mensagem)
        except Exception as erro_ao_registrar:
            log.error("Também não consegui registrar a execução: %s", expurgo.sem_caminhos(erro_ao_registrar))
        execucao.resumir(TITULO, [f"Execução {id_execucao} FALHOU: {mensagem}"] + linhas_do_resumo(resultado))
        return 1

    try:
        situacao = registrar(resultado).get("situacao", "FALHOU")
    except Exception as erro:
        # Os arquivos já saíram e foram confirmados; só o registro da execução falhou.
        log.error("Não consegui registrar a execução: %s", expurgo.sem_caminhos(erro))
        situacao = "FALHOU"
    execucao.resumir(TITULO, [f"Execução {id_execucao}: {situacao}."] + linhas_do_resumo(resultado))
    return {"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1)


def main(lista=None):
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    try:
        return principal(argumentos(lista))
    except SystemExit:
        raise
    except Exception as erro:
        log.error("Erro: %s", expurgo.sem_caminhos(erro))
        return 1


if __name__ == "__main__":
    sys.exit(main())
