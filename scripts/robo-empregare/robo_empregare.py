"""
ROBÔ DA EMPREGARE: CANDIDATOS DE CADA VAGA → MONITORA

A Empregare não tem API. Este robô (Selenium, Chrome headless) entra no portal
da empresa, pede a exportação "Candidatos da vaga (Excel)" de cada vaga, baixa
os arquivos na Central de Exportações, lê cada Excel e grava os candidatos no
Supabase pelas RPCs de carga (supabase/migrations/20261005170000_robo_empregare.sql).
A lista de vagas vem do próprio MONITORA (listar_vagas_empregare): do quadro de
vagas do edital (fonte principal) e, para editais antigos, da Seleção
(supabase/migrations/20261006080000_robo_empregare_vagas_do_quadro.sql).

Roda pelo GitHub Actions (.github/workflows/robo-empregare.yml): no horário de
reserva, pelo botão "Run workflow" ou pelo "Rodar agora" das Configurações
(RPC disparar_robo). Guia de operação: docs/robo-empregare.md.

Uso
  python scripts/robo-empregare/robo_empregare.py --seco
      só lista as vagas que exportaria (lê o MONITORA; não entra na Empregare)
  python scripts/robo-empregare/robo_empregare.py --fumaca
      teste de fumaça: entra na Empregare, abre Vagas e a Central e sai
      (não exporta, não grava; não precisa do Supabase)
  python scripts/robo-empregare/robo_empregare.py --sondar --vagas 177979 --limite 2
      só leitura: abre 1 a 3 candidatos da vaga e escreve no log a ESTRUTURA da
      aba Questionários (seletores, perguntas, padrão mascarado dos links dos
      anexos, status sem cookies); não exporta, não grava, não usa o Supabase
  python scripts/robo-empregare/robo_empregare.py [--editais 80/2026,81/2026]
      [--vagas 177979,177980] [--limite 60] [--forcar] [--anexos] [--disparado-por agenda|<uuid>]
      --anexos: também guarda o link de cada anexo do questionário (e o de
      impressão das respostas), lidos de GetRespostaDetails; anexos_empregare.py,
      migration 20261008160000
      Inscrições congeladas (migration 20261020170000): as vagas de edital com
      a trava ligada ficam fora da carga. Sem filtro, o robô as pula; com o
      edital ou a vaga pedidos, recusa a execução inteira (nada exportado).
      --forcar-congelado <token>: a liberação que o banco gravou quando o
      administrador global pediu "Forçar edital com inscrições congeladas"
      (disparar_robo); vai para listar_vagas_empregare e a execução registra o
      uso (registrar_uso_liberacao_congelamento). O banco confere de novo ao
      abrir cada vaga (FC_EMPREGARE_ABRIR_VAGA).
  python scripts/robo-empregare/robo_empregare.py --so-anexos --vagas 182514 [--candidatos 2160872] [--seco]
      só relê os anexos do questionário (so_anexos.py, migration 20261020130000):
      não exporta, não grava a carga nem fecha a vaga (situação, ativos e lote não
      mudam); sem --candidatos, relê os suspeitos (captura no dia da "DATA DE
      RESPOSTA" ou antes); nunca reduz anexos; --seco só compara, sem gravar.
      Edital com inscrições congeladas: só com --seco ou com --forcar-congelado
      (a liberação; o banco confere em gravar_anexos_empregare, migration
      20261022120000).
  python scripts/robo-empregare/robo_empregare.py --resumir-perguntas [--editais 114/2026] [--forcar]
      só recalcula o resumo das perguntas da carga (resumo_das_perguntas.py)
      dos editais cuja carga mudou (--forcar: de todos com carga); não entra
      na Empregare. A carga normal faz isso sozinha no fim.

Variáveis: EMPREGARE_EMAIL, EMPREGARE_SENHA, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
O log é público (repositório público): só contagens, códigos de vaga e números
de edital; toda mensagem passa por python/monitora/mascaramento.py.

Saída: 0 concluída; 1 erro (nada ou quase nada gravado); 2 parcial (alguma
vaga falhou ou foi recusada pela trava, ou os anexos do questionário de alguma
vaga não gravaram); 3 entrada inválida. No GitHub Actions, a saída do passo
"carga" (sim/nao) diz se alguma vaga foi gravada: só então o workflow
pré-classifica. Prazo único: PRAZO_DA_EXECUCAO; cancelamento ou tempo esgotado
(SIGTERM) fecha a execução no banco com erro.
"""

import contextlib
import os
import pathlib
import re
import sys
import tempfile
import time
from datetime import datetime

# A base comum (python/monitora/) vem do próprio repositório, sem instalar nada.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

import anexos_empregare as anexos  # noqa: E402
import navegador_empregare as nav  # noqa: E402
import resumo_das_perguntas  # noqa: E402
import so_anexos  # noqa: E402
from planilha_empregare import em_lotes, ler_planilha  # noqa: E402

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.execucao import FUSO, disparo, url_da_execucao  # noqa: E402
from monitora.mascaramento import mascarar, resumo_do_erro  # noqa: E402

