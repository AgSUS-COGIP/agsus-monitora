"""
MODO "SÓ ANEXOS" DO ROBÔ DA EMPREGARE (--so-anexos)

Relê os anexos do questionário de candidatos de vagas já carregadas, SEM
exportar: não chama exportar_vaga, gravar_lote_empregare nem
fechar_vaga_empregare (situação, ativos e lote não mudam) e o workflow não
pré-classifica depois. Serve para a resposta que o candidato editou na
Empregare depois da captura (o número da resposta não muda e a captura
incremental não relia; migration 20261020130000_robo_modo_anexos.sql).

Por vaga:
  1. listar_anexos_empregare(p_vaga, p_codigos): o que está gravado (hashes,
     nunca o link) e, sem códigos pedidos, só os SUSPEITOS (captura no dia da
     "DATA DE RESPOSTA" da exportação ou antes);
  2. localiza a vaga (CO_VAGA_INTERNO gravado ou PortalEmpregare.localizar_vaga,
     só leitura), lê a lista de candidatos (capturar_candidatos) e filtra os pedidos;
  3. relê as respostas deles (anexos.capturar_anexos sem prioridades: força a releitura);
  4. compara com o gravado e grava SÓ por gravar_anexos_empregare
     (anexos.gravar_anexos), com as regras de segurança abaixo.

SEGURANÇA
  - Nunca reduz: a releitura com menos perguntas, ou sem um anexo (pergunta,
    número) que está gravado, NÃO é gravada; o candidato sai como "bloqueado"
    no relatório (pode ser falha parcial da Empregare; quem decide é a equipe).
  - O candidato cuja resposta não foi relida inteira (sem identificador de
    resposta na lista — lista grande que estourou o tempo —, falha no GET ou
    tempo esgotado) sai como "não relido" e nada dele é gravado.
  - --seco: compara e relata (novos, alterados, removidos por candidato) sem
    gravar e sem abrir execução no banco.
  - Edital com inscrições congeladas (20261022170000): fora do --seco, só com a
    liberação do administrador global (--forcar-congelado; a execução registra
    o uso e o banco confere em gravar_anexos_empregare); sem ela, a execução
    inteira é recusada antes de abrir a Empregare.
  - O resumo das perguntas da carga NÃO é recalculado: ele vem das colunas do
    Excel (resumo_das_perguntas.py), que este modo não toca.

O log é público: só contagens e códigos (vaga, candidato da Empregare).
"""

import hashlib
import re
import time

import anexos_empregare as anexos

from monitora import execucao, supabase_rpc
from monitora.mascaramento import resumo_do_erro

RPC_LISTAR = "listar_anexos_empregare"
MAXIMO_DE_CANDIDATOS = 1000
CODIGOS_POR_LINHA = 40
# O workflow tem 120 min; sem exportação, a releitura pode ir até aqui (desde o início).
PRAZO_DO_MODO = 100 * 60
_ARQUIVO_DO_LINK = re.compile(r"[?&]arquivo=([^&]*)")


# ── Comparação com o gravado ────────────────────────────────────────────────


def hash16(texto):
    """Os 16 primeiros hex do sha256 (o mesmo de listar_anexos_empregare)."""
    return hashlib.sha256(str(texto).encode("utf-8")).hexdigest()[:16]


def arquivo_do_link(link):
    """O parâmetro arquivo= do link (como FC_ARQUIVO_DO_LINK_EMPREGARE); sem ele, o link inteiro."""
    m = _ARQUIVO_DO_LINK.search(str(link or ""))
    return m.group(1) if m else str(link or "")


def gravado_por_candidato(listado):
    """
    {código: {resposta: {"perguntas": n, "anexos": {(pergunta, número): hash do arquivo}}}}
    a partir de listar_anexos_empregare.
    """
    saida = {}
    for c in (listado or {}).get("candidatos") or []:
        respostas = {}
        for r in c.get("respostas") or []:
            itens = {}
            for a in r.get("anexos") or []:
                if isinstance(a, (list, tuple)) and len(a) >= 3:
                    itens[(str(a[0]), int(a[1]))] = str(a[2])
            respostas[str(r.get("resposta"))] = {"perguntas": int(r.get("perguntas") or 0), "anexos": itens}
        saida[str(c.get("codigo"))] = respostas
    return saida


