"""
PRÉ-CLASSIFICAÇÃO DA AVALIAÇÃO DOCUMENTAL (job Python, fase F2)

Para cada edital, lê do MONITORA (RPCs só do service_role) a regra da avaliação
e os inscritos que o robô da Empregare trouxe em cada vaga — sem o cadastro
(nome, e-mail, CPF, telefone) —, calcula a Lista Geral de Classificação
Provisória (eliminação automática, ordem pela base da nota da regra — a nota
declarada completa, item 8.2.6, ou a ART — com o desempate da regra) e o lote
de convocação ("a linha anda"); depois do fim das inscrições do cronograma do
edital, congela a nota declarada completa de cada inscrito (o banco guarda e
não deixa mudar até a coordenação descongelar); mantém no lote, com a entrada
DECISAO, quem a coordenação incluiu por decisão (TB_DECISAO_LOTE), mesmo que
a regra o elimine ou o deixe abaixo do corte
com python/monitora/avaliacao_documental/, e GRAVA O RESULTADO PRONTO
(gravar_pre_classificacao_vaga). O banco valida e serve; a tela só lê.
Migration: supabase/migrations/20261006110000_pre_classificacao_e_lote.sql.

Durante as inscrições do cronograma (da véspera do início a 3 dias depois do
fim), grava também o RETRATO das inscrições de cada vaga — inscritos,
finalizaram o questionário, aptos para análise pela regra, eliminados; só
contagens — para o cartão "Inscrições" da aba (gravar_retrato_inscricoes,
20261009140000_acompanhamento_das_inscricoes.sql). Com a regra ainda não
conferida, os aptos vêm de uma prévia (nada da classificação é gravado); sem
regra, só inscritos e finalizados.

Roda pelo GitHub Actions (.github/workflows/pre-classificacao.yml): pelo
"Recalcular" da aba Pré-classificação e pelo "Rodar agora" das Configurações
(RPC disparar_robo), pelo "Run workflow" e, sozinho, no fim do robô da
Empregare (--apos-robo: os editais das vagas da última carga). Guia:
docs/python-no-monitora.md.

Uso
  python scripts/pre_classificacao/pre_classificacao.py --seco [--editais 93/2026]
      calcula e mostra o resumo; não grava nada (e explica o edital sem regra
      conferida)
  python scripts/pre_classificacao/pre_classificacao.py [--editais 93/2026,<id>]
      [--refazer-lote] [--apos-robo] [--disparado-por <uuid>|robo]

Sem --editais nem --apos-robo: os editais ativos com vagas da Empregare.
Editais: números ("93/2026"), ids (uuid) ou, sem número, o nome ("FCC").

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; EDITAIS, MODO e
DISPARADO_POR (do workflow). O log é público (repositório público): só
contagens, códigos de vaga e de aviso e números de edital; tudo passa por
python/monitora/mascaramento.py.

Saída: 0 concluída; 2 parcial (algum edital falhou); 1 erro.
"""

import argparse
import os
import pathlib
import re
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.avaliacao_documental.distribuicao import atribuicoes_dos_novos  # noqa: E402
from monitora.avaliacao_documental.pre_classificacao import (  # noqa: E402
    congela_a_declarada,
    fim_das_inscricoes,
    nivel_da_vaga,
    normalizar_regra,
    pre_classificar_vaga,
)
from monitora.avaliacao_documental.retrato_das_inscricoes import retrata_hoje, retrato_da_vaga  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402
from monitora.registro import registro  # noqa: E402

TITULO = "Pré-classificação da Avaliação documental → MONITORA"
GUIA = "docs/python-no-monitora.md"
CAMPOS_DA_LINHA = (
    "id",
    "situacao",
    "motivo_codigo",
    "motivo",
    "art",
    "nota",
    "origem_nota",
    "declarada",
    "declarada_parciais",
    "declarada_completa",
    "declarada_congelada",
    "sem_mapa",
    "divergente",
    "modalidade",
    "posicao",
    "posicao_modalidade",
    "lote",
    "lista_lote",
    "entrada",
    "motivo_entrada",
)
# O que o resumo da execução diz de cada situação de edital.
EXPLICACOES = {
    "SEM_REGRA": "edital sem regra conferida: crie a regra na aba Regra da Avaliação documental e marque como conferida",
    "REGRA_NAO_CONFERIDA": "edital sem regra conferida: a regra existe, mas falta a coordenação marcar como conferida",
    "SEM_VAGAS": "nenhuma vaga da Empregare ligada ao edital: rode o robô da Empregare para ele",
    "PREVIA": "regra ainda não conferida: prévia calculada, nada seria gravado",
}
_PEDIDO = re.compile(r"^[A-Za-z0-9/ ._-]{1,100}$")
log = registro("pre_classificacao")