GUIA = "docs/robo-empregare.md"
LIMITE_PADRAO = 60
# Candidatos por chamada de gravar_lote_empregare. Cada linha leva o questionário
# inteiro (~3 KB): com 500, a vaga 182528 (769 candidatos) estourou os 8 s do banco
# em 14/10. Com 200 o lote fica em ~0,3 s; se ainda estourar, o lote é dividido ao
# meio até TAMANHO_MINIMO_DO_LOTE (gravar_lote).
TAMANHO_DO_LOTE = 200
TAMANHO_MINIMO_DO_LOTE = 25
# Vagas por lote de exportação: pede, captura, baixa e grava o lote antes do próximo.
# A Central de Exportações mostra só as mais recentes por página (15): com 30 pedidas
# de uma vez, as 15 primeiras ficavam fora da lista ("ainda não listada").
TAMANHO_DO_LOTE_DE_EXPORTACAO = 10
# Prazos contados desde o login (o workflow tem 120 min; links e anexos já têm orçamento próprio).
PRAZO_PARA_NOVO_LOTE = 95 * 60  # segundos: depois disso, não começa outro lote
PRAZO_PARA_SEGUNDA_PASSADA = 90 * 60  # segundos: depois disso, sem segunda passada
# Prazo único da execução: nenhuma espera, download ou nova volta na Central passa dele. O que
# faltar vira falha e a execução fecha normal (finalizar_sync_empregare), com folga para o
# fechamento, o resumo das perguntas e o passo de pré-classificação antes dos 120 min.
PRAZO_DA_EXECUCAO = 105 * 60
# Anexos do questionário (--anexos): além do orçamento (anexos.ORCAMENTO_DOS_ANEXOS), param
# em PRAZO_DOS_ANEXOS menos RESERVA_POR_VAGA por vaga ainda não pedida: a carga das vagas
# que faltam (~1 min cada: pedir, lista de candidatos, baixar e gravar) cabe antes do
# PRAZO_PARA_NOVO_LOTE e o workflow termina com folga antes dos 120 min.
PRAZO_DOS_ANEXOS = 85 * 60
RESERVA_POR_VAGA = 60
TITULO = "Robô da Empregare → MONITORA"
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


# ── Entrada ─────────────────────────────────────────────────────────────────


def separar(texto):
    return [p for p in re.split(r"[\s,;]+", str(texto or "").strip()) if p]


def argumentos(lista=None):
    p = execucao.Argumentos(description="Robô da Empregare → MONITORA")
    p.add_argument("--seco", action="store_true", help="só lista as vagas que exportaria")
    p.add_argument("--fumaca", action="store_true", help="só entra na Empregare e abre a Central")
    p.add_argument("--forcar", action="store_true", help="aceita arquivo com menos da metade dos candidatos")
    p.add_argument("--sondar", action="store_true", help="só lê a estrutura da aba Questionários (1 a 3 candidatos)")
    p.add_argument("--anexos", action="store_true", help="também guarda o link de cada anexo do questionário")
    p.add_argument(
        "--so-anexos",
        action="store_true",
        help="só relê os anexos do questionário (sem exportar nem mexer em situação/lote; so_anexos.py)",
    )
    p.add_argument("--candidatos", default="", help="com --so-anexos: códigos de candidato da Empregare")
    p.add_argument(
        "--resumir-perguntas",
        action="store_true",
        help="só recalcula o resumo das perguntas da carga (sem entrar na Empregare)",
    )
    p.add_argument("--editais", default="", help="números de edital: 80/2026,81/2026")
    p.add_argument("--vagas", default="", help="códigos de vaga: 177979,177980")
    p.add_argument("--limite", type=int, default=LIMITE_PADRAO, help="máximo de vagas (1 a 500)")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    p.add_argument(
        "--forcar-congelado",
        default=os.environ.get("FORCAR_CONGELADO", ""),
        help="token da liberação do administrador global (edital com inscrições congeladas)",
    )
    args = p.parse_args(lista)
    args.forcar_congelado = str(args.forcar_congelado or "").strip().lower()
    if args.forcar_congelado:
        if not _UUID.fullmatch(args.forcar_congelado):
            p.error("--forcar-congelado inválido (é o token que o MONITORA manda)")
        if args.sondar or args.fumaca or args.resumir_perguntas:
            p.error("--forcar-congelado só nos modos que gravam (normal, forcar, só anexos) e no seco")
        if args.so_anexos and args.seco:
            p.error("--forcar-congelado não vale no só anexos com --seco (ele não grava)")

    args.editais = separar(args.editais)
    args.vagas = separar(args.vagas)
    ruins = [e for e in args.editais if not re.fullmatch(r"\d{1,4}/\d{4}", e)]
    if ruins:
        p.error(f"edital inválido: {', '.join(ruins)} (use o número, como 80/2026)")
    ruins = [v for v in args.vagas if not re.fullmatch(r"\d{1,20}", v)]
    if ruins:
        p.error(f"código de vaga inválido: {', '.join(mascarar(r) for r in ruins)} (só dígitos)")
    if not 1 <= args.limite <= 500:
        p.error("limite fora de 1 a 500")
    if args.sondar and len(args.vagas) != 1:
        p.error("o modo sondar pede exatamente um código de vaga em --vagas")
    args.candidatos = list(dict.fromkeys(separar(args.candidatos)))
    ruins = [c for c in args.candidatos if not re.fullmatch(r"\d{1,20}", c)]
    if ruins:
        p.error(f"código de candidato inválido: {', '.join(mascarar(r) for r in ruins[:5])} (só dígitos)")
    if args.candidatos and not args.so_anexos:
        p.error("--candidatos só com --so-anexos")
    if len(args.candidatos) > so_anexos.MAXIMO_DE_CANDIDATOS:
        p.error(f"no máximo {so_anexos.MAXIMO_DE_CANDIDATOS} candidatos")
    if args.so_anexos:
        if not (args.vagas or args.editais):
            p.error("--so-anexos pede --vagas ou --editais")
        if args.forcar or args.anexos or args.sondar or args.fumaca or args.resumir_perguntas:
            p.error("--so-anexos não combina com --forcar, --anexos, --sondar, --fumaca nem --resumir-perguntas")
    return args