def lido_da_resposta(capturada):
    """A resposta relida no mesmo formato do gravado."""
    itens = {}
    for a in capturada.get("anexos") or []:
        itens[(str(a.get("pergunta")), int(a.get("arquivo") or 1))] = hash16(arquivo_do_link(a.get("link")))
    return {"perguntas": int(capturada.get("perguntas") or 0), "anexos": itens}


def comparar(gravado, capturadas):
    """
    Compara as respostas relidas de um candidato com as gravadas. Devolve
    {"novos", "alterados", "removidos", "perguntas_antes", "perguntas_agora",
    "reduz", "mudou"}: `reduz` = alguma resposta relida tem menos perguntas que
    a gravada ou perdeu um anexo (pergunta, número) gravado.
    """
    novos = alterados = removidos = antes = agora = 0
    reduz = False
    for cap in capturadas or []:
        lido = lido_da_resposta(cap)
        velho = (gravado or {}).get(str(cap.get("resposta"))) or {"perguntas": 0, "anexos": {}}
        antes += velho["perguntas"]
        agora += lido["perguntas"]
        sumidos = [k for k in velho["anexos"] if k not in lido["anexos"]]
        removidos += len(sumidos)
        novos += sum(1 for k in lido["anexos"] if k not in velho["anexos"])
        alterados += sum(1 for k, h in lido["anexos"].items() if k in velho["anexos"] and velho["anexos"][k] != h)
        if sumidos or lido["perguntas"] < velho["perguntas"]:
            reduz = True
    return {
        "novos": novos,
        "alterados": alterados,
        "removidos": removidos,
        "perguntas_antes": antes,
        "perguntas_agora": agora,
        "reduz": reduz,
        "mudou": bool(novos or alterados or removidos or antes != agora),
    }


def escolher_alvo(listado, pedidos):
    """Os códigos a reler na vaga: os pedidos que a vaga tem ou, sem pedidos, os suspeitos."""
    candidatos = [c for c in (listado or {}).get("candidatos") or [] if c.get("codigo")]
    if pedidos:
        da_vaga = {str(c["codigo"]) for c in candidatos}
        return [c for c in pedidos if c in da_vaga]
    return [str(c["codigo"]) for c in candidatos if c.get("suspeito")]


def em_linhas(rotulo, codigos):
    """Lista de códigos em linhas curtas (o log corta em 600 caracteres)."""
    codigos = list(codigos)
    return [
        f"{rotulo} ({len(codigos)}): " + ", ".join(codigos[i : i + CODIGOS_POR_LINHA])
        for i in range(0, len(codigos), CODIGOS_POR_LINHA)
    ]


# ── Uma vaga ────────────────────────────────────────────────────────────────


def novo_relatorio(vaga):
    return {
        "vaga": vaga,
        "situacao": "OK",
        "motivo": "",
        "alvo": 0,
        "relidos": 0,
        "com_mudanca": 0,
        "sem_mudanca": 0,
        "gravados": 0,
        "novos": 0,
        "alterados": 0,
        "removidos": 0,
        "leituras_invalidadas": 0,
        "bloqueados": [],
        "nao_relidos": [],
        "encontrados": set(),
    }