def separar(texto):
    return [p.strip() for p in re.split(r"[,;\n]", str(texto or "")) if p.strip()]


def argumentos(lista=None):
    p = argparse.ArgumentParser(description=TITULO)
    p.add_argument(
        "--editais", default=os.environ.get("EDITAIS", ""), help="93/2026, ids ou nomes, separados por vírgula"
    )
    p.add_argument("--seco", action="store_true", help="calcula e mostra o resumo; não grava")
    p.add_argument("--refazer-lote", action="store_true", help="recorta o lote do zero (só antes das fichas)")
    p.add_argument("--apos-robo", action="store_true", help="os editais das vagas da última carga do robô")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    args = p.parse_args(lista)
    modo = str(os.environ.get("MODO", "")).strip().lower()
    if modo == "seco":
        args.seco = True
    elif modo == "refazer_lote":
        args.refazer_lote = True
    args.editais = separar(args.editais)
    ruins = [e for e in args.editais if not _PEDIDO.match(e)]
    if ruins or len(args.editais) > 100:
        p.error("editais: até 100, cada um número (93/2026), id ou nome curto")
    return args


def tipo_do_disparo(valor):
    """('ROBO'|'MONITORA'|'GITHUB', usuário ou None) — 'robo' = fim do robô da Empregare."""
    if str(valor or "").strip().lower() == "robo":
        return "ROBO", None
    tipo, usuario = execucao.disparo(valor)
    return ("GITHUB", None) if tipo == "AGENDA" else (tipo, usuario)


def dados_da_vaga(vaga, documental=None):
    """
    A vaga para a conta: o quadro e o nível (do nome do cargo e da regra de
    classificação do edital — a mesma conta da ficha), para a nota declarada
    que pontua por nível. Sem cargo nem nível padrão, o nível fica None.
    """
    quadro = vaga.get("quadro") or None
    return {
        "codigo": vaga.get("codigo"),
        "vagas_imediatas": quadro.get("vagas_imediatas") if quadro else None,
        "cadastro_reserva": bool(quadro and quadro.get("cadastro_reserva")),
        "modalidades": quadro.get("modalidades") if quadro else None,
        "nivel": nivel_da_vaga(vaga.get("cargo"), documental),
    }


def situacao_da_regra(edital):
    regra = edital.get("regra")
    if not regra:
        return "SEM_REGRA"
    if regra.get("situacao") != "CONFERIDA":
        return "REGRA_NAO_CONFERIDA"
    return None


