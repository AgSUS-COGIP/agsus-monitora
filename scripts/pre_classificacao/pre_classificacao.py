"""
PRÉ-CLASSIFICAÇÃO DA AVALIAÇÃO DOCUMENTAL (job Python, fase F2)

Para cada edital, lê do MONITORA (RPCs só do service_role) a regra da avaliação
e os inscritos que o robô da Empregare trouxe em cada vaga — sem o cadastro
(nome, e-mail, CPF, telefone) —, calcula a Lista Geral de Classificação
Provisória por ART (eliminação automática, ordem pela ART com o desempate da
regra, nota declarada só para conferir) e o lote de convocação ("a linha anda")
com python/monitora/avaliacao_documental/, e GRAVA O RESULTADO PRONTO
(gravar_pre_classificacao_vaga). O banco valida e serve; a tela só lê.
Migration: supabase/migrations/20261006110000_pre_classificacao_e_lote.sql.

Roda pelo GitHub Actions (.github/workflows/pre-classificacao.yml): pelo
"Recalcular" da aba Pré-classificação e pelo "Rodar agora" das Configurações
(api/rodar-carga.js), pelo "Run workflow" e, sozinho, no fim do robô da
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
from monitora.avaliacao_documental.pre_classificacao import (  # noqa: E402
    normalizar_regra,
    pre_classificar_vaga,
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


def dados_da_vaga(vaga):
    quadro = vaga.get("quadro") or None
    return {
        "codigo": vaga.get("codigo"),
        "vagas_imediatas": quadro.get("vagas_imediatas") if quadro else None,
        "cadastro_reserva": bool(quadro and quadro.get("cadastro_reserva")),
        "modalidades": quadro.get("modalidades") if quadro else None,
    }


def situacao_da_regra(edital):
    regra = edital.get("regra")
    if not regra:
        return "SEM_REGRA"
    if regra.get("situacao") != "CONFERIDA":
        return "REGRA_NAO_CONFERIDA"
    return None


def processar_edital(chamar, edital, hoje, refazer, gravar):
    """
    Pré-classifica as vagas de um edital. gravar = função (vaga, resultado) ou
    None (modo seco). Devolve o resultado do edital (só códigos e contagens).
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
        "divergencias": 0,
        "avisos": [],
    }
    situacao = situacao_da_regra(edital)
    if situacao and (gravar is not None or situacao == "SEM_REGRA"):
        resultado["situacao"] = situacao
        resultado["inscritos"] = sum(int(v.get("candidatos_ativos") or 0) for v in vagas)
        return resultado
    if not vagas:
        resultado["situacao"] = "SEM_VAGAS"
        return resultado
    if situacao == "REGRA_NAO_CONFERIDA":
        resultado["situacao"] = "PREVIA"
    if refazer and not edital.get("refazer_permitido", True):
        refazer = False
        resultado["avisos"].append("REFAZER_RECUSADO")

    regra = normalizar_regra(edital["regra"].get("configuracao"))
    avisos = Counter()
    for vaga in vagas:
        lidos = chamar("pre_classificacao_ler_candidatos", {"p_edital": edital["id"], "p_vaga": vaga["codigo"]}) or {}
        r = pre_classificar_vaga(
            regra,
            dados_da_vaga(vaga),
            lidos.get("candidatos") or [],
            anterior=lidos.get("anterior") or {},
            ultimo_lote=vaga.get("ultimo_lote") or 0,
            refazer=refazer,
            hoje=hoje,
        )
        resumo = r["resumo"]
        if gravar is not None:
            gravar(vaga["codigo"], r)
        for chave in ("inscritos", "eliminados", "ranqueados", "no_lote", "divergencias"):
            resultado[chave] += int(resumo[chave] or 0)
        avisos.update(resumo["avisos"])
        log.info(
            "Edital %s · vaga %s: %s inscritos, %s eliminados, %s no lote (tamanho %s).",
            resultado["rotulo"],
            vaga["codigo"],
            resumo["inscritos"],
            resumo["eliminados"],
            resumo["no_lote"],
            resumo["tamanho"] if resumo["tamanho"] is not None else "sem quadro",
        )
    resultado["avisos"] = sorted(set(resultado["avisos"]) | set(avisos))
    resultado["avisos_por_vaga"] = dict(sorted(avisos.items()))
    return resultado


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
        return f"{rotulo}: {EXPLICACOES[r['situacao']]}{extra}."
    if r["situacao"] == "FALHOU":
        return f"{rotulo}: FALHOU — {r.get('mensagem') or 'erro'}."
    prefixo = f"{rotulo}: {EXPLICACOES['PREVIA']} — " if r["situacao"] == "PREVIA" else f"{rotulo}: "
    avisos = r.get("avisos_por_vaga") or {}
    texto_avisos = (
        " · avisos: " + ", ".join(f"{c} ({n} vaga(s))" for c, n in avisos.items())
        if avisos
        else (" · avisos: " + ", ".join(r["avisos"]) if r["avisos"] else "")
    )
    return (
        f"{prefixo}{r['vagas']} vaga(s) · {r['inscritos']} inscritos · {r['eliminados']} eliminados · "
        f"{r['ranqueados']} na Provisória · {r['no_lote']} no lote · {r['divergencias']} divergência(s) ART × declarada"
        f"{texto_avisos}."
    )


def para_o_banco(r):
    """O resultado do edital que vai ao log do banco (sem os avisos por vaga)."""
    return {k: v for k, v in r.items() if k != "avisos_por_vaga"}


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
                resultados.append(processar_edital(chamar, edital, hoje, args.refazer_lote, gravar))
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