def identificador(agora=None, sufixo=None):
    return execucao.identificador(agora, sufixo, prefixo="gh")


# ── Saída (log público) ─────────────────────────────────────────────────────


def registrar(texto):
    print(mascarar(texto), flush=True)


def resumir(linhas):
    execucao.resumir(TITULO, linhas)


def lista_de_codigos(vagas, maximo=80):
    codigos = [v["vaga"] for v in vagas]
    texto = ", ".join(codigos[:maximo])
    return texto + (f" … (+{len(codigos) - maximo})" if len(codigos) > maximo else "")


# ligada: vaga já ligada ao edital em TB_EMPREGARE_VAGA (edital em inscrição, sem análise
# nem Seleção; migration 20261009140000_acompanhamento_das_inscricoes.sql).
ORIGENS = (
    ("quadro", "quadro do edital"),
    ("selecao", "Seleção"),
    ("ligada", "ligadas ao edital"),
    ("pedida", "pedidas fora das fontes"),
)


def contagem_por_origem(vagas):
    """De onde vieram as vagas (campo 'origem' da lista): 'quadro do edital 5 · Seleção 2'. Só contagens."""
    contagem = {}
    for v in vagas:
        origem = v.get("origem") or "selecao"
        contagem[origem] = contagem.get(origem, 0) + 1
    partes = [f"{nome} {contagem.pop(chave)}" for chave, nome in ORIGENS if chave in contagem]
    partes += [f"{chave} {n}" for chave, n in sorted(contagem.items())]
    return " · ".join(partes) or "—"


# ── Carga de uma vaga ───────────────────────────────────────────────────────


def com_links(linhas, enderecos):
    """
    Põe em cada linha do Excel o link de detalhes do candidato (campo "link"),
    casando o código da linha com o data-pessoa-id da lista de candidaturas.
    Devolve (linhas, quantas com link).
    """
    links = (enderecos or {}).get("candidatos") or {}
    if not links:
        return linhas, 0
    saida = [dict(l, link=links[l["codigo"]]) if l.get("codigo") in links else l for l in linhas]
    return saida, sum(1 for l in saida if l.get("link"))


def fechar_vaga(config, corpo, vaga_interno, chamar):
    """
    fechar_vaga_empregare com o identificador interno da vaga. Banco sem a
    migration 20261007160000 (função sem p_vaga_interno: 404 do PostgREST)
    fecha como antes, sem o identificador. Uma tentativa só: se a resposta se
    perdeu, o fechamento (que desativa os ausentes) pode já ter rodado.
    """
    if not vaga_interno:
        return chamar(config, "fechar_vaga_empregare", corpo, tentativas=1)
    try:
        return chamar(config, "fechar_vaga_empregare", dict(corpo, p_vaga_interno=vaga_interno), tentativas=1)
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) != 404:
            raise
        registrar("O banco ainda não guarda o identificador interno da vaga (falta a migration 20261007160000).")
        return chamar(config, "fechar_vaga_empregare", corpo, tentativas=1)


def estourou_o_tempo(erro):
    """57014 = o banco cancelou a instrução no statement_timeout (a transação inteira volta)."""
    return isinstance(erro, supabase_rpc.ErroDoSupabase) and "57014" in str(erro)


def gravar_lote(config, sync, codigo, total, lote, chamar):
    """
    Grava um lote da vaga; devolve a resposta da última chamada. Se o banco
    cancelar por tempo (57014), divide o lote ao meio e grava as duas metades,
    até TAMANHO_MINIMO_DO_LOTE. Seguro porque a chamada cancelada não gravou
    nada (cada RPC é uma transação) e o upsert pela chave é idempotente; os
    ausentes só saem em fechar_vaga_empregare, depois do último lote.
    Uma tentativa por chamada (o 57014 nunca se repete igual: o lote se
    divide); erro de rede perde a vaga, não a execução.
    """
    corpo = {"p_sync": sync, "p_vaga": codigo, "p_total": total, "p_linhas": lote}
    try:
        return chamar(config, "gravar_lote_empregare", corpo, tentativas=1)
    except supabase_rpc.ErroDoSupabase as erro:
        if not estourou_o_tempo(erro) or len(lote) <= TAMANHO_MINIMO_DO_LOTE:
            raise
    meio = len(lote) // 2
    registrar(f"Vaga {codigo}: lote de {len(lote)} estourou o tempo do banco; gravando em duas partes.")
    r = gravar_lote(config, sync, codigo, total, lote[:meio], chamar)
    if (r or {}).get("situacao") == "RECUSADA":
        return r
    return gravar_lote(config, sync, codigo, total, lote[meio:], chamar)