def processar_vaga(portal, config, sync, vaga, pedidos, seco, prazo, registrar, chamar, agora=time.monotonic):
    """
    Relê os anexos dos candidatos da vaga e grava (ou, seco, só compara). Nunca
    levanta por causa da Empregare ou do banco: devolve o relatório da vaga
    (situacao OK, SEM_ALVO ou FALHA).
    """
    rel = novo_relatorio(vaga)
    try:
        listado = chamar(config, RPC_LISTAR, {"p_vaga": vaga, "p_codigos": pedidos or None}) or {}
    except supabase_rpc.ErroDoSupabase as erro:
        rel.update(situacao="FALHA", motivo=f"o banco não listou os anexos gravados ({erro})")
        if getattr(erro, "status", None) == 404:
            rel["motivo"] = "o banco ainda não tem listar_anexos_empregare (migration 20261020130000)"
        return rel
    except Exception as erro:
        rel.update(situacao="FALHA", motivo=f"o banco não listou os anexos gravados ({resumo_do_erro(erro)})")
        return rel

    rel["encontrados"] = {str(c.get("codigo")) for c in listado.get("candidatos") or []}
    if not listado.get("conhecida"):
        rel.update(situacao="FALHA", motivo="vaga sem carga no MONITORA (rode a carga normal antes)")
        return rel
    alvo = escolher_alvo(listado, pedidos)
    rel["alvo"] = len(alvo)
    if not pedidos:
        registrar(
            f"Vaga {vaga}: {listado.get('ativos', 0)} ativo(s) · {listado.get('suspeitos', 0)} suspeito(s) "
            f"(captura no dia da DATA DE RESPOSTA ou antes) · {listado.get('sem_captura', 0)} sem captura (não entram)."
        )
    if not alvo:
        rel["situacao"] = "SEM_ALVO"
        registrar(f"Vaga {vaga}: nenhum candidato a reler.")
        return rel

    interno = listado.get("vaga_interno") or portal.localizar_vaga(vaga)
    if not interno:
        rel.update(situacao="FALHA", motivo="não achei a vaga na Empregare")
        rel["nao_relidos"] = list(alvo)
        return rel
    portal.ids_das_vagas[str(vaga)] = interno
    enderecos = portal.capturar_candidatos(vaga) or {}
    respostas = enderecos.get("respostas") or {}
    filtradas = {c: respostas[c] for c in alvo if c in respostas}
    sem_resposta = [c for c in alvo if c not in respostas]
    if not filtradas:
        rel.update(situacao="FALHA", motivo="nenhum candidato pedido com resposta na lista da Empregare")
        rel["nao_relidos"] = list(alvo)
        return rel

    capturados = anexos.capturar_anexos(portal, vaga, filtradas, registrar, prazo, agora=agora, prioridades=None)
    gravado = gravado_por_candidato(listado)
    permitidos = {}
    incompletos = []
    for codigo, dados in filtradas.items():
        lidas = capturados.get(codigo) or []
        if len(lidas) < len(dados.get("respostas") or []):
            incompletos.append(codigo)
            continue
        diferenca = comparar(gravado.get(codigo), lidas)
        rel["relidos"] += 1
        for k in ("novos", "alterados", "removidos"):
            rel[k] += diferenca[k]
        if diferenca["reduz"]:
            rel["bloqueados"].append(codigo)
        elif diferenca["mudou"]:
            rel["com_mudanca"] += 1
            permitidos[codigo] = lidas
        else:
            rel["sem_mudanca"] += 1
            permitidos[codigo] = lidas  # grava a captura de hoje (deixa de ser suspeito)
        if diferenca["mudou"] or diferenca["reduz"]:
            registrar(
                f"Vaga {vaga}, candidato {codigo}: {diferenca['novos']} anexo(s) novo(s) · "
                f"{diferenca['alterados']} alterado(s) · {diferenca['removidos']} removido(s) · "
                f"perguntas {diferenca['perguntas_antes']}→{diferenca['perguntas_agora']}"
                + (" · BLOQUEADO: a releitura veio com menos; nada gravado." if diferenca["reduz"] else ".")
            )
    rel["nao_relidos"] = sem_resposta + incompletos

    if seco:
        registrar(f"Vaga {vaga}: seco, nada gravado ({len(permitidos)} candidato(s) seriam gravados).")
    elif permitidos:
        totais = {"leituras_invalidadas": 0, "falhou": False}
        rel["gravados"] = anexos.gravar_anexos(
            config, sync, vaga, permitidos, listado.get("colunas") or [], chamar, registrar, totais=totais
        )
        rel["leituras_invalidadas"] = totais["leituras_invalidadas"]
        if totais["falhou"]:
            rel.update(situacao="FALHA", motivo="a gravação dos anexos falhou")
    return rel


# ── A execução ──────────────────────────────────────────────────────────────


