"""
RESUMO DAS PERGUNTAS DA CARGA (robô da Empregare → MONITORA)

Depois de cada carga, o robô recalcula, em Python, o resumo das perguntas dos
editais cuja carga mudou e grava pronto; a Avaliação documental só lê
(obter_perguntas_carga_analise). A conta e a regra de privacidade estão em
python/monitora/avaliacao_documental/perguntas_da_carga.py.

RPCs (só service_role; supabase/migrations/20261009180000_resumo_das_perguntas_da_carga.sql):
  listar_resumos_pergunta_pendentes(p_editais, p_forcar)
      os editais cujo resumo está velho (a assinatura das vagas GRAVADA mudou)
      ou sem resumo; com p_forcar, todos os que têm carga. Por edital: id,
      número, assinatura, vagas e as colunas de pergunta das vagas.
  ler_respostas_pergunta_vaga(p_vaga)
      as respostas cruas dos candidatos ativos da vaga (só as colunas de
      pergunta, sem espaços nas pontas, até 200 caracteres). Uma vaga por
      chamada, para cada resposta ficar pequena.
  gravar_resumo_pergunta_edital(p_edital, p_hash, p_perguntas, p_candidatos)
      confere o formato e grava; se a carga mudou no meio (assinatura
      diferente), recusa com 40001 e o edital fica para a próxima vez.

O log é público: só números de edital e contagens.
"""

from monitora import supabase_rpc
from monitora.avaliacao_documental.perguntas_da_carga import resumir_perguntas
from monitora.mascaramento import resumo_do_erro


def resumir_editais(config, registrar, chamar=supabase_rpc.chamar, editais=None, forcar=False):
    """Recalcula e grava os resumos pendentes. Devolve (recalculados, falhas)."""
    pendentes = (
        chamar(
            config,
            "listar_resumos_pergunta_pendentes",
            {"p_editais": editais or None, "p_forcar": bool(forcar)},
        )
        or {}
    ).get("editais") or []
    recalculados = falhas = 0
    for edital in pendentes:
        numero = edital.get("numero") or "sem número"
        try:
            linhas = []
            candidatos = 0
            for vaga in edital.get("vagas") or []:
                lido = chamar(config, "ler_respostas_pergunta_vaga", {"p_vaga": vaga}) or {}
                linhas.extend(lido.get("linhas") or [])
                candidatos += int(lido.get("candidatos") or 0)
            perguntas = resumir_perguntas(edital.get("colunas") or [], linhas)
            chamar(
                config,
                "gravar_resumo_pergunta_edital",
                {
                    "p_edital": edital["edital"],
                    "p_hash": edital["hash"],
                    "p_perguntas": perguntas,
                    "p_candidatos": candidatos,
                },
                tentativas=1,
            )
            recalculados += 1
            registrar(
                f"Perguntas da carga do edital {numero}: {len(perguntas)} pergunta(s), {candidatos} candidato(s)."
            )
        except supabase_rpc.ErroDoSupabase as erro:
            falhas += 1
            if "40001" in str(erro):
                registrar(f"Perguntas da carga do edital {numero}: a carga mudou no meio; fica para a próxima.")
            else:
                registrar(f"Perguntas da carga do edital {numero}: o banco recusou ({erro}).")
        except Exception as erro:
            falhas += 1
            registrar(f"Perguntas da carga do edital {numero}: falhou ({resumo_do_erro(erro)}).")
    return recalculados, falhas