def gravar_vaga(config, sync, codigo, caminho, chamar=supabase_rpc.chamar, enderecos=None, totais=None):
    """
    Lê o Excel e grava. Devolve 'GRAVADA', 'RECUSADA' ou 'FALHA'. `enderecos`
    (de PortalEmpregare.capturar_candidatos) leva o identificador interno da vaga
    e os links de detalhes dos candidatos; sem ele, grava como antes. `totais`
    (dict, opcional) soma "gravadas" e "anexos_com_falha" (vaga gravada cujos
    anexos do questionário o banco recusou: a execução sai parcial).
    """
    totais = totais if totais is not None else {}
    try:
        lido = ler_planilha(caminho, codigo)
    except Exception as erro:
        registrar(f"Vaga {codigo}: não consegui ler o Excel ({resumo_do_erro(erro)}).")
        return "FALHA"
    linhas, ligados = com_links(lido["linhas"], enderecos)
    try:
        for lote in em_lotes(linhas, TAMANHO_DO_LOTE):
            r = gravar_lote(config, sync, codigo, len(linhas), lote, chamar)
            if (r or {}).get("situacao") == "RECUSADA":
                break
        fim = fechar_vaga(
            config,
            {"p_sync": sync, "p_vaga": codigo, "p_colunas": lido["colunas"], "p_arquivo": os.path.basename(caminho)},
            (enderecos or {}).get("vaga_interno"),
            chamar,
        )
    except supabase_rpc.ErroDoSupabase as erro:
        registrar(f"Vaga {codigo}: o banco recusou a gravação ({erro}).")
        return "FALHA"
    except Exception as erro:
        # Resposta truncada, conexão derrubada, JSON inválido: perde esta vaga, não a execução.
        registrar(f"Vaga {codigo}: a gravação falhou ({resumo_do_erro(erro)}).")
        return "FALHA"
    situacao = (fim or {}).get("situacao", "FALHA")
    detalhes = f"{len(linhas)} candidatos no arquivo"
    if lido["sem_chave"]:
        detalhes += f", {lido['sem_chave']} sem código/CPF/e-mail (fora)"
    if lido["repetidas"]:
        detalhes += f", {lido['repetidas']} repetidos"
    if enderecos:
        detalhes += f", {ligados} com link da Empregare"
    if situacao == "GRAVADA":
        registrar(
            f"Vaga {codigo}: gravada · {detalhes} · {fim.get('ativos')} ativos · {fim.get('desativadas')} saíram."
        )
        totais["gravadas"] = totais.get("gravadas", 0) + 1
        if (enderecos or {}).get("anexos"):
            dos_anexos = {}
            anexos.gravar_anexos(
                config, sync, codigo, enderecos["anexos"], lido["colunas"], chamar, registrar, totais=dos_anexos
            )
            if dos_anexos.get("falhou"):
                totais["anexos_com_falha"] = totais.get("anexos_com_falha", 0) + 1
    elif situacao == "RECUSADA":
        motivo = (fim or {}).get("mensagem") or "menos da metade dos ativos; nada mudou"
        registrar(f"Vaga {codigo}: RECUSADA pela trava · {detalhes} ({motivo}).")
    return situacao


def sem_tempo(fim, agora):
    """O prazo único da execução (`fim`, no relógio `agora`) já passou?"""
    return fim is not None and agora() >= fim


def baixar_e_gravar(
    portal,
    config,
    sync,
    pedidas,
    pasta,
    desde,
    dormir=time.sleep,
    enderecos=None,
    fim=None,
    agora=time.monotonic,
    totais=None,
):
    """
    Percorre a Central até baixar cada vaga pedida. Devolve (baixadas, falhas,
    pendentes): `falhas` são as baixadas que não gravaram; `pendentes`, os
    códigos que não apareceram (ou não baixaram) depois de TENTATIVAS_CENTRAL
    ou do prazo único da execução (`fim`, no relógio `agora`).
    `enderecos`: {código da vaga: links capturados} (capturar_candidatos).
    Falha ao abrir ou ler a Central gasta só aquela tentativa.
    """
    enderecos = enderecos or {}
    pendentes = list(pedidas)
    baixadas = falhas = 0
    for tentativa in range(1, nav.TENTATIVAS_CENTRAL + 1):
        if not pendentes:
            break
        if sem_tempo(fim, agora):
            registrar(f"Prazo da execução ({PRAZO_DA_EXECUCAO // 60} min) esgotado: Central não aberta de novo.")
            break
        registrar(
            f"Central de Exportações: tentativa {tentativa}/{nav.TENTATIVAS_CENTRAL} ({len(pendentes)} vaga(s) pendente(s))."
        )
        try:
            portal.abrir_central()
            linhas = portal.ler_central()
        except Exception as erro:
            registrar(f"Central de Exportações: não abriu nesta tentativa ({resumo_do_erro(erro)}).")
            linhas = None
        if linhas is not None:
            registrar(
                f"Central de Exportações: {len(linhas)} exportação(ões) lida(s) em "
                f"{getattr(portal, 'paginas_da_central', 1) or 1} página(s)."
            )
        ainda = []
        for codigo in pendentes:
            if linhas is None or sem_tempo(fim, agora):
                ainda.append(codigo)
                continue
            linha, motivo = nav.escolher_exportacao(linhas, codigo, desde)
            if not linha:
                registrar(f"Vaga {codigo}: exportação ainda não disponível ({motivo}).")
                ainda.append(codigo)
                continue
            try:
                caminho = portal.baixar(linha, os.path.join(pasta, codigo))
            except Exception as erro:
                registrar(f"Vaga {codigo}: o download falhou ({resumo_do_erro(erro)}).")
                caminho = None
            if not caminho:
                registrar(f"Vaga {codigo}: o download não terminou (até {nav.TIMEOUT_DOWNLOAD}s).")
                ainda.append(codigo)
                continue
            baixadas += 1
            if gravar_vaga(config, sync, codigo, caminho, enderecos=enderecos.get(codigo), totais=totais) == "FALHA":
                falhas += 1
        pendentes = ainda
        if pendentes and tentativa < nav.TENTATIVAS_CENTRAL:
            espera = nav.ESPERA_ENTRE_TENTATIVAS if fim is None else min(nav.ESPERA_ENTRE_TENTATIVAS, fim - agora())
            if espera > 0:
                dormir(espera)
    if pendentes:
        registrar(f"Sem download nesta execução: {', '.join(pendentes)}.")
    return baixadas, falhas, pendentes


