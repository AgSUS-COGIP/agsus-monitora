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
(api/rodar-carga.js). Guia de operação: docs/robo-empregare.md.

Uso
  python scripts/robo-empregare/robo_empregare.py --seco
      só lista as vagas que exportaria (lê o MONITORA; não entra na Empregare)
  python scripts/robo-empregare/robo_empregare.py --fumaca
      teste de fumaça: entra na Empregare, abre Vagas e a Central e sai
      (não exporta, não grava; não precisa do Supabase)
  python scripts/robo-empregare/robo_empregare.py [--editais 80/2026,81/2026]
      [--vagas 177979,177980] [--limite 60] [--forcar] [--disparado-por agenda|<uuid>]

Variáveis: EMPREGARE_EMAIL, EMPREGARE_SENHA, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
O log é público (repositório público): só contagens, códigos de vaga e números
de edital; toda mensagem passa por mascaramento.py.

Saída: 0 concluída; 1 erro (nada ou quase nada gravado); 2 parcial (alguma
vaga falhou ou foi recusada pela trava).
"""

import argparse
import os
import re
import sys
import tempfile
import time
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import navegador_empregare as nav
import supabase_rpc
from mascaramento import mascarar, resumo_do_erro
from planilha_empregare import em_lotes, ler_planilha

FUSO = ZoneInfo("America/Sao_Paulo")
LIMITE_PADRAO = 60
TAMANHO_DO_LOTE = 500
TITULO = "Robô da Empregare → MONITORA"
_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


# ── Entrada ─────────────────────────────────────────────────────────────────


def separar(texto):
    return [p for p in re.split(r"[\s,;]+", str(texto or "").strip()) if p]


def argumentos(lista=None):
    p = argparse.ArgumentParser(description="Robô da Empregare → MONITORA")
    p.add_argument("--seco", action="store_true", help="só lista as vagas que exportaria")
    p.add_argument("--fumaca", action="store_true", help="só entra na Empregare e abre a Central")
    p.add_argument("--forcar", action="store_true", help="aceita arquivo com menos da metade dos candidatos")
    p.add_argument("--editais", default="", help="números de edital: 80/2026,81/2026")
    p.add_argument("--vagas", default="", help="códigos de vaga: 177979,177980")
    p.add_argument("--limite", type=int, default=LIMITE_PADRAO, help="máximo de vagas (1 a 500)")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    args = p.parse_args(lista)

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
    return args


def disparo(valor):
    """('AGENDA'|'MONITORA'|'GITHUB', uuid do usuário ou None)."""
    v = str(valor or "").strip()
    if v.lower() == "agenda":
        return "AGENDA", None
    if _UUID.fullmatch(v):
        return "MONITORA", v.lower()
    return "GITHUB", None


def identificador(agora=None, sufixo=None):
    agora = agora or datetime.now(FUSO)
    return f"gh-{agora:%Y%m%dT%H%M%S}-{(sufixo or uuid.uuid4().hex)[:8]}"


def url_da_execucao(ambiente=None):
    a = os.environ if ambiente is None else ambiente
    servidor, repositorio, execucao = (a.get(n, "") for n in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"))
    if servidor == "https://github.com" and repositorio and execucao.isdigit():
        return f"{servidor}/{repositorio}/actions/runs/{execucao}"
    return None


# ── Saída (log público) ─────────────────────────────────────────────────────


def registrar(texto):
    print(mascarar(texto), flush=True)


def resumir(linhas):
    texto = "\n".join([f"## {TITULO}", ""] + [f"- {mascarar(l)}" for l in linhas])
    print(texto, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as saida:
            saida.write(texto + "\n")


def lista_de_codigos(vagas, maximo=80):
    codigos = [v["vaga"] for v in vagas]
    texto = ", ".join(codigos[:maximo])
    return texto + (f" … (+{len(codigos) - maximo})" if len(codigos) > maximo else "")


ORIGENS = (("quadro", "quadro do edital"), ("selecao", "Seleção"), ("pedida", "pedidas fora das duas"))


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


def gravar_vaga(config, sync, codigo, caminho, chamar=supabase_rpc.chamar):
    """Lê o Excel e grava. Devolve 'GRAVADA', 'RECUSADA' ou 'FALHA'."""
    try:
        lido = ler_planilha(caminho, codigo)
    except Exception as erro:
        registrar(f"Vaga {codigo}: não consegui ler o Excel ({resumo_do_erro(erro)}).")
        return "FALHA"
    linhas = lido["linhas"]
    try:
        for lote in em_lotes(linhas, TAMANHO_DO_LOTE):
            r = chamar(
                config,
                "gravar_lote_empregare",
                {"p_sync": sync, "p_vaga": codigo, "p_total": len(linhas), "p_linhas": lote},
            )
            if (r or {}).get("situacao") == "RECUSADA":
                break
        fim = chamar(
            config,
            "fechar_vaga_empregare",
            {"p_sync": sync, "p_vaga": codigo, "p_colunas": lido["colunas"], "p_arquivo": os.path.basename(caminho)},
        )
    except supabase_rpc.ErroDoSupabase as erro:
        registrar(f"Vaga {codigo}: o banco recusou a gravação ({erro}).")
        return "FALHA"
    situacao = (fim or {}).get("situacao", "FALHA")
    detalhes = f"{len(linhas)} candidatos no arquivo"
    if lido["sem_chave"]:
        detalhes += f", {lido['sem_chave']} sem código/CPF/e-mail (fora)"
    if lido["repetidas"]:
        detalhes += f", {lido['repetidas']} repetidos"
    if situacao == "GRAVADA":
        registrar(f"Vaga {codigo}: gravada · {detalhes} · {fim.get('ativos')} ativos · {fim.get('desativadas')} saíram.")
    elif situacao == "RECUSADA":
        registrar(f"Vaga {codigo}: RECUSADA pela trava · {detalhes} (menos da metade dos ativos; nada mudou).")
    return situacao


def baixar_e_gravar(portal, config, sync, pedidas, pasta, desde, dormir=time.sleep):
    """Percorre a Central até baixar cada vaga pedida. Devolve (baixadas, falhas)."""
    pendentes = list(pedidas)
    baixadas = falhas = 0
    for tentativa in range(1, nav.TENTATIVAS_CENTRAL + 1):
        if not pendentes:
            break
        registrar(f"Central de Exportações: tentativa {tentativa}/{nav.TENTATIVAS_CENTRAL} ({len(pendentes)} vaga(s) pendente(s)).")
        portal.abrir_central()
        linhas = portal.ler_central()
        ainda = []
        for codigo in pendentes:
            linha, motivo = nav.escolher_exportacao(linhas, codigo, desde)
            if not linha:
                registrar(f"Vaga {codigo}: exportação ainda não disponível ({motivo}).")
                ainda.append(codigo)
                continue
            caminho = portal.baixar(linha, os.path.join(pasta, codigo))
            if not caminho:
                registrar(f"Vaga {codigo}: o download não terminou em {nav.TIMEOUT_DOWNLOAD}s.")
                ainda.append(codigo)
                continue
            baixadas += 1
            if gravar_vaga(config, sync, codigo, caminho) == "FALHA":
                falhas += 1
        pendentes = ainda
        if pendentes and tentativa < nav.TENTATIVAS_CENTRAL:
            dormir(nav.ESPERA_ENTRE_TENTATIVAS)
    if pendentes:
        registrar(f"Sem download depois de {nav.TENTATIVAS_CENTRAL} tentativas: {', '.join(pendentes)}.")
    return baixadas, falhas + len(pendentes)


# ── Execução ────────────────────────────────────────────────────────────────


def fumaca():
    email, senha = nav.credenciais()
    with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
        portal.entrar(email, senha)
        portal.abrir_vagas_anunciadas()
        portal.abrir_central()
        linhas = portal.ler_central()
    resumir(["Teste de fumaça: login aceito, Vagas Anunciadas e Central de Exportações abriram.",
             f"Exportações listadas na Central: {len(linhas)}. Nada foi exportado nem gravado."])
    return 0


def principal(args):
    if args.fumaca:
        return fumaca()

    config = supabase_rpc.configuracao()
    lista = supabase_rpc.chamar(
        config,
        "listar_vagas_empregare",
        {"p_editais": args.editais or None, "p_vagas": args.vagas or None, "p_limite": args.limite},
    )
    vagas = lista.get("vagas") or []
    editais = sorted({v.get("edital") for v in vagas if v.get("edital")})
    escolha = {"PADRAO": "vagas dos editais em curso", "EDITAIS": "editais pedidos", "VAGAS": "vagas pedidas"}

    if args.seco:
        resumir([
            "Modo seco: não entrou na Empregare e nada foi gravado.",
            f"Escolha: {escolha.get(lista.get('modo'), lista.get('modo'))} · limite {lista.get('limite')}.",
            f"Vagas que seriam exportadas: {len(vagas)} (de {len(editais)} edital(is)).",
            f"Origem das vagas: {contagem_por_origem(vagas)}.",
            f"Códigos: {lista_de_codigos(vagas) or '—'}",
        ])
        return 0

    email, senha = nav.credenciais()
    tipo, usuario = disparo(args.disparado_por)
    sync = identificador()
    filtro = {"editais": args.editais, "vagas": args.vagas, "limite": args.limite}
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
    )
    registrar(f"Execução {sync}: {len(vagas)} vaga(s) ({escolha.get(lista.get('modo'))}); disparo {tipo.lower()}.")
    registrar(f"Origem das vagas: {contagem_por_origem(vagas)}.")

    baixadas = falhas = 0
    try:
        if vagas:
            with tempfile.TemporaryDirectory() as pasta, nav.PortalEmpregare(pasta, registrar) as portal:
                portal.entrar(email, senha)
                portal.abrir_vagas_anunciadas()
                desde = datetime.now(FUSO).replace(tzinfo=None)
                pedidas = []
                for v in vagas:
                    registrar(f"Vaga {v['vaga']} (edital {v.get('edital') or '—'}): pedindo a exportação.")
                    if portal.exportar_vaga(v["vaga"]):
                        pedidas.append(v["vaga"])
                    else:
                        falhas += 1
                if pedidas:
                    registrar(f"Aguardando a Empregare gerar os arquivos ({nav.ESPERA_APOS_EXPORTAR}s).")
                    time.sleep(nav.ESPERA_APOS_EXPORTAR)
                    b, f = baixar_e_gravar(portal, config, sync, pedidas, pasta, desde)
                    baixadas += b
                    falhas += f
    except Exception as erro:
        mensagem = resumo_do_erro(erro)
        try:
            supabase_rpc.chamar(
                config,
                "finalizar_sync_empregare",
                {"p_sync": sync, "p_vagas_baixadas": baixadas, "p_vagas_falha": falhas, "p_erro": mensagem},
            )
        except Exception as erro_ao_fechar:
            registrar(f"Também não consegui fechar a execução no banco ({resumo_do_erro(erro_ao_fechar)}).")
        resumir([f"Execução {sync} FALHOU: {mensagem}", f"Vagas baixadas antes da falha: {baixadas}."])
        return 1

    fim = supabase_rpc.chamar(
        config,
        "finalizar_sync_empregare",
        {"p_sync": sync, "p_vagas_baixadas": baixadas, "p_vagas_falha": falhas, "p_erro": None},
    ) or {}
    situacao = fim.get("situacao", "FALHOU")
    resumir([
        f"Execução {sync}: {situacao}.",
        f"Vagas pedidas: {len(vagas)} · baixadas: {baixadas} · com falha: {falhas} · recusadas pela trava: {fim.get('recusadas', 0)}.",
        f"Candidatos gravados: {fim.get('linhas', 0)} · saíram (inativos): {fim.get('desativadas', 0)}.",
        f"Códigos: {lista_de_codigos(vagas) or '—'}",
    ])
    return {"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1)


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
