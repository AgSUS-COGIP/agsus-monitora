"""
PACOTES DOS PAINÉIS (job Python)

Monta os pacotes prontos do Painel de análises (TA_PAINEL_ANALISE), da Lista de aprovados
(TA_CANDIDATO_APROVADO_AREA) e do Painel de entrevistas (TA_PAINEL_ENTREVISTA) das áreas
desatualizadas — marca de mudança (TL_ALTERACAO_CACHE), sem pacote ou pacote de mais de 24 h — e
grava (migration 20261029180000). A montagem (cópia fiel das funções SQL de antes) está em
python/monitora/paineis/pacotes.py; o banco só lê as fontes e valida o que grava.

RPCs (todas só service_role):
    paineis_ler_pendentes()                      o que está desatualizado
    paineis_ler_fontes(p_cache, p_area)          as fontes cruas de uma área e as marcas vistas
    paineis_gravar_pacote(...)                   valida e grava; apaga só as marcas lidas

Roda pelo GitHub Actions (.github/workflows/pacotes-dos-paineis.yml): pedido pela rodada do
pg_cron dos pacotes (private."PR_REMONTAR_CACHE_AGENDADO", chave "Pacotes dos painéis") e pelo
"Run workflow". Se o job não der conta, o banco monta como antes (reserva). As sincronizações de
Entrevistas e Seleção não são tocadas: o pacote das entrevistas sai dos dados que já estão no banco.

Uso
  python scripts/paineis/pacotes.py --seco
      só lê e monta; imprime por pacote e área quantas linhas sairiam; não grava nada
  python scripts/paineis/pacotes.py [--caches ANALISES,APROVADOS,ENTREVISTAS] [--disparado-por agenda|<uuid>]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. O log é público: só pacotes, áreas e contagens.

Saída: 0 concluída; 1 erro; 2 parcial (alguma área falhou); 3 entrada inválida.
"""

import os
import pathlib
import sys
import time

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.paineis import json_exato, pacotes  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Pacotes dos painéis → MONITORA"
CACHES = ("ANALISES", "APROVADOS", "ENTREVISTAS")
log = registro("pacotes-dos-paineis")


def lista_de_caches(texto):
    escolhidos = [c.strip().upper() for c in str(texto or "").split(",") if c.strip()]
    for c in escolhidos:
        if c not in CACHES:
            raise ValueError(f"pacote desconhecido: {c[:30]}")
    return escolhidos or list(CACHES)


def argumentos(lista=None):
    p = execucao.Argumentos(description=TITULO)
    p.add_argument("--seco", action="store_true", help="só lê e monta; não grava")
    p.add_argument("--caches", default=os.environ.get("CACHES", ""), help="ANALISES,APROVADOS,ENTREVISTAS")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    return p.parse_args(lista)


def pendentes(chamar, caches):
    dados = chamar("paineis_ler_pendentes", {}) or {}
    if dados.get("schema_version") != 1 or not isinstance(dados.get("pendentes"), list):
        raise ValueError("paineis_ler_pendentes: formato desconhecido")
    return [(p["cache"], p["area"], p.get("motivo")) for p in dados["pendentes"] if p.get("cache") in caches]


def principal(args, configuracao=None, chamar_rpc=None, relogio=time.perf_counter):
    try:
        caches = lista_de_caches(args.caches)
    except ValueError as erro:
        log.error("Entrada inválida: %s", erro)
        return execucao.ENTRADA_INVALIDA
    cfg = supabase_rpc.configuracao("docs/python-no-monitora.md") if configuracao is None else configuracao
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    tipo, _usuario = execucao.disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="paineis")
    resumo, falhas = [], 0
    fila = pendentes(chamar, caches)
    for cache, area, motivo in fila:
        inicio = relogio()
        try:
            fontes = chamar(
                "paineis_ler_fontes", {"p_cache": cache, "p_area": area}, decodificar=json_exato.ler, tempo_limite=300
            )
            lido = relogio()
            pacote = pacotes.montar(cache, fontes)
            montado = relogio()
            linhas = pacotes.linhas_do_pacote(cache, pacote)
            if args.seco:
                resumo.append(
                    f"{cache} {area} ({motivo}): {linhas} linha(s) · leitura {lido - inicio:.1f} s · "
                    f"montagem {montado - lido:.1f} s · marcas {len(fontes['marcas'])} · não gravado"
                )
                continue
            r = (
                chamar(
                    "paineis_gravar_pacote",
                    {
                        "p_cache": cache,
                        "p_area": area,
                        "p_lido_em": fontes["lido_em"],
                        "p_marcas": fontes["marcas"],
                        "p_pacote": pacote,
                        "p_execucao": id_execucao,
                    },
                    codificar=json_exato.escrever,
                    decodificar=json_exato.ler,
                    tempo_limite=300,
                    # Sem repetir: a primeira tentativa pode ter gravado e só a resposta se perdido.
                    tentativas=1,
                )
                or {}
            )
            fim = relogio()
            gravado = "gravado" if int(r.get("gravados") or 0) > 0 else "já havia um mais novo"
            resumo.append(
                f"{cache} {area} ({motivo}): {linhas} linha(s), {gravado} · marcas apagadas "
                f"{int(r.get('marcas_apagadas') or 0)} · leitura {lido - inicio:.1f} s · montagem "
                f"{montado - lido:.1f} s · gravação {fim - montado:.1f} s"
            )
        except Exception as erro:
            # Uma área que falha não segura as outras; a marca fica e a próxima rodada tenta de novo
            # (ou o banco monta na reserva).
            falhas += 1
            log.error("%s %s: %s", cache, area, resumo_do_erro(erro))
            resumo.append(f"{cache} {area}: FALHOU ({resumo_do_erro(erro)[:200]})")

    cabeca = f"Execução {id_execucao} (disparo {tipo.lower()}): {len(fila)} pacote(s) desatualizado(s)"
    if args.seco:
        cabeca += " · modo seco: nada foi gravado"
    execucao.resumir(TITULO, [cabeca + ".", *(resumo or ["Nada a montar."])])
    if falhas and falhas == len(fila):
        return execucao.ERRO
    return execucao.PARCIAL if falhas else execucao.CONCLUIDA


def main(lista=None):
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    try:
        return principal(argumentos(lista))
    except SystemExit:
        raise
    except Exception as erro:
        log.error("Erro: %s", resumo_do_erro(erro))
        return execucao.ERRO


if __name__ == "__main__":
    sys.exit(main())