# ── Lotes de exportação ─────────────────────────────────────────────────────


def prazo_dos_anexos(gasto):
    """
    Até quando ler anexos nesta vaga (no relógio gasto["agora"]): o menor entre o
    limite por vaga, o que resta do orçamento e PRAZO_DOS_ANEXOS (desde o início)
    menos a reserva das vagas que ainda vão ser pedidas (gasto["faltam"]).
    None: sem tempo.
    """
    agora = gasto["agora"]()
    restante = anexos.ORCAMENTO_DOS_ANEXOS - gasto["anexos"]
    fim_da_execucao = gasto["inicio"] + PRAZO_DOS_ANEXOS - RESERVA_POR_VAGA * max(gasto["faltam"], 0)
    prazo = min(agora + anexos.TEMPO_LIMITE_DOS_ANEXOS, agora + restante, fim_da_execucao)
    return prazo if prazo > agora else None


def pedir_exportacoes(portal, vagas, enderecos, com_anexos, gasto, config=None, chamar=supabase_rpc.chamar):
    """
    Pede a exportação de cada vaga e, enquanto a Empregare gera os arquivos,
    captura os links da vaga e dos candidatos (e, com --anexos, os anexos do
    questionário: primeiro o lote, sem quem não finalizou o questionário e sem
    reler resposta já lida, por anexos.prioridades_da_vaga; até prazo_dos_anexos,
    com o tempo somado em gasto["anexos"]).
    Vaga já capturada (segunda passada) só pede a exportação de novo.
    Devolve (códigos pedidos, vagas cuja exportação não foi pedida).
    """
    gasto.setdefault("anexos", 0.0)
    gasto.setdefault("agora", time.monotonic)
    if "inicio" not in gasto:
        gasto["inicio"] = gasto["agora"]()
    gasto.setdefault("faltam", len(vagas))
    pedidas, nao_pedidas = [], []
    for v in vagas:
        codigo = v["vaga"]
        registrar(f"Vaga {codigo} (edital {v.get('edital') or '—'}): pedindo a exportação.")
        if not portal.exportar_vaga(codigo):
            nao_pedidas.append(v)
            continue
        pedidas.append(codigo)
        if codigo in enderecos:
            continue
        gasto["faltam"] -= 1
        # Enquanto a Empregare gera o arquivo: os links da vaga e dos candidatos.
        enderecos[codigo] = portal.capturar_candidatos(codigo)
        # --anexos: os anexos do questionário (GetRespostaDetails de cada resposta).
        respostas = (enderecos[codigo] or {}).pop("respostas", None)
        if not (com_anexos and respostas):
            continue
        prazo = prazo_dos_anexos(gasto)
        if prazo is None:
            registrar(f"Vaga {codigo}: sem tempo para os anexos nesta execução (o resto na próxima).")
            continue
        inicio = gasto["agora"]()
        prioridades = anexos.prioridades_da_vaga(config, codigo, chamar, registrar)
        enderecos[codigo]["anexos"] = anexos.capturar_anexos(
            portal, codigo, respostas, registrar, prazo, agora=gasto["agora"], prioridades=prioridades
        )
        gasto["anexos"] += gasto["agora"]() - inicio
    return pedidas, nao_pedidas


def exportar_e_baixar(
    portal, config, sync, vagas, pasta, enderecos, com_anexos, gasto, dormir, relogio, fim=None, totais=None
):
    """
    Um lote: pede as exportações, espera, baixa e grava. Devolve (baixadas,
    falhas na gravação, vagas que não saíram: exportação não pedida ou não baixada).
    `fim`: o prazo único da execução, no relógio gasto["agora"].
    """
    agora = gasto.get("agora", time.monotonic)
    desde = relogio()
    pedidas, nao_pedidas = pedir_exportacoes(portal, vagas, enderecos, com_anexos, gasto, config)
    if not pedidas:
        return 0, 0, nao_pedidas
    registrar(f"Aguardando a Empregare gerar os arquivos ({nav.ESPERA_APOS_EXPORTAR}s).")
    dormir(nav.ESPERA_APOS_EXPORTAR)
    baixadas, falhas, pendentes = baixar_e_gravar(
        portal, config, sync, pedidas, pasta, desde, dormir, enderecos, fim=fim, agora=agora, totais=totais
    )
    por_codigo = {v["vaga"]: v for v in vagas}
    return baixadas, falhas, nao_pedidas + [por_codigo[c] for c in pendentes]


def agora_na_empregare():
    return datetime.now(FUSO).replace(tzinfo=None)


