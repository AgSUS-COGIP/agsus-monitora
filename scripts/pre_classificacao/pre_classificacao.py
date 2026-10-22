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

Grava também, por vaga, as SUGESTÕES DA FICHA: as linhas de título, curso
e vínculo que as respostas de cada inscrito já dão
(python/monitora/avaliacao_documental/sugestoes_da_ficha.py →
gravar_sugestoes_da_ficha, 20261009190000_sugestoes_da_ficha.sql), para a
ficha vir pronta para conferir. Falha só vira aviso.

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

--refazer-lote (modo refazer_lote): recorta o lote do zero. Vale enquanto
ninguém foi analisado e TODAS as fichas do edital estão intocadas (pendentes,
nunca atribuídas, reservadas, salvas nem concluídas); o banco confere de novo
na gravação. Quem continua no lote mantém a ficha, quem sai fica com a ficha
FORA_LOTE ("Lote refeito em dd/mm") e quem entra ganha ficha nova; o resumo
diz quantos ficam, entram e saem. Com ficha iniciada, o edital é recusado
("o lote já está em análise: N fichas iniciadas").
Migration: 20261013110000_refazer_lote_com_fichas_intocadas.sql.

Sem --editais nem --apos-robo: os editais ativos com vagas da Empregare.
Editais: números ("93/2026"), ids (uuid) ou, sem número, o nome ("FCC").

Inscrições congeladas (migration 20261020170000): o edital com a trava ligada
não é recalculado nem tem o lote refeito. No fim do robô e sem --editais, ele
é pulado (aparece no resumo); pedido em --editais, a execução inteira é
recusada (nada gravado). O seco o calcula (não grava). --forcar-congelado
<token> (FORCAR_CONGELADO): a liberação do administrador global (disparar_robo,
"Forçar edital com inscrições congeladas"); a execução registra o uso.

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; EDITAIS, MODO e
DISPARADO_POR (do workflow). O log é público (repositório público): só
contagens, códigos de vaga e de aviso e números de edital; tudo passa por
python/monitora/mascaramento.py.

Leitura em partes (20261014110000_pre_classificacao_ler_em_partes.sql): a lista
dos editais traz só os metadados das vagas; cada vaga é lida à parte, com os
inscritos em partes de TAMANHO_DA_PARTE (na ordem do id, a mesma de antes), e
a primeira parte traz o cargo e a linha do quadro da vaga. Assim nenhuma
chamada passa do statement_timeout do service_role, por maior que seja o
edital (o 114/2026, com 7.160 inscritos, estourava os 8 s numa chamada só).

Gravação (20261014130000_gravar_pre_classificacao_rapido.sql): o resumo de cada
vaga leva a linha do quadro lida com ela (p_resumo.quadro; o banco só confere
que é do edital) e o banco lê as linhas uma vez. O refazer só vale com todas as
vagas gravadas: abrir_fichas_pre_classificacao só roda no fim do edital; se uma
vaga falha, o edital fica FALHOU, as fichas não mudam e a próxima execução
refaz o lote do zero.

Menos egress (20261014220000_jobs_leem_so_o_necessario.sql): o job pede os
nomes das colunas do edital uma vez (pre_classificacao_ler_colunas), escolhe as
que a regra olha (colunas_da_leitura.py) e lê só elas de cada inscrito
(p_colunas; o 114/2026 caiu de 38,9 MB para 4,6 MB por execução, com o mesmo
resultado). No fim do robô (--apos-robo), o edital que não mudou desde a última
pré-classificação concluída de hoje ("sem_mudanca") não é recalculado; sem
nenhum edital a recalcular, nem abre execução.