def linhas_do_relatorio(relatorios, pedidos, seco):
    """O resumo final (log e página da execução): totais, bloqueados e não relidos."""
    soma = {
        k: sum(r[k] for r in relatorios)
        for k in (
            "alvo",
            "relidos",
            "com_mudanca",
            "sem_mudanca",
            "gravados",
            "novos",
            "alterados",
            "removidos",
            "leituras_invalidadas",
        )
    }
    linhas = [
        ("SECO: nada foi gravado. " if seco else "")
        + "Só anexos: não exportou, não mudou situação, ativos, lote nem pré-classificação.",
        f"Vagas: {len(relatorios)} · com falha: {sum(r['situacao'] == 'FALHA' for r in relatorios)} · "
        f"sem candidato a reler: {sum(r['situacao'] == 'SEM_ALVO' for r in relatorios)}.",
        f"Candidatos a reler: {soma['alvo']} · relidos: {soma['relidos']} · com mudança: {soma['com_mudanca']} · "
        f"sem mudança: {soma['sem_mudanca']}.",
        f"Anexos: {soma['novos']} novo(s) · {soma['alterados']} alterado(s) · {soma['removidos']} removido(s)"
        + ("" if seco else f" · {soma['gravados']} gravado(s) · {soma['leituras_invalidadas']} leitura(s) a refazer")
        + ".",
    ]
    for r in relatorios:
        if r["situacao"] == "FALHA":
            linhas.append(f"Vaga {r['vaga']}: FALHA — {r['motivo']}.")
    bloqueados = [f"{r['vaga']}/{c}" for r in relatorios for c in r["bloqueados"]]
    nao_relidos = [f"{r['vaga']}/{c}" for r in relatorios for c in r["nao_relidos"]]
    if bloqueados:
        linhas += em_linhas("Bloqueados (a releitura veio com menos; nada gravado) vaga/candidato", bloqueados)
    if nao_relidos:
        linhas += em_linhas("Não relidos (sem resposta na lista, falha ou tempo) vaga/candidato", nao_relidos)
    if pedidos:
        achados = set().union(*(r["encontrados"] for r in relatorios)) if relatorios else set()
        fora = [c for c in pedidos if c not in achados]
        if fora:
            linhas += em_linhas("Candidatos pedidos que não estão ativos nas vagas", fora)
    return linhas


def vagas_pedidas(args, config, chamar):
    """
    As vagas: os códigos pedidos ou as dos editais (listar_vagas_empregare, só
    leitura), até o limite. Finalidade "anexos": as vagas de edital com
    inscrições congeladas vêm também, marcadas ("congelada" e, com a liberação
    do administrador global em args.forcar_congelado, "liberada"; migration
    20261020170000). Os códigos pedidos também passam pela lista, para a marca
    valer para eles. Banco sem a finalidade: a lista de antes, sem marca.
    """
    liberacao = getattr(args, "forcar_congelado", "") or None
    corpo = {"p_editais": args.editais or None, "p_vagas": args.vagas or None, "p_limite": args.limite}
    try:
        lista = chamar(config, "listar_vagas_empregare", dict(corpo, p_finalidade="anexos", p_liberacao=liberacao))
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) != 404:
            raise
        if args.vagas:
            return [{"vaga": v} for v in args.vagas][: args.limite]
        lista = chamar(config, "listar_vagas_empregare", corpo)
    return (lista or {}).get("vagas") or []


def congeladas_sem_liberacao(vagas):
    """As vagas de edital com inscrições congeladas sem a liberação: o modo que grava não roda nelas."""
    return [v for v in vagas if v.get("congelada") and not v.get("liberada")]


def recusa_das_congeladas(vagas):
    """As linhas do resumo quando o Só anexos (que grava) pega edital congelado sem a liberação."""
    editais = sorted({str(v.get("edital") or "sem número") for v in vagas})
    return [
        f"Recusado: inscrições congeladas em {', '.join(editais)} ({len(vagas)} vaga(s)). Nada foi relido nem gravado.",
        "Para conferir sem gravar, rode com “só comparar”; para gravar, o administrador global usa "
        "“Forçar edital com inscrições congeladas” em Status das atualizações › Rodar com opções (com motivo).",
    ]


