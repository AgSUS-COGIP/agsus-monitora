"""
PARIDADE DA CLASSIFICAÇÃO: banco × robô (ferramenta do ensaio, só leitura, sem rede)

Lê da entrada o JSON da seção PARIDADE de
supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql (o que
conferencia_ler_classificacao entregava e o que o robô novo lê, na mesma transação) e confere:
  1. cada vaga distinta (edital, nome) com private."FC_QUADRO_DA_VAGA": a mesma linha do quadro
     por monitora.classificacao.quadro_da_vaga;
  2. vagas_sem_quadro (multiconjunto de edital, área, vaga) igual ao de regras.vagas_sem_quadro;
  3. analises_alteradas (edital -> última atualização) igual a regras.AnalisesDaClassificacao.
Imprime só contagens (o log não leva nome de vaga). Saída 0 = tudo igual; 1 = alguma diferença.

    python -I scripts/conferencias/paridade_do_quadro.py < saida.json
"""

import json
import pathlib
import sys
from collections import Counter

_AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parents[1] / "python"))

import regras  # noqa: E402

from monitora.classificacao.quadro_da_vaga import preparar_quadros, quadro_da_vaga  # noqa: E402


def comparar(dados):
    """Diferenças por item: {"quadro": n, "vagas_sem_quadro": n, "analises_alteradas": n} e totais."""
    if isinstance(dados, list):  # a saída do SQL vem como [{"paridade": {...}}]
        dados = dados[0]["paridade"]
    quadros = preparar_quadros(dados["nova"].get("quadros"))
    diferentes_quadro = sum(
        1
        for edital, nome, esperado in dados.get("quadro_sql") or []
        if quadro_da_vaga(quadros.get(edital), nome) != esperado
    )

    analises = regras.AnalisesDaClassificacao()
    for _ in analises.paginas([dados.get("linhas") or []]):
        pass
    editais = {e["id"]: e for e in dados.get("contexto") or []}
    nova = Counter(
        (v["edital"], v["area"], v["vaga"])
        for v in regras.vagas_sem_quadro(analises, dados["nova"].get("quadros"), editais)
    )
    antiga = Counter((v["edital"], v["area"], v["vaga"]) for v in dados["antiga"].get("vagas_sem_quadro") or [])

    alteradas_antigas = {
        a["edital"]: regras.momento(a.get("alterada_em")) for a in dados["antiga"].get("analises_alteradas") or []
    }
    return {
        "vagas_distintas": len(dados.get("quadro_sql") or []),
        "quadro": diferentes_quadro,
        "vagas_sem_quadro_antes": sum(antiga.values()),
        "vagas_sem_quadro_depois": sum(nova.values()),
        "vagas_sem_quadro": sum(((antiga - nova) + (nova - antiga)).values()),
        "editais_alterados": len(alteradas_antigas),
        "analises_alteradas": 0 if alteradas_antigas == analises.alteradas else 1,
        "listas_e_ajustes_iguais": bool(dados.get("listas_iguais")),
    }


def main():
    r = comparar(json.loads(sys.stdin.buffer.read().decode("utf-8")))
    print(json.dumps(r, ensure_ascii=False))
    ok = (
        r["quadro"] == 0
        and r["vagas_sem_quadro"] == 0
        and r["analises_alteradas"] == 0
        and r["listas_e_ajustes_iguais"]
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