def processar_edital(chamar, edital, hoje, refazer, gravar, retratar=False):
    """
    Pré-classifica as vagas de um edital. gravar = função (vaga, resultado) ou
    None (modo seco). Devolve o resultado do edital (só códigos e contagens).
    retratar: monta também o retrato das inscrições de cada vaga
    (resultado["retrato"]), mesmo sem regra conferida (prévia, sem gravar).
    """
    vagas = edital.get("vagas") or []
    resultado = {
        "edital": edital["id"],
        "rotulo": edital.get("rotulo") or "",
        "situacao": "PROCESSADO",
        "vagas": len(vagas),
        "inscritos": 0,
        "eliminados": 0,
        "ranqueados": 0,
        "no_lote": 0,
        "por_decisao": 0,
        "divergencias": 0,
        "pela_art": 0,
        "congeladas": 0,
        "avisos": [],
    }
    situacao = situacao_da_regra(edital)
    # Regra não conferida no modo normal: a classificação não é gravada, mas o
    # retrato das inscrições leva os aptos de uma prévia.
    so_retrato = False
    if situacao and (gravar is not None or situacao == "SEM_REGRA"):
        resultado["situacao"] = situacao
        resultado["inscritos"] = sum(int(v.get("candidatos_ativos") or 0) for v in vagas)
        if not retratar or not vagas:
            return resultado
        if situacao == "SEM_REGRA":
            resultado["retrato"] = [
                retrato_da_vaga(vaga["codigo"], ler_candidatos(chamar, edital, vaga).get("candidatos") or [])
                for vaga in vagas
            ]
            return resultado
        so_retrato = True
        gravar = None
    if not vagas:
        resultado["situacao"] = "SEM_VAGAS"
        return resultado
    if situacao == "REGRA_NAO_CONFERIDA" and not so_retrato:
        resultado["situacao"] = "PREVIA"
    if refazer and not edital.get("refazer_permitido", True):
        refazer = False
        resultado["avisos"].append("REFAZER_RECUSADO")

    regra = normalizar_regra(edital["regra"].get("configuracao"))
    # A declarada congela na primeira pré-classificação depois do fim das inscrições (ou já, sem data).
    congelar = congela_a_declarada(hoje, fim_das_inscricoes(edital.get("cronograma")))
    retratos = []
    if not so_retrato:
        resultado["base_da_nota"] = regra["provisoria"]["base_da_nota"]
        resultado["congelar"] = congelar
    avisos = Counter()
    for vaga in vagas:
        lidos = ler_candidatos(chamar, edital, vaga)
        r = pre_classificar_vaga(
            regra,
            dados_da_vaga(vaga, edital.get("documental")),
            lidos.get("candidatos") or [],
            anterior=lidos.get("anterior") or {},
            ultimo_lote=vaga.get("ultimo_lote") or 0,
            refazer=refazer,
            hoje=hoje,
            congelar=congelar,
            decisoes=lidos.get("decisoes") or {},
        )
        resumo = r["resumo"]
        if retratar:
            retratos.append(
                retrato_da_vaga(vaga["codigo"], lidos.get("candidatos") or [], regra, r, previa=situacao is not None)
            )
        if so_retrato:
            continue
        if gravar is not None:
            gravar(vaga["codigo"], r)
        for chave in (
            "inscritos",
            "eliminados",
            "ranqueados",
            "no_lote",
            "por_decisao",
            "divergencias",
            "pela_art",
            "congeladas",
        ):
            resultado[chave] += int(resumo[chave] or 0)
        avisos.update(resumo["avisos"])
        log.info(
            "Edital %s · vaga %s: %s inscritos, %s eliminados, %s no lote pela regra + %s por decisão (tamanho %s).",
            resultado["rotulo"],
            vaga["codigo"],
            resumo["inscritos"],
            resumo["eliminados"],
            resumo["no_lote"],
            resumo["por_decisao"],
            resumo["tamanho"] if resumo["tamanho"] is not None else "sem quadro",
        )
    if retratar:
        resultado["retrato"] = retratos
    if so_retrato:
        return resultado
    resultado["avisos"] = sorted(set(resultado["avisos"]) | set(avisos))
    resultado["avisos_por_vaga"] = dict(sorted(avisos.items()))
    return resultado


def ler_candidatos(chamar, edital, vaga):
    return chamar("pre_classificacao_ler_candidatos", {"p_edital": edital["id"], "p_vaga": vaga["codigo"]}) or {}


def gravar_retrato(chamar, id_execucao, resultado):
    """
    Grava o retrato das inscrições do edital (gravar_retrato_inscricoes). Uma
    falha (ex.: banco sem a migration) só vira aviso: a pré-classificação segue.
    Devolve quantas vagas foram retratadas.
    """
    retrato = resultado.get("retrato") or []
    if not retrato:
        return 0
    try:
        r = (
            chamar(
                "gravar_retrato_inscricoes",
                {"p_execucao": id_execucao, "p_edital": resultado["edital"], "p_vagas": retrato},
            )
            or {}
        )
    except Exception as erro:
        log.warning("Retrato das inscrições de %s não gravado: %s", resultado.get("rotulo"), resumo_do_erro(erro)[:200])
        return 0
    return int(r.get("vagas") or 0)