def executar(
    args,
    config,
    abrir_portal,
    registrar,
    resumir,
    chamar=supabase_rpc.chamar,
    agora=time.monotonic,
    ids=None,
    liberar=None,
):
    """
    O modo anexos inteiro. `abrir_portal()`: context manager que entrega o
    PortalEmpregare já logado em Vagas Anunciadas. `ids`: {"sync", "tipo",
    "usuario", "url"} (quem chamou monta). `liberar(sync)`: registra o uso da
    liberação do administrador global nesta execução e devolve a linha do log
    (usar_liberacao do robô). Saída: 0 concluída, 2 parcial, 1 erro.

    Inscrições congeladas (20261022170000): fora do --seco, vaga de edital
    congelado sem a liberação recusa a execução inteira (nada relido nem
    gravado); o banco confere de novo em gravar_anexos_empregare.
    """
    seco = bool(args.seco)
    pedidos = list(args.candidatos or [])
    vagas = vagas_pedidas(args, config, chamar)
    ids = ids or {}
    sync = ids.get("sync")
    bloqueadas = [] if seco else congeladas_sem_liberacao(vagas)
    if bloqueadas:
        resumir(recusa_das_congeladas(bloqueadas))
        return 1
    if not seco:
        filtro = {"so_anexos": True, "editais": args.editais, "vagas": args.vagas, "limite": args.limite}
        if pedidos:
            filtro["candidatos"] = pedidos
        if getattr(args, "forcar_congelado", ""):
            filtro["forcar_congelado"] = True
        chamar(
            config,
            "iniciar_sync_empregare",
            {
                "p_sync": sync,
                "p_disparo": ids.get("tipo"),
                "p_usuario": ids.get("usuario"),
                "p_filtro": filtro,
                "p_vagas_pedidas": len(vagas),
                "p_url": ids.get("url"),
                "p_forcar": False,
            },
            tentativas=1,
        )
        if liberar and getattr(args, "forcar_congelado", ""):
            linha = liberar(sync)
            if linha:
                registrar(linha)
    registrar(
        f"Só anexos{' (seco)' if seco else ''}: {len(vagas)} vaga(s)"
        + (f", {len(pedidos)} candidato(s) pedido(s)" if pedidos else ", candidatos suspeitos")
        + "."
    )

    relatorios = []
    inicio = agora()
    try:
        # Cancelamento ou tempo esgotado no GitHub (SIGTERM/SIGINT) também fecha a execução.
        with execucao.interromper_com_excecao():
            if vagas:
                with abrir_portal() as portal:
                    for v in vagas:
                        codigo = str(v["vaga"])
                        if agora() - inicio >= PRAZO_DO_MODO:
                            rel = novo_relatorio(codigo)
                            rel.update(situacao="FALHA", motivo="sem tempo nesta execução")
                            relatorios.append(rel)
                            continue
                        prazo = min(agora() + anexos.TEMPO_LIMITE_DOS_ANEXOS, inicio + PRAZO_DO_MODO)
                        relatorios.append(
                            processar_vaga(portal, config, sync, codigo, pedidos, seco, prazo, registrar, chamar, agora)
                        )
    except (Exception, execucao.ExecucaoInterrompida) as erro:
        mensagem = resumo_do_erro(erro)
        if not seco:
            try:
                chamar(
                    config,
                    "finalizar_sync_empregare",
                    {
                        "p_sync": sync,
                        "p_vagas_baixadas": sum(r["situacao"] != "FALHA" for r in relatorios),
                        "p_vagas_falha": sum(r["situacao"] == "FALHA" for r in relatorios),
                        "p_erro": mensagem,
                    },
                    tentativas=1,
                )
            except Exception as erro_ao_fechar:
                registrar(f"Também não consegui fechar a execução no banco ({resumo_do_erro(erro_ao_fechar)}).")
        resumir([f"Só anexos FALHOU: {mensagem}"] + linhas_do_relatorio(relatorios, pedidos, seco))
        return 1

    # Vaga com falha, candidato bloqueado ou não relido = PARCIAL (alguém precisa olhar).
    com_pendencia = sum(r["situacao"] == "FALHA" or bool(r["bloqueados"] or r["nao_relidos"]) for r in relatorios)
    linhas = linhas_do_relatorio(relatorios, pedidos, seco)
    if seco:
        resumir(linhas)
        return 2 if com_pendencia else 0
    fim = (
        chamar(
            config,
            "finalizar_sync_empregare",
            {
                "p_sync": sync,
                # "Baixadas" = vagas relidas (a lista foi lida); sem nenhuma, o banco fecha como FALHOU.
                "p_vagas_baixadas": sum(r["situacao"] != "FALHA" for r in relatorios),
                "p_vagas_falha": com_pendencia,
                "p_erro": None,
            },
            # Sem repetir: se a resposta se perdeu, a execução já pode estar fechada.
            tentativas=1,
        )
        or {}
    )
    situacao = fim.get("situacao", "FALHOU")
    resumir([f"Execução {sync} (só anexos): {situacao}."] + linhas)
    return {"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1)