def processar_vagas(
    portal,
    config,
    sync,
    vagas,
    pasta,
    com_anexos=False,
    dormir=time.sleep,
    agora=time.monotonic,
    relogio=agora_na_empregare,
    contagem=None,
):
    """
    Exporta, baixa e grava em lotes de TAMANHO_DO_LOTE_DE_EXPORTACAO vagas (a
    Central só mostra as exportações mais recentes: pedir todas de uma vez
    empurrava as primeiras para fora da lista). As que não saírem ganham uma
    segunda passada no fim (exportação pedida de novo, sem recapturar links),
    se ainda houver tempo. Devolve (baixadas, falhas). `contagem` (dict) recebe
    os mesmos números a cada lote: se a execução cair no meio, quem chamou sabe
    quanto já foi baixado (e "gravadas" e "anexos_com_falha", de gravar_vaga).
    Nada passa do prazo único da execução (PRAZO_DA_EXECUCAO, também posto no
    portal para os downloads e a leitura da Central): o que faltar vira falha.
    """
    inicio = agora()
    fim = inicio + PRAZO_DA_EXECUCAO
    if hasattr(portal, "prazo"):
        # O portal conta no time.monotonic: o prazo só vai para ele com o relógio de verdade.
        portal.prazo = fim if agora is time.monotonic else None
    enderecos = {}
    gasto = {"anexos": 0.0, "agora": agora, "inicio": inicio, "faltam": len(vagas)}
    total = contagem if contagem is not None else {}
    total.update(baixadas=0, falhas=0, gravadas=0, anexos_com_falha=0)
    de_novo = []
    lotes = em_lotes(list(vagas), TAMANHO_DO_LOTE_DE_EXPORTACAO)
    for n, lote in enumerate(lotes, 1):
        if agora() - inicio >= PRAZO_PARA_NOVO_LOTE:
            restantes = [v for resto in lotes[n - 1 :] for v in resto]
            registrar(
                f"Sem tempo para mais lotes ({PRAZO_PARA_NOVO_LOTE // 60} min): "
                f"{len(restantes)} vaga(s) ficaram de fora ({lista_de_codigos(restantes)})."
            )
            total["falhas"] += len(restantes)
            break
        registrar(f"Lote {n}/{len(lotes)}: {len(lote)} vaga(s) ({lista_de_codigos(lote)}).")
        b, f, sobra = exportar_e_baixar(
            portal, config, sync, lote, pasta, enderecos, com_anexos, gasto, dormir, relogio, fim, total
        )
        total["baixadas"] += b
        total["falhas"] += f
        de_novo += sobra
        registrar(
            f"Lote {n}/{len(lotes)}: {b} baixada(s) · {f} com falha na gravação · "
            f"{len(sobra)} para a segunda passada · {int(agora() - inicio) // 60} min de execução."
        )
    if not de_novo:
        return total["baixadas"], total["falhas"]
    if agora() - inicio >= PRAZO_PARA_SEGUNDA_PASSADA:
        registrar(
            f"Sem tempo para a segunda passada ({PRAZO_PARA_SEGUNDA_PASSADA // 60} min): "
            f"{len(de_novo)} vaga(s) com falha ({lista_de_codigos(de_novo)})."
        )
        total["falhas"] += len(de_novo)
        return total["baixadas"], total["falhas"]
    registrar(f"Segunda passada: pedindo de novo a exportação de {len(de_novo)} vaga(s) ({lista_de_codigos(de_novo)}).")
    sem_arquivo = []
    for lote in em_lotes(de_novo, TAMANHO_DO_LOTE_DE_EXPORTACAO):
        if sem_tempo(fim, agora):
            registrar(
                f"Prazo da execução ({PRAZO_DA_EXECUCAO // 60} min) esgotado na segunda passada: "
                f"{len(lote)} vaga(s) com falha ({lista_de_codigos(lote)})."
            )
            total["falhas"] += len(lote)
            sem_arquivo += lote
            continue
        b, f, sobra = exportar_e_baixar(
            portal, config, sync, lote, pasta, enderecos, com_anexos, gasto, dormir, relogio, fim, total
        )
        total["baixadas"] += b
        total["falhas"] += f + len(sobra)
        sem_arquivo += sobra
    registrar(
        f"Segunda passada: {len(de_novo) - len(sem_arquivo)} de {len(de_novo)} vaga(s) baixada(s) da Central"
        + (f"; com falha: {lista_de_codigos(sem_arquivo)}." if sem_arquivo else ".")
    )
    return total["baixadas"], total["falhas"]


# ── Resumo das perguntas da carga ───────────────────────────────────────────


def resumir_perguntas(config, editais=None, forcar=False, chamar=supabase_rpc.chamar):
    """
    Recalcula o resumo das perguntas dos editais cuja carga mudou (Python:
    resumo_das_perguntas.py). Nunca derruba a execução: devolve a linha do
    resumo final e se houve falha. Banco sem a migration 20261009180000: avisa.
    """
    try:
        feitos, falhas = resumo_das_perguntas.resumir_editais(config, registrar, chamar, editais, forcar)
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) == 404:
            return "Resumo das perguntas: o banco ainda não tem a migration 20261009180000.", False
        return f"Resumo das perguntas NÃO atualizado ({erro}); a tela segue com o anterior.", True
    except Exception as erro:
        return f"Resumo das perguntas NÃO atualizado ({resumo_do_erro(erro)}); a tela segue com o anterior.", True
    linha = f"Resumo das perguntas da carga: {feitos} edital(is) recalculado(s)"
    return (linha + (f", {falhas} com falha." if falhas else ".")), bool(falhas)


# ── Execução ────────────────────────────────────────────────────────────────


def fumaca():
    email, senha = nav.credenciais()
    with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
        portal.entrar(email, senha)
        portal.abrir_vagas_anunciadas()
        portal.abrir_central()
        linhas = portal.ler_central()
    resumir(
        [
            "Teste de fumaça: login aceito, Vagas Anunciadas e Central de Exportações abriram.",
            f"Exportações listadas na Central: {len(linhas)}. Nada foi exportado nem gravado.",
        ]
    )
    return 0