def abrir_fichas(chamar, id_execucao, edital_id):
    """
    No fim do edital: lê a distribuição, calcula para quem vão as fichas novas
    (distribuição inicial: quem tem menos pendentes) e pede ao banco para abrir
    as fichas do lote (abrir_fichas_pre_classificacao valida e grava). Devolve
    as contagens (sem dado pessoal).
    """
    distribuicao = chamar("pre_classificacao_ler_distribuicao", {"p_edital": edital_id}) or {}
    atribuicoes = atribuicoes_dos_novos(distribuicao)
    r = (
        chamar(
            "abrir_fichas_pre_classificacao",
            {"p_execucao": id_execucao, "p_edital": edital_id, "p_atribuicoes": atribuicoes},
        )
        or {}
    )
    return {
        "fichas_criadas": int(r.get("criadas") or 0),
        "fichas_atribuidas": int(r.get("atribuidas") or 0),
        "fichas_fora_do_lote": int(r.get("fora_do_lote") or 0),
    }


def payload_da_vaga(resultado_da_vaga):
    resumo = resultado_da_vaga["resumo"]
    return (
        {k: resumo[k] for k in ("tamanho", "descricao", "por_modalidade", "acima_do_corte", "avisos")},
        [{k: linha.get(k) for k in CAMPOS_DA_LINHA} for linha in resultado_da_vaga["linhas"]],
    )


def linha_do_resumo(r):
    rotulo = r.get("rotulo") or r["edital"]
    if r["situacao"] in EXPLICACOES and r["situacao"] != "PREVIA":
        extra = f" ({r['inscritos']} inscritos em {r['vagas']} vaga(s) aguardam)" if r.get("inscritos") else ""
        retrato = f" Retrato das inscrições: {r['retratadas']} vaga(s)." if r.get("retratadas") else ""
        return f"{rotulo}: {EXPLICACOES[r['situacao']]}{extra}.{retrato}"
    if r["situacao"] == "FALHOU":
        return f"{rotulo}: FALHOU — {r.get('mensagem') or 'erro'}."
    prefixo = f"{rotulo}: {EXPLICACOES['PREVIA']} — " if r["situacao"] == "PREVIA" else f"{rotulo}: "
    avisos = r.get("avisos_por_vaga") or {}
    texto_avisos = (
        " · avisos: " + ", ".join(f"{c} ({n} vaga(s))" for c, n in avisos.items())
        if avisos
        else (" · avisos: " + ", ".join(r["avisos"]) if r["avisos"] else "")
    )
    texto_fichas = (
        f" · fichas: {r['fichas_criadas']} aberta(s), {r['fichas_atribuidas']} atribuída(s), "
        f"{r['fichas_fora_do_lote']} fora do lote"
        if "fichas_criadas" in r
        else ""
    )
    texto_base = (
        f" · nota do lote: declarada ({r.get('pela_art', 0)} pela ART, sem declarada completa)"
        if r.get("base_da_nota") == "DECLARADA"
        else (" · nota do lote: ART" if r.get("base_da_nota") else "")
    )
    texto_congeladas = f" · {r['congeladas']} declarada(s) congelada(s)" if r.get("congeladas") else ""
    texto_lote = f"{r['no_lote']} no lote"
    texto_retrato = f" · retrato das inscrições: {r['retratadas']} vaga(s)" if r.get("retratadas") else ""
    if r.get("por_decisao"):
        texto_lote = f"lote: {r['no_lote']} pela regra + {r['por_decisao']} por decisão"
    return (
        f"{prefixo}{r['vagas']} vaga(s) · {r['inscritos']} inscritos · {r['eliminados']} eliminados · "
        f"{r['ranqueados']} na Provisória · {texto_lote} · {r['divergencias']} divergência(s) ART × declarada"
        f"{texto_base}{texto_congeladas}{texto_fichas}{texto_avisos}{texto_retrato}."
    )


def para_o_banco(r):
    """O resultado do edital que vai ao log do banco (sem os avisos por vaga nem o retrato)."""
    return {k: v for k, v in r.items() if k not in ("avisos_por_vaga", "retrato")}