Saída: 0 concluída; 2 parcial (algum edital falhou ou não foi encontrado); 1 erro;
3 entrada inválida. Cancelamento ou tempo esgotado no GitHub (SIGTERM) fecha a
execução no banco com erro (python/monitora/execucao.py).
"""

import os
import pathlib
import re
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.avaliacao_documental.colunas_da_leitura import colunas_necessarias, montar_colunas  # noqa: E402
from monitora.avaliacao_documental.distribuicao import atribuicoes_dos_novos  # noqa: E402
from monitora.avaliacao_documental.pre_classificacao import (  # noqa: E402
    congela_a_declarada,
    fim_das_inscricoes,
    mudancas_do_lote,
    nivel_da_vaga,
    normalizar_regra,
    pre_classificar_vaga,
)
from monitora.avaliacao_documental.retrato_das_inscricoes import retrata_hoje, retrato_da_vaga  # noqa: E402
from monitora.avaliacao_documental.sugestoes_da_ficha import (  # noqa: E402
    ITENS_DO_TIPO,
    sugestoes_da_vaga,
)
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
    "modalidades",
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
# Inscritos por chamada de pre_classificacao_ler_candidatos (o banco aceita até 5.000).
TAMANHO_DA_PARTE = 500
_PEDIDO = re.compile(r"^[A-Za-z0-9/ ._-]{1,100}$")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
log = registro("pre_classificacao")


def separar(texto):
    return [p.strip() for p in re.split(r"[,;\n]", str(texto or "")) if p.strip()]


def argumentos(lista=None):
    p = execucao.Argumentos(description=TITULO)
    p.add_argument(
        "--editais", default=os.environ.get("EDITAIS", ""), help="93/2026, ids ou nomes, separados por vírgula"
    )
    p.add_argument("--seco", action="store_true", help="calcula e mostra o resumo; não grava")
    p.add_argument(
        "--refazer-lote", action="store_true", help="recorta o lote do zero (só com todas as fichas intocadas)"
    )
    p.add_argument("--apos-robo", action="store_true", help="os editais das vagas da última carga do robô")
    p.add_argument("--disparado-por", default=os.environ.get("DISPARADO_POR", ""))
    p.add_argument(
        "--forcar-congelado",
        default=os.environ.get("FORCAR_CONGELADO", ""),
        help="token da liberação do administrador global (edital com inscrições congeladas)",
    )
    args = p.parse_args(lista)
    args.forcar_congelado = str(args.forcar_congelado or "").strip().lower()
    if args.forcar_congelado and not _UUID.fullmatch(args.forcar_congelado):
        p.error("--forcar-congelado inválido (é o token que o MONITORA manda)")
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
    As cotas (acúmulo e percentuais da regra de classificação) escolhem a
    modalidade de quem marcou mais de uma cota (modalidade_do_candidato).
    """
    quadro = vaga.get("quadro") or None
    return {
        "codigo": vaga.get("codigo"),
        "vagas_imediatas": quadro.get("vagas_imediatas") if quadro else None,
        "cadastro_reserva": bool(quadro and quadro.get("cadastro_reserva")),
        "modalidades": quadro.get("modalidades") if quadro else None,
        "nivel": nivel_da_vaga(vaga.get("cargo"), documental),
        "cotas": (documental or {}).get("cotas"),
    }


def situacao_da_regra(edital):
    regra = edital.get("regra")
    if not regra:
        return "SEM_REGRA"
    if regra.get("situacao") != "CONFERIDA":
        return "REGRA_NAO_CONFERIDA"
    return None