def sondar(args):
    """Modo sondar: só leitura, sem Supabase; o log leva só a estrutura (anexos_empregare.sondar)."""
    vaga = args.vagas[0]
    limite = min(args.limite, anexos.LIMITE_DA_SONDAGEM)
    if args.limite > limite:
        registrar(f"Sondagem: limite reduzido de {args.limite} para {limite} candidato(s).")
    email, senha = nav.credenciais()
    with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
        portal.entrar(email, senha)
        portal.abrir_vagas_anunciadas()
        linhas = anexos.sondar(portal, vaga, limite, registrar)
    resumir(linhas)
    return 0


@contextlib.contextmanager
def portal_logado():
    """O PortalEmpregare logado, em Vagas Anunciadas (pasta temporária para downloads)."""
    email, senha = nav.credenciais()
    with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
        portal.entrar(email, senha)
        portal.abrir_vagas_anunciadas()
        yield portal


def so_anexos_da_empregare(args, config, chamar=supabase_rpc.chamar, abrir_portal=portal_logado):
    """Modo --so-anexos (so_anexos.py): relê só os anexos; nunca exporta nem grava a carga."""
    tipo, usuario = disparo(args.disparado_por)
    ids = {"sync": identificador(), "tipo": tipo, "usuario": usuario, "url": url_da_execucao()}

    def liberar(sync):
        return usar_liberacao(config, args.forcar_congelado, sync, chamar)

    return so_anexos.executar(args, config, abrir_portal, registrar, resumir, chamar=chamar, ids=ids, liberar=liberar)


# ── Inscrições congeladas (migration 20261020170000) ─────────────────────────


def listar_vagas(config, args, chamar=None):
    """
    A lista de vagas da carga (listar_vagas_empregare, finalidade carga): as de
    edital com inscrições congeladas voltam em "congeladas", salvo a liberação
    do administrador global (--forcar-congelado). Banco sem a migration
    20261020170000: a lista de antes, com aviso.
    """
    chamar = chamar or supabase_rpc.chamar
    corpo = {"p_editais": args.editais or None, "p_vagas": args.vagas or None, "p_limite": args.limite}
    try:
        return (
            chamar(
                config,
                "listar_vagas_empregare",
                dict(corpo, p_finalidade="carga", p_liberacao=args.forcar_congelado or None),
            )
            or {}
        )
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) != 404:
            raise
    registrar("O banco ainda não tem a trava de inscrições congeladas (migration 20261020170000); lista sem ela.")
    return chamar(config, "listar_vagas_empregare", corpo) or {}


def texto_das_congeladas(congeladas):
    """'114/2026 (30 vaga(s))' — só números de edital e contagens."""
    return ", ".join(f"{c.get('edital') or 'sem número'} ({c.get('vagas', 0)} vaga(s))" for c in congeladas)


def recusa_das_congeladas(congeladas):
    """As linhas do resumo quando o pedido explícito cai em edital congelado."""
    return [
        f"Recusado: inscrições congeladas em {texto_das_congeladas(congeladas)}. Nada foi exportado nem gravado.",
        "Para carregar (ou reler os anexos) mesmo assim, o administrador global usa "
        "“Forçar edital com inscrições congeladas” em Status das atualizações › Rodar com opções (com motivo); "
        "o Só anexos com “só comparar” não grava e roda sem a liberação.",
    ]


def usar_liberacao(config, liberacao, execucao, chamar=None):
    """
    Registra que esta execução usa a liberação (registrar_uso_liberacao_congelamento):
    é o que deixa o banco gravar as vagas do edital congelado. Devolve a linha do
    log; nunca derruba a execução (sem o registro, o banco recusa as vagas).
    """
    if not liberacao:
        return None
    chamar = chamar or supabase_rpc.chamar
    try:
        r = (
            chamar(config, "registrar_uso_liberacao_congelamento", {"p_liberacao": liberacao, "p_execucao": execucao})
            or {}
        )
    except Exception as erro:
        return f"Override NÃO registrado ({resumo_do_erro(erro)}): o banco recusa as vagas de edital congelado."
    editais = r.get("editais") or []
    if not editais:
        return "Override vencido ou inválido: as vagas de edital congelado serão recusadas."
    return (
        "Override do administrador global registrado nesta execução: "
        f"inscrições congeladas liberadas em {', '.join(editais)}."
    )