def principal(args, configuracao=None, chamar_rpc=None):
    cfg = configuracao or supabase_rpc.configuracao(GUIA)
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo):
        return chamar_rpc(cfg, funcao, corpo)

    contexto = (
        chamar(
            "pre_classificacao_ler_editais",
            {"p_editais": args.editais or None, "p_apos_robo": bool(args.apos_robo and not args.editais)},
        )
        or {}
    )
    editais = contexto.get("editais") or []
    hoje = contexto.get("hoje")
    cabecalho = []
    if contexto.get("nao_encontrados"):
        cabecalho.append("Editais não encontrados: " + ", ".join(contexto["nao_encontrados"]) + ".")
    if not editais:
        cabecalho.append("Nenhum edital para pré-classificar.")

    if args.seco:
        resultados = []
        for edital in editais:
            try:
                resultados.append(processar_edital(chamar, edital, hoje, args.refazer_lote, None))
            except Exception as erro:
                resultados.append(
                    {
                        "edital": edital["id"],
                        "rotulo": edital.get("rotulo"),
                        "situacao": "FALHOU",
                        "mensagem": resumo_do_erro(erro),
                    }
                )
        execucao.resumir(
            TITULO, ["Modo seco: nada foi gravado."] + cabecalho + [linha_do_resumo(r) for r in resultados]
        )
        return 2 if any(r["situacao"] == "FALHOU" for r in resultados) else 0

    tipo, usuario = tipo_do_disparo(args.disparado_por)
    id_execucao = execucao.identificador(prefixo="precl")
    try:
        chamar(
            "iniciar_pre_classificacao",
            {
                "p_execucao": id_execucao,
                "p_disparo": tipo,
                "p_usuario": usuario,
                "p_url": execucao.url_da_execucao(),
                "p_refazer": bool(args.refazer_lote),
                "p_pedido": args.editais,
            },
        )
    except supabase_rpc.ErroDoSupabase as erro:
        if "55P03" in str(erro) or "em andamento" in str(erro):
            execucao.resumir(TITULO, ["Já há uma pré-classificação em andamento; esta não rodou."])
            return 1
        raise
    log.info("Execução %s (disparo %s, %s edital(is)).", id_execucao, tipo.lower(), len(editais))

    resultados = []
    try:
        for edital in editais:
            regra = edital.get("regra") or {}

            def gravar(codigo, r, edital=edital, regra=regra):
                resumo, linhas = payload_da_vaga(r)
                chamar(
                    "gravar_pre_classificacao_vaga",
                    {
                        "p_execucao": id_execucao,
                        "p_edital": edital["id"],
                        "p_vaga": codigo,
                        "p_versao_regra": regra.get("versao"),
                        "p_resumo": resumo,
                        "p_linhas": linhas,
                    },
                )

            try:
                resultado = processar_edital(
                    chamar,
                    edital,
                    hoje,
                    args.refazer_lote,
                    gravar,
                    retratar=retrata_hoje(hoje, edital.get("cronograma")),
                )
                if resultado["situacao"] == "PROCESSADO":
                    resultado.update(abrir_fichas(chamar, id_execucao, edital["id"]))
                resultado["retratadas"] = gravar_retrato(chamar, id_execucao, resultado)
                resultados.append(resultado)
            except Exception as erro:
                mensagem = resumo_do_erro(erro)[:300]
                log.warning("Edital %s falhou: %s", edital.get("rotulo"), mensagem)
                resultados.append(
                    {
                        "edital": edital["id"],
                        "rotulo": edital.get("rotulo") or "",
                        "situacao": "FALHOU",
                        "mensagem": mensagem,
                    }
                )
    except Exception as erro:
        mensagem = resumo_do_erro(erro)
        try:
            chamar("finalizar_pre_classificacao", {"p_execucao": id_execucao, "p_editais": [], "p_erro": mensagem})
        except Exception as erro_ao_fechar:
            log.error("Também não consegui fechar a execução: %s", resumo_do_erro(erro_ao_fechar))
        execucao.resumir(TITULO, [f"Execução {id_execucao} FALHOU: {mensagem}"])
        return 1

    fim = (
        chamar(
            "finalizar_pre_classificacao",
            {"p_execucao": id_execucao, "p_editais": [para_o_banco(r) for r in resultados], "p_erro": None},
        )
        or {}
    )
    situacao = fim.get("situacao", "FALHOU")
    execucao.resumir(
        TITULO,
        [
            f"Execução {id_execucao}: {situacao}"
            + (" · lote refeito do zero" if args.refazer_lote else "")
            + f" · {fim.get('vagas', 0)} vaga(s) gravada(s) · {fim.get('lote', 0)} no lote."
        ]
        + cabecalho
        + [linha_do_resumo(r) for r in resultados],
    )
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
        log.error("Erro: %s", resumo_do_erro(erro))
        return 1


if __name__ == "__main__":
    sys.exit(main())