def processar_edital(chamar, edital, hoje, refazer, gravar, retratar=False, gravar_sugestoes=None):
    """
    Pré-classifica as vagas de um edital. gravar = função (vaga, resultado) ou
    None (modo seco). Devolve o resultado do edital (só códigos e contagens).
    gravar_sugestoes = função (vaga, calcular) ou None: as linhas que as
    respostas de cada candidato já dão para a ficha (sugestoes_da_ficha.py).
    calcular() devolve as sugestões e é chamada DENTRO do tratamento de erro
    de gravar_sugestoes (um erro na conta só vira aviso, como o da gravação);
    devolve quantos candidatos ficaram com sugestão.
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
        "sugestoes": 0,
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
            colunas = colunas_do_edital(chamar, edital, None)
            resultado["retrato"] = [
                retrato_da_vaga(
                    vaga["codigo"], ler_candidatos(chamar, edital, vaga, colunas=colunas).get("candidatos") or []
                )
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
    # Refazer o lote do zero só com todas as fichas do edital intocadas (o banco confere de novo
    # na gravação): senão o edital não é processado e o resumo diz por quê.
    if refazer and not so_retrato and not edital.get("refazer_permitido", True):
        resultado["situacao"] = "FALHOU"
        resultado["mensagem"] = mensagem_do_refazer_recusado(edital)
        return resultado

    regra = normalizar_regra(edital["regra"].get("configuracao"))
    # A declarada congela na primeira pré-classificação depois do fim das inscrições (ou já, sem data).
    congelar = congela_a_declarada(hoje, fim_das_inscricoes(edital.get("cronograma")))
    retratos = []
    if not so_retrato:
        resultado["base_da_nota"] = regra["provisoria"]["base_da_nota"]
        resultado["congelar"] = congelar
    avisos = Counter()
    lote_refeito = Counter()
    # Só as colunas que esta regra olha (20261014220000): o resultado é o mesmo.
    colunas = colunas_do_edital(chamar, edital, regra)
    for vaga in vagas:
        lidos = ler_candidatos(chamar, edital, vaga, colunas=colunas)
        # O cargo e a linha do quadro vêm com a primeira parte dos inscritos (desde 20261014110000).
        vaga = {**vaga, **(lidos.get("vaga") or {})}
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
            cronograma=edital.get("cronograma"),
        )
        resumo = r["resumo"]
        if retratar:
            retratos.append(
                retrato_da_vaga(vaga["codigo"], lidos.get("candidatos") or [], regra, r, previa=situacao is not None)
            )
        if so_retrato:
            continue
        if refazer:
            lote_refeito.update(mudancas_do_lote(lidos.get("anterior") or {}, r["linhas"]))
        if gravar is not None:
            # A linha do quadro lida com a vaga vai junto: o banco só confere (20261014130000).
            r["quadro"] = (vaga.get("quadro") or {}).get("id")
            gravar(vaga["codigo"], r)
        if gravar_sugestoes is not None and tem_blocos_com_itens(regra):
            nivel = dados_da_vaga(vaga, edital.get("documental"))["nivel"]
            candidatos = lidos.get("candidatos") or []
            resultado["sugestoes"] += gravar_sugestoes(
                vaga["codigo"], lambda candidatos=candidatos, nivel=nivel: sugestoes_da_vaga(regra, candidatos, nivel)
            )
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
    if refazer:
        resultado["lote_refeito"] = {k: lote_refeito[k] for k in ("ficam", "entram", "saem")}
    return resultado


def mensagem_do_refazer_recusado(edital):
    """Por que o lote do edital não pode ser refeito (só a contagem; sem dado pessoal)."""
    iniciadas = int(edital.get("fichas_iniciadas") or 0)
    if iniciadas:
        return f"lote não refeito: o lote já está em análise: {iniciadas} fichas iniciadas"
    return "lote não refeito: o edital já tem candidato analisado"


def tem_blocos_com_itens(regra):
    """A regra tem bloco de títulos, cursos ou vínculos (onde a ficha registra itens)?"""
    return any(b.get("tipo") in ITENS_DO_TIPO for b in regra.get("blocos") or [])


def colunas_do_edital(chamar, edital, regra):
    """
    As colunas que o cálculo olha com esta regra (colunas_da_leitura.py), dos nomes
    que o banco tem no edital; None = ler todas (banco sem pre_classificacao_ler_colunas).
    """
    try:
        nomes = (chamar("pre_classificacao_ler_colunas", {"p_edital": edital["id"]}) or {}).get("colunas")
    except supabase_rpc.ErroDoSupabase as erro:
        if erro.status == 404:
            return None
        raise
    return colunas_necessarias(regra, nomes or [])


def ler_candidatos(chamar, edital, vaga, tamanho=None, colunas=None):
    """
    Os inscritos da vaga, lidos em partes de `tamanho` (TAMANHO_DA_PARTE) na ordem do id (p_apos =
    o último id da parte anterior) enquanto o banco disser que há mais. A
    primeira parte traz também a vaga (cargo e quadro), a situação anterior e
    as decisões. Devolve tudo junto, como uma leitura só.
    colunas: só estas colunas de cada inscrito (o banco devolve pela posição, em "c";
    aqui voltam a {nome: valor} em "colunas"); None = todas.
    """
    corpo = {"p_edital": edital["id"], "p_vaga": vaga["codigo"], "p_limite": tamanho or TAMANHO_DA_PARTE}
    if colunas is not None:
        corpo["p_colunas"] = list(colunas)
    lidos = chamar("pre_classificacao_ler_candidatos", corpo) or {}
    candidatos = list(lidos.get("candidatos") or [])
    parte = lidos
    while parte.get("mais") and candidatos:
        apos = candidatos[-1]["id"]
        parte = chamar("pre_classificacao_ler_candidatos", {**corpo, "p_apos": apos}) or {}
        novos = parte.get("candidatos") or []
        if novos and str(novos[0]["id"]) <= str(apos):
            raise RuntimeError(f"leitura em partes fora de ordem na vaga {vaga['codigo']}")
        candidatos.extend(novos)
        if not novos:
            break
    lidos = {k: v for k, v in lidos.items() if k != "mais"}
    if colunas is not None:
        candidatos = [
            {**{k: v for k, v in c.items() if k != "c"}, "colunas": montar_colunas(c.get("c"), colunas)}
            if "c" in c
            else c
            for c in candidatos
        ]
    lidos["candidatos"] = candidatos
    return lidos


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
    dados = {k: resumo[k] for k in ("tamanho", "descricao", "por_modalidade", "acima_do_corte", "avisos")}
    # A linha do quadro lida nesta execução (id ou None = vaga sem quadro). Sem a chave, o
    # banco acha a linha de novo (FC_QUADRO_DA_VAGA_EMPREGARE, até ~2 s por vaga).
    if "quadro" in resultado_da_vaga:
        dados["quadro"] = resultado_da_vaga["quadro"]
    return (
        dados,
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
    refeito = r.get("lote_refeito")
    texto_fichas += (
        f" · lote refeito: {refeito['ficam']} ficam, {refeito['entram']} entram, {refeito['saem']} saem"
        if refeito
        else ""
    )
    texto_congeladas = f" · {r['congeladas']} declarada(s) congelada(s)" if r.get("congeladas") else ""
    texto_lote = f"{r['no_lote']} no lote"
    texto_retrato = f" · retrato das inscrições: {r['retratadas']} vaga(s)" if r.get("retratadas") else ""
    texto_retrato += f" · sugestões da ficha: {r['sugestoes']} candidato(s)" if r.get("sugestoes") else ""
    if r.get("por_decisao"):
        texto_lote = f"lote: {r['no_lote']} pela regra + {r['por_decisao']} por decisão"
    return (
        f"{prefixo}{r['vagas']} vaga(s) · {r['inscritos']} inscritos · {r['eliminados']} eliminados · "
        f"{r['ranqueados']} na Provisória · {texto_lote} · {r['divergencias']} divergência(s) ART × declarada"
        f"{texto_base}{texto_congeladas}{texto_fichas}{texto_avisos}{texto_retrato}."
    )


def para_o_banco(r):
    """O resultado do edital que vai ao log do banco (sem os avisos por vaga nem o retrato)."""
    return {k: v for k, v in r.items() if k not in ("avisos_por_vaga", "retrato", "sugestoes")}


def ler_editais(chamar, args):
    """
    Os editais a calcular (pre_classificacao_ler_editais). Com a trava das
    inscrições congeladas (20261020170000): o seco os inclui (não grava); a
    liberação do administrador global (--forcar-congelado) também. Banco sem a
    migration: a chamada de antes.
    """
    corpo = {"p_editais": args.editais or None, "p_apos_robo": bool(args.apos_robo and not args.editais)}
    try:
        return (
            chamar(
                "pre_classificacao_ler_editais",
                dict(corpo, p_incluir_congelados=bool(args.seco), p_liberacao=args.forcar_congelado or None),
            )
            or {}
        )
    except supabase_rpc.ErroDoSupabase as erro:
        if getattr(erro, "status", None) != 404:
            raise
    log.warning("O banco ainda não tem a trava de inscrições congeladas (migration 20261020170000).")
    return chamar("pre_classificacao_ler_editais", corpo) or {}


def rotulos(editais):
    return ", ".join(str(e.get("rotulo") or e.get("id")) for e in editais)


def recusa_dos_congelados(congelados):
    """As linhas do resumo quando o pedido explícito cai em edital congelado."""
    return [
        f"Recusado: inscrições congeladas em {rotulos(congelados)}. Nada foi recalculado nem gravado (o lote não muda).",
        "O modo seco continua. Para recalcular mesmo assim, o administrador global usa "
        "“Forçar edital com inscrições congeladas” em Status das atualizações › Rodar com opções (com motivo).",
    ]


def usar_liberacao(chamar, liberacao, id_execucao):
    """Registra o uso da liberação nesta execução (registrar_uso_liberacao_congelamento); nunca derruba."""
    if not liberacao:
        return None
    try:
        r = chamar("registrar_uso_liberacao_congelamento", {"p_liberacao": liberacao, "p_execucao": id_execucao}) or {}
    except Exception as erro:
        return f"Override NÃO registrado na execução ({resumo_do_erro(erro)[:200]})."
    editais = r.get("editais") or []
    if not editais:
        return "Override vencido ou inválido: os editais congelados ficaram de fora."
    return f"Override do administrador global registrado nesta execução: {', '.join(editais)}."


def com_nao_encontrados(codigo, contexto):
    """Edital pedido que não existe não é sucesso: a execução sai parcial (2), salvo se já falhou."""
    return execucao.PARCIAL if codigo == execucao.CONCLUIDA and contexto.get("nao_encontrados") else codigo


def principal(args, configuracao=None, chamar_rpc=None):
    cfg = configuracao or supabase_rpc.configuracao(GUIA)
    chamar_rpc = chamar_rpc or supabase_rpc.chamar

    def chamar(funcao, corpo, **opcoes):
        return chamar_rpc(cfg, funcao, corpo, **opcoes)

    contexto = ler_editais(chamar, args)
    editais = contexto.get("editais") or []
    hoje = contexto.get("hoje")
    cabecalho = []
    # Inscrições congeladas (20261020170000): pedido explícito recusa a execução inteira;
    # no fim do robô e sem --editais, o edital só fica de fora (e aparece no resumo).
    congelados = contexto.get("congelados") or []
    if any(c.get("pedido") for c in congelados):
        execucao.resumir(TITULO, recusa_dos_congelados(congelados))
        return 1
    if congelados:
        cabecalho.append(f"Inscrições congeladas (não recalculado): {rotulos(congelados)}.")
    if args.seco and any(e.get("congelado") for e in editais):
        cabecalho.append(
            "Inscrições congeladas (só calculado no seco; num modo que grava ficaria de fora): "
            + rotulos([e for e in editais if e.get("congelado")])
            + "."
        )
    # No fim do robô, o edital que não mudou desde a última pré-classificação de hoje não é
    # recalculado (20261014220000): nada a ler nem gravar.
    sem_mudanca = [e for e in editais if e.get("sem_mudanca")]
    if sem_mudanca:
        editais = [e for e in editais if not e.get("sem_mudanca")]
        cabecalho.append(
            "Sem mudança desde a última pré-classificação de hoje (não recalculado): "
            + ", ".join(str(e.get("rotulo") or e.get("id")) for e in sem_mudanca)
            + "."
        )
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
        return com_nao_encontrados(2 if any(r["situacao"] == "FALHOU" for r in resultados) else 0, contexto)

    if sem_mudanca and not editais:
        execucao.resumir(TITULO, cabecalho)
        return com_nao_encontrados(0, contexto)

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
            # Sem repetir: se a resposta se perdeu, a 2ª tentativa esbarraria na execução que a 1ª abriu.
            tentativas=1,
        )
    except supabase_rpc.ErroDoSupabase as erro:
        if "55P03" in str(erro) or "em andamento" in str(erro):
            execucao.resumir(TITULO, ["Já há uma pré-classificação em andamento; esta não rodou."])
            return 1
        raise
    log.info("Execução %s (disparo %s, %s edital(is)).", id_execucao, tipo.lower(), len(editais))
    linha_do_override = usar_liberacao(chamar, args.forcar_congelado, id_execucao)
    if linha_do_override:
        log.info("%s", linha_do_override)
        cabecalho.append(linha_do_override)

    resultados = []
    try:
        # Cancelamento ou tempo esgotado no GitHub (SIGTERM/SIGINT): ExecucaoInterrompida passa pelo
        # except de cada edital e cai aqui, que fecha a execução com erro.
        with execucao.interromper_com_excecao():
            processar_editais(chamar, id_execucao, editais, hoje, args, resultados)
    except (Exception, execucao.ExecucaoInterrompida) as erro:
        mensagem = resumo_do_erro(erro)
        try:
            chamar(
                "finalizar_pre_classificacao",
                {"p_execucao": id_execucao, "p_editais": [], "p_erro": mensagem},
                tentativas=1,
            )
        except Exception as erro_ao_fechar:
            log.error("Também não consegui fechar a execução: %s", resumo_do_erro(erro_ao_fechar))
        execucao.resumir(TITULO, [f"Execução {id_execucao} FALHOU: {mensagem}"])
        return 1

    fim = (
        chamar(
            "finalizar_pre_classificacao",
            {"p_execucao": id_execucao, "p_editais": [para_o_banco(r) for r in resultados], "p_erro": None},
            # Sem repetir: se a resposta se perdeu, a execução já pode estar fechada.
            tentativas=1,
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
    return com_nao_encontrados({"CONCLUIDA": 0, "PARCIAL": 2}.get(situacao, 1), contexto)


def processar_editais(chamar, id_execucao, editais, hoje, args, resultados):
    """Calcula e grava edital por edital (em `resultados`); a falha de um edital fica nele (FALHOU)."""
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

        def gravar_sugestoes(codigo, calcular, edital=edital):
            """As sugestões da ficha (calcular() e gravar_sugestoes_da_ficha); falha na conta ou na gravação só vira aviso."""
            try:
                sugestoes = calcular()
                r = (
                    chamar(
                        "gravar_sugestoes_da_ficha",
                        {
                            "p_execucao": id_execucao,
                            "p_edital": edital["id"],
                            "p_vaga": codigo,
                            "p_sugestoes": sugestoes,
                        },
                    )
                    or {}
                )
            except Exception as erro:
                log.warning(
                    "Sugestões da ficha da vaga %s não calculadas ou não gravadas: %s",
                    codigo,
                    resumo_do_erro(erro)[:200],
                )
                return 0
            return int(r.get("candidatos") or 0)

        try:
            resultado = processar_edital(
                chamar,
                edital,
                hoje,
                args.refazer_lote,
                gravar,
                retratar=retrata_hoje(hoje, edital.get("cronograma")),
                gravar_sugestoes=gravar_sugestoes,
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