def principal(args):
    if args.fumaca:
        return fumaca()
    if args.sondar:
        return sondar(args)

    config = supabase_rpc.configuracao(GUIA)
    if args.so_anexos:
        return so_anexos_da_empregare(args, config)
    if args.resumir_perguntas:
        linha, falhou = resumir_perguntas(config, args.editais, args.forcar)
        resumir([linha])
        return 2 if falhou else 0
    lista = listar_vagas(config, args)
    vagas = lista.get("vagas") or []
    editais = sorted({v.get("edital") for v in vagas if v.get("edital")})
    escolha = {"PADRAO": "vagas dos editais em curso", "EDITAIS": "editais pedidos", "VAGAS": "vagas pedidas"}
    congeladas = lista.get("congeladas") or []
    pedidas_congeladas = [c for c in congeladas if c.get("pedido")]
    linha_das_congeladas = (
        f"Editais com inscrições congeladas (pulados): {texto_das_congeladas(congeladas)}." if congeladas else None
    )

    if args.seco:
        resumir(
            [
                "Modo seco: não entrou na Empregare e nada foi gravado.",
                f"Escolha: {escolha.get(lista.get('modo'), lista.get('modo'))} · limite {lista.get('limite')}.",
                f"Vagas que seriam exportadas: {len(vagas)} (de {len(editais)} edital(is)).",
                f"Origem das vagas: {contagem_por_origem(vagas)}.",
                f"Códigos: {lista_de_codigos(vagas) or '—'}",
            ]
            + ([linha_das_congeladas] if linha_das_congeladas else [])
            + (["Num modo que grava, este pedido seria recusado."] if pedidas_congeladas else [])
        )
        return 0

    # Edital ou vaga pedidos de edital congelado: recusa a execução inteira (nada exportado).
    if pedidas_congeladas:
        resumir(recusa_das_congeladas(pedidas_congeladas))
        return 1

    email, senha = nav.credenciais()
    tipo, usuario = disparo(args.disparado_por)
    sync = identificador()
    filtro = {"editais": args.editais, "vagas": args.vagas, "limite": args.limite}
    if args.anexos:
        filtro["anexos"] = True
    if args.forcar_congelado:
        filtro["forcar_congelado"] = True
    supabase_rpc.chamar(
        config,
        "iniciar_sync_empregare",
        {
            "p_sync": sync,
            "p_disparo": tipo,
            "p_usuario": usuario,
            "p_filtro": filtro,
            "p_vagas_pedidas": len(vagas),
            "p_url": url_da_execucao(),
            "p_forcar": bool(args.forcar),
        },
        # Sem repetir: se a resposta se perdeu, a 2ª tentativa esbarraria na execução que a 1ª abriu.
        tentativas=1,
    )
    registrar(f"Execução {sync}: {len(vagas)} vaga(s) ({escolha.get(lista.get('modo'))}); disparo {tipo.lower()}.")
    registrar(f"Origem das vagas: {contagem_por_origem(vagas)}.")
    if linha_das_congeladas:
        registrar(linha_das_congeladas)
    linha_do_override = usar_liberacao(config, args.forcar_congelado, sync)
    if linha_do_override:
        registrar(linha_do_override)

    contagem = {"baixadas": 0, "falhas": 0, "gravadas": 0, "anexos_com_falha": 0}
    try:
        # Cancelamento ou tempo esgotado no GitHub (SIGTERM/SIGINT) também fecha a execução.
        with execucao.interromper_com_excecao():
            if vagas:
                with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
                    portal.entrar(email, senha)
                    portal.abrir_vagas_anunciadas()
                    processar_vagas(portal, config, sync, vagas, pasta, args.anexos, contagem=contagem)
    except (Exception, execucao.ExecucaoInterrompida) as erro:
        baixadas, falhas = contagem["baixadas"], contagem["falhas"]
        mensagem = resumo_do_erro(erro)
        try:
            supabase_rpc.chamar(
                config,
                "finalizar_sync_empregare",
                {"p_sync": sync, "p_vagas_baixadas": baixadas, "p_vagas_falha": falhas, "p_erro": mensagem},
                tentativas=1,
            )
        except Exception as erro_ao_fechar:
            registrar(f"Também não consegui fechar a execução no banco ({resumo_do_erro(erro_ao_fechar)}).")
        execucao.saida_do_passo("carga", "sim" if contagem.get("gravadas") else "nao")
        resumir([f"Execução {sync} FALHOU: {mensagem}", f"Vagas baixadas antes da falha: {baixadas}."])
        return 1

    baixadas, falhas = contagem["baixadas"], contagem["falhas"]
    # O passo seguinte do workflow (pré-classificação) só roda se alguma vaga foi gravada.
    execucao.saida_do_passo("carga", "sim" if contagem.get("gravadas") else "nao")
    fim = (
        supabase_rpc.chamar(
            config,
            "finalizar_sync_empregare",
            {"p_sync": sync, "p_vagas_baixadas": baixadas, "p_vagas_falha": falhas, "p_erro": None},
            # Sem repetir: se a resposta se perdeu, a execução já pode estar fechada.
            tentativas=1,
        )
        or {}
    )
    situacao = fim.get("situacao", "FALHOU")
    anexos_com_falha = contagem.get("anexos_com_falha", 0)
    # Depois de fechar: o resumo das perguntas dos editais cuja carga mudou (não muda a saída).
    linha_do_resumo, _ = resumir_perguntas(config)
    resumir(
        [
            f"Execução {sync}: {situacao}.",
            f"Vagas pedidas: {len(vagas)} · baixadas: {baixadas} · com falha: {falhas} · recusadas pela trava: {fim.get('recusadas', 0)}.",
            f"Candidatos gravados: {fim.get('linhas', 0)} · saíram (inativos): {fim.get('desativadas', 0)}.",
            linha_do_resumo,
            f"Códigos: {lista_de_codigos(vagas) or '—'}",
        ]
        + (
            [f"Anexos do questionário NÃO gravados em {anexos_com_falha} vaga(s) (ver o log): saída parcial."]
            if anexos_com_falha
            else []
        )
        + ([linha_das_congeladas] if linha_das_congeladas else [])
        + ([linha_do_override] if linha_do_override else [])
    )
    codigo = {"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1)
    return execucao.PARCIAL if codigo == 0 and anexos_com_falha else codigo


def main(lista=None):
    # Acentos no console do Windows (no GitHub Actions a saída já é UTF-8).
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    try:
        return principal(argumentos(lista))
    except SystemExit:
        raise
    except Exception as erro:
        registrar(f"Erro: {resumo_do_erro(erro)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
